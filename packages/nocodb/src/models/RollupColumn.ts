import type { RollupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';

export const ROLLUP_FUNCTIONS = <const>[
  'count',
  'min',
  'max',
  'avg',
  'countDistinct',
  'sumDistinct',
  'avgDistinct',
  'sum',
];

export default class RollupColumn implements RollupType {
  id: string;
  base_id?: string;
  fk_workspace_id?: string;
  fk_column_id;
  fk_relation_column_id;
  fk_rollup_column_id;
  rollup_function: (typeof ROLLUP_FUNCTIONS)[number];

  constructor(data: Partial<RollupColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    data: Partial<RollupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_column_id',
      'fk_relation_column_id',
      'fk_rollup_column_id',
      'rollup_function',
    ]);

    const column = await Column.get(
      context,
      {
        colId: insertObj.fk_column_id,
      },
      ncMeta,
    );

    if (!column) {
      NcError.fieldNotFound(insertObj.fk_column_id);
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_ROLLUP,
      insertObj,
    );

    return this.read(context, data.fk_column_id, ncMeta).then(
      async (rollupColumn) => {
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

        return rollupColumn;
      },
    );
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_ROLLUP}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_ROLLUP,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_ROLLUP}:${columnId}`, column);
    }
    return column ? new RollupColumn(column) : null;
  }

  public async getRollupColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return Column.get(context, { colId: this.fk_rollup_column_id }, ncMeta);
  }

  public async getRelationColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return Column.get(context, { colId: this.fk_relation_column_id }, ncMeta);
  }
}
