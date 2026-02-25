import OutlineViewColumnCE from 'src/models/OutlineViewColumn';
import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class OutlineViewColumn extends OutlineViewColumnCE {
  id: string;
  fk_view_id: string;
  fk_column_id: string;
  fk_level_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  show?: BoolType;
  order?: number;
  width?: string;

  constructor(data: OutlineViewColumn) {
    super(data);
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        context,
        `${CacheScope.OUTLINE_VIEW_COLUMN}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.OUTLINE_VIEW_COLUMNS,
        columnId,
      );

      column = prepareForResponse(column);

      await NocoCache.set(
        context,
        `${CacheScope.OUTLINE_VIEW_COLUMN}:${columnId}`,
        column,
      );
    }

    return column && new OutlineViewColumn(column);
  }

  static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<OutlineViewColumn[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.OUTLINE_VIEW_COLUMN,
      [viewId],
    );
    let { list: columns } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !columns.length) {
      columns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.OUTLINE_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(
        context,
        CacheScope.OUTLINE_VIEW_COLUMN,
        [viewId],
        columns,
      );
    }
    columns.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return columns?.map((c) => new OutlineViewColumn(c));
  }

  static async getNextOrderForLevel(
    context: NcContext,
    viewId: string,
    levelId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    return ncMeta.metaGetNextOrder(MetaTable.OUTLINE_VIEW_COLUMNS, {
      fk_view_id: viewId,
      fk_level_id: levelId,
    });
  }

  static async insert(
    context: NcContext,
    column: Partial<OutlineViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'fk_level_id',
      'show',
      'base_id',
      'source_id',
      'order',
      'width',
    ]);

    if (!(insertObj.base_id && insertObj.source_id)) {
      const viewRef = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.OUTLINE_VIEW,
        { fk_view_id: insertObj.fk_view_id },
      );
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.OUTLINE_VIEW_COLUMNS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (insertedColumn) => {
      await NocoCache.appendToList(
        context,
        CacheScope.OUTLINE_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.OUTLINE_VIEW_COLUMN}:${id}`,
      );
      return insertedColumn;
    });
  }

  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<OutlineViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'show',
      'order',
      'width',
      'fk_level_id',
    ]);

    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.OUTLINE_VIEW_COLUMNS,
      prepareForDb(updateObj),
      columnId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.OUTLINE_VIEW_COLUMN}:${columnId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
