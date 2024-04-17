import type { BoolType, KanbanColumnType } from 'nocodb-sdk';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class KanbanViewColumn implements KanbanColumnType {
  id: string;
  title?: string;
  show?: BoolType;
  order?: number;

  fk_view_id: string;
  fk_column_id: string;
  base_id?: string;
  source_id?: string;

  constructor(data: KanbanViewColumn) {
    Object.assign(this, data);
  }

  public static async get(kanbanViewColumnId: string, ncMeta = Noco.ncMeta) {
    let view =
      kanbanViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW_COLUMN}:${kanbanViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.KANBAN_VIEW_COLUMNS,
        kanbanViewColumnId,
      );
      await NocoCache.set(
        `${CacheScope.KANBAN_VIEW_COLUMN}:${kanbanViewColumnId}`,
        view,
      );
    }
    return view && new KanbanViewColumn(view);
  }
  static async insert(column: Partial<KanbanViewColumn>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.KANBAN_VIEW_COLUMNS,
      {
        fk_view_id: column.fk_view_id,
      },
    );

    if (!(column.base_id && column.source_id)) {
      const viewRef = await View.get(column.fk_view_id, ncMeta);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.KANBAN_VIEW_COLUMNS,
      insertObj,
    );

    return this.get(id, ncMeta).then(async (kanbanViewColumn) => {
      await NocoCache.appendToList(
        CacheScope.KANBAN_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.KANBAN_VIEW_COLUMN}:${id}`,
      );
      return kanbanViewColumn;
    });
  }

  public static async list(
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<KanbanViewColumn[]> {
    const cachedList = await NocoCache.getList(CacheScope.KANBAN_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(
        null,
        null,
        MetaTable.KANBAN_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.KANBAN_VIEW_COLUMN, [viewId], views);
    }
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return views?.map((v) => new KanbanViewColumn(v));
  }

  // todo: update prop names
  static async update(
    columnId: string,
    body: Partial<KanbanViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['order', 'show']);

    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.KANBAN_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // get existing cache
    const key = `${CacheScope.KANBAN_VIEW_COLUMN}:${columnId}`;
    await NocoCache.update(key, updateObj);

    // on view column update, delete any optimised single query cache
    {
      const viewCol = await this.get(columnId, ncMeta);
      const view = await View.get(viewCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(view.fk_model_id, [view]);
    }

    return res;
  }
}
