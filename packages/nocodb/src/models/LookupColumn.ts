import type { LookupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class LookupColumn implements LookupType {
  fk_relation_column_id: string;
  fk_lookup_column_id: string;
  fk_column_id: string;

  constructor(data: Partial<LookupColumn>) {
    Object.assign(this, data);
  }

  public async getRelationColumn(context: NcContext): Promise<Column> {
    return await Column.get(context, {
      colId: this.fk_relation_column_id,
    });
  }

  public async getLookupColumn(context: NcContext): Promise<Column> {
    return await Column.get(context, {
      colId: this.fk_lookup_column_id,
    });
  }

  public static async insert(
    context: NcContext,
    data: Partial<LookupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_column_id',
      'fk_relation_column_id',
      'fk_lookup_column_id',
    ]);

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LOOKUP,
      insertObj,
    );

    return this.read(context, data.fk_column_id, ncMeta).then(
      async (lookupColumn) => {
        await NocoCache.appendToList(
          CacheScope.COL_LOOKUP,
          [data.fk_lookup_column_id],
          `${CacheScope.COL_LOOKUP}:${data.fk_column_id}`,
        );

        await NocoCache.appendToList(
          CacheScope.COL_LOOKUP,
          [data.fk_relation_column_id],
          `${CacheScope.COL_LOOKUP}:${data.fk_column_id}`,
        );

        return lookupColumn;
      },
    );
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let colData =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_LOOKUP}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LOOKUP,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_LOOKUP}:${columnId}`, colData);
    }
    return colData ? new LookupColumn(colData) : null;
  }

  id: string;
}
