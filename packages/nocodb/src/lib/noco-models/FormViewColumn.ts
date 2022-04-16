import Noco from '../noco/Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import { FormColumnType } from 'nocodb-sdk';
import View from './View';
import NocoCache from '../noco-cache/NocoCache';
import extractProps from '../noco/meta/helpers/extractProps';

export default class FormViewColumn implements FormColumnType {
  id?: string;
  label?: string;
  help?: string;
  description?: string;
  required?: boolean;
  show?: boolean;
  order?: number;

  fk_view_id?: string;
  fk_column_id?: string;
  project_id?: string;
  base_id?: string;

  constructor(data: FormViewColumn) {
    Object.assign(this, data);
  }

  uuid?: any;

  public static async get(formViewId: string, ncMeta = Noco.ncMeta) {
    let view =
      formViewId &&
      (await NocoCache.get(
        `${CacheScope.FORM_VIEW_COLUMN}:${formViewId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.FORM_VIEW_COLUMNS,
        formViewId
      );
    }
    await NocoCache.set(`${CacheScope.FORM_VIEW_COLUMN}:${formViewId}`, view);

    return view && new FormViewColumn(view);
  }

  static async insert(column: Partial<FormViewColumn>, ncMeta = Noco.ncMeta) {
    const insertObj = {
      fk_view_id: column.fk_view_id,
      fk_column_id: column.fk_column_id,
      order: await ncMeta.metaGetNextOrder(MetaTable.FORM_VIEW_COLUMNS, {
        fk_view_id: column.fk_view_id
      }),
      show: column.show,
      project_id: column.project_id,
      base_id: column.base_id,
      label: column.label,
      help: column.help,
      description: column.description,
      required: column.required
    };

    if (!(column.project_id && column.base_id)) {
      const viewRef = await View.get(column.fk_view_id, ncMeta);
      insertObj.project_id = viewRef.project_id;
      insertObj.base_id = viewRef.base_id;
    }

    const { id, fk_column_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.FORM_VIEW_COLUMNS,
      insertObj
    );

    await NocoCache.set(`${CacheScope.FORM_VIEW_COLUMN}:${fk_column_id}`, id);

    await NocoCache.appendToList(
      CacheScope.FORM_VIEW_COLUMN,
      [column.fk_view_id],
      `${CacheScope.FORM_VIEW_COLUMN}:${id}`
    );
    return this.get(id, ncMeta);
  }

  public static async list(
    viewId: string,
    ncMeta = Noco.ncMeta
  ): Promise<FormViewColumn[]> {
    let viewColumns = await NocoCache.getList(CacheScope.FORM_VIEW_COLUMN, [
      viewId
    ]);
    if (!viewColumns.length) {
      viewColumns = await ncMeta.metaList2(
        null,
        null,
        MetaTable.FORM_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId
          },
          orderBy: {
            order: 'asc'
          }
        }
      );
      await NocoCache.setList(
        CacheScope.FORM_VIEW_COLUMN,
        [viewId],
        viewColumns
      );
    }
    viewColumns.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity)
    );
    return viewColumns?.map(v => new FormViewColumn(v));
  }

  static async update(
    columnId: string,
    body: Partial<FormViewColumn>,
    ncMeta = Noco.ncMeta
  ) {
    const insertObj = extractProps(body, [
      'label',
      'help',
      'description',
      'required',
      'show',
      'order'
    ]);
    // get existing cache
    const key = `${CacheScope.FORM_VIEW_COLUMN}:${columnId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      Object.assign(o, insertObj);
      // set cache
      await NocoCache.set(key, o);
    }
    // update meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.FORM_VIEW_COLUMNS,
      insertObj,
      columnId
    );
  }

  created_at?: string;
  updated_at?: string;
}
