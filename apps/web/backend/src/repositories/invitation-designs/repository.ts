import { type TypedSQL, withTypes } from '@ilbertt/bun-sqlgen';
import type { SQL } from 'bun';
import type { Queries } from '#backend/queries.gen.ts';

export interface InvitationDesignsRepositoryContract {
  get(input: { ownerId: string }): Promise<string>;
  save(input: { ownerId: string; packageId: string }): Promise<void>;
}
export class InvitationDesignsRepository implements InvitationDesignsRepositoryContract {
  private readonly sql: TypedSQL<Queries>;
  constructor(input: { database: SQL; defaultPackageId: string }) {
    this.sql = withTypes<Queries>(input.database);
    this.defaultPackageId = input.defaultPackageId;
  }
  private readonly defaultPackageId: string;
  async get(input: { ownerId: string }) {
    const rows = await this.sql
      .GetInvitationDesign`select package_id from invitation_design where owner_id = ${input.ownerId}`;
    return rows[0]?.package_id ?? this.defaultPackageId;
  }
  async save(input: { ownerId: string; packageId: string }) {
    await this.sql
      .SaveInvitationDesign`insert into invitation_design (owner_id, package_id) values (${input.ownerId}, ${input.packageId}) on conflict(owner_id) do update set package_id = excluded.package_id`;
  }
}
