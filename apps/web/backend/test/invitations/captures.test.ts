import { expect, test } from 'bun:test';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import { FaceAnalysisError } from '#backend/lib/faces/errors.ts';
import { opaqueId } from '#backend/lib/opaque-id.ts';
import { MAX_PHOTO_BYTES } from '#backend/models/invitations/model.ts';
import { InvitationCapturesRepository } from '#backend/repositories/invitations/captures.ts';
import { cookies, fixture, observation, photo, upload } from './fixture.ts';

const SUCCESS = 200;
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const INTERNAL_ERROR = 500;
const REFERENCE = 1;
const MISMATCH = 3;
const SELFIE = 4;
const NO_FACE = 5;
const actor = { userId: OWNER_USER_ID };
const settings = { name: 'Ada Lovelace', groupName: '', maxGuests: 0 };
type CaptureRow = {
  id: string;
  owner_id: string;
  guest_id: string;
  image: Uint8Array;
  media_type: string;
  created_at: string;
};

function photoUpload(file: File) {
  const body = new FormData();
  body.set('photo', file);
  return body;
}

test('submitted selfies are retained independently of match results and reference photos', async () => {
  const f = await fixture({
    faces: {
      analyze: ({ image }) => {
        const id = image.at(-1)!;
        if (id === NO_FACE) {
          return Promise.reject(new FaceAnalysisError({ code: 'no_face', message: 'No face.' }));
        }
        return Promise.resolve(observation(id));
      },
    },
  });
  try {
    const owner = await f.admin();
    const guest = await f.management.create({ actor, settings, photos: [photo(REFERENCE)] });
    const storedGuest = (await f.guests.get({ ownerId: actor.userId, publicId: guest.id }))!;
    const route = `/api/invitations/${guest.token}`;
    const noFace = new File(
      [Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from([NO_FACE])])],
      'selfie.png',
      { type: 'application/octet-stream' },
    );
    const attempts = [
      { file: photo(SELFIE), status: SUCCESS, mediaType: 'image/jpeg' },
      { file: photo(MISMATCH), status: FORBIDDEN, mediaType: 'image/jpeg' },
      { file: photo(REFERENCE), status: FORBIDDEN, mediaType: 'image/jpeg' },
      { file: noFace, status: BAD_REQUEST, mediaType: 'image/png' },
    ];
    const started = new Date().toISOString();
    for (const attempt of attempts) {
      const response = await f.request({
        path: `${route}/verify`,
        method: 'POST',
        body: photoUpload(attempt.file),
      });
      expect(response.status).toBe(attempt.status);
      if (attempt.status === SUCCESS) {
        expect(
          (await f.request({ path: `${route}/content`, cookie: cookies(response) })).status,
        ).toBe(SUCCESS);
      } else {
        expect(response.headers.get('set-cookie')).toBeNull();
      }
    }
    const finished = new Date().toISOString();
    const captures = await f.database<
      CaptureRow[]
    >`select * from invitation_capture order by rowid`;
    expect(captures).toHaveLength(attempts.length);
    expect(new Set(captures.map((capture) => capture.id)).size).toBe(attempts.length);
    for (const [index, capture] of captures.entries()) {
      expect(capture.owner_id).toBe(actor.userId);
      expect(capture.guest_id).toBe(storedGuest.id);
      expect(capture.media_type).toBe(attempts[index]!.mediaType);
      expect(capture.image).toEqual(new Uint8Array(await attempts[index]!.file.arrayBuffer()));
      expect(new Date(capture.created_at).toISOString()).toBe(capture.created_at);
      expect(capture.created_at >= started && capture.created_at <= finished).toBe(true);
    }
    expect(await f.management.get({ actor, id: guest.id })).toEqual({
      ...guest,
      activity: {
        ...guest.activity,
        verifiedAt: expect.any(String),
        verificationFailedAt: expect.any(String),
      },
    });
    const avatar = await f.request({
      path: `/api/admin/guests/${guest.id}/photos/${guest.references[0]!.id}`,
      cookie: owner,
    });
    expect(new Uint8Array(await avatar.arrayBuffer())).toEqual(
      new Uint8Array(await photo(REFERENCE).arrayBuffer()),
    );
  } finally {
    await f.close();
  }
});

test('invalid links, rejected uploads, and guests without references do not collect captures', async () => {
  const f = await fixture();
  try {
    await f.admin();
    const direct = await f.management.create({ actor, settings });
    expect(
      (
        await f.request({
          path: `/api/invitations/${direct.token}/verify`,
          method: 'POST',
          body: upload(SELFIE),
        })
      ).status,
    ).toBe(SUCCESS);
    const guest = await f.management.create({ actor, settings, photos: [photo(REFERENCE)] });
    const verify = (file: File) =>
      f.request({
        path: `/api/invitations/${guest.token}/verify`,
        method: 'POST',
        body: photoUpload(file),
      });
    expect(
      (await verify(new File(['not an image'], 'bad.jpg', { type: 'image/jpeg' }))).status,
    ).toBe(BAD_REQUEST);
    expect(
      (await verify(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'large.jpg'))).status,
    ).toBe(BAD_REQUEST);
    expect(
      (
        await f.request({
          path: `/api/invitations/${guest.token}/verify`,
          method: 'POST',
          origin: 'https://elsewhere.invalid',
          body: upload(SELFIE),
        })
      ).status,
    ).toBe(FORBIDDEN);
    await f.management.setAccess({ actor, id: guest.id, active: false });
    expect((await verify(photo(SELFIE))).status).toBe(NOT_FOUND);
    await f.management.setAccess({ actor, id: guest.id, active: true });
    await f.management.rotate({ actor, id: guest.id });
    expect((await verify(photo(SELFIE))).status).toBe(NOT_FOUND);
    expect(
      (
        await f.request({
          path: `/api/invitations/${opaqueId()}/verify`,
          method: 'POST',
          body: upload(SELFIE),
        })
      ).status,
    ).toBe(NOT_FOUND);
    expect(await f.database`select id from invitation_capture`).toHaveLength(0);
  } finally {
    await f.close();
  }
});

test('capture writes enforce current owner, guest, link and face-check state and cascade with their owner', async () => {
  const f = await fixture();
  try {
    await f.admin();
    await f.admin('outsider');
    const guest = await f.management.create({ actor, settings, photos: [photo(REFERENCE)] });
    const other = await f.management.create({ actor, settings, photos: [photo(REFERENCE)] });
    const storedGuest = (await f.guests.get({ ownerId: actor.userId, publicId: guest.id }))!;
    const storedOther = (await f.guests.get({ ownerId: actor.userId, publicId: other.id }))!;
    const captures = new InvitationCapturesRepository(f.database);
    const input = {
      id: 'capture',
      ownerId: actor.userId,
      guestId: storedGuest.id,
      linkToken: guest.token,
      image: new Uint8Array(await photo(SELFIE).arrayBuffer()),
      mediaType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    };
    expect(await captures.save({ ...input, ownerId: 'outsider' })).toBe(false);
    expect(await captures.save({ ...input, guestId: storedOther.id })).toBe(false);
    expect(await captures.save({ ...input, linkToken: 'previous-token' })).toBe(false);
    await f.management.setAccess({ actor, id: guest.id, active: false });
    expect(await captures.save(input)).toBe(false);
    await f.management.setAccess({ actor, id: guest.id, active: true });
    await f.management.removePhoto({ actor, id: guest.id, photoId: guest.references[0]!.id });
    expect(await captures.save(input)).toBe(false);
    await f.management.addPhoto({ actor, id: guest.id, photo: photo(REFERENCE) });
    expect(await captures.save(input)).toBe(true);
    expect(
      await captures.save({
        ...input,
        id: 'other-capture',
        guestId: storedOther.id,
        linkToken: other.token,
      }),
    ).toBe(true);
    await expect(
      Promise.resolve(f.database`insert into invitation_capture (id, owner_id, guest_id, image, media_type, created_at)
        values ('wrong-owner', 'outsider', ${storedGuest.id}, ${input.image}, ${input.mediaType}, ${input.createdAt})`),
    ).rejects.toThrow();
    await f.database`delete from invitation_guest where owner_id = ${actor.userId} and id = ${storedGuest.id}`;
    expect(await f.database<{ id: string }[]>`select id from invitation_capture`).toEqual([
      { id: 'other-capture' },
    ]);
    await f.database`delete from auth_user where id = ${actor.userId}`;
    expect(await f.database`select id from invitation_capture`).toHaveLength(0);
  } finally {
    await f.close();
  }
});

test('a failed capture write does not issue a successful authentication session', async () => {
  const f = await fixture();
  try {
    await f.admin();
    const guest = await f.management.create({ actor, settings, photos: [photo(REFERENCE)] });
    await f.database`create trigger fail_capture before insert on invitation_capture
      begin select raise(abort, 'Capture storage unavailable'); end`;
    const response = await f.request({
      path: `/api/invitations/${guest.token}/verify`,
      method: 'POST',
      body: upload(SELFIE),
    });
    expect(response.status).toBe(INTERNAL_ERROR);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await f.database`select id from invitation_capture`).toHaveLength(0);
    expect(await f.database`select token_hash from invitation_session`).toHaveLength(0);
    expect(await f.management.get({ actor, id: guest.id })).toEqual(guest);
  } finally {
    await f.close();
  }
});
