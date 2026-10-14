import { type TypedSQL, withTypes } from '@ilbertt/bun-sqlgen';
import type { SQL } from 'bun';
import type { WeddingSettings } from '#backend/models/wedding/model.ts';
import type { Queries } from '#backend/queries.gen.ts';

export interface WeddingRepositoryContract {
  get(input: { ownerId: string }): Promise<WeddingSettings | null>;
  save(input: { ownerId: string; settings: WeddingSettings }): Promise<void>;
}
export class WeddingRepository implements WeddingRepositoryContract {
  private readonly sql: TypedSQL<Queries>;
  constructor(database: SQL) {
    this.sql = withTypes<Queries>(database);
  }
  async get({ ownerId }: { ownerId: string }) {
    const rows = await this.sql.GetWeddingSettings`
      /* @type coupleNames string */
      /* @type date string */
      select couple_names as "coupleNames", ceremony_date as "date"
      from wedding_settings where owner_id = ${ownerId}
    `;
    return rows[0] ?? null;
  }
  async save({ ownerId, settings }: { ownerId: string; settings: WeddingSettings }) {
    await this.sql.SaveWeddingSettings`
      insert into wedding_settings (owner_id, couple_names, ceremony_date)
      values (${ownerId}, ${settings.coupleNames}, ${settings.date})
      on conflict (owner_id) do update set couple_names = excluded.couple_names, ceremony_date = excluded.ceremony_date
    `;
  }
}
