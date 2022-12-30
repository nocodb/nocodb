import FormulaColumn from './FormulaColumn';
import LinkToAnotherRecordColumn from './LinkToAnotherRecordColumn';
import LookupColumn from './LookupColumn';
import RollupColumn from './RollupColumn';
import SelectOption from './SelectOption';
import Model from './Model';
import NocoCache from '../cache/NocoCache';
import {
  AllowedColumnTypesForQrAndBarcodes,
  ColumnReqType,
  ColumnType,
  UITypes,
} from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import View from './View';
import Noco from '../Noco';
import Sort from './Sort';
import Filter from './Filter';
import addFormulaErrorIfMissingColumn from '../meta/helpers/addFormulaErrorIfMissingColumn';
import { NcError } from '../meta/helpers/catchError';
import QrCodeColumn from './QrCodeColumn';
import BarcodeColumn from './BarcodeColumn';

export default class Column<T = any> implements ColumnType {
  public fk_model_id: string;
  public project_id: string;
  public base_id: string;

  public column_name: string;
  public title: string;

  public uidt: UITypes;
  public dt: string;
  public np: string;
  public ns: string;
  public clen: string;
  public cop: string;
  public pk: boolean;
  public pv: boolean;
  public rqd: boolean;
  public un: boolean;
  public ct: string;
  public ai: boolean;
  public unique: boolean;
  public cdf: string;
  public cc: string;
  public csn: string;
  public dtx: string;
  public dtxp: string;
  public dtxs: string;
  public au: boolean;
  public system: boolean;

  public colOptions: T;
  public model: Model;

  public order: number;

  public validate: any;
  public meta: any;

  constructor(data: Partial<ColumnType | Column>) {
    Object.assign(this, data);
  }

  public async getModel(): Promise<Model> {
    return Model.getByIdOrName({
      id: this.fk_model_id,
    });
  }

  public static async insert<T>(
    column: Partial<T> & {
      base_id?: string;
      [key: string]: any;
      fk_model_id: string;
      uidt: UITypes | string;
    } & Pick<ColumnReqType, 'column_order'>,
    ncMeta = Noco.ncMeta
  ) {
    if (!column.fk_model_id) NcError.badRequest('Missing model id');

    const insertObj: any = {
      id: column?.id,
      fk_model_id: column.fk_model_id,
      column_name: column.column_name || column.cn,
      title: column.title || column._cn,
      uidt: column.uidt,
      dt: column.dt,
      np: column.np,
      ns: column.ns,
      clen: column.clen,
      cop: column.cop,
      pk: column.pk,
      rqd: column.rqd,
      un: column.un,
      ct: column.ct,
      ai: column.ai,
      unique: column.unique,
      cdf: column.cdf,
      cc: column.cc,
      csn: column.csn,
      dtx: column.dtx,
      dtxp: column.dtxp,
      dtxs: column.dtxs,
      au: column.au,
      pv: column.pv,
      order: column.order,
      project_id: column.project_id,
      base_id: column.base_id,
      system: column.system,
      meta:
        column.meta && typeof column.meta === 'object'
          ? JSON.stringify(column.meta)
          : column.meta,
    };

    if (column.validate) {
      if (typeof column.validate === 'string')
        insertObj.validate = column.validate;
      else insertObj.validate = JSON.stringify(column.validate);
    }

    if (!(column.project_id && column.base_id)) {
      const model = await Model.getByIdOrName(
        { id: column.fk_model_id },
        ncMeta
      );
      insertObj.project_id = model.project_id;
      insertObj.base_id = model.base_id;
    }

    if (!column.uidt) throw new Error('UI Datatype not found');
    const row = await ncMeta.metaInsert2(
      null, //column.project_id || column.base_id,
      null, //column.db_alias,
      MetaTable.COLUMNS,
      insertObj
    );

    const col = await this.get({ colId: row.id }, ncMeta);

    await NocoCache.appendToList(
      CacheScope.COLUMN,
      [column.fk_model_id],
      `${CacheScope.COLUMN}:${row.id}`
    );

    await this.insertColOption(column, row.id, ncMeta);

    await View.insertColumnToAllViews(
      {
        fk_column_id: row.id,
        fk_model_id: column.fk_model_id,
        show: true,
        column_order: column.column_order,
      },
      ncMeta
    );

    return col;
  }

  private static async insertColOption<T>(
    column: Partial<T> & { base_id?: string; [p: string]: any },
    colId,
    ncMeta = Noco.ncMeta
  ) {
    switch (column.uidt || column.ui_data_type) {
      case UITypes.Lookup: {
        // LookupColumn.insert()
        await LookupColumn.insert(
          {
            fk_column_id: colId,
            fk_relation_column_id: column.fk_relation_column_id,
            fk_lookup_column_id: column.fk_lookup_column_id,
          },
          ncMeta
        );
        break;
      }
      case UITypes.Rollup: {
        await RollupColumn.insert(
          {
            fk_column_id: colId,
            fk_relation_column_id: column.fk_relation_column_id,

            fk_rollup_column_id: column.fk_rollup_column_id,
            rollup_function: column.rollup_function,
          },
          ncMeta
        );
        break;
      }
      case UITypes.LinkToAnotherRecord: {
        await LinkToAnotherRecordColumn.insert(
          {
            fk_column_id: colId,

            // ref_db_alias
            type: column.type,
            // db_type:

            fk_child_column_id: column.fk_child_column_id,
            fk_parent_column_id: column.fk_parent_column_id,

            fk_mm_model_id: column.fk_mm_model_id,
            fk_mm_child_column_id: column.fk_mm_child_column_id,
            fk_mm_parent_column_id: column.fk_mm_parent_column_id,

            ur: column.ur,
            dr: column.dr,

            fk_index_name: column.fk_index_name,
            fk_related_model_id: column.fk_related_model_id,

            virtual: column.virtual,
          },
          ncMeta
        );
        break;
      }
      case UITypes.QrCode: {
        await QrCodeColumn.insert(
          {
            fk_column_id: colId,
            fk_qr_value_column_id: column.fk_qr_value_column_id,
          },
          ncMeta
        );
        break;
      }
      case UITypes.Barcode: {
        await BarcodeColumn.insert(
          {
            fk_column_id: colId,
            fk_barcode_value_column_id: column.fk_barcode_value_column_id,
            barcode_format: column.barcode_format,
          },
          ncMeta
        );
        break;
      }
      case UITypes.Formula: {
        await FormulaColumn.insert(
          {
            fk_column_id: colId,
            formula: column.formula,
            formula_raw: column.formula_raw,
          },
          ncMeta
        );
        break;
      }
      case UITypes.MultiSelect: {
        if (!column.colOptions?.options) {
          const selectColors = [
            '#cfdffe',
            '#d0f1fd',
            '#c2f5e8',
            '#ffdaf6',
            '#ffdce5',
            '#fee2d5',
            '#ffeab6',
            '#d1f7c4',
            '#ede2fe',
            '#eeeeee',
          ];
          for (const [i, option] of column.dtxp?.split(',').entries() ||
            [].entries()) {
            await SelectOption.insert(
              {
                fk_column_id: colId,
                title: option.replace(/^'/, '').replace(/'$/, ''),
                order: i + 1,
                color: selectColors[i % selectColors.length],
              },
              ncMeta
            );
          }
        } else {
          for (const [i, option] of column.colOptions.options.entries() ||
            [].entries()) {
            // Trim end of enum/set
            if (column.dt === 'enum' || column.dt === 'set') {
              option.title = option.title.trimEnd();
            }
            await SelectOption.insert(
              {
                ...option,
                fk_column_id: colId,
                order: i + 1,
              },
              ncMeta
            );
          }
        }
        break;
      }
      case UITypes.SingleSelect: {
        if (!column.colOptions?.options) {
          const selectColors = [
            '#cfdffe',
            '#d0f1fd',
            '#c2f5e8',
            '#ffdaf6',
            '#ffdce5',
            '#fee2d5',
            '#ffeab6',
            '#d1f7c4',
            '#ede2fe',
            '#eeeeee',
          ];
          for (const [i, option] of column.dtxp?.split(',').entries() ||
            [].entries()) {
            await SelectOption.insert(
              {
                fk_column_id: colId,
                title: option.replace(/^'/, '').replace(/'$/, ''),
                order: i + 1,
                color: selectColors[i % selectColors.length],
              },
              ncMeta
            );
          }
        } else {
          for (const [i, option] of column.colOptions.options.entries() ||
            [].entries()) {
            // Trim end of enum/set
            if (column.dt === 'enum' || column.dt === 'set') {
              option.title = option.title.trimEnd();
            }
            await SelectOption.insert(
              {
                ...option,
                fk_column_id: colId,
                order: i + 1,
              },
              ncMeta
            );
          }
        }
        break;
      }

      /*  default:
        {
          await ncMeta.metaInsert2(
            model.project_id,
            model.db_alias,
            'nc_col_props_v2',
            {
              column_id: model.column_id,

              cn: model.cn,
              // todo: decide type
              uidt: model.uidt,
              dt: model.dt,
              np: model.np,
              ns: model.ns,
              clen: model.clen,
              cop: model.cop,
              pk: model.pk,
              rqd: model.rqd,
              un: model.un,
              ct: model.ct,
              ai: model.ai,
              unique: model.unique,
              ctf: model.ctf,
              cc: model.cc,
              csn: model.csn,
              dtx: model.dtx,
              dtxp: model.dtxp,
              dtxs: model.dtxs,
              au: model.au
            }
          );
          if (
            model.uidt === UITypes.MultiSelect ||
            model.uidt === UITypes.SingleSelect
          ) {
            for (const option of model.dtxp.split(','))
              await ncMeta.metaInsert2(
                model.project_id,
                model.db_alias,
                MetaTable.COL_SELECT_OPTIONS',
                {
                  column_id: colId,
                  name: option
                }
              );
          }
        }
        break;*/
    }
  }

  public async getColOptions<T>(ncMeta = Noco.ncMeta): Promise<T> {
    let res: any;

    switch (this.uidt) {
      case UITypes.Lookup:
        res = await LookupColumn.read(this.id, ncMeta);
        break;
      case UITypes.Rollup:
        res = await RollupColumn.read(this.id, ncMeta);
        break;
      case UITypes.LinkToAnotherRecord:
        res = await LinkToAnotherRecordColumn.read(this.id, ncMeta);
        break;
      case UITypes.MultiSelect:
        res = await SelectOption.read(this.id, ncMeta);
        break;
      case UITypes.SingleSelect:
        res = await SelectOption.read(this.id, ncMeta);
        break;
      case UITypes.Formula:
        res = await FormulaColumn.read(this.id, ncMeta);
        break;
      case UITypes.QrCode:
        res = await QrCodeColumn.read(this.id, ncMeta);
        break;
      case UITypes.Barcode:
        res = await BarcodeColumn.read(this.id, ncMeta);
        break;
      // default:
      //   res = await DbColumn.read(this.id);
      //   break;
    }
    this.colOptions = res;
    return res;
  }

  async loadModel(force = false): Promise<Model> {
    if (!this.model || force) {
      this.model = await Model.getByIdOrName({
        // base_id: this.project_id,
        // db_alias: this.db_alias,
        id: this.fk_model_id,
      });
    }

    return this.model;
  }

  public static async clearList({ fk_model_id }) {
    await NocoCache.deepDel(
      CacheScope.COLUMN,
      `${CacheScope.COLUMN}:${fk_model_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD
    );
  }

  public static async clear({ id }) {
    await NocoCache.delAll(CacheScope.COLUMN, `*${id}*`);
  }

  public static async list(
    {
      fk_model_id,
    }: {
      fk_model_id: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<Column[]> {
    let columnsList = await NocoCache.getList(CacheScope.COLUMN, [fk_model_id]);
    if (!columnsList.length) {
      columnsList = await ncMeta.metaList2(null, null, MetaTable.COLUMNS, {
        condition: {
          fk_model_id,
        },
        orderBy: {
          order: 'asc',
        },
      });

      columnsList.forEach((column) => {
        if (column.meta && typeof column.meta === 'string') {
          try {
            column.meta = JSON.parse(column.meta);
          } catch {
            column.meta = {};
          }
        }
      });

      await NocoCache.setList(CacheScope.COLUMN, [fk_model_id], columnsList);
    }
    columnsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity)
    );
    return Promise.all(
      columnsList.map(async (m) => {
        const column = new Column(m);
        await column.getColOptions(ncMeta);
        return column;
      })
    );

    /*const columns = ncMeta
      .knex('nc_models_v2 as tab')
      .select(
        'col.id',
        'col.cn',
        'col._cn',
        'col.uidt',
        'rel.rel_cn',
        'rel.ref_rel_cn',
        'rel.id as rel_id'
      )
      .join('nc_columns_v2 as col', 'tab.id', 'col.model_id')
      .leftJoin(
        ncMeta
          .knex('nc_col_relations_v2 as r')
          .select(
            'r.*',
            'col1.cn as rel_cn',
            'col1._cn as _rel_cn',
            'col2.cn as ref_rel_cn',
            'col2._cn as _ref_rel_cn'
          )
          .join('nc_columns_v2 as col1', 'col1.id', 'r.rel_column_id')
          .join('nc_columns_v2 as col2', 'col2.id', 'r.ref_rel_column_id')
          .as('rel'),
        'col.id',
        'rel.column_id'
      )
      .condition(condition)
      .where({
        'tab.base_id': base_id,
        'tab.db_alias': db_alias
      });

    return columns.map(c => new Column(c));*/
  }

  public static async get(
    {
      base_id,
      db_alias,
      colId,
    }: {
      base_id?: string;
      db_alias?: string;
      colId: string;
    },
    ncMeta = Noco.ncMeta
  ): Promise<Column> {
    let colData =
      colId &&
      (await NocoCache.get(
        `${CacheScope.COLUMN}:${colId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        base_id,
        db_alias,
        MetaTable.COLUMNS,
        colId
      );
      if (colData) {
        try {
          colData.meta = JSON.parse(colData.meta);
        } catch {
          colData.meta = {};
        }
        await NocoCache.set(`${CacheScope.COLUMN}:${colId}`, colData);
      }
    }
    if (colData) {
      const column = new Column(colData);
      await column.getColOptions(ncMeta);
      return column;
    }
    return null;
  }

  id: string;

  static async delete(id, ncMeta = Noco.ncMeta) {
    const col = await this.get({ colId: id }, ncMeta);

    // todo: or instead of delete reset related foreign key value to null and handle in BaseModel

    // get qr code columns and delete
    {
      const qrCodeCols = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_QRCODE,
        {
          condition: { fk_qr_value_column_id: id },
        }
      );
      for (const qrCodeCol of qrCodeCols) {
        await Column.delete(qrCodeCol.fk_column_id, ncMeta);
      }
    }

    {
      const barcodeCols = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_BARCODE,
        {
          condition: { fk_barcode_value_column_id: id },
        }
      );
      for (const barcodeCol of barcodeCols) {
        await Column.delete(barcodeCol.fk_column_id, ncMeta);
      }
    }

    // get lookup columns and delete
    {
      let lookups = await NocoCache.getList(CacheScope.COL_LOOKUP, [id]);
      if (!lookups.length) {
        lookups = await ncMeta.metaList2(null, null, MetaTable.COL_LOOKUP, {
          condition: { fk_lookup_column_id: id },
        });
      }
      for (const lookup of lookups) {
        await Column.delete(lookup.fk_column_id, ncMeta);
      }
    }

    // get rollup column and delete
    {
      let rollups = await NocoCache.getList(CacheScope.COL_ROLLUP, [id]);
      if (!rollups.length) {
        rollups = await ncMeta.metaList2(null, null, MetaTable.COL_ROLLUP, {
          condition: { fk_rollup_column_id: id },
        });
      }
      for (const rollup of rollups) {
        await Column.delete(rollup.fk_column_id, ncMeta);
      }
    }

    {
      let formulaColumns = await NocoCache.getList(CacheScope.COLUMN, [
        col.fk_model_id,
      ]);
      if (!formulaColumns.length) {
        formulaColumns = await ncMeta.metaList2(null, null, MetaTable.COLUMNS, {
          condition: {
            fk_model_id: col.fk_model_id,
            uidt: UITypes.Formula,
          },
        });
      }
      formulaColumns = formulaColumns.filter((c) => c.uidt === UITypes.Formula);

      for (const formulaCol of formulaColumns) {
        const formula = await new Column(
          formulaCol
        ).getColOptions<FormulaColumn>();
        if (
          addFormulaErrorIfMissingColumn({
            formula,
            columnId: id,
            title: col?.title,
          })
        )
          await FormulaColumn.update(formulaCol.id, formula, ncMeta);
      }
    }

    //  if relation column check lookup and rollup and delete
    if (col.uidt === UITypes.LinkToAnotherRecord) {
      // get lookup columns using relation and delete
      let lookups = await NocoCache.getList(CacheScope.COL_LOOKUP, [id]);
      if (!lookups.length) {
        lookups = await ncMeta.metaList2(null, null, MetaTable.COL_LOOKUP, {
          condition: { fk_relation_column_id: id },
        });
      }
      for (const lookup of lookups) {
        await Column.delete(lookup.fk_column_id, ncMeta);
      }

      // get rollup columns using relation and delete
      let rollups = await NocoCache.getList(CacheScope.COL_ROLLUP, [id]);
      if (!rollups.length) {
        rollups = await ncMeta.metaList2(null, null, MetaTable.COL_ROLLUP, {
          condition: { fk_relation_column_id: id },
        });
      }
      for (const rollup of rollups) {
        await Column.delete(rollup.fk_column_id, ncMeta);
      }
    }

    // delete sorts
    {
      let sorts = await NocoCache.getList(CacheScope.SORT, [id]);
      if (!sorts.length) {
        sorts = await ncMeta.metaList2(null, null, MetaTable.SORT, {
          condition: {
            fk_column_id: id,
          },
        });
      }
      for (const sort of sorts) {
        await Sort.delete(sort.id, ncMeta);
      }
    }
    // delete filters
    {
      let filters = await NocoCache.getList(CacheScope.FILTER_EXP, [id]);
      if (!filters.length) {
        filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
          condition: {
            fk_column_id: id,
          },
        });
      }
      for (const filter of filters) {
        await Filter.delete(filter.id, ncMeta);
      }
    }

    // Delete from view columns
    let colOptionTableName = null;
    let cacheScopeName = null;
    switch (col.uidt) {
      case UITypes.Rollup:
        colOptionTableName = MetaTable.COL_ROLLUP;
        cacheScopeName = CacheScope.COL_ROLLUP;
        break;
      case UITypes.Lookup:
        colOptionTableName = MetaTable.COL_LOOKUP;
        cacheScopeName = CacheScope.COL_LOOKUP;
        break;
      case UITypes.LinkToAnotherRecord:
        colOptionTableName = MetaTable.COL_RELATIONS;
        cacheScopeName = CacheScope.COL_RELATION;
        break;
      case UITypes.MultiSelect:
      case UITypes.SingleSelect:
        colOptionTableName = MetaTable.COL_SELECT_OPTIONS;
        cacheScopeName = CacheScope.COL_SELECT_OPTION;
        break;
      case UITypes.Formula:
        colOptionTableName = MetaTable.COL_FORMULA;
        cacheScopeName = CacheScope.COL_FORMULA;
        break;
      case UITypes.QrCode:
        colOptionTableName = MetaTable.COL_QRCODE;
        cacheScopeName = CacheScope.COL_QRCODE;
        break;
      case UITypes.Barcode:
        colOptionTableName = MetaTable.COL_BARCODE;
        cacheScopeName = CacheScope.COL_BARCODE;
        break;
    }

    if (colOptionTableName && cacheScopeName) {
      await ncMeta.metaDelete(null, null, colOptionTableName, {
        fk_column_id: col.id,
      });
      await NocoCache.deepDel(
        cacheScopeName,
        `${cacheScopeName}:${col.id}`,
        CacheDelDirection.CHILD_TO_PARENT
      );
    }

    // Grid View Columns
    await ncMeta.metaDelete(null, null, MetaTable.GRID_VIEW_COLUMNS, {
      fk_column_id: col.id,
    });
    const gridViewColumnId = await NocoCache.get(
      `${CacheScope.GRID_VIEW_COLUMN}:${col.id}`,
      CacheGetType.TYPE_STRING
    );
    if (gridViewColumnId) {
      await NocoCache.deepDel(
        CacheScope.GRID_VIEW_COLUMN,
        `${CacheScope.GRID_VIEW_COLUMN}:${gridViewColumnId}`,
        CacheDelDirection.CHILD_TO_PARENT
      );
      await NocoCache.del(`${CacheScope.GRID_VIEW_COLUMN}:${col.id}`);
    }

    // Form View Columns
    await ncMeta.metaDelete(null, null, MetaTable.FORM_VIEW_COLUMNS, {
      fk_column_id: col.id,
    });
    const formViewColumnId = await NocoCache.get(
      `${CacheScope.FORM_VIEW_COLUMN}:${col.id}`,
      CacheGetType.TYPE_STRING
    );
    if (formViewColumnId) {
      await NocoCache.deepDel(
        CacheScope.FORM_VIEW_COLUMN,
        `${CacheScope.FORM_VIEW_COLUMN}:${formViewColumnId}`,
        CacheDelDirection.CHILD_TO_PARENT
      );
      await NocoCache.del(`${CacheScope.FORM_VIEW_COLUMN}:${col.id}`);
    }

    // Kanban View Columns
    await ncMeta.metaDelete(null, null, MetaTable.KANBAN_VIEW_COLUMNS, {
      fk_column_id: col.id,
    });
    const kanbanViewColumnId = await NocoCache.get(
      `${CacheScope.KANBAN_VIEW_COLUMN}:${col.id}`,
      CacheGetType.TYPE_STRING
    );
    if (kanbanViewColumnId) {
      await NocoCache.deepDel(
        CacheScope.KANBAN_VIEW_COLUMN,
        `${CacheScope.KANBAN_VIEW_COLUMN}:${kanbanViewColumnId}`,
        CacheDelDirection.CHILD_TO_PARENT
      );
      await NocoCache.del(`${CacheScope.KANBAN_VIEW_COLUMN}:${col.id}`);
    }

    // Gallery View Column
    await ncMeta.metaDelete(null, null, MetaTable.GALLERY_VIEW_COLUMNS, {
      fk_column_id: col.id,
    });
    const galleryViewColumnId = await NocoCache.get(
      `${CacheScope.GALLERY_VIEW_COLUMN}:${col.id}`,
      CacheGetType.TYPE_STRING
    );
    if (galleryViewColumnId) {
      await NocoCache.deepDel(
        CacheScope.GALLERY_VIEW_COLUMN,
        `${CacheScope.GALLERY_VIEW_COLUMN}:${galleryViewColumnId}`,
        CacheDelDirection.CHILD_TO_PARENT
      );
      await NocoCache.del(`${CacheScope.GALLERY_VIEW_COLUMN}:${col.id}`);
    }

    // Get LTAR columns in which current column is referenced as foreign key
    const ltarColumns = await ncMeta.metaList2(
      null,
      null,
      MetaTable.COL_RELATIONS,
      {
        xcCondition: {
          _or: [
            { fk_child_column_id: { eq: col.id } },
            { fk_parent_column_id: { eq: col.id } },
            { fk_mm_child_column_id: { eq: col.id } },
            { fk_mm_parent_column_id: { eq: col.id } },
          ],
        },
      }
    );

    // Delete LTAR columns in which current column is referenced as foreign key
    for (const ltarColumn of ltarColumns) {
      await Column.delete(ltarColumn.fk_column_id, ncMeta);
    }

    // Columns
    await ncMeta.metaDelete(null, null, MetaTable.COLUMNS, col.id);
    await NocoCache.deepDel(
      CacheScope.COLUMN,
      `${CacheScope.COLUMN}:${col.id}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
  }

  static async update(colId: string, column: any, ncMeta = Noco.ncMeta) {
    const oldCol = await Column.get({ colId }, ncMeta);

    switch (oldCol.uidt) {
      case UITypes.Lookup: {
        // LookupColumn.insert()

        await ncMeta.metaDelete(null, null, MetaTable.COL_LOOKUP, {
          fk_column_id: colId,
        });
        await NocoCache.deepDel(
          CacheScope.COL_LOOKUP,
          `${CacheScope.COL_LOOKUP}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT
        );
        break;
      }
      case UITypes.Rollup: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_ROLLUP, {
          fk_column_id: colId,
        });
        await NocoCache.deepDel(
          CacheScope.COL_ROLLUP,
          `${CacheScope.COL_ROLLUP}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT
        );
        break;
      }

      case UITypes.LinkToAnotherRecord: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_RELATIONS, {
          fk_column_id: colId,
        });
        await NocoCache.deepDel(
          CacheScope.COL_RELATION,
          `${CacheScope.COL_RELATION}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT
        );
        break;
      }
      case UITypes.Formula: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_FORMULA, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          CacheScope.COL_FORMULA,
          `${CacheScope.COL_FORMULA}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT
        );
        break;
      }
      case UITypes.QrCode: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_QRCODE, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          CacheScope.COL_QRCODE,
          `${CacheScope.COL_QRCODE}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT
        );
        break;
      }

      case UITypes.Barcode: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_BARCODE, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          CacheScope.COL_BARCODE,
          `${CacheScope.COL_BARCODE}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT
        );
        break;
      }

      case UITypes.MultiSelect:
      case UITypes.SingleSelect: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_SELECT_OPTIONS, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          CacheScope.COL_SELECT_OPTION,
          `${CacheScope.COL_SELECT_OPTION}:${colId}:list`,
          CacheDelDirection.PARENT_TO_CHILD
        );
        break;
      }
    }
    const updateObj = {
      column_name: column.column_name,
      title: column.title,
      uidt: column.uidt,
      dt: column.dt,
      np: column.np,
      ns: column.ns,
      clen: column.clen,
      cop: column.cop,
      pk: column.pk,
      rqd: column.rqd,
      un: column.un,
      ct: column.ct,
      ai: column.ai,
      unique: column.unique,
      cdf: column.cdf,
      cc: column.cc,
      csn: column.csn,
      dtx: column.dtx,
      dtxp: column.dtxp,
      dtxs: column.dtxs,
      au: column.au,
      pv: column.pv,
      system: column.system,
      validate: null,
      meta: column.meta,
    };

    if (column.validate) {
      if (typeof column.validate === 'string')
        updateObj.validate = column.validate;
      else updateObj.validate = JSON.stringify(column.validate);
    }

    // get qr code columns and delete if target type is not supported by QR code column type
    if (!AllowedColumnTypesForQrAndBarcodes.includes(updateObj.uidt)) {
      const qrCodeCols = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_QRCODE,
        {
          condition: { fk_qr_value_column_id: colId },
        }
      );
      const barcodeCols = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_BARCODE,
        {
          condition: { fk_barcode_value_column_id: colId },
        }
      );
      for (const qrCodeCol of qrCodeCols) {
        await Column.delete(qrCodeCol.fk_column_id, ncMeta);
      }
      for (const barcodeCol of barcodeCols) {
        await Column.delete(barcodeCol.fk_column_id, ncMeta);
      }
    }

    // get existing cache
    const key = `${CacheScope.COLUMN}:${colId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COLUMNS,
      {
        ...updateObj,
        meta:
          updateObj.meta && typeof updateObj.meta === 'object'
            ? JSON.stringify(updateObj.meta)
            : updateObj.meta,
      },
      colId
    );
    await this.insertColOption(column, colId, ncMeta);
  }

  static async updateAlias(
    colId: string,
    { title }: { title: string },
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.COLUMN}:${colId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o.title = title;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(
      null, //column.project_id || column.base_id,
      null, //column.db_alias,
      MetaTable.COLUMNS,
      {
        title,
      },
      colId
    );
  }

  public getValidators(): any {
    if (this.validate && typeof this.validate === 'string')
      try {
        return JSON.parse(this.validate);
      } catch {}
    return null;
  }

  async delete(ncMeta = Noco.ncMeta) {
    return await Column.delete(this.id, ncMeta);
  }

  static async checkTitleAvailable(
    {
      column_name,
      fk_model_id,
      exclude_id,
    }: { column_name; fk_model_id; exclude_id? },
    ncMeta = Noco.ncMeta
  ) {
    return !(await ncMeta.metaGet2(
      null,
      null,
      MetaTable.COLUMNS,
      {
        column_name,
        fk_model_id,
      },
      null,
      exclude_id && { id: { neq: exclude_id } }
    ));
  }

  static async checkAliasAvailable(
    { title, fk_model_id, exclude_id }: { title; fk_model_id; exclude_id? },
    ncMeta = Noco.ncMeta
  ) {
    return !(await ncMeta.metaGet2(
      null,
      null,
      MetaTable.COLUMNS,
      {
        title,
        fk_model_id,
      },
      null,
      exclude_id && { id: { neq: exclude_id } }
    ));
  }

  static async markAsSystemField(
    colId: string,
    system = true,
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.COLUMN}:${colId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o.system = system;
      // set cache
      await NocoCache.set(key, o);
    }
    // update system field in meta db
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COLUMNS,
      {
        system,
      },
      colId
    );
  }
}
