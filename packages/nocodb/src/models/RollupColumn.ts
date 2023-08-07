import type { RollupType } from 'nocodb-sdk';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export const ROLLUP_FUNCTIONS = <const>[
  'count',
  'min',
  'max',
  'avg',
  'countDistinct',
  'sumDistinct',
  'avgDistinct',
];

export default class RollupColumn implements RollupType {
  id: string;
  fk_column_id;
  fk_relation_column_id;
  fk_rollup_column_id;
  rollup_function: (typeof ROLLUP_FUNCTIONS)[number];

  constructor(data: Partial<RollupColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    data: Partial<RollupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_column_id',
      'fk_relation_column_id',
      'fk_rollup_column_id',
      'rollup_function',
    ]);
    await ncMeta.metaInsert2(null, null, MetaTable.COL_ROLLUP, insertObj);

    await NocoCache.appendToList(
      CacheScope.COL_ROLLUP,
      [data.fk_rollup_column_id],
      `${CacheScope.COL_ROLLUP}:${data.fk_column_id}`,
    );

    await NocoCache.appendToList(
      CacheScope.COL_ROLLUP,
      [data.fk_relation_column_id],
      `${CacheScope.COL_ROLLUP}:${data.fk_column_id}`,
    );

    return this.read(data.fk_column_id, ncMeta);
  }

  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_ROLLUP}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_ROLLUP,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_ROLLUP}:${columnId}`, column);
    }
    return column ? new RollupColumn(column) : null;
  }

  public async getRollupColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return Column.get({ colId: this.fk_rollup_column_id }, ncMeta);
  }

  public async getRelationColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return Column.get({ colId: this.fk_relation_column_id }, ncMeta);
  }
}
