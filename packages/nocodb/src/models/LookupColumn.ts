import type { LookupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import {
  getModelContext,
  setModelContext,
  throwMissingContext,
} from '~/helpers/modelContext';

export default class LookupColumn implements LookupType {
  fk_workspace_id?: string;
  base_id?: string;
  fk_relation_column_id: string;
  fk_lookup_column_id: string;
  fk_column_id: string;
  error: string;

  constructor(data: Partial<LookupColumn>) {
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
    throwMissingContext('LookupColumn');
  }

  public async getRelationColumn(): Promise<Column> {
    return await Column.get(this.context, {
      colId: this.fk_relation_column_id,
    });
  }

  public async getLookupColumn(): Promise<Column> {
    // The lookup column lives in the related table, which may be in a different base.
    // Derive refContext from the relation column's LTAR options.
    const relationCol = await this.getRelationColumn();
    const colOpts =
      await relationCol?.getColOptions<LinkToAnotherRecordColumn>();
    const refContext = colOpts
      ? colOpts.getRelContext().refContext
      : this.context;
    return await Column.get(refContext, {
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
      'error',
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
          context,
          CacheScope.COL_LOOKUP,
          [data.fk_lookup_column_id],
          `${CacheScope.COL_LOOKUP}:${data.fk_column_id}`,
        );

        await NocoCache.appendToList(
          context,
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
        context,
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
      await NocoCache.set(
        context,
        `${CacheScope.COL_LOOKUP}:${columnId}`,
        colData,
      );
    }
    if (!colData) return null;
    const instance = new LookupColumn(colData);
    setModelContext(instance, context);
    return instance;
  }

  id: string;

  public static async update(
    context: NcContext,
    columnId: string,
    data: Partial<LookupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, [
      'fk_column_id',
      'fk_relation_column_id',
      'fk_lookup_column_id',
      'error',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LOOKUP,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.COL_LOOKUP}:${columnId}`,
      updateObj,
    );
  }
}
