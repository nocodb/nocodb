import Noco from '../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import View from './View';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';
import { BoolType, KanbanColumnType } from 'nocodb-sdk';

export default class KanbanViewColumn implements KanbanColumnType {
  id: string;
  title?: string;
  show?: BoolType;
  order?: number;

  fk_view_id: string;
  fk_column_id: string;
  project_id?: string;
  base_id?: string;

  constructor(data: KanbanViewColumn) {
    Object.assign(this, data);
  }

  public static async get(kanbanViewColumnId: string, ncMeta = Noco.ncMeta) {
    let view =
      kanbanViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW_COLUMN}:${kanbanViewColumnId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.KANBAN_VIEW_COLUMNS,
        kanbanViewColumnId
      );
      await NocoCache.set(
        `${CacheScope.KANBAN_VIEW_COLUMN}:${kanbanViewColumnId}`,
        view
      );
    }
    return view && new KanbanViewColumn(view);
  }
  static async insert(column: Partial<KanbanViewColumn>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'project_id',
      'base_id',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.KANBAN_VIEW_COLUMNS,
      {
        fk_view_id: column.fk_view_id,
      }
    );

    if (!(column.project_id && column.base_id)) {
      const viewRef = await View.get(column.fk_view_id, ncMeta);
      insertObj.project_id = viewRef.project_id;
      insertObj.base_id = viewRef.base_id;
    }

    const { id, fk_column_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.KANBAN_VIEW_COLUMNS,
      insertObj
    );

    await NocoCache.set(`${CacheScope.KANBAN_VIEW_COLUMN}:${fk_column_id}`, id);

    await NocoCache.appendToList(
      CacheScope.KANBAN_VIEW_COLUMN,
      [column.fk_view_id],
      `${CacheScope.KANBAN_VIEW_COLUMN}:${id}`
    );

    return this.get(id, ncMeta);
  }

  public static async list(
    viewId: string,
    ncMeta = Noco.ncMeta
  ): Promise<KanbanViewColumn[]> {
    let views = await NocoCache.getList(CacheScope.KANBAN_VIEW_COLUMN, [
      viewId,
    ]);
    if (!views.length) {
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
        }
      );
      await NocoCache.setList(CacheScope.KANBAN_VIEW_COLUMN, [viewId], views);
    }
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity)
    );
    return views?.map((v) => new KanbanViewColumn(v));
  }
}
