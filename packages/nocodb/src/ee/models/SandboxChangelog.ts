import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';

// App-managed monotonic counter (microsecond clock + intra-tick increment).
// Replay iterates by `seq` ASC. created_at alone has only second precision
// (see meta.service.ts now()) so same-second entries would otherwise replay
// non-deterministically.
let lastSeq = 0;
function nextSeq(): number {
  const now = Date.now() * 1000;
  lastSeq = now > lastSeq ? now : lastSeq + 1;
  return lastSeq;
}

export default class SandboxChangelog {
  id: string;
  seq: number;
  fk_sandbox_id: string;
  base_id: string;
  event: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  parent_entity_id: string;
  parent_entity_title: string;
  description?: string;
  created_by: string;
  meta?: Record<string, any> | string;
  merged_at?: string;
  public status: 'pending' | 'applied' | 'skipped' | 'failed';
  created_at: string;

  constructor(data: Partial<SandboxChangelog>) {
    Object.assign(this, data);
  }

  public static async insert(
    data: Partial<SandboxChangelog>,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxChangelog> {
    const insertObj = extractProps(data, [
      'fk_sandbox_id',
      'base_id',
      'event',
      'entity_type',
      'entity_id',
      'entity_title',
      'parent_entity_id',
      'parent_entity_title',
      'created_by',
      'description',
      'meta',
    ]);

    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    insertObj.seq = nextSeq();

    const result = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_CHANGELOG,
      prepareForDb(insertObj),
    );

    return new SandboxChangelog(prepareForResponse(result));
  }

  public static async listBySandboxId(
    sandboxId: string,
    opts?: { excludeMerged?: boolean },
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxChangelog[]> {
    const knex = ncMeta.knex || Noco.ncMeta.knex;

    let query = knex(MetaTable.SANDBOX_CHANGELOG)
      .where('fk_sandbox_id', sandboxId)
      .orderBy('seq', 'asc');

    if (opts?.excludeMerged) {
      query = query.where('status', 'pending');
    }

    const records = await query;

    if (!records || records.length === 0) return [];

    return records.map((r) => new SandboxChangelog(prepareForResponse(r)));
  }

  public static async listByBaseId(
    baseId: string,
    opts?: { excludeMerged?: boolean },
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxChangelog[]> {
    const knex = ncMeta.knex || Noco.ncMeta.knex;

    let query = knex(MetaTable.SANDBOX_CHANGELOG)
      .where('base_id', baseId)
      .orderBy('seq', 'asc');

    if (opts?.excludeMerged) {
      query = query.where('status', 'pending');
    }

    const records = await query;

    if (!records || records.length === 0) return [];

    return records.map((r) => new SandboxChangelog(prepareForResponse(r)));
  }

  public static async markAsMerged(
    ids: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    if (!ids.length) return;

    const knex = ncMeta.knex || Noco.ncMeta.knex;

    await knex(MetaTable.SANDBOX_CHANGELOG)
      .whereIn('id', ids)
      .update({ merged_at: knex.fn.now(), status: 'applied' });
  }

  public static async markAsSkipped(
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const knex = ncMeta.knex || Noco.ncMeta.knex;
    await knex(MetaTable.SANDBOX_CHANGELOG)
      .where({ id })
      .update({ status: 'skipped' });
  }

  public static async markAsFailed(
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const knex = ncMeta.knex || Noco.ncMeta.knex;
    await knex(MetaTable.SANDBOX_CHANGELOG)
      .where({ id })
      .update({ status: 'failed' });
  }

  public static async deleteBySandboxId(
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_CHANGELOG,
      { fk_sandbox_id: sandboxId },
      undefined,
      true, // force — delete by condition
    );
  }
}
