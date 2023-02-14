import Noco from '../Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import { parseMetaProp, stringifyMetaProp } from '../utils/modelUtils';
import Model from './Model';
import FormView from './FormView';
import GridView from './GridView';
import KanbanView from './KanbanView';
import GalleryView from './GalleryView';
import GridViewColumn from './GridViewColumn';
import Sort from './Sort';
import Filter from './Filter';
import {
  ColumnReqType,
  isSystemColumn,
  UITypes,
  ViewType,
  ViewTypes,
} from 'nocodb-sdk';
import GalleryViewColumn from './GalleryViewColumn';
import FormViewColumn from './FormViewColumn';
import KanbanViewColumn from './KanbanViewColumn';
import Column from './Column';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';
import MapView from './MapView';
import MapViewColumn from './MapViewColumn';

const { v4: uuidv4 } = require('uuid');
export default class View implements ViewType {
  id?: string;
  title: string;
  uuid?: string;
  password?: string;
  show: boolean;
  is_default: boolean;
  order: number;
  type: ViewTypes;
  lock_type?: ViewType['lock_type'];

  fk_model_id: string;
  model?: Model;
  view?: FormView | GridView | KanbanView | GalleryView | MapView;
  columns?: Array<
    | FormViewColumn
    | GridViewColumn
    | GalleryViewColumn
    | KanbanViewColumn
    | MapViewColumn
  >;

  sorts: Sort[];
  filter: Filter;
  project_id?: string;
  base_id?: string;
  show_system_fields?: boolean;
  meta?: any;

  constructor(data: View) {
    Object.assign(this, data);
  }

  async getModel(ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.model = await Model.getByIdOrName(
      { id: this.fk_model_id },
      ncMeta
    ));
  }

  async getModelWithInfo(ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.model = await Model.getWithInfo(
      { id: this.fk_model_id },
      ncMeta
    ));
  }

  async getView<T>(): Promise<T> {
    switch (this.type) {
      case ViewTypes.GRID:
        this.view = await GridView.get(this.id);
        break;
      case ViewTypes.KANBAN:
        this.view = await KanbanView.get(this.id);
        break;
      case ViewTypes.GALLERY:
        this.view = await GalleryView.get(this.id);
        break;
      case ViewTypes.MAP:
        this.view = await MapView.get(this.id);
        break;
      case ViewTypes.FORM:
        this.view = await FormView.get(this.id);
        break;
    }
    return <T>this.view;
  }

  async getViewWithInfo(
    ncMeta = Noco.ncMeta
  ): Promise<FormView | GridView | KanbanView | GalleryView> {
    switch (this.type) {
      case ViewTypes.GRID:
        this.view = await GridView.getWithInfo(this.id, ncMeta);
        break;
      case ViewTypes.KANBAN:
        this.view = await KanbanView.get(this.id, ncMeta);
        break;
      case ViewTypes.GALLERY:
        this.view = await GalleryView.get(this.id, ncMeta);
        break;
      case ViewTypes.MAP:
        this.view = await MapView.get(this.id, ncMeta);
        break;
      case ViewTypes.FORM:
        this.view = await FormView.get(this.id, ncMeta);
        break;
    }
    return this.view;
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.VIEWS, viewId);
      view.meta = parseMetaProp(view);
      await NocoCache.set(`${CacheScope.VIEW}:${view.id}`, view);
    }

    return view && new View(view);
  }

  public static async getByTitleOrId(
    { fk_model_id, titleOrId }: { titleOrId: string; fk_model_id: string },
    ncMeta = Noco.ncMeta
  ) {
    const viewId =
      titleOrId &&
      (await NocoCache.get(
        `${CacheScope.VIEW}:${fk_model_id}:${titleOrId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!viewId) {
      const view = await ncMeta.metaGet2(
        null,
        null,
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
        }
      );
      view.meta = parseMetaProp(view);
      // todo: cache - titleOrId can be viewId so we need a different scope here
      await NocoCache.set(
        `${CacheScope.VIEW}:${fk_model_id}:${titleOrId}`,
        view.id
      );
      await NocoCache.set(`${CacheScope.VIEW}:${fk_model_id}:${view.id}`, view);
      return view && new View(view);
    }
    return viewId && this.get(viewId?.id || viewId);
  }

  public static async getDefaultView(
    fk_model_id: string,
    ncMeta = Noco.ncMeta
  ) {
    let view =
      fk_model_id &&
      (await NocoCache.get(
        `${CacheScope.VIEW}:${fk_model_id}:default`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.VIEWS,
        {
          fk_model_id,
          is_default: 1,
        },
        null
      );
      view.meta = parseMetaProp(view);
      await NocoCache.set(`${CacheScope.VIEW}:${fk_model_id}:default`, view);
    }
    return view && new View(view);
  }

  public static async list(modelId: string, ncMeta = Noco.ncMeta) {
    let viewsList = await NocoCache.getList(CacheScope.VIEW, [modelId]);
    if (!viewsList.length) {
      viewsList = await ncMeta.metaList2(null, null, MetaTable.VIEWS, {
        condition: {
          fk_model_id: modelId,
        },
        orderBy: {
          order: 'asc',
        },
      });
      for (const view of viewsList) {
        view.meta = parseMetaProp(view);
      }
      await NocoCache.setList(CacheScope.VIEW, [modelId], viewsList);
    }
    viewsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity)
    );
    return viewsList?.map((v) => new View(v));
  }

  public async getFilters(ncMeta = Noco.ncMeta) {
    return (this.filter = (await Filter.getFilterObject(
      {
        viewId: this.id,
      },
      ncMeta
    )) as any);
  }

  public async getSorts(ncMeta = Noco.ncMeta) {
    return (this.sorts = await Sort.list({ viewId: this.id }, ncMeta));
  }

  static async insert(
    view: Partial<View> &
      Partial<FormView | GridView | GalleryView | KanbanView | MapView> & {
        copy_from_id?: string;
        fk_grp_col_id?: string;
        created_at?;
        updated_at?;
      },
    ncMeta = Noco.ncMeta
  ) {
    // get order value
    const order = await ncMeta.metaGetNextOrder(MetaTable.VIEWS, {
      fk_model_id: view.fk_model_id,
    });

    const insertObj = {
      id: view.id,
      title: view.title,
      show: true,
      is_default: view.is_default,
      order,
      type: view.type,
      fk_model_id: view.fk_model_id,
      project_id: view.project_id,
      base_id: view.base_id,
      created_at: view.created_at,
      updated_at: view.updated_at,
      meta: view.meta ?? {},
    };

    insertObj.meta = stringifyMetaProp(insertObj);

    // get project and base id if missing
    if (!(view.project_id && view.base_id)) {
      const model = await Model.getByIdOrName({ id: view.fk_model_id }, ncMeta);
      insertObj.project_id = model.project_id;
      insertObj.base_id = model.base_id;
    }

    const copyFromView =
      view.copy_from_id && (await View.get(view.copy_from_id, ncMeta));
    await copyFromView?.getView();

    const { id: view_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.VIEWS,
      insertObj
    );

    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${view_id}`
    );

    let columns: any[] = await (
      await Model.getByIdOrName({ id: view.fk_model_id }, ncMeta)
    ).getColumns(ncMeta);

    // insert view metadata based on view type
    switch (view.type) {
      case ViewTypes.GRID:
        await GridView.insert(
          {
            ...((copyFromView?.view as GridView) || {}),
            ...(view as GridView),
            fk_view_id: view_id,
          },
          ncMeta
        );
        break;
      case ViewTypes.MAP:
        await MapView.insert(
          {
            ...(view as MapView),
            fk_view_id: view_id,
          },
          ncMeta
        );
        break;
      case ViewTypes.GALLERY:
        await GalleryView.insert(
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta
        );
        break;
      case ViewTypes.FORM:
        await FormView.insert(
          {
            heading: view.title,
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta
        );
        break;
      case ViewTypes.KANBAN:
        // set grouping field
        (view as KanbanView).fk_grp_col_id = view.fk_grp_col_id;

        await KanbanView.insert(
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta
        );
        break;
    }

    if (copyFromView) {
      const sorts = await copyFromView.getSorts(ncMeta);
      const filters = await copyFromView.getFilters(ncMeta);
      columns = await copyFromView.getColumns(ncMeta);

      for (const sort of sorts) {
        await Sort.insert(
          {
            ...sort,
            fk_view_id: view_id,
            id: null,
          },
          ncMeta
        );
      }

      for (const filter of filters.children) {
        await Filter.insert(
          {
            ...filter,
            fk_view_id: view_id,
            id: null,
          },
          ncMeta
        );
      }
    }
    {
      let order = 1;
      let galleryShowLimit = 0;
      let kanbanShowLimit = 0;

      if (view.type === ViewTypes.KANBAN && !copyFromView) {
        // sort by primary value & attachment first, then by singleLineText & Number
        // so that later we can handle control `show` easily
        columns.sort((a, b) => {
          const primaryValueOrder = b.pv - a.pv;
          const attachmentOrder =
            +(b.uidt === UITypes.Attachment) - +(a.uidt === UITypes.Attachment);
          const singleLineTextOrder =
            +(b.uidt === UITypes.SingleLineText) -
            +(a.uidt === UITypes.SingleLineText);
          const numberOrder =
            +(b.uidt === UITypes.Number) - +(a.uidt === UITypes.Number);
          const defaultOrder = b.order - a.order;
          return (
            primaryValueOrder ||
            attachmentOrder ||
            singleLineTextOrder ||
            numberOrder ||
            defaultOrder
          );
        });
      }

      for (const vCol of columns) {
        let show = 'show' in vCol ? vCol.show : true;

        if (view.type === ViewTypes.GALLERY) {
          const galleryView = await GalleryView.get(view_id, ncMeta);
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
        }

        else if (view.type === ViewTypes.KANBAN && !copyFromView) {
          const kanbanView = await KanbanView.get(view_id, ncMeta);
          if (vCol.id === kanbanView?.fk_grp_col_id) {
            // include grouping field if it exists
            show = true;
          } else if (vCol.id === kanbanView.fk_cover_image_col_id || vCol.pv) {
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
        }
        
        else if (view.type === ViewTypes.MAP && !copyFromView) {
          const mapView = await MapView.get(view_id, ncMeta);
          if (vCol.id === mapView?.fk_geo_data_col_id) {
            show = true;
        }
      }

        // if columns is list of virtual columns then get the parent column
        const col = vCol.fk_column_id
          ? await Column.get({ colId: vCol.fk_column_id }, ncMeta)
          : vCol;

        if (isSystemColumn(col)) show = false;
        await View.insertColumn(
          {
            order: order++,
            ...col,
            ...vCol,
            view_id,
            fk_column_id: vCol.fk_column_id || vCol.id,
            show,
            id: null,
          },
          ncMeta
        );
      }
    }

    return View.get(view_id, ncMeta);
  }

  static async insertColumnToAllViews(
    param: {
      fk_column_id: any;
      fk_model_id: any;
      order?: number;
      show;
    } & Pick<ColumnReqType, 'column_order'>,
    ncMeta = Noco.ncMeta
  ) {
    const insertObj = {
      fk_column_id: param.fk_column_id,
      fk_model_id: param.fk_model_id,
      order: param.order,
      show: param.show,
    };
    const views = await this.list(param.fk_model_id, ncMeta);

    for (const view of views) {
      const modifiedInsertObj = { ...insertObj, fk_view_id: view.id };

      if (param.column_order?.view_id === view.id) {
        modifiedInsertObj.order = param.column_order?.order;
      }

      switch (view.type) {
        case ViewTypes.GRID:
          await GridViewColumn.insert(modifiedInsertObj, ncMeta);
          break;
        case ViewTypes.GALLERY:
          await GalleryViewColumn.insert(modifiedInsertObj, ncMeta);
          break;

        case ViewTypes.MAP:
          await MapViewColumn.insert(
            {
              ...insertObj,
              fk_view_id: view.id,
            },
            ncMeta
          );
          break;
        case ViewTypes.KANBAN:
          await KanbanViewColumn.insert(modifiedInsertObj, ncMeta);
          break;
      }
    }
  }

  static async insertColumn(
    param: {
      view_id: any;
      order;
      show;
      fk_column_id;
      id?: string;
    } & Partial<FormViewColumn>,
    ncMeta = Noco.ncMeta
  ) {
    const view = await this.get(param.view_id, ncMeta);

    let col;
    switch (view.type) {
      case ViewTypes.GRID:
        {
          col = await GridViewColumn.insert(
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta
          );
        }
        break;
      case ViewTypes.GALLERY:
        {
          col = await GalleryViewColumn.insert(
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta
          );
        }
        break;
      case ViewTypes.MAP:
        {
          col = await MapViewColumn.insert(
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta
          );
        }
        break;
      case ViewTypes.FORM:
        {
          col = await FormViewColumn.insert(
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta
          );
        }
        break;
      case ViewTypes.KANBAN:
        {
          col = await KanbanViewColumn.insert(
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta
          );
        }
        break;
    }

    return col;
  }

  static async listWithInfo(id: string, ncMeta = Noco.ncMeta) {
    const list = await this.list(id, ncMeta);
    for (const item of list) {
      await item.getViewWithInfo(ncMeta);
    }
    return list;
  }

  static async getColumns(
    viewId: string,
    ncMeta = Noco.ncMeta
  ): Promise<
    Array<
      | GridViewColumn
      | FormViewColumn
      | GalleryViewColumn
      | KanbanViewColumn
      | MapViewColumn
    >
  > {
    let columns: Array<GridViewColumn | any> = [];
    const view = await this.get(viewId, ncMeta);

    // todo:  just get - order & show props
    switch (view.type) {
      case ViewTypes.GRID:
        columns = await GridViewColumn.list(viewId, ncMeta);
        break;
      case ViewTypes.GALLERY:
        columns = await GalleryViewColumn.list(viewId, ncMeta);
        break;
      case ViewTypes.MAP:
        columns = await MapViewColumn.list(viewId, ncMeta);
        break;
      case ViewTypes.FORM:
        columns = await FormViewColumn.list(viewId, ncMeta);
        break;
      case ViewTypes.KANBAN:
        columns = await KanbanViewColumn.list(viewId, ncMeta);
        break;
    }

    return columns;
  }

  async getColumns(ncMeta = Noco.ncMeta) {
    return (this.columns = await View.getColumns(this.id, ncMeta));
  }

  static async updateColumn(
    viewId: string,
    colId: string,
    colData: {
      order?: number;
      show?: boolean;
    },
    ncMeta = Noco.ncMeta
  ): Promise<Array<GridViewColumn | any>> {
    const columns: Array<GridViewColumn | any> = [];
    const view = await this.get(viewId, ncMeta);
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
    }
    const updateObj = extractProps(colData, ['order', 'show']);

    // keep primary_value_column always visible and first in grid view
    if (view.type === ViewTypes.GRID) {
      const primary_value_column_meta = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.COLUMNS,
        {
          fk_model_id: view.fk_model_id,
          pv: true,
        }
      );

      const primary_value_column = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.GRID_VIEW_COLUMNS,
        {
          fk_view_id: view.id,
          fk_column_id: primary_value_column_meta.id,
        }
      );

      if (primary_value_column && primary_value_column.id === colId) {
        updateObj.order = 1;
        updateObj.show = true;
      }
    }

    // get existing cache
    const key = `${cacheScope}:${colId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(null, null, table, updateObj, colId);

    return columns;
  }

  static async insertOrUpdateColumn(
    viewId: string,
    fkColId: string,
    colData: {
      order: number;
      show: boolean;
    },
    ncMeta = Noco.ncMeta
  ): Promise<
    | GridViewColumn
    | FormViewColumn
    | GalleryViewColumn
    | KanbanViewColumn
    | MapViewColumn
    | any
  > {
    const view = await this.get(viewId);
    const table = this.extractViewColumnsTableName(view);
    console.log(table);

    const existingCol = await ncMeta.metaGet2(null, null, table, {
      fk_view_id: viewId,
      fk_column_id: fkColId,
    });

    if (existingCol) {
      await ncMeta.metaUpdate(
        null,
        null,
        table,
        {
          order: colData.order,
          show: colData.show,
        },
        existingCol.id
      );
      return { ...existingCol, ...colData };
    } else {
      switch (view.type) {
        case ViewTypes.GRID:
          return await GridViewColumn.insert({
            fk_view_id: viewId,
            fk_column_id: fkColId,
            order: colData.order,
            show: colData.show,
          });
        case ViewTypes.GALLERY:
          return await GalleryViewColumn.insert({
            fk_view_id: viewId,
            fk_column_id: fkColId,
            order: colData.order,
            show: colData.show,
          });
        case ViewTypes.KANBAN:
          return await KanbanViewColumn.insert({
            fk_view_id: viewId,
            fk_column_id: fkColId,
            order: colData.order,
            show: colData.show,
          });
          break;
        case ViewTypes.MAP:
          return await MapViewColumn.insert({
            fk_view_id: viewId,
            fk_column_id: fkColId,
            order: colData.order,
            show: colData.show,
          });
          break;
        case ViewTypes.FORM:
          return await FormViewColumn.insert({
            fk_view_id: viewId,
            fk_column_id: fkColId,
            order: colData.order,
            show: colData.show,
          });
      }
      return await ncMeta.metaInsert2(view.project_id, view.base_id, table, {
        fk_view_id: viewId,
        fk_column_id: fkColId,
        order: colData.order,
        show: colData.show,
      });
    }
  }

  // todo: cache
  static async getByUUID(uuid: string, ncMeta = Noco.ncMeta) {
    const view = await ncMeta.metaGet2(null, null, MetaTable.VIEWS, {
      uuid,
    });

    if (view) {
      view.meta = parseMetaProp(view);
    }

    return view && new View(view);
  }

  static async share(viewId, ncMeta = Noco.ncMeta) {
    const view = await this.get(viewId);
    if (!view.uuid) {
      const uuid = uuidv4();
      view.uuid = uuid;
      // get existing cache
      const key = `${CacheScope.VIEW}:${view.id}`;
      const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
      if (o) {
        // update data
        o.uuid = uuid;
        // set cache
        await NocoCache.set(key, o);
      }
      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.VIEWS,
        {
          uuid: view.uuid,
        },
        viewId
      );
    }
    if (!view.meta || !('allowCSVDownload' in view.meta)) {
      const defaultMeta = {
        ...(view.meta ?? {}),
        allowCSVDownload: true,
      };
      // get existing cache
      const key = `${CacheScope.VIEW}:${view.id}`;
      const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
      if (o) {
        // update data
        o.meta = defaultMeta;
        // set cache
        await NocoCache.set(key, o);
      }
      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.VIEWS,
        {
          meta: JSON.stringify(defaultMeta),
        },
        viewId
      );
      view.meta = defaultMeta;
    }
    return view;
  }

  static async passwordUpdate(
    viewId: string,
    { password }: { password: string },
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.VIEW}:${viewId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o.password = password;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.VIEWS,
      {
        password,
      },
      viewId
    );
  }

  static async sharedViewDelete(viewId, ncMeta = Noco.ncMeta) {
    // get existing cache
    const key = `${CacheScope.VIEW}:${viewId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o.uuid = null;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.VIEWS,
      {
        uuid: null,
      },
      viewId
    );
  }

  static async update(
    viewId: string,
    body: {
      title?: string;
      order?: number;
      show_system_fields?: boolean;
      lock_type?: string;
      password?: string;
      uuid?: string;
      meta?: any;
    },
    ncMeta = Noco.ncMeta
  ) {
    const updateObj = extractProps(body, [
      'title',
      'order',
      'show_system_fields',
      'lock_type',
      'password',
      'meta',
      'uuid',
    ]);

    // get existing cache
    const key = `${CacheScope.VIEW}:${viewId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o = {
        ...o,
        ...updateObj,
      };
      if (o.is_default) {
        await NocoCache.set(`${CacheScope.VIEW}:${o.fk_model_id}:default`, o);
      }
      // set cache
      await NocoCache.set(key, o);
    }

    // if meta data defined then stringify it
    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // set meta
    await ncMeta.metaUpdate(null, null, MetaTable.VIEWS, updateObj, viewId);

    const view = await this.get(viewId);

    if (view.type === ViewTypes.GRID) {
      if ('show_system_fields' in updateObj) {
        await View.fixPVColumnForView(viewId, ncMeta);
      }
    }

    return view;
  }

  // @ts-ignore
  static async delete(viewId, ncMeta = Noco.ncMeta) {
    const view = await this.get(viewId);
    await Sort.deleteAll(viewId);
    await Filter.deleteAll(viewId);
    const table = this.extractViewTableName(view);
    const tableScope = this.extractViewTableNameScope(view);
    const columnTable = this.extractViewColumnsTableName(view);
    const columnTableScope = this.extractViewColumnsTableNameScope(view);
    await ncMeta.metaDelete(null, null, columnTable, {
      fk_view_id: viewId,
    });
    await NocoCache.deepDel(
      tableScope,
      `${tableScope}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
    await ncMeta.metaDelete(null, null, table, {
      fk_view_id: viewId,
    });
    await NocoCache.deepDel(
      columnTableScope,
      `${columnTableScope}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
    await ncMeta.metaDelete(null, null, MetaTable.VIEWS, viewId);
    await NocoCache.deepDel(
      CacheScope.VIEW,
      `${CacheScope.VIEW}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
    await NocoCache.del(`${CacheScope.VIEW}:${view.fk_model_id}:${view.title}`);
    await NocoCache.del(`${CacheScope.VIEW}:${view.fk_model_id}:${view.id}`);
  }

  private static extractViewColumnsTableName(view: View) {
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
    }
    return table;
  }

  private static extractViewTableName(view: View) {
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
    }
    return table;
  }

  private static extractViewColumnsTableNameScope(view: View) {
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
    }
    return scope;
  }

  static async showAllColumns(
    viewId,
    ignoreColdIds = [],
    ncMeta = Noco.ncMeta
  ) {
    const view = await this.get(viewId);
    const table = this.extractViewColumnsTableName(view);
    const scope = this.extractViewColumnsTableNameScope(view);

    const columns = await view
      .getModel(ncMeta)
      .then((meta) => meta.getColumns());
    const viewColumns = await this.getColumns(viewId, ncMeta);
    const availableColumnsInView = viewColumns.map(
      (column) => column.fk_column_id
    );

    // get existing cache
    const dataList = await NocoCache.getList(scope, [viewId]);
    if (dataList?.length) {
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
          viewId,
          viewColumns[colIndex].id,
          { show: true },
          ncMeta
        );
      } else {
        await this.insertColumn(
          {
            view_id: viewId,
            order: await ncMeta.metaGetNextOrder(table, {
              fk_view_id: viewId,
            }),
            show: true,
            fk_column_id: col.id,
          },
          ncMeta
        );
      }

      // return await ncMeta.metaUpdate(
      //   null,
      //   null,
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
    viewId,
    ignoreColdIds = [],
    ncMeta = Noco.ncMeta
  ) {
    const view = await this.get(viewId);
    const table = this.extractViewColumnsTableName(view);
    const scope = this.extractViewColumnsTableNameScope(view);

    if (view.type === ViewTypes.GRID) {
      const primary_value_column = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.COLUMNS,
        {
          fk_model_id: view.fk_model_id,
          pv: true,
        }
      );

      // keep primary_value_column always visible
      if (primary_value_column) {
        ignoreColdIds.push(primary_value_column.id);
      }
    }

    // get existing cache
    const dataList = await NocoCache.getList(scope, [viewId]);
    if (dataList?.length) {
      for (const o of dataList) {
        if (!ignoreColdIds?.length || !ignoreColdIds.includes(o.fk_column_id)) {
          // set data
          o.show = false;
          // set cache
          await NocoCache.set(`${scope}:${o.id}`, o);
        }
      }
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      table,
      { show: false },
      {
        fk_view_id: viewId,
      },
      ignoreColdIds?.length
        ? {
            _not: {
              fk_column_id: {
                in: ignoreColdIds,
              },
            },
          }
        : null
    );
  }

  async delete() {
    await View.delete(this.id);
  }

  static async shareViewList(tableId, ncMeta = Noco.ncMeta) {
    let sharedViews = await NocoCache.getList(CacheScope.VIEW, [tableId]);
    if (!sharedViews.length) {
      sharedViews = await ncMeta.metaList2(null, null, MetaTable.VIEWS, {
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
      });
      await NocoCache.setList(CacheScope.VIEW, [tableId], sharedViews);
    }
    sharedViews = sharedViews.filter((v) => v.uuid !== null);
    return sharedViews?.map((v) => new View(v));
  }

  static async fixPVColumnForView(viewId, ncMeta = Noco.ncMeta) {
    // get a list of view columns sorted by order
    const view_columns = await ncMeta.metaList2(
      null,
      null,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      }
    );
    const view_columns_meta = [];

    // get column meta for each view column
    for (const col of view_columns) {
      const col_meta = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.COLUMNS,
        col.fk_column_id
      );
      view_columns_meta.push(col_meta);
    }

    const primary_value_column_meta = view_columns_meta.find((col) => col.pv);

    if (primary_value_column_meta) {
      const primary_value_column = view_columns.find(
        (col) => col.fk_column_id === primary_value_column_meta.id
      );
      const primary_value_column_index = view_columns.findIndex(
        (col) => col.fk_column_id === primary_value_column_meta.id
      );
      const view_orders = view_columns.map((col) => col.order);
      const view_min_order = Math.min(...view_orders);

      // if primary_value_column is not visible, make it visible
      if (!primary_value_column.show) {
        await ncMeta.metaUpdate(
          null,
          null,
          MetaTable.GRID_VIEW_COLUMNS,
          { show: true },
          primary_value_column.id
        );
        await NocoCache.set(
          `${CacheScope.GRID_VIEW_COLUMN}:${primary_value_column.id}`,
          primary_value_column
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
            null,
            null,
            MetaTable.GRID_VIEW_COLUMNS,
            { order: i + 1 },
            view_columns[i].id
          );
          await NocoCache.set(
            `${CacheScope.GRID_VIEW_COLUMN}:${view_columns[i].id}`,
            view_columns[i]
          );
        }
      }
    }

    const views = await ncMeta.metaList2(
      null,
      null,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      }
    );
    await NocoCache.setList(CacheScope.GRID_VIEW_COLUMN, [viewId], views);
  }
}
