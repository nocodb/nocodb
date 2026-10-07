import { UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

// The v3 field API stored these options under camelCase keys that no v2 reader understands.
const KEY_RENAMES: Record<string, string> = {
  dateFormat: 'date_format',
  timeFormat: 'time_format',
  displayTimezone: 'isDisplayTimezone',
};

const DATE_UIDTS = [
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
];

type ColumnRow = {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  meta: string | null;
};

const up = async (knex: Knex) => {
  const rows: ColumnRow[] = await knex(MetaTable.COLUMNS)
    .select('id', 'base_id', 'fk_workspace_id', 'meta')
    .whereIn('uidt', DATE_UIDTS)
    .andWhere((qb) => {
      for (const key of Object.keys(KEY_RENAMES)) {
        qb.orWhere('meta', 'like', `%"${key}"%`);
      }
    });

  for (const row of rows) {
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(row.meta ?? '');
    } catch {
      continue;
    }
    if (!meta || typeof meta !== 'object') continue;

    let changed = false;
    for (const [from, to] of Object.entries(KEY_RENAMES)) {
      if (!(from in meta)) continue;
      // An explicit v2 key wins over the stray camelCase copy.
      if (!(to in meta)) meta[to] = meta[from];
      delete meta[from];
      changed = true;
    }
    if (!changed) continue;

    await knex(MetaTable.COLUMNS)
      .where('id', row.id)
      .update({ meta: JSON.stringify(meta) });

    // Knex migrations don't flush the cache; the column list self-heals once its item key is gone.
    await NocoCache.del(
      { workspace_id: row.fk_workspace_id, base_id: row.base_id },
      `${CacheScope.COLUMN}:${row.id}`,
    );
  }
};

const down = async () => {
  // Data heal — the v2 keys are the canonical shape; nothing to revert.
};

export { up, down };
