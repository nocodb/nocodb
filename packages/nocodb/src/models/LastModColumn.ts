import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { Column } from '~/models';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

export interface TrackModificationsColumnOptions {
  triggerColumnIds: string[];
}

export default class LastModColumn {
  id: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_column_id: string;
  fk_trigger_column_id: string;

  constructor(data: Partial<LastModColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    data: { fk_column_id: string; triggerColumnIds: string[] },
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumnOptions> {
    const { fk_column_id, triggerColumnIds } = data;

    // Get the track column to get workspace and base info
    const trackColumn = await Column.get(context, { colId: fk_column_id });
    if (!trackColumn) {
      throw new Error('Track column not found');
    }

    const results = [];

    // Insert each trigger column relationship
    for (const triggerColId of triggerColumnIds) {
      const id = await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LAST_MOD_TRIGGER_COLUMNS,
        {
          fk_column_id,
          fk_trigger_column_id: triggerColId,
          fk_workspace_id: trackColumn.fk_workspace_id,
          base_id: trackColumn.base_id,
        },
      );

      const record = await this.get(context, { id }, ncMeta);
      if (record) results.push(record);
    }

    // Cache the results
    await NocoCache.setList(
      CacheScope.COL_LAST_MOD_TRIGGERS,
      [fk_column_id],
      results.map(({ created_at, updated_at, ...others }) => others),
    );

    return await this.read(context, fk_column_id, ncMeta);
  }

  public static async get(
    context: NcContext,
    { id }: { id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<LastModColumn> {
    const record = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LAST_MOD_TRIGGER_COLUMNS,
      id,
    );

    if (!record) return null;

    return new LastModColumn(record);
  }

  public static async read(
    context: NcContext,
    fk_column_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumnOptions | null> {
    const cachedList = await NocoCache.getList(
      CacheScope.COL_LAST_MOD_TRIGGERS,
      [fk_column_id],
    );
    let { list: columns } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !columns.length) {
      columns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LAST_MOD_TRIGGER_COLUMNS,
        { condition: { fk_column_id } },
      );
      await NocoCache.setList(
        CacheScope.COL_LAST_MOD_TRIGGERS,
        [fk_column_id],
        columns.map(({ created_at, updated_at, ...others }) => others),
      );
    }

    return columns?.length
      ? {
          triggerColumnIds: columns.map((c) => c.fk_trigger_column_id),
        }
      : {
          triggerColumnIds: [],
        };
  }
}
