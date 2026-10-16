import { type TypedSQL, withTypes } from '@ilbertt/bun-sqlgen';
import type { SQL } from 'bun';
import type { Queries } from '#backend/queries.gen.ts';
import type { GuestScope } from '#backend/repositories/invitations/repository.ts';

type CaptureInput = GuestScope & {
  id: string;
  linkToken: string;
  image: Uint8Array;
  mediaType: string;
  createdAt: string;
};

export interface InvitationCapturesRepositoryContract {
  save(input: CaptureInput): Promise<boolean>;
  list(
    input: GuestScope & { cursor?: string; limit: number },
  ): Promise<{ id: string; createdAt: string; authorized: boolean | null }[]>;
  reject(input: GuestScope & { id: string }): Promise<void>;
  image(
    input: GuestScope & { id: string },
  ): Promise<{ image: Uint8Array; mediaType: string } | null>;
}

export class InvitationCapturesRepository implements InvitationCapturesRepositoryContract {
  private readonly sql: TypedSQL<Queries>;

  constructor(database: SQL) {
    this.sql = withTypes<Queries>(database);
  }

  async list(input: GuestScope & { cursor?: string; limit: number }) {
    const rows = await this.sql.ListInvitationCaptures`
      select id, created_at, authorized from invitation_capture
      where owner_id = ${input.ownerId} and guest_id = ${input.guestId}
        and (${input.cursor ?? null} is null or (created_at, id) < (
          select created_at, id from invitation_capture
          where owner_id = ${input.ownerId} and guest_id = ${input.guestId} and id = ${input.cursor ?? null}
        ))
      order by created_at desc, id desc
      limit ${input.limit}
    `;
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      authorized: row.authorized === null ? null : Boolean(row.authorized),
    }));
  }

  async reject(input: GuestScope & { id: string }) {
    await this.sql.RejectInvitationCapture`
      update invitation_capture set authorized = 0
      where owner_id = ${input.ownerId} and guest_id = ${input.guestId} and id = ${input.id}
        and authorized is null
    `;
  }

  async image(input: GuestScope & { id: string }) {
    const [row] = await this.sql.InvitationCaptureImage`
      select image, media_type from invitation_capture
      where owner_id = ${input.ownerId} and guest_id = ${input.guestId} and id = ${input.id}
    `;
    return row ? { image: row.image, mediaType: row.media_type } : null;
  }

  async save(input: CaptureInput) {
    const rows = await this.sql.SaveInvitationCapture`
      insert into invitation_capture (id, owner_id, guest_id, image, media_type, created_at)
      select ${input.id}, g.owner_id, g.id, ${input.image}, ${input.mediaType}, ${input.createdAt}
      from invitation_guest g
      where g.owner_id = ${input.ownerId} and g.id = ${input.guestId}
        and g.token = ${input.linkToken} and g.active = 1
        and exists (select 1 from invitation_reference p where p.owner_id = g.owner_id and p.guest_id = g.id)
      returning id
    `;
    return rows.length > 0;
  }
}
