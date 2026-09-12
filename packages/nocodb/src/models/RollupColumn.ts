import type { RollupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import {
  getModelContext,
  setModelContext,
  throwMissingContext,
} from '~/helpers/modelContext';

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
  error: string;

  constructor(data: Partial<RollupColumn>) {
    Object.assign(this, data);
  }

  get context(): NcContext {
    const ctx = getModelContext(this);
    if (ctx) return ctx;
    if (this.fk_workspace_id && this.base_id) {
      return {
        workspace_id: this.fk_workspace_id,
        base_id: this.base_id,
      } as NcContext;
    }
    throwMissingContext('RollupColumn');
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
      'error',
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
          context,
          CacheScope.COL_ROLLUP,
          [data.fk_rollup_column_id],
          `${CacheScope.COL_ROLLUP}:${data.fk_column_id}`,
        );

        await NocoCache.appendToList(
          context,
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
        context,
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
      await NocoCache.set(
        context,
        `${CacheScope.COL_ROLLUP}:${columnId}`,
        column,
      );
    }
    if (!column) return null;
    const instance = new RollupColumn(column);
    setModelContext(instance, context);
    return instance;
  }

  public async getRollupColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    // The rollup column lives in the related table, which may be in a different base.
    // Derive refContext from the relation column's LTAR options.
    const relationCol = await this.getRelationColumn(ncMeta);
    const colOpts = await relationCol?.getColOptions<LinkToAnotherRecordColumn>(
      ncMeta,
    );
    const refContext = colOpts
      ? colOpts.getRelContext().refContext
      : this.context;
    return Column.get(refContext, { colId: this.fk_rollup_column_id }, ncMeta);
  }

  public async getRelationColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return Column.get(
      this.context,
      { colId: this.fk_relation_column_id },
      ncMeta,
    );
  }

  public static async update(
    context: NcContext,
    columnId: string,
    data: Partial<RollupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, [
      'fk_column_id',
      'fk_relation_column_id',
      'fk_rollup_column_id',
      'rollup_function',
      'error',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_ROLLUP,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.COL_ROLLUP}:${columnId}`,
      updateObj,
    );
  }
}
