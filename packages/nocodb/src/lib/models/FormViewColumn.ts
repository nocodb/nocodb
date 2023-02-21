import Noco from '../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import { FormColumnType } from 'nocodb-sdk';
import { deserializeJSON, serializeJSON } from '../utils/serialize';
import View from './View';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';

export default class FormViewColumn implements FormColumnType {
  id?: string;
  label?: string;
  help?: string;
  description?: string;
  required?: boolean;
  enable_scanner?: boolean;
  show?: boolean;
  order?: number;

  fk_view_id?: string;
  fk_column_id?: string;
  project_id?: string;
  base_id?: string;
  meta?: string | Record<string, any>;

  constructor(data: FormViewColumn) {
    Object.assign(this, data);
  }

  uuid?: any;

  public static async get(formViewColumnId: string, ncMeta = Noco.ncMeta) {
    let viewColumn =
      formViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.FORM_VIEW_COLUMN}:${formViewColumnId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.FORM_VIEW_COLUMNS,
        formViewColumnId
      );
      viewColumn.meta =
        viewColumn.meta && typeof viewColumn.meta === 'string'
          ? JSON.parse(viewColumn.meta)
          : viewColumn.meta;
    }
    await NocoCache.set(
      `${CacheScope.FORM_VIEW_COLUMN}:${formViewColumnId}`,
      viewColumn
    );

    return viewColumn && new FormViewColumn(viewColumn);
  }

  static async insert(column: Partial<FormViewColumn>, ncMeta = Noco.ncMeta) {
    const insertObj: Partial<FormViewColumn> = {
      fk_view_id: column.fk_view_id,
      fk_column_id: column.fk_column_id,
      order: await ncMeta.metaGetNextOrder(MetaTable.FORM_VIEW_COLUMNS, {
        fk_view_id: column.fk_view_id,
      }),
      show: column.show,
      project_id: column.project_id,
      base_id: column.base_id,
      label: column.label,
      help: column.help,
      description: column.description,
      required: column.required,
      enable_scanner: column.enable_scanner,
    };

    if (column.meta) {
      insertObj.meta = serializeJSON(column.meta);
    }

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

    // if cache is not present skip pushing it into the list to avoid unexpected behaviour
    if (
      (
        await NocoCache.getList(CacheScope.FORM_VIEW_COLUMN, [
          column.fk_view_id,
        ])
      )?.length
    )
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
      viewId,
    ]);
    if (!viewColumns.length) {
      viewColumns = await ncMeta.metaList2(
        null,
        null,
        MetaTable.FORM_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        }
      );

      for (const viewColumn of viewColumns) {
        viewColumn.meta = deserializeJSON(viewColumn.meta);
      }

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
    return viewColumns?.map((v) => new FormViewColumn(v));
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
      'order',
      'meta',
      'enable_scanner',
    ]);

    // get existing cache
    const key = `${CacheScope.FORM_VIEW_COLUMN}:${columnId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      Object.assign(o, insertObj);
      // set cache
      await NocoCache.set(key, o);
    }

    if (insertObj.meta) {
      insertObj.meta = serializeJSON(insertObj.meta);
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
