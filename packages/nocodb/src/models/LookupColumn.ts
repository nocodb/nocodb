import type { LookupType } from 'nocodb-sdk';
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

  public async getRelationColumn(): Promise<Column> {
    return await Column.get({
      colId: this.fk_relation_column_id,
    });
  }

  public async getLookupColumn(): Promise<Column> {
    return await Column.get({
      colId: this.fk_lookup_column_id,
    });
  }

  public static async insert(
    data: Partial<LookupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_column_id',
      'fk_relation_column_id',
      'fk_lookup_column_id',
    ]);

    await ncMeta.metaInsert2(null, null, MetaTable.COL_LOOKUP, insertObj);

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

    return this.read(data.fk_column_id, ncMeta);
  }

  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let colData =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_LOOKUP}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_LOOKUP,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_LOOKUP}:${columnId}`, colData);
    }
    return colData ? new LookupColumn(colData) : null;
  }

  id: string;
}
