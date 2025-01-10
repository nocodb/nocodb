import {
  AppEvents,
  CommonAggregations,
  ExpandedFormMode,
  isSystemColumn,
  parseProp,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type {
  BoolType,
  ColumnReqType,
  ExpandedFormModeType,
  FilterType,
  NcRequest,
  ViewType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Model from '~/models/Model';
import FormView from '~/models/FormView';
import GridView from '~/models/GridView';
import KanbanView from '~/models/KanbanView';
import GalleryView from '~/models/GalleryView';
import CalendarView from '~/models/CalendarView';
import GridViewColumn from '~/models/GridViewColumn';
import CalendarViewColumn from '~/models/CalendarViewColumn';
import CalendarRange from '~/models/CalendarRange';
import Sort from '~/models/Sort';
import Filter from '~/models/Filter';
import GalleryViewColumn from '~/models/GalleryViewColumn';
import FormViewColumn from '~/models/FormViewColumn';
import KanbanViewColumn from '~/models/KanbanViewColumn';
import Column from '~/models/Column';
import MapView from '~/models/MapView';
import MapViewColumn from '~/models/MapViewColumn';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { CustomUrl, LinkToAnotherRecordColumn } from '~/models';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { isEE } from '~/utils';

const { v4: uuidv4 } = require('uuid');

const logger = new Logger('View');

/*
type ViewColumn =
  | GridViewColumn
  | FormViewColumn
  | GalleryViewColumn
  | KanbanViewColumn
  | CalendarViewColumn
  | MapViewColumn;

type ViewColumnEnrichedWithTitleAndName = ViewColumn & {
  title: string;
  name: string;
  dt: string;
};
*/

export default class View implements ViewType {
  id?: string;
  title: string;
  description?: string;
  uuid?: string;
  password?: string;
  show: boolean;
  is_default: boolean;
  order: number;
  type: ViewTypes;
  lock_type?: ViewType['lock_type'];
  created_by?: string;
  owned_by?: string;

  fk_model_id: string;
  model?: Model;
  view?:
    | FormView
    | GridView
    | KanbanView
    | GalleryView
    | MapView
    | CalendarView;
  columns?: Array<
    | FormViewColumn
    | GridViewColumn
    | GalleryViewColumn
    | KanbanViewColumn
    | MapViewColumn
    | CalendarViewColumn
  >;

  sorts: Sort[];
  filter: Filter;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  show_system_fields?: boolean;
  meta?: any;
  fk_custom_url_id?: string;

  constructor(data: View) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        viewId,
      );
      if (view) {
        view.meta = parseMetaProp(view);

        await NocoCache.set(`${CacheScope.VIEW}:${view.id}`, view);
      }
    }

    return view && new View(view);
  }

  public static async getByTitleOrId(
    context: NcContext,
    { fk_model_id, titleOrId }: { titleOrId: string; fk_model_id: string },
    ncMeta = Noco.ncMeta,
  ) {
    const viewId =
      titleOrId &&
      (await NocoCache.get(
        `${CacheScope.VIEW_ALIAS}:${fk_model_id}:${titleOrId}`,
        CacheGetType.TYPE_STRING,
      ));
    if (!viewId) {
      const view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        { fk_model_id },
        null,
        {
          _or: [
            {
              id: {
                eq: titleOrId,
              },
            },
            {
              title: {
                eq: titleOrId,
              },
            },
          ],
        },
      );

      if (view) {
        await NocoCache.set(
          `${CacheScope.VIEW}:${fk_model_id}:${view.id}`,
          view,
        );
        view.meta = parseMetaProp(view);
        // todo: cache - titleOrId can be viewId so we need a different scope here
        await NocoCache.set(
          `${CacheScope.VIEW_ALIAS}:${fk_model_id}:${titleOrId}`,
          view.id,
        );
      }
      return view && new View(view);
    }
    return viewId && this.get(context, viewId?.id || viewId);
  }

  public static async getDefaultView(
    context: NcContext,
    fk_model_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    let view =
      fk_model_id &&
      (await NocoCache.get(
        `${CacheScope.VIEW}:${fk_model_id}:default`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          fk_model_id,
          is_default: 1,
        },
        null,
      );
      if (view) {
        view.meta = parseMetaProp(view);

        await NocoCache.set(`${CacheScope.VIEW}:${fk_model_id}:default`, view);
      }
    }
    return view && new View(view);
  }

  public static async list(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.VIEW, [modelId]);
    let { list: viewsList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !viewsList.length) {
      viewsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          condition: {
            fk_model_id: modelId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      for (const view of viewsList) {
        view.meta = parseMetaProp(view);
      }
      await NocoCache.setList(CacheScope.VIEW, [modelId], viewsList);
    }
    viewsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return viewsList?.map((v) => new View(v));
  }

  // todo: refactor and move duplicate logic to service
  static async insert(
    context: NcContext,
    {
      view,
      req,
    }: {
      view: Partial<View> &
        Partial<
          | FormView
          | GridView
          | GalleryView
          | KanbanView
          | MapView
          | CalendarView
        > & {
          copy_from_id?: string;
          fk_grp_col_id?: string;
          calendar_range?: Partial<CalendarRange>[];
        };
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    let copyFromView: View;
    try {
      const insertObj = extractProps(view, [
        'id',
        'title',
        'is_default',
        'description',
        'type',
        'fk_model_id',
        'base_id',
        'source_id',
        'meta',
      ]);

      // get order value
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.VIEWS, {
        fk_model_id: view.fk_model_id,
      });

      insertObj.show = true;

      if (!insertObj.meta) {
        insertObj.meta = {};
      }

      insertObj.meta = stringifyMetaProp(insertObj);

      const model = await Model.getByIdOrName(
        context,
        { id: view.fk_model_id },
        ncMeta,
      );

      // get base and base id if missing
      if (!view.source_id) {
        insertObj.source_id = model.source_id;
      }

      copyFromView =
        view.copy_from_id &&
        (await View.get(context, view.copy_from_id, ncMeta));
      await copyFromView?.getView(context);

      const { id: view_id } = await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        insertObj,
      );

      let columns: any[] = await (
        await Model.getByIdOrName(context, { id: view.fk_model_id }, ncMeta)
      ).getColumns(context, ncMeta);

      // insert view metadata based on view type
      switch (view.type) {
        case ViewTypes.GRID:
          await GridView.insert(
            context,
            {
              ...((copyFromView?.view as GridView) || {}),
              ...(view as GridView),
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.MAP:
          await MapView.insert(
            context,
            {
              ...(view as MapView),
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.GALLERY:
          await GalleryView.insert(
            context,
            {
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.FORM:
          await FormView.insert(
            context,
            {
              heading: view.title,
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.KANBAN:
          // set grouping field
          (view as KanbanView).fk_grp_col_id = view.fk_grp_col_id;

          await KanbanView.insert(
            context,
            {
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.CALENDAR: {
          const obj = extractProps(view, ['calendar_range']);
          if (!obj.calendar_range) break;
          const calendarRange = obj.calendar_range as Partial<CalendarRange>[];
          calendarRange.forEach((range) => {
            range.fk_view_id = view_id;
          });

          await CalendarView.insert(
            context,
            {
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );

          await CalendarRange.bulkInsert(context, calendarRange, ncMeta);
        }
      }

      if (copyFromView) {
        // generate parent audit id and add it to req object
        const eventId = await ncMeta.genNanoid(MetaTable.AUDIT);
        req.ncParentAuditId = eventId;
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_START, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
          id: eventId,
        });

        const sorts = await copyFromView.getSorts(context, ncMeta);
        const filters = await copyFromView.getFilters(context, ncMeta);
        columns = await copyFromView.getColumns(context, ncMeta);

        for (const sort of sorts) {
          await Sort.insert(
            context,
            {
              ...extractProps(sort, [
                'fk_column_id',
                'direction',
                'base_id',
                'source_id',
                'order',
              ]),
              fk_view_id: view_id,
              id: null,
            },
            ncMeta,
          );
          Noco.appHooksService.emit(AppEvents.SORT_CREATE, {
            sort,
            view: view as ViewType,
            column: await Column.get(context, {
              colId: sort.fk_column_id,
            }),
            req,
            context,
          });
        }

        for (const filter of filters.children) {
          const createdFilter = await Filter.insert(
            context,
            {
              ...extractProps(filter, [
                'id',
                'fk_parent_column_id',
                'fk_column_id',
                'comparison_op',
                'comparison_sub_op',
                'value',
                'fk_parent_id',
                'is_group',
                'logical_op',
                'base_id',
                'source_id',
                'order',
              ]),
              fk_view_id: view_id,
              id: null,
            },
            ncMeta,
          );

          Noco.appHooksService.emit(AppEvents.FILTER_CREATE, {
            filter: createdFilter as FilterType,
            column: await Column.get(context, {
              colId: filter.fk_column_id,
            }),

            view: view as ViewType,
            req,
            context,
          });
        }
      }
      {
        let order = 1;
        let galleryShowLimit = 0;
        let kanbanShowLimit = 0;
        let calendarRanges: Array<string> | null = null;

        if (view.type === ViewTypes.CALENDAR) {
          calendarRanges = await View.getRangeColumnsAsArray(
            context,
            view_id,
            ncMeta,
          );
        }

        if (view.type === ViewTypes.KANBAN && !copyFromView) {
          // sort by display value & attachment first, then by singleLineText & Number
          // so that later we can handle control `show` easily
          columns.sort((a, b) => {
            const displayValueOrder = b.pv - a.pv;
            const attachmentOrder =
              +(b.uidt === UITypes.Attachment) -
              +(a.uidt === UITypes.Attachment);
            const singleLineTextOrder =
              +(b.uidt === UITypes.SingleLineText) -
              +(a.uidt === UITypes.SingleLineText);
            const numberOrder =
              +(b.uidt === UITypes.Number) - +(a.uidt === UITypes.Number);
            const defaultOrder = b.order - a.order;
            return (
              displayValueOrder ||
              attachmentOrder ||
              singleLineTextOrder ||
              numberOrder ||
              defaultOrder
            );
          });
        }

        for (const vCol of columns) {
          let show = 'show' in vCol ? vCol.show : true;
          const underline = false;
          const bold = false;
          const italic = false;

          if (view.type === ViewTypes.GALLERY) {
            const galleryView = await GalleryView.get(context, view_id, ncMeta);
            if (
              vCol.id === galleryView.fk_cover_image_col_id ||
              vCol.pv ||
              galleryShowLimit < 3
            ) {
              show = true;
              galleryShowLimit++;
            } else {
              show = false;
            }
          } else if (view.type === ViewTypes.KANBAN && !copyFromView) {
            const kanbanView = await KanbanView.get(context, view_id, ncMeta);
            if (vCol.id === kanbanView?.fk_grp_col_id) {
              // include grouping field if it exists
              show = true;
            } else if (
              vCol.id === kanbanView.fk_cover_image_col_id ||
              vCol.pv
            ) {
              // Show cover image or primary key
              show = true;
              kanbanShowLimit++;
            } else if (kanbanShowLimit < 3 && !isSystemColumn(vCol)) {
              // show at most 3 non-system columns
              show = true;
              kanbanShowLimit++;
            } else {
              // other columns will be hidden
              show = false;
            }
          } else if (view.type === ViewTypes.CALENDAR && !copyFromView) {
            const calendarView = await CalendarView.get(
              context,
              view_id,
              ncMeta,
            );
            if (calendarRanges && calendarRanges.includes(vCol.id)) {
              show = true;
            } else
              show = vCol.id === calendarView?.fk_cover_image_col_id || vCol.pv;
            // Show all Fields in Ranges
          } else if (view.type === ViewTypes.MAP && !copyFromView) {
            const mapView = await MapView.get(context, view_id, ncMeta);
            if (vCol.id === mapView?.fk_geo_data_col_id) {
              show = true;
            }
          }

          // if columns is list of virtual columns then get the parent column
          const col = vCol.fk_column_id
            ? await Column.get(context, { colId: vCol.fk_column_id }, ncMeta)
            : vCol;

          if (isSystemColumn(col)) show = false;
          await View.insertColumn(
            context,
            {
              order: order++,
              ...col,
              ...vCol,
              view_id,
              fk_column_id: vCol.fk_column_id || vCol.id,
              show,
              underline,
              bold,
              italic,
              id: null,
            },
            ncMeta,
          );
        }
      }

      await Model.getNonDefaultViewsCountAndReset(
        context,
        { modelId: view.fk_model_id },
        ncMeta,
      );

      cleanCommandPaletteCache(context.workspace_id).catch(() => {
        logger.error('Failed to clean command palette cache');
      });

      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_COMPLETE, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
        });
      }
      return View.get(context, view_id, ncMeta).then(async (v) => {
        await NocoCache.appendToList(
          CacheScope.VIEW,
          [view.fk_model_id],
          `${CacheScope.VIEW}:${view_id}`,
        );
        return v;
      });
    } catch (e) {
      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_FAIL, {
          sourceView: copyFromView,
          destView: view as ViewType,
          error: e,
          req,
          context,
        });
      }
      throw e;
    }
  }

  static async getRangeColumnsAsArray(
    context: NcContext,
    viewId: string,
    ncMeta,
  ) {
    const calRange = await CalendarRange.read(context, viewId, ncMeta);
    if (calRange) {
      const calIds: Set<string> = new Set();
      calRange.ranges.forEach((range) => {
        calIds.add(range.fk_from_column_id);
      });
      return Array.from(calIds) as Array<string>;
    }
    return [];
  }

  static async insertColumnToAllViews(
    context: NcContext,
    param: {
      fk_column_id: any;
      fk_model_id: any;
      order?: number;
      column_show: {
        show: boolean;
        view_id?: any;
      };
    } & Pick<ColumnReqType, 'column_order'>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = {
      fk_column_id: param.fk_column_id,
      fk_model_id: param.fk_model_id,
      order: param.order,
      show: param.column_show.show,
    };
    const views = await this.list(context, param.fk_model_id, ncMeta);

    const tableColumns = await Column.list(
      context,
      { fk_model_id: param.fk_model_id },
      ncMeta,
    );
    // keep a map of column id to column object for easy access
    const colIdMap = new Map(tableColumns.map((c) => [c.id, c]));

    for (const view of views) {
      const modifiedInsertObj = {
        ...insertObj,
        fk_view_id: view.id,
        source_id: view.source_id,
      };

      if (colIdMap.get(param.fk_column_id)?.uidt === UITypes.Order) {
        modifiedInsertObj.show = false;
      } else if (param.column_show?.view_id === view.id) {
        modifiedInsertObj.show = true;
      } else if (view.uuid) {
        // if view is shared, then keep the show state as it is
      }
      // if gallery/kanban view, show only 3 columns(excluding system columns)
      else if (view.type === ViewTypes.GALLERY) {
        const visibleColumnsCount = (
          await GalleryViewColumn.list(context, view.id, ncMeta)
        )?.filter(
          (c) => c.show && !isSystemColumn(colIdMap.get(c.fk_column_id)),
        ).length;
        modifiedInsertObj.show = visibleColumnsCount < 3;
      } else if (view.type === ViewTypes.KANBAN) {
        const visibleColumnsCount = (
          await KanbanViewColumn.list(context, view.id, ncMeta)
        )?.filter(
          (c) => c.show && !isSystemColumn(colIdMap.get(c.fk_column_id)),
        ).length;
        modifiedInsertObj.show = visibleColumnsCount < 3;
      } else if (view.type !== ViewTypes.FORM) {
        modifiedInsertObj.show = true;
      }

      if (param.column_order?.view_id === view.id) {
        modifiedInsertObj.order = param.column_order?.order;
      }

      switch (view.type) {
        case ViewTypes.GRID:
          await GridViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;
        case ViewTypes.GALLERY:
          await GalleryViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;

        case ViewTypes.MAP:
          await MapViewColumn.insert(
            context,
            {
              ...insertObj,
              fk_view_id: view.id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.KANBAN:
          await KanbanViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;
        case ViewTypes.CALENDAR:
          await CalendarViewColumn.insert(
            context,
            {
              ...insertObj,
              fk_view_id: view.id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.FORM:
          await FormViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;
      }
    }
  }

  static async insertColumn(
    context: NcContext,
    param: {
      view_id: any;
      order;
      show;
      underline?;
      bold?;
      italic?;
      fk_column_id;
      id?: string;
    } & Partial<FormViewColumn> &
      Partial<CalendarViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, param.view_id, ncMeta);

    let col;
    switch (view.type) {
      case ViewTypes.GRID:
        {
          col = await GridViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.GALLERY:
        {
          col = await GalleryViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.MAP:
        {
          col = await MapViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.FORM:
        {
          col = await FormViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.KANBAN:
        {
          col = await KanbanViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.CALENDAR:
        {
          col = await CalendarViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
    }

    return col;
  }

  static async listWithInfo(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const list = await this.list(context, id, ncMeta);
    for (const item of list) {
      await item.getViewWithInfo(context, ncMeta);
    }
    return list;
  }

  static async getColumns(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<
    Array<
      | GridViewColumn
      | FormViewColumn
      | GalleryViewColumn
      | KanbanViewColumn
      | MapViewColumn
      | CalendarViewColumn
    >
  > {
    let columns: Array<GridViewColumn | any> = [];
    const view = await this.get(context, viewId, ncMeta);

    // todo:  just get - order & show props
    switch (view.type) {
      case ViewTypes.GRID:
        columns = await GridViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.GALLERY:
        columns = await GalleryViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.MAP:
        columns = await MapViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.FORM:
        columns = await FormViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.KANBAN:
        columns = await KanbanViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.CALENDAR:
        columns = await CalendarViewColumn.list(context, viewId, ncMeta);
        break;
    }

    return columns;
  }

  static async getViewColumnId(
    context: NcContext,
    {
      viewId,
      colId,
    }: {
      viewId: string;
      colId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId);
    if (!view) return undefined;

    let tableName;
    let cacheScope;
    switch (view.type) {
      case ViewTypes.GRID:
        tableName = MetaTable.GRID_VIEW_COLUMNS;
        cacheScope = CacheScope.GRID_VIEW_COLUMN;

        break;
      case ViewTypes.GALLERY:
        tableName = MetaTable.GALLERY_VIEW_COLUMNS;
        cacheScope = CacheScope.GALLERY_VIEW_COLUMN;

        break;
      case ViewTypes.MAP:
        tableName = MetaTable.MAP_VIEW_COLUMNS;
        cacheScope = CacheScope.MAP_VIEW_COLUMN;

        break;
      case ViewTypes.FORM:
        tableName = MetaTable.FORM_VIEW_COLUMNS;
        cacheScope = CacheScope.FORM_VIEW_COLUMN;

        break;
      case ViewTypes.KANBAN:
        tableName = MetaTable.KANBAN_VIEW_COLUMNS;
        cacheScope = CacheScope.KANBAN_VIEW_COLUMN;

        break;
      case ViewTypes.CALENDAR:
        tableName = MetaTable.CALENDAR_VIEW_COLUMNS;
        cacheScope = CacheScope.CALENDAR_VIEW_COLUMN;

        break;
    }

    const key = `${cacheScope}:viewColumnId:${colId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_STRING);
    if (o) return o;

    const viewColumn = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      tableName,
      {
        fk_view_id: viewId,
        fk_column_id: colId,
      },
    );
    if (!viewColumn) return undefined;

    await NocoCache.set(key, viewColumn.id);

    return viewColumn.id;
  }

  static async updateColumn(
    context: NcContext,
    viewId: string,
    colId: string,
    colData: {
      order?: number;
      show?: BoolType;
      underline?: BoolType;
      bold?: BoolType;
      italic?: BoolType;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId, ncMeta);
    let table;
    let cacheScope;
    switch (view.type) {
      case ViewTypes.GRID:
        table = MetaTable.GRID_VIEW_COLUMNS;
        cacheScope = CacheScope.GRID_VIEW_COLUMN;
        break;
      case ViewTypes.MAP:
        table = MetaTable.MAP_VIEW_COLUMNS;
        cacheScope = CacheScope.MAP_VIEW_COLUMN;
        break;
      case ViewTypes.GALLERY:
        table = MetaTable.GALLERY_VIEW_COLUMNS;
        cacheScope = CacheScope.GALLERY_VIEW_COLUMN;
        break;
      case ViewTypes.KANBAN:
        table = MetaTable.KANBAN_VIEW_COLUMNS;
        cacheScope = CacheScope.KANBAN_VIEW_COLUMN;
        break;
      case ViewTypes.FORM:
        table = MetaTable.FORM_VIEW_COLUMNS;
        cacheScope = CacheScope.FORM_VIEW_COLUMN;
        break;
      case ViewTypes.CALENDAR:
        table = MetaTable.CALENDAR_VIEW_COLUMNS;
        cacheScope = CacheScope.CALENDAR_VIEW_COLUMN;
    }
    let updateObj = extractProps(colData, ['order', 'show']);

    // keep primary_value_column always visible and first in grid view
    if (view.type === ViewTypes.GRID) {
      const primary_value_column_meta = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          fk_model_id: view.fk_model_id,
          pv: true,
        },
      );

      const primary_value_column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GRID_VIEW_COLUMNS,
        {
          fk_view_id: view.id,
          fk_column_id: primary_value_column_meta.id,
        },
      );

      if (primary_value_column && primary_value_column.id === colId) {
        updateObj.order = 1;
        updateObj.show = true;
      }
    }
    if (view.type === ViewTypes.CALENDAR) {
      updateObj = {
        ...updateObj,
        ...extractProps(colData, ['underline', 'bold', 'italic']),
      };
    }

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      table,
      updateObj,
      colId,
    );

    await NocoCache.update(`${cacheScope}:${colId}`, updateObj);

    // on view column update, delete corresponding single query cache
    await View.clearSingleQueryCache(context, view.fk_model_id, [view], ncMeta);

    return res;
  }

  static async getColumn(
    context: NcContext,
    viewId: string,
    colId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId, ncMeta);
    switch (view.type) {
      case ViewTypes.GRID:
        return GridViewColumn.get(context, colId, ncMeta);
      case ViewTypes.MAP:
        return MapViewColumn.get(context, colId, ncMeta);
      case ViewTypes.GALLERY:
        return GalleryViewColumn.get(context, colId, ncMeta);
      case ViewTypes.KANBAN:
        return KanbanViewColumn.get(context, colId, ncMeta);
      case ViewTypes.FORM:
        return FormViewColumn.get(context, colId, ncMeta);
      case ViewTypes.CALENDAR:
        return CalendarViewColumn.get(context, colId, ncMeta);
    }
    return null;
  }

  static async insertOrUpdateColumn(
    context: NcContext,
    viewId: string,
    fkColId: string,
    colData: {
      order?: number;
      show?: BoolType;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<
    | GridViewColumn
    | FormViewColumn
    | GalleryViewColumn
    | KanbanViewColumn
    | MapViewColumn
    | any
  > {
    const view = await this.get(context, viewId, ncMeta);
    const table = this.extractViewColumnsTableName(view);

    const existingCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      table,
      {
        fk_view_id: viewId,
        fk_column_id: fkColId,
      },
    );

    if (existingCol) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        table,
        {
          order: colData.order,
          show: colData.show,
        },
        existingCol.id,
      );

      // on view column update, delete any optimised single query cache
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );

      return { ...existingCol, ...colData };
    } else {
      switch (view.type) {
        case ViewTypes.GRID:
          return await GridViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.GALLERY:
          return await GalleryViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.KANBAN:
          return await KanbanViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.MAP:
          return await MapViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.FORM:
          return await FormViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.CALENDAR:
          return await CalendarViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
      }
      return await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        table,
        {
          source_id: view.source_id,
          fk_view_id: viewId,
          fk_column_id: fkColId,
          order: colData.order,
          show: colData.show,
        },
      );
    }
  }

  // todo: cache
  static async getByUUID(
    context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ) {
    const view = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        uuid,
      },
    );

    if (view) {
      view.meta = parseMetaProp(view);
    }

    return view && new View(view);
  }

  static async share(context: NcContext, viewId, ncMeta = Noco.ncMeta) {
    const view = await this.get(context, viewId);
    if (!view.uuid) {
      const uuid = uuidv4();
      view.uuid = uuid;

      // set meta
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          uuid: view.uuid,
        },
        viewId,
      );

      await NocoCache.update(`${CacheScope.VIEW}:${view.id}`, {
        uuid: view.uuid,
      });
    }
    if (!view.meta || !('allowCSVDownload' in view.meta)) {
      const defaultMeta = {
        ...(view.meta ?? {}),
        allowCSVDownload: true,
      };
      view.meta = defaultMeta;

      // set meta
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        prepareForDb({
          meta: defaultMeta,
        }),
        viewId,
      );

      await NocoCache.update(
        `${CacheScope.VIEW}:${view.id}`,
        prepareForResponse({
          meta: defaultMeta,
        }),
      );
    }
    return view;
  }

  static async passwordUpdate(
    context: NcContext,
    viewId: string,
    { password }: { password: string },
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        password,
      },
      viewId,
    );

    await NocoCache.update(`${CacheScope.VIEW}:${viewId}`, {
      password,
    });
  }

  static async sharedViewDelete(
    context: NcContext,
    viewId,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        uuid: null,
        ...(isEE ? { fk_custom_url_id: null } : {}),
      },
      viewId,
    );

    await CustomUrl.delete({ view_id: viewId });

    await NocoCache.update(`${CacheScope.VIEW}:${viewId}`, {
      uuid: null,
      ...(isEE ? { fk_custom_url_id: null } : {}),
    });
  }

  static async update(
    context: NcContext,
    viewId: string,
    body: {
      title?: string;
      order?: number;
      show_system_fields?: BoolType;
      lock_type?: string;
      password?: string;
      uuid?: string;
      meta?: any;
      owned_by?: string;
      created_by?: string;
      expanded_record_mode?: ExpandedFormModeType;
      attachment_mode_column_id?: string;
      fk_custom_url_id?: string;
    },
    includeCreatedByAndUpdateBy = false,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'title',
      'order',
      'description',
      'show_system_fields',
      'lock_type',
      'password',
      'meta',
      'uuid',
      ...(isEE ? ['fk_custom_url_id'] : []),
      ...(includeCreatedByAndUpdateBy ? ['owned_by', 'created_by'] : []),
      ...(isEE ? ['expanded_record_mode', 'attachment_mode_column_id'] : []),
    ]);

    if (isEE) {
      if (!updateObj?.attachment_mode_column_id) {
        updateObj.expanded_record_mode = ExpandedFormMode.FIELD;
      } else {
        updateObj.expanded_record_mode = ExpandedFormMode.ATTACHMENT;
      }
    }

    const oldView = await this.get(context, viewId, ncMeta);

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      prepareForDb(updateObj),
      viewId,
    );

    // reset alias cache
    await NocoCache.del(
      `${CacheScope.VIEW}:${oldView.fk_model_id}:${oldView.title}`,
    );

    await NocoCache.update(
      `${CacheScope.VIEW}:${viewId}`,
      prepareForResponse(updateObj),
    );

    if (oldView.is_default) {
      await NocoCache.update(
        `${CacheScope.VIEW}:${oldView.fk_model_id}:default`,
        prepareForResponse(updateObj),
      );
    }

    const view = await this.get(context, viewId, ncMeta);

    if (view.type === ViewTypes.GRID) {
      if ('show_system_fields' in updateObj) {
        await View.fixPVColumnForView(context, viewId, ncMeta);
      }
    }

    // on update, delete any optimised single query cache
    await View.clearSingleQueryCache(context, view.fk_model_id, [view], ncMeta);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return view;
  }

  // @ts-ignore
  static async delete(context: NcContext, viewId, ncMeta = Noco.ncMeta) {
    const view = await this.get(context, viewId, ncMeta);
    await Sort.deleteAll(context, viewId, ncMeta);
    await Filter.deleteAll(context, viewId, ncMeta);
    const table = this.extractViewTableName(view);

    const tableScope = this.extractViewTableNameScope(view);
    const columnTable = this.extractViewColumnsTableName(view);
    const columnTableScope = this.extractViewColumnsTableNameScope(view);
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      columnTable,
      {
        fk_view_id: viewId,
      },
    );
    await ncMeta.metaDelete(context.workspace_id, context.base_id, table, {
      fk_view_id: viewId,
    });
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      viewId,
    );
    await NocoCache.deepDel(
      `${tableScope}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // For Calendar View, delete the range associated with viewId
    if (view.type === ViewTypes.CALENDAR) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_RANGE,
        {
          fk_view_id: viewId,
        },
      );
      await NocoCache.deepDel(
        `${CacheScope.CALENDAR_VIEW_RANGE}:${viewId}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }
    await NocoCache.deepDel(
      `${columnTableScope}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.deepDel(
      `${CacheScope.VIEW}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.del([
      `${CacheScope.VIEW_ALIAS}:${view.fk_model_id}:${view.title}`,
      `${CacheScope.VIEW_ALIAS}:${view.fk_model_id}:${view.id}`,
    ]);

    if (view?.id) {
      // get all Links associated with the view and remove the view from the link
      const links = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_target_view_id: view.id,
          },
        },
      );

      for (const link of links) {
        await LinkToAnotherRecordColumn.update(context, link.fk_column_id, {
          fk_target_view_id: null,
        });
      }
    }

    // on update, delete any optimised single query cache
    await View.clearSingleQueryCache(context, view.fk_model_id, [view], ncMeta);

    if (isEE && view.fk_custom_url_id) {
      CustomUrl.delete({ id: view.fk_custom_url_id as string }).catch(() => {
        logger.error(`Failed to delete custom urls of viewId: ${view.id}`);
      });
    }

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await Model.getNonDefaultViewsCountAndReset(
      context,
      { modelId: view.fk_model_id },
      ncMeta,
    );
  }

  static async showAllColumns(
    context: NcContext,
    viewId,
    ignoreColdIds = [],
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId);
    const table = this.extractViewColumnsTableName(view);
    const scope = this.extractViewColumnsTableNameScope(view);

    const columns = await view
      .getModel(context, ncMeta)
      .then((meta) => meta.getColumns(context, ncMeta));
    const viewColumns = await this.getColumns(context, viewId, ncMeta);
    const availableColumnsInView = viewColumns.map(
      (column) => column.fk_column_id,
    );

    // get existing cache
    const cachedList = await NocoCache.getList(scope, [viewId]);
    const { list: dataList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && dataList?.length) {
      for (const o of dataList) {
        if (!ignoreColdIds?.length || !ignoreColdIds.includes(o.fk_column_id)) {
          // set data
          o.show = true;
          // set cache
          await NocoCache.set(`${scope}:${o.id}`, o);
        }
      }
    }

    // insert or update view column
    for (const col of columns) {
      if (ignoreColdIds?.includes(col.id)) continue;

      const colIndex = availableColumnsInView.indexOf(col.id);
      if (colIndex > -1) {
        await this.updateColumn(
          context,
          viewId,
          viewColumns[colIndex].id,
          { show: true },
          ncMeta,
        );
      } else {
        await this.insertColumn(
          context,
          {
            view_id: viewId,
            order: await ncMeta.metaGetNextOrder(table, {
              fk_view_id: viewId,
            }),
            show: true,
            fk_column_id: col.id,
          },
          ncMeta,
        );
      }

      // return await ncMeta.metaUpdate(
      // context.workspace_id,
      // context.base_id,
      //   table,
      //   { show: true },
      //   {
      //     fk_view_id: viewId,
      //   },
      //   ignoreColdIds?.length
      //     ? {
      //         _not: {
      //           fk_column_id: {
      //             in: ignoreColdIds,
      //           },
      //         },
      //       }
      //     : null
      // );
    }
  }

  static async hideAllColumns(
    context: NcContext,
    viewId,
    ignoreColdIds = [],
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId, ncMeta);
    const table = this.extractViewColumnsTableName(view);
    const scope = this.extractViewColumnsTableNameScope(view);

    if (view.type === ViewTypes.GRID) {
      const primary_value_column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          fk_model_id: view.fk_model_id,
          pv: true,
        },
      );

      // keep primary_value_column always visible
      if (primary_value_column) {
        ignoreColdIds.push(primary_value_column.id);
      }
    }

    // get existing cache
    const cachedList = await NocoCache.getList(scope, [viewId]);
    const { list: dataList } = cachedList;
    const { isNoneList } = cachedList;

    const colsEssentialForView =
      view.type === ViewTypes.MAP
        ? [(await MapView.get(context, viewId, ncMeta)).fk_geo_data_col_id]
        : [];

    const mergedIgnoreColdIds = [...ignoreColdIds, ...colsEssentialForView];

    if (!isNoneList && dataList?.length) {
      for (const o of dataList) {
        if (
          !mergedIgnoreColdIds?.length ||
          !mergedIgnoreColdIds.includes(o.fk_column_id)
        ) {
          // set data
          o.show = false;
          // set cache
          await NocoCache.set(`${scope}:${o.id}`, o);
        }
      }
    }
    // set meta
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      table,
      { show: false },
      {
        fk_view_id: viewId,
      },
      mergedIgnoreColdIds?.length
        ? {
            _not: {
              fk_column_id: {
                in: ignoreColdIds,
              },
            },
          }
        : null,
    );
  }

  static async getSharedViewPath(
    context: NcContext,
    viewId,
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId, ncMeta);
    if (!view.uuid) return null;

    let viewType;
    switch (view.type) {
      case ViewTypes.FORM:
        viewType = 'form';
        break;
      case ViewTypes.KANBAN:
        viewType = 'kanban';
        break;
      case ViewTypes.GALLERY:
        viewType = 'gallery';
        break;
      case ViewTypes.MAP:
        viewType = 'map';
        break;
      case ViewTypes.CALENDAR:
        viewType = 'calendar';
        break;
      default:
        viewType = 'view';
    }

    return `${encodeURI(
      `/nc/${viewType}/${view.uuid}${
        parseProp(view.meta)?.surveyMode ? '/survey' : ''
      }`,
    )}`;
  }

  static async shareViewList(
    context: NcContext,
    tableId,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.VIEW, [tableId]);
    let { list: sharedViews } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !sharedViews.length) {
      sharedViews = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          xcCondition: {
            fk_model_id: {
              eq: tableId,
            },
            _not: {
              uuid: {
                eq: null,
              },
            },
          },
        },
      );
      await NocoCache.setList(CacheScope.VIEW, [tableId], sharedViews);
    }
    sharedViews = sharedViews.filter((v) => v.uuid !== null);
    return sharedViews?.map((v) => new View(v));
  }

  static async fixPVColumnForView(
    context: NcContext,
    viewId,
    ncMeta = Noco.ncMeta,
  ) {
    // get a list of view columns sorted by order
    const view_columns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      },
    );
    const view_columns_meta = [];

    // get column meta for each view column
    for (const col of view_columns) {
      const col_meta = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        col.fk_column_id,
      );
      if (col_meta) view_columns_meta.push(col_meta);
    }

    const primary_value_column_meta = view_columns_meta.find((col) => col.pv);

    if (primary_value_column_meta) {
      const primary_value_column = view_columns.find(
        (col) => col.fk_column_id === primary_value_column_meta.id,
      );
      const primary_value_column_index = view_columns.findIndex(
        (col) => col.fk_column_id === primary_value_column_meta.id,
      );
      const view_orders = view_columns.map((col) => col.order);
      const view_min_order = Math.min(...view_orders);

      // if primary_value_column is not visible, make it visible
      if (!primary_value_column.show) {
        await ncMeta.metaUpdate(
          context.workspace_id,
          context.base_id,
          MetaTable.GRID_VIEW_COLUMNS,
          { show: true },
          primary_value_column.id,
        );
        await NocoCache.set(
          `${CacheScope.GRID_VIEW_COLUMN}:${primary_value_column.id}`,
          primary_value_column,
        );
      }

      if (
        primary_value_column.order === view_min_order &&
        view_orders.filter((o) => o === view_min_order).length === 1
      ) {
        // if primary_value_column is in first order do nothing
        return;
      } else {
        // if primary_value_column not in first order, move it to the start of array
        if (primary_value_column_index !== 0) {
          const temp_pv = view_columns.splice(primary_value_column_index, 1);
          view_columns.unshift(...temp_pv);
        }

        // update order of all columns in view to match the order in array
        for (let i = 0; i < view_columns.length; i++) {
          await ncMeta.metaUpdate(
            context.workspace_id,
            context.base_id,
            MetaTable.GRID_VIEW_COLUMNS,
            { order: i + 1 },
            view_columns[i].id,
          );
          await NocoCache.set(
            `${CacheScope.GRID_VIEW_COLUMN}:${view_columns[i].id}`,
            view_columns[i],
          );
        }
      }
    }

    const views = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      },
    );
    await NocoCache.setList(CacheScope.GRID_VIEW_COLUMN, [viewId], views);
  }

  public static async clearSingleQueryCache(
    context: NcContext,
    modelId: string,
    views?: { id?: string }[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!Noco.isEE()) return;

    // get all views of the model
    let viewsList =
      views || (await NocoCache.getList(CacheScope.VIEW, [modelId])).list;

    if (!views && !viewsList?.length) {
      viewsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          condition: {
            fk_model_id: modelId,
          },
        },
      );
    }

    const deleteKeys = [];

    for (const view of viewsList) {
      deleteKeys.push(
        `${CacheScope.SINGLE_QUERY}:${modelId}:${view.id}:queries`,
        `${CacheScope.SINGLE_QUERY}:${modelId}:${view.id}:count`,
        `${CacheScope.SINGLE_QUERY}:${modelId}:${view.id}:read`,
      );
    }

    deleteKeys.push(
      `${CacheScope.SINGLE_QUERY}:${modelId}:default:queries`,
      `${CacheScope.SINGLE_QUERY}:${modelId}:default:count`,
      `${CacheScope.SINGLE_QUERY}:${modelId}:default:read`,
    );

    await NocoCache.del(deleteKeys);
  }

  static async bulkColumnInsertToViews(
    context: NcContext,
    {
      columns,
      viewColumns,
      copyFromView,
    }: {
      copyFromView?: View;
      columns?: ({
        order?: number;
        show?;
      } & Column)[];
      viewColumns?: (
        | GridViewColumn
        | GalleryViewColumn
        | FormViewColumn
        | KanbanViewColumn
        | MapViewColumn
        | CalendarViewColumn
      )[];
    },
    view: View,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObjs = [];

    if (viewColumns) {
      for (let i = 0; i < viewColumns.length; i++) {
        const column =
          view.type === ViewTypes.FORM
            ? prepareForDb(viewColumns[i])
            : viewColumns[i];

        insertObjs.push({
          ...extractProps(column, [
            'fk_view_id',
            'fk_column_id',
            'show',
            'base_id',
            'source_id',
            'order',
            ...(view.type === ViewTypes.CALENDAR
              ? ['bold', 'italic', 'underline']
              : []),
            ...(view.type === ViewTypes.FORM
              ? [
                  'label',
                  'help',
                  'description',
                  'required',
                  'enable_scanner',
                  'meta',
                ]
              : [
                  'width',
                  'group_by',
                  'group_by_order',
                  'group_by_sort',
                  'aggregation',
                ]),
          ]),
          fk_view_id: view.id,
          base_id: view.base_id,
          source_id: view.source_id,
        });
      }
    } else {
      if (!columns) {
        columns = await Column.list(context, { fk_model_id: view.fk_model_id });
      }

      if (!copyFromView) {
        // sort by display value first, then other columns
        // so that later we can handle control `show` easily
        columns.sort((a, b) => {
          return +b.pv - +a.pv;
        });
      }

      let order = 1;
      let galleryShowLimit = 0;
      let kanbanShowLimit = 0;

      let calendarRangeColumns;

      if (view.type == ViewTypes.CALENDAR) {
        const calendarRange = await CalendarRange.read(
          context,
          view.id,
          ncMeta,
        );
        if (calendarRange) {
          calendarRangeColumns = calendarRange.ranges
            .map((range) => [
              range.fk_from_column_id,
              (range as any).fk_to_column_id,
            ])
            .flat();
        }
      }

      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];

        let show = 'show' in column ? column.show : true;

        const aggregation = CommonAggregations.None;

        if (view.type === ViewTypes.GALLERY) {
          const galleryView = await GalleryView.get(context, view.id, ncMeta);
          if (
            (column.id === galleryView.fk_cover_image_col_id && column.pv) ||
            (column.id !== galleryView.fk_cover_image_col_id &&
              (column.pv || galleryShowLimit < 3))
          ) {
            show = true;
            galleryShowLimit++;
          } else {
            show = false;
          }
        } else if (view.type === ViewTypes.KANBAN && !copyFromView) {
          const kanbanView = await KanbanView.get(context, view.id, ncMeta);
          if (column.id === kanbanView?.fk_grp_col_id && column.pv) {
            // include grouping field if it exists
            show = true;
          } else if (
            (column.id === kanbanView.fk_cover_image_col_id && column.pv) ||
            (column.id !== kanbanView.fk_cover_image_col_id && column.pv)
          ) {
            // Show primary key and cover image if it is a primary value; otherwise, it will be redundant.
            show = true;
            kanbanShowLimit++;
          } else if (
            column.id !== kanbanView.fk_cover_image_col_id &&
            kanbanShowLimit < 3 &&
            !isSystemColumn(column)
          ) {
            // show at most 3 non-system columns
            show = true;
            kanbanShowLimit++;
          } else {
            // other columns will be hidden
            show = false;
          }
        } else if (view.type === ViewTypes.MAP && !copyFromView) {
          const mapView = await MapView.get(context, view.id, ncMeta);
          if (column.id === mapView?.fk_geo_data_col_id) {
            show = true;
          }
        } else if (view.type === ViewTypes.FORM && isSystemColumn(column)) {
          show = false;
        } else if (view.type === ViewTypes.CALENDAR) {
          if (!calendarRangeColumns) break;
          if (calendarRangeColumns.includes(column.id)) {
            show = true;
          }
        }

        insertObjs.push({
          fk_column_id: column.id,
          order: order++,
          show,
          fk_view_id: view.id,
          base_id: view.base_id,
          source_id: view.source_id,
          ...(view.type === ViewTypes.GRID
            ? {
                aggregation,
              }
            : {}),
        });
      }
    }

    switch (view.type) {
      case ViewTypes.GRID:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.GRID_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.GALLERY:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.GALLERY_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.MAP:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.MAP_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.KANBAN:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.KANBAN_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.FORM:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.FORM_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.CALENDAR:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.CALENDAR_VIEW_COLUMNS,
          insertObjs,
        );
    }
  }

  static async insertMetaOnly(
    context: NcContext,
    {
      view,
      model,
      req,
    }: {
      view: Partial<View> &
        Partial<
          | FormView
          | GridView
          | GalleryView
          | KanbanView
          | MapView
          | CalendarView
        > & {
          copy_from_id?: string;
          fk_grp_col_id?: string;
          calendar_range?: Partial<CalendarRange>[];
          created_by: string;
          owned_by: string;
          expanded_record_mode?: ExpandedFormModeType;
          attachment_mode_column_id?: string;
        };
      model: {
        getColumns: (context: NcContext, ncMeta?) => Promise<Column[]>;
      };
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(view, [
      'id',
      'title',
      'is_default',
      'description',
      'type',
      'fk_model_id',
      'base_id',
      'source_id',
      'meta',
      'created_by',
      'owned_by',
      'lock_type',
      ...(isEE ? ['expanded_record_mode', 'attachment_mode_column_id'] : []),
    ]);

    if (isEE) {
      if (!insertObj?.attachment_mode_column_id) {
        insertObj.expanded_record_mode = ExpandedFormMode.FIELD;
      } else {
        insertObj.expanded_record_mode = ExpandedFormMode.ATTACHMENT;
      }
    }

    if (!insertObj.order) {
      // get order value
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.VIEWS, {
        fk_model_id: view.fk_model_id,
      });
    }

    insertObj.show = true;

    if (!insertObj.meta) {
      insertObj.meta = {};
    }

    insertObj.meta = stringifyMetaProp(insertObj);

    const copyFromView =
      view.copy_from_id && (await View.get(context, view.copy_from_id, ncMeta));
    await copyFromView?.getView(context);

    const table = await Model.getByIdOrName(
      context,
      { id: view.fk_model_id },
      ncMeta,
    );

    // get base and base id if missing
    if (!view.source_id) {
      insertObj.source_id = table.source_id;
    }

    const insertedView = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      insertObj,
    );

    const { id: view_id } = insertedView;

    // insert view metadata based on view type
    switch (view.type) {
      case ViewTypes.GRID:
        await GridView.insert(
          context,
          {
            ...((copyFromView?.view as GridView) || {}),
            ...(view as GridView),
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.MAP:
        await MapView.insert(
          context,
          {
            ...(view as MapView),
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.GALLERY:
        await GalleryView.insert(
          context,
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.FORM:
        await FormView.insert(
          context,
          {
            heading: view.title,
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.KANBAN:
        // set grouping field
        (view as KanbanView).fk_grp_col_id = view.fk_grp_col_id;

        await KanbanView.insert(
          context,
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.CALENDAR: {
        const obj = extractProps(view, ['calendar_range']);
        if (!obj.calendar_range) break;
        const calendarRange = obj.calendar_range as Partial<CalendarRange>[];
        calendarRange.forEach((range) => {
          range.fk_view_id = view_id;
        });

        await CalendarRange.bulkInsert(context, calendarRange, ncMeta);
        await CalendarView.insert(
          context,
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );

        break;
      }
    }
    try {
      // copy from view
      if (copyFromView) {
        // generate parent audit id and add it to req object
        const eventId = await ncMeta.genNanoid(MetaTable.AUDIT);
        req.ncParentAuditId = eventId;
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_START, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
          id: eventId,
        });

        const sorts = await copyFromView.getSorts(context, ncMeta);
        const filters = await Filter.rootFilterList(
          context,
          { viewId: copyFromView.id },
          ncMeta,
        );
        const viewColumns = await copyFromView.getColumns(context, ncMeta);

        const sortInsertObjs = [];
        const filterInsertObjs = [];

        for (const sort of sorts) {
          sortInsertObjs.push({
            ...extractProps(sort, [
              'fk_column_id',
              'direction',
              'base_id',
              'source_id',
            ]),
            fk_view_id: view_id,
            id: undefined,
          });

          Noco.appHooksService.emit(AppEvents.SORT_CREATE, {
            sort: {
              ...sort,
              id: undefined,
            },
            view: view as ViewType,
            column: await Column.get(context, {
              colId: sort.fk_column_id,
            }),
            req,
            context,
          });
        }

        for (const filter of filters) {
          const fn = async (filter, parentId: string = null) => {
            const generatedId = await ncMeta.genNanoid(MetaTable.FILTER_EXP);

            filterInsertObjs.push({
              ...extractProps(filter, [
                'fk_parent_column_id',
                'fk_column_id',
                'comparison_op',
                'comparison_sub_op',
                'value',
                'fk_parent_id',
                'is_group',
                'logical_op',
                'base_id',
                'source_id',
                'order',
              ]),
              fk_view_id: view_id,
              id: generatedId,
              fk_parent_id: parentId,
            });
            if (filter.is_group)
              await Promise.all(
                ((await filter.getChildren(context)) || []).map(
                  async (child) => {
                    await fn(child, generatedId);
                  },
                ),
              );

            Noco.appHooksService.emit(AppEvents.FILTER_CREATE, {
              filter: { ...filter, id: undefined } as FilterType,
              column: await Column.get(context, {
                colId: filter.fk_column_id,
              }),
              view: view as ViewType,
              req,
              context,
            });
          };

          await fn(filter);
        }

        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.SORT,
          sortInsertObjs,
        );

        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          filterInsertObjs,
          true,
        );

        // populate view columns
        await View.bulkColumnInsertToViews(
          context,
          { viewColumns, copyFromView },
          insertedView,
        );
      } else {
        // populate view columns
        await View.bulkColumnInsertToViews(
          context,
          { columns: (await model.getColumns(context, ncMeta)) as any[] },
          insertedView,
        );
      }

      await Model.getNonDefaultViewsCountAndReset(
        context,
        { modelId: view.fk_model_id },
        ncMeta,
      );

      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_COMPLETE, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
        });
      }
      return insertedView;
    } catch (e) {
      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_FAIL, {
          sourceView: copyFromView,
          destView: view as ViewType,
          error: e,
          req,
          context,
        });
      }

      throw e;
    }
  }

  public static extractViewColumnsTableName(view: View) {
    let table;
    switch (view.type) {
      case ViewTypes.GRID:
        table = MetaTable.GRID_VIEW_COLUMNS;
        break;
      case ViewTypes.GALLERY:
        table = MetaTable.GALLERY_VIEW_COLUMNS;
        break;
      case ViewTypes.KANBAN:
        table = MetaTable.KANBAN_VIEW_COLUMNS;
        break;
      case ViewTypes.FORM:
        table = MetaTable.FORM_VIEW_COLUMNS;
        break;
      case ViewTypes.MAP:
        table = MetaTable.MAP_VIEW_COLUMNS;
        break;
      case ViewTypes.CALENDAR:
        table = MetaTable.CALENDAR_VIEW_COLUMNS;
        break;
    }
    return table;
  }

  protected static extractViewTableName(view: View) {
    let table;
    switch (view.type) {
      case ViewTypes.GRID:
        table = MetaTable.GRID_VIEW;
        break;
      case ViewTypes.GALLERY:
        table = MetaTable.GALLERY_VIEW;
        break;
      case ViewTypes.KANBAN:
        table = MetaTable.KANBAN_VIEW;
        break;
      case ViewTypes.FORM:
        table = MetaTable.FORM_VIEW;
        break;
      case ViewTypes.MAP:
        table = MetaTable.MAP_VIEW;
        break;
      case ViewTypes.CALENDAR:
        table = MetaTable.CALENDAR_VIEW;
        break;
    }
    return table;
  }

  protected static extractViewColumnsTableNameScope(view: View) {
    let scope;
    switch (view.type) {
      case ViewTypes.GRID:
        scope = CacheScope.GRID_VIEW_COLUMN;
        break;
      case ViewTypes.GALLERY:
        scope = CacheScope.GALLERY_VIEW_COLUMN;
        break;
      case ViewTypes.MAP:
        scope = CacheScope.MAP_VIEW_COLUMN;
        break;
      case ViewTypes.KANBAN:
        scope = CacheScope.KANBAN_VIEW_COLUMN;
        break;
      case ViewTypes.FORM:
        scope = CacheScope.FORM_VIEW_COLUMN;
        break;
      case ViewTypes.CALENDAR:
        scope = CacheScope.CALENDAR_VIEW_COLUMN;
        break;
    }
    return scope;
  }

  private static extractViewTableNameScope(view: View) {
    let scope;
    switch (view.type) {
      case ViewTypes.GRID:
        scope = CacheScope.GRID_VIEW;
        break;
      case ViewTypes.GALLERY:
        scope = CacheScope.GALLERY_VIEW;
        break;
      case ViewTypes.MAP:
        scope = CacheScope.MAP_VIEW;
        break;
      case ViewTypes.KANBAN:
        scope = CacheScope.KANBAN_VIEW;
        break;
      case ViewTypes.FORM:
        scope = CacheScope.FORM_VIEW;
        break;
      case ViewTypes.CALENDAR:
        scope = CacheScope.CALENDAR_VIEW;
        break;
    }
    return scope;
  }

  async getModel(context: NcContext, ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.model = await Model.getByIdOrName(
      context,
      { id: this.fk_model_id },
      ncMeta,
    ));
  }

  async getModelWithInfo(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    return (this.model = await Model.getWithInfo(
      context,
      { id: this.fk_model_id },
      ncMeta,
    ));
  }

  async getView<T>(context: NcContext, ncMeta = Noco.ncMeta): Promise<T> {
    switch (this.type) {
      case ViewTypes.GRID:
        this.view = await GridView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.KANBAN:
        this.view = await KanbanView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.GALLERY:
        this.view = await GalleryView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.MAP:
        this.view = await MapView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.FORM:
        this.view = await FormView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.CALENDAR:
        this.view = await CalendarView.get(context, this.id, ncMeta);
        break;
    }
    return <T>this.view;
  }

  async getViewWithInfo(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<FormView | GridView | KanbanView | GalleryView> {
    switch (this.type) {
      case ViewTypes.GRID:
        this.view = await GridView.getWithInfo(context, this.id, ncMeta);
        break;
      case ViewTypes.KANBAN:
        this.view = await KanbanView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.GALLERY:
        this.view = await GalleryView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.MAP:
        this.view = await MapView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.FORM:
        this.view = await FormView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.CALENDAR:
        this.view = await CalendarView.get(context, this.id, ncMeta);
        break;
    }
    return this.view;
  }

  public async getFilters(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.filter = (await Filter.getFilterObject(
      context,
      {
        viewId: this.id,
      },
      ncMeta,
    )) as any);
  }

  public async getSorts(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.sorts = await Sort.list(context, { viewId: this.id }, ncMeta));
  }

  async getColumns(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.columns = await View.getColumns(context, this.id, ncMeta));
  }

  async delete(context: NcContext, ncMeta = Noco.ncMeta) {
    await View.delete(context, this.id, ncMeta);
  }

  static async updateIfColumnUsedAsExpandedMode(
    _context: NcContext,
    _columnId: string,
    _modelId: string,
    _ncMeta = Noco.ncMeta,
  ) {
    return;
  }
}
