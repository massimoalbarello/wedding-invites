import { type TypedSQL, withTypes } from '@ilbertt/bun-sqlgen';
import type { SQL } from 'bun';
import { OWNER_USER_ID } from '#backend/lib/auth/owner-registration.ts';
import type { Queries } from '#backend/queries.gen.ts';
export interface AdminRepositoryContract {
  hasOwner(): Promise<boolean>;
}
export class AdminRepository implements AdminRepositoryContract {
  private readonly sql: TypedSQL<Queries>;
  constructor(database: SQL) {
    this.sql = withTypes<Queries>(database);
  }
  async hasOwner() {
    const owners = await this.sql.FindOwner`select id from auth_user where id = ${OWNER_USER_ID}`;
    return owners.length > 0;
  }
}
