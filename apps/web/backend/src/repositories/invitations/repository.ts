import { type TypedSQL, withTypes } from '@ilbertt/bun-sqlgen';
import type { SQL } from 'bun';
import type { FaceObservation } from '#backend/models/faces/model.ts';
import {
  type Guest,
  type GuestListInput,
  type GuestSettings,
  type InvitationStats,
  MAX_REFERENCE_PHOTOS,
  type RsvpStatus,
} from '#backend/models/invitations/model.ts';
import type { Queries } from '#backend/queries.gen.ts';

export type GuestScope = { ownerId: string; guestId: string };
export type StoredReference = { id: string; observation: FaceObservation };
export interface InvitationsRepositoryContract {
  list(input: GuestListInput & { ownerId: string }): Promise<Guest[]>;
  get(input: { ownerId: string; publicId: string }): Promise<Guest | null>;
  byToken(token: string): Promise<Guest | null>;
  create(guest: Guest): Promise<void>;
  update(input: GuestScope & { settings: GuestSettings }): Promise<boolean>;
  stats(ownerId: string): Promise<InvitationStats>;
  groups(ownerId: string): Promise<string[]>;
  setAccess(input: GuestScope & { active: boolean }): Promise<void>;
  rotate(input: GuestScope & { token: string }): Promise<void>;
  revokeSessions(input: GuestScope): Promise<void>;
  addReference(
    input: GuestScope & {
      id: string;
      image: Uint8Array;
      mediaType: string;
      observation: FaceObservation;
      createdAt: string;
    },
  ): Promise<boolean>;
  references(input: GuestScope): Promise<StoredReference[]>;
  referenceImage(
    input: GuestScope & { id: string },
  ): Promise<{ image: Uint8Array; mediaType: string } | null>;
  removeReference(input: GuestScope & { id: string }): Promise<boolean>;
  createSession(
    input: GuestScope & {
      linkToken: string;
      tokenHash: string;
      expiresAt: string;
      faceScanRequired: boolean;
    },
  ): Promise<boolean>;
  hasSession(input: GuestScope & { tokenHash: string; now: string }): Promise<boolean>;
  rsvp(
    input: GuestScope & {
      linkToken: string;
      tokenHash: string;
      now: string;
      status: Exclude<RsvpStatus, 'pending'>;
      companions: { id: string; name: string }[];
    },
  ): Promise<boolean>;
}

export class InvitationsRepository implements InvitationsRepositoryContract {
  private readonly sql: TypedSQL<Queries>;
  constructor(private readonly database: SQL) {
    this.sql = withTypes<Queries>(database);
  }
  async list(input: GuestListInput & { ownerId: string }) {
    const search = input.search ?? '';
    const rows = await this.sql.ListInvitationGuests`
      /* @type id string */
      /* @type owner_id string */
      /* @type name string */
      /* @type created_at string */
      /* @type companions string */
      /* @type references_json string */
      select g.*,
        (select json_group_array(json_object('id', c.id, 'name', c.name)) from invitation_companion c where c.owner_id = g.owner_id and c.guest_id = g.id) as companions,
        (select json_group_array(json_object('id', p.id, 'createdAt', p.created_at)) from invitation_reference p where p.owner_id = g.owner_id and p.guest_id = g.id) as references_json
      from invitation_guest g
      where g.owner_id = ${input.ownerId}
        and (${input.cursor ?? null} is null or g.public_id > ${input.cursor ?? null})
        and (${input.status ?? null} is null or g.status = ${input.status ?? null})
        and (${input.group ?? null} is null or g.group_name = ${input.group ?? null})
        and (${search} = '' or instr(lower(g.name), lower(${search})) > 0 or instr(lower(g.group_name), lower(${search})) > 0
          or exists (select 1 from invitation_companion c where c.owner_id = g.owner_id and c.guest_id = g.id and instr(lower(c.name), lower(${search})) > 0))
      order by g.public_id asc limit ${input.limit}
    `;
    return rows.map(mapGuest);
  }
  async get({ ownerId, publicId }: { ownerId: string; publicId: string }) {
    const rows = await this.sql.InvitationGuestById`
      /* @type id string */
      /* @type owner_id string */
      /* @type name string */
      /* @type created_at string */
      /* @type companions string */
      /* @type references_json string */
      select g.*,
        (select json_group_array(json_object('id', c.id, 'name', c.name)) from invitation_companion c where c.owner_id = g.owner_id and c.guest_id = g.id) as companions,
        (select json_group_array(json_object('id', p.id, 'createdAt', p.created_at)) from invitation_reference p where p.owner_id = g.owner_id and p.guest_id = g.id) as references_json
      from invitation_guest g where g.owner_id = ${ownerId} and g.public_id = ${publicId}
    `;
    return rows[0] ? mapGuest(rows[0]) : null;
  }
  async byToken(token: string) {
    const rows = await this.sql.InvitationGuestByToken`
      /* @type id string */
      /* @type owner_id string */
      /* @type name string */
      /* @type created_at string */
      /* @type companions string */
      /* @type references_json string */
      select g.*,
        (select json_group_array(json_object('id', c.id, 'name', c.name)) from invitation_companion c where c.owner_id = g.owner_id and c.guest_id = g.id) as companions,
        (select json_group_array(json_object('id', p.id, 'createdAt', p.created_at)) from invitation_reference p where p.owner_id = g.owner_id and p.guest_id = g.id) as references_json
      from invitation_guest g where g.token = ${token} and g.active = 1
    `;
    return rows[0] ? mapGuest(rows[0]) : null;
  }
  async create(guest: Guest) {
    await this.sql.CreateInvitationGuest`
      insert into invitation_guest (id, public_id, owner_id, token, name, group_name, face_scan_required, max_guests, status, active, created_at)
      values (${guest.id}, ${guest.publicId}, ${guest.ownerId}, ${guest.token}, ${guest.name}, ${guest.groupName}, ${Number(guest.faceScanRequired)}, ${guest.maxGuests}, ${guest.status}, ${Number(guest.active)}, ${guest.createdAt})
    `;
  }
  update(input: GuestScope & { settings: GuestSettings }) {
    return this.database.begin(async (tx) => {
      const sql = withTypes<Queries>(tx);
      await sql.RevokeChangedInvitationMode`
        delete from invitation_session where owner_id = ${input.ownerId} and guest_id = ${input.guestId}
          and exists (select 1 from invitation_guest g where g.owner_id = ${input.ownerId} and g.id = ${input.guestId} and g.face_scan_required <> ${Number(input.settings.faceScanRequired)})
          and ${input.settings.maxGuests} >= (select count(*) from invitation_companion c where c.owner_id = ${input.ownerId} and c.guest_id = ${input.guestId})
      `;
      const rows = await sql.UpdateInvitationGuest`
        update invitation_guest set name = ${input.settings.name}, group_name = ${input.settings.groupName}, face_scan_required = ${Number(input.settings.faceScanRequired)}, max_guests = ${input.settings.maxGuests}
        where owner_id = ${input.ownerId} and id = ${input.guestId}
          and ${input.settings.maxGuests} >= (select count(*) from invitation_companion c where c.owner_id = ${input.ownerId} and c.guest_id = ${input.guestId})
        returning id
      `;
      return rows.length > 0;
    });
  }
  async stats(ownerId: string): Promise<InvitationStats> {
    const rows = await this.sql.InvitationStats`
      /* @type invited number */
      /* @type accepted number */
      /* @type declined number */
      /* @type pending number */
      /* @type companions number */
      select count(*) as invited,
        coalesce(sum(status = 'accepted'), 0) as accepted,
        coalesce(sum(status = 'declined'), 0) as declined,
        coalesce(sum(status = 'pending'), 0) as pending,
        (select count(*) from invitation_companion c join invitation_guest g on c.guest_id = g.id and c.owner_id = g.owner_id where c.owner_id = ${ownerId} and g.status = 'accepted') as companions
      from invitation_guest where owner_id = ${ownerId}
    `;
    const row = rows[0]!;
    return { ...row, attending: row.accepted + row.companions };
  }
  async groups(ownerId: string) {
    const rows = await this.sql.InvitationGroups`
      select distinct group_name from invitation_guest where owner_id = ${ownerId} and group_name <> '' order by group_name collate nocase
    `;
    return rows.map((row) => row.group_name);
  }
  async setAccess(input: GuestScope & { active: boolean }) {
    await this.database.begin(async (tx) => {
      const sql = withTypes<Queries>(tx);
      await sql.SetInvitationAccess`update invitation_guest set active = ${Number(input.active)} where owner_id = ${input.ownerId} and id = ${input.guestId}`;
      await sql.RevokeInvitationAccessSessions`delete from invitation_session where owner_id = ${input.ownerId} and guest_id = ${input.guestId}`;
    });
  }
  async rotate(input: GuestScope & { token: string }) {
    await this.database.begin(async (tx) => {
      const sql = withTypes<Queries>(tx);
      await sql.RotateInvitationLink`update invitation_guest set token = ${input.token} where owner_id = ${input.ownerId} and id = ${input.guestId}`;
      await sql.RevokeRotatedInvitationSessions`delete from invitation_session where owner_id = ${input.ownerId} and guest_id = ${input.guestId}`;
    });
  }
  async revokeSessions(input: GuestScope) {
    await this.sql
      .RevokeInvitationSessions`delete from invitation_session where owner_id = ${input.ownerId} and guest_id = ${input.guestId}`;
  }
  async addReference(
    input: GuestScope & {
      id: string;
      image: Uint8Array;
      mediaType: string;
      observation: FaceObservation;
      createdAt: string;
    },
  ) {
    const rows = await this.sql.AddInvitationReference`
      insert into invitation_reference (id, owner_id, guest_id, image, media_type, observation, created_at)
      select ${input.id}, ${input.ownerId}, ${input.guestId}, ${input.image}, ${input.mediaType}, ${JSON.stringify(input.observation)}, ${input.createdAt}
      where (select count(*) from invitation_reference where owner_id = ${input.ownerId} and guest_id = ${input.guestId}) < ${MAX_REFERENCE_PHOTOS}
      returning id
    `;
    return rows.length > 0;
  }
  async references(input: GuestScope) {
    const rows = await this.sql
      .InvitationReferenceObservations`select id, observation from invitation_reference where owner_id = ${input.ownerId} and guest_id = ${input.guestId}`;
    return rows.map((row) => ({
      id: row.id,
      observation: JSON.parse(row.observation) as FaceObservation,
    }));
  }
  async referenceImage(input: GuestScope & { id: string }) {
    const rows = await this.sql.InvitationReferenceImage`
      /* @type image Uint8Array */
      select image, media_type from invitation_reference where owner_id = ${input.ownerId} and guest_id = ${input.guestId} and id = ${input.id}
    `;
    const row = rows[0];
    return row ? { image: row.image, mediaType: row.media_type } : null;
  }
  async removeReference(input: GuestScope & { id: string }) {
    const rows = await this.sql
      .RemoveInvitationReference`delete from invitation_reference where owner_id = ${input.ownerId} and guest_id = ${input.guestId} and id = ${input.id} returning id`;
    return rows.length > 0;
  }
  async createSession(
    input: GuestScope & {
      linkToken: string;
      tokenHash: string;
      expiresAt: string;
      faceScanRequired: boolean;
    },
  ) {
    const rows = await this.sql.CreateInvitationSession`
      insert into invitation_session (token_hash, owner_id, guest_id, expires_at)
      select ${input.tokenHash}, owner_id, id, ${input.expiresAt} from invitation_guest
      where owner_id = ${input.ownerId} and id = ${input.guestId} and token = ${input.linkToken} and active = 1 and face_scan_required = ${Number(input.faceScanRequired)}
      returning token_hash
    `;
    return rows.length > 0;
  }
  async hasSession(input: GuestScope & { tokenHash: string; now: string }) {
    const rows = await this.sql.FindInvitationSession`
      select token_hash from invitation_session where token_hash = ${input.tokenHash} and owner_id = ${input.ownerId} and guest_id = ${input.guestId} and expires_at > ${input.now}
    `;
    return rows.length > 0;
  }
  rsvp(
    input: GuestScope & {
      linkToken: string;
      tokenHash: string;
      now: string;
      status: Exclude<RsvpStatus, 'pending'>;
      companions: { id: string; name: string }[];
    },
  ) {
    return this.database.begin(async (tx) => {
      const sql = withTypes<Queries>(tx);
      const rows = await sql.UpdateInvitationRsvp`
        update invitation_guest set status = ${input.status}
        where owner_id = ${input.ownerId} and id = ${input.guestId}
          and token = ${input.linkToken} and active = 1 and max_guests >= ${input.companions.length}
          and exists (
            select 1 from invitation_session s
            where s.owner_id = ${input.ownerId} and s.guest_id = ${input.guestId}
              and s.token_hash = ${input.tokenHash} and s.expires_at > ${input.now}
          )
        returning id
      `;
      if (rows.length === 0) {
        return false;
      }
      await sql.ClearInvitationCompanions`delete from invitation_companion where owner_id = ${input.ownerId} and guest_id = ${input.guestId}`;
      for (const companion of input.companions) {
        await sql.CreateInvitationCompanion`insert into invitation_companion (id, owner_id, guest_id, name) values (${companion.id}, ${input.ownerId}, ${input.guestId}, ${companion.name})`;
      }
      return true;
    });
  }
}

function mapGuest(row: Queries['ListInvitationGuests']): Guest {
  return {
    id: row.id,
    publicId: row.public_id,
    ownerId: row.owner_id,
    token: row.token,
    name: row.name,
    groupName: row.group_name,
    faceScanRequired: Boolean(row.face_scan_required),
    maxGuests: row.max_guests,
    status: row.status as RsvpStatus,
    active: Boolean(row.active),
    createdAt: row.created_at,
    companions: JSON.parse(row.companions),
    references: JSON.parse(row.references_json),
  };
}
