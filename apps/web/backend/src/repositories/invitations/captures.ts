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
}

export class InvitationCapturesRepository implements InvitationCapturesRepositoryContract {
  private readonly sql: TypedSQL<Queries>;

  constructor(database: SQL) {
    this.sql = withTypes<Queries>(database);
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
