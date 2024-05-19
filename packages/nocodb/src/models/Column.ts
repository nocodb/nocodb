import {
  AllowedColumnTypesForQrAndBarcodes,
  isLinksOrLTAR,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { ColumnReqType, ColumnType } from 'nocodb-sdk';
import FormulaColumn from '~/models/FormulaColumn';
import LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import LookupColumn from '~/models/LookupColumn';
import RollupColumn from '~/models/RollupColumn';
import SelectOption from '~/models/SelectOption';
import Model from '~/models/Model';
import View from '~/models/View';
import Sort from '~/models/Sort';
import Filter from '~/models/Filter';
import QrCodeColumn from '~/models/QrCodeColumn';
import BarcodeColumn from '~/models/BarcodeColumn';
import { LinksColumn } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import addFormulaErrorIfMissingColumn from '~/helpers/addFormulaErrorIfMissingColumn';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
} from '~/utils/modelUtils';
import { getFormulasReferredTheColumn } from '~/helpers/formulaHelpers';

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

const logger = new Logger('Column');

export default class Column<T = any> implements ColumnType {
  public fk_model_id: string;
  public base_id: string;
  public source_id: string;

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

  public async getModel(ncMeta = Noco.ncMeta): Promise<Model> {
    return Model.getByIdOrName(
      {
        id: this.fk_model_id,
      },
      ncMeta,
    );
  }

  public static async insert<T>(
    column: Partial<T> & {
      source_id?: string;
      [key: string]: any;
      fk_model_id: string;
      uidt: UITypes | string;
      view_id?: string;
    } & Pick<ColumnReqType, 'column_order'>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!column.fk_model_id) NcError.badRequest('Missing model id');

    // TODO: fix type
    const insertObj = extractProps(column as any, [
      'id',
      'fk_model_id',
      'column_name',
      'title',
      'uidt',
      'dt',
      'np',
      'ns',
      'clen',
      'cop',
      'pk',
      'rqd',
      'un',
      'ct',
      'ai',
      'unique',
      'cdf',
      'cc',
      'csn',
      'dtx',
      'dtxp',
      'dtxs',
      'au',
      'pv',
      'order',
      'base_id',
      'source_id',
      'system',
      'meta',
    ]);

    if (!insertObj.column_name) {
      insertObj.column_name = column.cn;
    }

    if (!insertObj.title) {
      insertObj.title = column._cn;
    }

    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = JSON.stringify(insertObj.meta);
    }

    insertObj.order =
      column.order ??
      (await ncMeta.metaGetNextOrder(MetaTable.COLUMNS, {
        fk_model_id: column.fk_model_id,
      }));

    if (column.validate) {
      if (typeof column.validate === 'string')
        insertObj.validate = column.validate;
      else insertObj.validate = JSON.stringify(column.validate);
    }

    if (!(column.base_id && column.source_id)) {
      const model = await Model.getByIdOrName(
        { id: column.fk_model_id },
        ncMeta,
      );
      insertObj.base_id = model.base_id;
      insertObj.source_id = model.source_id;
    }

    if (!column.uidt) throw new Error('UI Datatype not found');
    const row = await ncMeta.metaInsert2(
      null, //column.base_id || column.source_id,
      null, //column.db_alias,
      MetaTable.COLUMNS,
      insertObj,
    );

    const col = await this.get({ colId: row.id }, ncMeta);

    await NocoCache.appendToList(
      CacheScope.COLUMN,
      [column.fk_model_id],
      `${CacheScope.COLUMN}:${row.id}`,
    );

    await this.insertColOption(column, row.id, ncMeta);

    await View.insertColumnToAllViews(
      {
        fk_column_id: row.id,
        fk_model_id: column.fk_model_id,
        column_show: {
          show:
            column.uidt === UITypes.LinkToAnotherRecord ||
            (column.uidt === UITypes.Links &&
              column.type === 'mm' &&
              !column.view_id)
              ? false
              : !column.view_id,
          view_id: column.view_id,
        },
        column_order: column.column_order,
      },
      ncMeta,
    );

    await View.clearSingleQueryCache(column.fk_model_id, null, ncMeta);

    return col;
  }

  private static async insertColOption<T>(
    column: Partial<T> & { source_id?: string; [p: string]: any },
    colId,
    ncMeta = Noco.ncMeta,
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
          ncMeta,
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
          ncMeta,
        );
        break;
      }
      case UITypes.Links:
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
          ncMeta,
        );
        break;
      }
      case UITypes.QrCode: {
        await QrCodeColumn.insert(
          {
            fk_column_id: colId,
            fk_qr_value_column_id: column.fk_qr_value_column_id,
          },
          ncMeta,
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
          ncMeta,
        );
        break;
      }
      case UITypes.Formula: {
        await FormulaColumn.insert(
          {
            fk_column_id: colId,
            formula: column.formula,
            formula_raw: column.formula_raw,
            parsed_tree: column.parsed_tree,
          },
          ncMeta,
        );
        break;
      }
      case UITypes.MultiSelect: {
        if (!column.colOptions?.options) {
          const bulkOptions = [];
          for (const [i, option] of column.dtxp?.split(',').entries() ||
            [].entries()) {
            bulkOptions.push({
              fk_column_id: colId,
              title: option.replace(/^'/, '').replace(/'$/, ''),
              order: i + 1,
              color: selectColors[i % selectColors.length],
            });
          }
          await SelectOption.bulkInsert(bulkOptions, ncMeta);
        } else {
          const bulkOptions = [];
          for (const [i, option] of column.colOptions.options.entries() ||
            [].entries()) {
            // Trim end of enum/set
            if (column.dt === 'enum' || column.dt === 'set') {
              option.title = option.title.trimEnd();
            }
            bulkOptions.push({
              color: selectColors[i % selectColors.length], // in case color is not provided
              ...option,
              fk_column_id: colId,
              order: i + 1,
            });
          }

          await SelectOption.bulkInsert(bulkOptions, ncMeta);
        }
        break;
      }
      case UITypes.SingleSelect: {
        if (!column.colOptions?.options) {
          const bulkOptions = [];
          for (const [i, option] of column.dtxp?.split(',').entries() ||
            [].entries()) {
            bulkOptions.push({
              fk_column_id: colId,
              title: option.replace(/^'/, '').replace(/'$/, ''),
              order: i + 1,
              color: selectColors[i % selectColors.length],
            });
          }
          await SelectOption.bulkInsert(bulkOptions, ncMeta);
        } else {
          const bulkOptions = [];
          for (const [i, option] of column.colOptions.options.entries() ||
            [].entries()) {
            // Trim end of enum/set
            if (column.dt === 'enum' || column.dt === 'set') {
              option.title = option.title.trimEnd();
            }
            bulkOptions.push({
              color: selectColors[i % selectColors.length], // in case color is not provided
              ...option,
              fk_column_id: colId,
              order: i + 1,
            });
          }
          await SelectOption.bulkInsert(bulkOptions, ncMeta);
        }
        break;
      }

      /*  default:
        {
          await ncMeta.metaInsert2(
            model.base_id,
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
                model.base_id,
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

  public async getColOptions<U = T>(ncMeta = Noco.ncMeta): Promise<U> {
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
      case UITypes.Links:
        res = await LinksColumn.read(this.id, ncMeta);
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
        // source_id: this.base_id,
        // db_alias: this.db_alias,
        id: this.fk_model_id,
      });
    }

    return this.model;
  }

  public static async list(
    {
      fk_model_id,
      fk_default_view_id,
    }: {
      fk_model_id: string;
      fk_default_view_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Column[]> {
    const cachedList = await NocoCache.getList(CacheScope.COLUMN, [
      fk_model_id,
    ]);
    let { list: columnsList } = cachedList;
    const { isNoneList } = cachedList;

    const defaultViewColumns = fk_default_view_id
      ? await View.getColumns(fk_default_view_id)
      : [];

    const defaultViewColumnOrderMap = defaultViewColumns.reduce((acc, col) => {
      acc[col.fk_column_id] = col.order;
      return acc;
    }, {} as Record<string, number>);

    if (!isNoneList && !columnsList.length) {
      columnsList = await ncMeta.metaList2(null, null, MetaTable.COLUMNS, {
        condition: {
          fk_model_id,
        },
        orderBy: {
          order: 'asc',
        },
      });

      columnsList.forEach((column) => {
        column.meta = parseMetaProp(column);
      });

      await NocoCache.setList(CacheScope.COLUMN, [fk_model_id], columnsList);
    }

    columnsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );

    return Promise.all(
      columnsList.map(async (m) => {
        if (defaultViewColumns.length) {
          m.meta = {
            ...parseMetaProp(m),
            defaultViewColOrder: defaultViewColumnOrderMap[m.id],
          };
        }

        const column = new Column(m);
        await column.getColOptions(ncMeta);
        return column;
      }),
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
        'tab.source_id': source_id,
        'tab.db_alias': db_alias
      });

    return columns.map(c => new Column(c));*/
  }

  public static async get(
    {
      source_id,
      db_alias,
      colId,
    }: {
      source_id?: string;
      db_alias?: string;
      colId: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    let colData =
      colId &&
      (await NocoCache.get(
        `${CacheScope.COLUMN}:${colId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        source_id,
        db_alias,
        MetaTable.COLUMNS,
        colId,
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

    // if column is not found, return
    if (!col) {
      return;
    }

    // todo: or instead of delete reset related foreign key value to null and handle in BaseModel

    // get qr code columns and delete
    {
      const qrCodeCols = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_QRCODE,
        {
          condition: { fk_qr_value_column_id: id },
        },
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
        },
      );
      for (const barcodeCol of barcodeCols) {
        await Column.delete(barcodeCol.fk_column_id, ncMeta);
      }
    }

    // get lookup columns and delete
    {
      const cachedList = await NocoCache.getList(CacheScope.COL_LOOKUP, [id]);
      let { list: lookups } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !lookups.length) {
        lookups = await ncMeta.metaList2(null, null, MetaTable.COL_LOOKUP, {
          condition: { fk_lookup_column_id: id },
        });
      }
      for (const lookup of lookups) {
        await Column.delete(lookup.fk_column_id, ncMeta);
      }
    }

    // get rollup/links column and delete
    {
      const cachedList = await NocoCache.getList(CacheScope.COL_ROLLUP, [id]);
      let { list: rollups } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !rollups.length) {
        rollups = await ncMeta.metaList2(null, null, MetaTable.COL_ROLLUP, {
          condition: { fk_rollup_column_id: id },
        });
      }
      for (const rollup of rollups) {
        await Column.delete(rollup.fk_column_id, ncMeta);
      }
    }

    {
      const cachedList = await NocoCache.getList(CacheScope.COLUMN, [
        col.fk_model_id,
      ]);
      let { list: formulaColumns } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !formulaColumns.length) {
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
          formulaCol,
        ).getColOptions<FormulaColumn>();
        if (
          addFormulaErrorIfMissingColumn({
            formula,
            columnId: id,
            title: col?.title,
          })
        )
          await FormulaColumn.update(
            formulaCol.id,
            formula as FormulaColumn & { parsed_tree?: any },
            ncMeta,
          );
      }
    }

    //  if relation column check lookup and rollup and delete
    if (isLinksOrLTAR(col.uidt)) {
      {
        // get lookup columns using relation and delete
        const cachedList = await NocoCache.getList(CacheScope.COL_LOOKUP, [id]);
        let { list: lookups } = cachedList;
        const { isNoneList } = cachedList;
        if (!isNoneList && !lookups.length) {
          lookups = await ncMeta.metaList2(null, null, MetaTable.COL_LOOKUP, {
            condition: { fk_relation_column_id: id },
          });
        }
        for (const lookup of lookups) {
          await Column.delete(lookup.fk_column_id, ncMeta);
        }
      }

      {
        // get rollup columns using relation and delete
        const cachedList = await NocoCache.getList(CacheScope.COL_ROLLUP, [id]);
        let { list: rollups } = cachedList;
        const { isNoneList } = cachedList;
        if (!isNoneList && !rollups.length) {
          rollups = await ncMeta.metaList2(null, null, MetaTable.COL_ROLLUP, {
            condition: { fk_relation_column_id: id },
          });
        }
        for (const rollup of rollups) {
          await Column.delete(rollup.fk_column_id, ncMeta);
        }
      }
    }

    // delete sorts
    {
      const cachedList = await NocoCache.getList(CacheScope.SORT, [id]);
      let { list: sorts } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !sorts.length) {
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
      const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [id]);
      let { list: filters } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !filters.length) {
        filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
          condition: {
            fk_column_id: id,
          },
        });
      }
      for (const filter of filters) {
        if (filter.fk_parent_id) continue;
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
      case UITypes.Links:
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
        `${cacheScopeName}:${col.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    // Delete from all view columns
    const viewColumnTables = [
      MetaTable.GRID_VIEW_COLUMNS,
      MetaTable.FORM_VIEW_COLUMNS,
      MetaTable.KANBAN_VIEW_COLUMNS,
      MetaTable.GALLERY_VIEW_COLUMNS,
    ];
    const viewColumnCacheScope = [
      CacheScope.GRID_VIEW_COLUMN,
      CacheScope.FORM_VIEW_COLUMN,
      CacheScope.KANBAN_VIEW_COLUMN,
      CacheScope.GALLERY_VIEW_COLUMN,
    ];

    for (let i = 0; i < viewColumnTables.length; i++) {
      const table = viewColumnTables[i];
      const cacheScope = viewColumnCacheScope[i];
      const viewColumns = await ncMeta.metaList2(null, null, table, {
        condition: { fk_column_id: id },
      });
      await ncMeta.metaDelete(null, null, table, { fk_column_id: id });
      for (const viewColumn of viewColumns) {
        await NocoCache.deepDel(
          `${cacheScope}:${viewColumn.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
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
      },
    );

    // Delete LTAR columns in which current column is referenced as foreign key
    for (const ltarColumn of ltarColumns) {
      await Column.delete(ltarColumn.fk_column_id, ncMeta);
    }

    // Columns
    await ncMeta.metaDelete(null, null, MetaTable.COLUMNS, col.id);
    await NocoCache.deepDel(
      `${CacheScope.COLUMN}:${col.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // on column delete, delete any optimised single query cache
    {
      await View.clearSingleQueryCache(col.fk_model_id, null, ncMeta);
    }
  }

  static async update(
    colId: string,
    column: Partial<Column> & Partial<Pick<ColumnReqType, 'column_order'>>,
    ncMeta = Noco.ncMeta,
    skipFormulaInvalidate = false,
  ) {
    const oldCol = await Column.get({ colId }, ncMeta);

    switch (oldCol.uidt) {
      case UITypes.Lookup: {
        // LookupColumn.insert()

        await ncMeta.metaDelete(null, null, MetaTable.COL_LOOKUP, {
          fk_column_id: colId,
        });
        await NocoCache.deepDel(
          `${CacheScope.COL_LOOKUP}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        break;
      }
      case UITypes.Rollup: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_ROLLUP, {
          fk_column_id: colId,
        });
        await NocoCache.deepDel(
          `${CacheScope.COL_ROLLUP}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        break;
      }

      case UITypes.LinkToAnotherRecord: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_RELATIONS, {
          fk_column_id: colId,
        });
        await NocoCache.deepDel(
          `${CacheScope.COL_RELATION}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        break;
      }
      case UITypes.Formula: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_FORMULA, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          `${CacheScope.COL_FORMULA}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        break;
      }
      case UITypes.QrCode: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_QRCODE, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          `${CacheScope.COL_QRCODE}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        break;
      }

      case UITypes.Barcode: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_BARCODE, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          `${CacheScope.COL_BARCODE}:${colId}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        break;
      }

      case UITypes.MultiSelect:
      case UITypes.SingleSelect: {
        await ncMeta.metaDelete(null, null, MetaTable.COL_SELECT_OPTIONS, {
          fk_column_id: colId,
        });

        await NocoCache.deepDel(
          `${CacheScope.COL_SELECT_OPTION}:${colId}:list`,
          CacheDelDirection.PARENT_TO_CHILD,
        );
        break;
      }
    }

    const updateObj = extractProps(column, [
      'column_name',
      'title',
      'uidt',
      'dt',
      'np',
      'ns',
      'clen',
      'cop',
      'pk',
      'rqd',
      'un',
      'ct',
      'ai',
      'unique',
      'cdf',
      'cc',
      'csn',
      'dtx',
      'dtxp',
      'dtxs',
      'au',
      'pv',
      'system',
      'validate',
      'meta',
    ]);

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
        },
      );
      const barcodeCols = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_BARCODE,
        {
          condition: { fk_barcode_value_column_id: colId },
        },
      );
      for (const qrCodeCol of qrCodeCols) {
        await Column.delete(qrCodeCol.fk_column_id, ncMeta);
      }
      for (const barcodeCol of barcodeCols) {
        await Column.delete(barcodeCol.fk_column_id, ncMeta);
      }
    }
    if (
      column.column_order &&
      column.column_order.order &&
      column.column_order.view_id
    ) {
      const viewColumn = (
        await View.getColumns(column.column_order.view_id, ncMeta)
      ).find((col) => col.fk_column_id === column.id);
      await View.updateColumn(
        column.column_order.view_id,
        viewColumn.id,
        {
          order: column.column_order.order,
        },
        ncMeta,
      );
    }

    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COLUMNS,
      prepareForDb(updateObj),
      colId,
    );

    await NocoCache.update(
      `${CacheScope.COLUMN}:${colId}`,
      prepareForResponse(updateObj),
    );

    await this.insertColOption(column, colId, ncMeta);

    // on column update, delete any optimised single query cache
    await View.clearSingleQueryCache(oldCol.fk_model_id, null, ncMeta);

    const updatedColumn = await Column.get({ colId }, ncMeta);
    if (!skipFormulaInvalidate) {
      // invalidate formula parsed-tree in which current column is used
      // whenever a new request comes for that formula, it will be populated again
      getFormulasReferredTheColumn(
        {
          column: updatedColumn,
          columns: await Column.list(
            { fk_model_id: oldCol.fk_model_id },
            ncMeta,
          ),
        },
        ncMeta,
      )
        .then(async (formulas) => {
          for (const formula of formulas) {
            await FormulaColumn.update(
              formula.id,
              {
                parsed_tree: null,
              },
              ncMeta,
            );
          }
        })
        // ignore the error and continue, if formula is no longer valid it will be captured in the next run
        .catch((err) => {
          logger.error(err);
        });
    }
  }

  static async updateAlias(
    colId: string,
    { title }: { title: string },
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    await ncMeta.metaUpdate(
      null, //column.base_id || column.source_id,
      null, //column.db_alias,
      MetaTable.COLUMNS,
      {
        title,
      },
      colId,
    );

    await NocoCache.update(`${CacheScope.COLUMN}:${colId}`, { title });

    const column = await Column.get({ colId }, ncMeta);

    await View.clearSingleQueryCache(column.fk_model_id, null, ncMeta);
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
    ncMeta = Noco.ncMeta,
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
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  static async checkAliasAvailable(
    { title, fk_model_id, exclude_id }: { title; fk_model_id; exclude_id? },
    ncMeta = Noco.ncMeta,
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
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  static async markAsSystemField(
    colId: string,
    system = true,
    ncMeta = Noco.ncMeta,
  ) {
    // update system field in meta db
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COLUMNS,
      {
        system,
      },
      colId,
    );

    await NocoCache.update(`${CacheScope.COLUMN}:${colId}`, { system });
  }

  static getMaxColumnNameLength(sqlClientType: string) {
    // no limit for sqlite but set as 255
    let fieldLengthLimit = 255;
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      fieldLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      fieldLengthLimit = 59;
    } else if (sqlClientType === 'mssql') {
      fieldLengthLimit = 128;
    }
    return fieldLengthLimit;
  }

  static async updateMeta(
    { colId, meta }: { colId: string; meta: any },
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COLUMNS,
      prepareForDb({ meta }),
      colId,
    );

    await NocoCache.update(
      `${CacheScope.COLUMN}:${colId}`,
      prepareForResponse({ meta }),
    );
  }

  static async bulkInsert(
    param: {
      columns: Column[];
      fk_model_id: any;
      source_id: string;
      base_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const extractedColumnMetas = [];
    const columns = [];

    // add fk_model_id
    for (const column of param.columns) {
      // pre-populate column meta to use while inserting colOptions
      const id = await ncMeta.genNanoid(MetaTable.COLUMNS);
      const colWithId = {
        ...column,
        id,
        base_id: param.base_id,
        source_id: param.source_id,
        fk_model_id: param.fk_model_id,
      };

      const insertObj = extractProps(colWithId as any, [
        'id',
        'fk_model_id',
        'column_name',
        'title',
        'uidt',
        'dt',
        'np',
        'ns',
        'clen',
        'cop',
        'pk',
        'rqd',
        'un',
        'ct',
        'ai',
        'unique',
        'cdf',
        'cc',
        'csn',
        'dtx',
        'dtxp',
        'dtxs',
        'au',
        'pv',
        'order',
        'base_id',
        'source_id',
        'system',
        'meta',
      ]);

      if (column.meta && typeof column.meta === 'object') {
        insertObj.meta = JSON.stringify(column.meta);
      }

      if (column.validate) {
        if (typeof column.validate === 'string')
          insertObj.validate = column.validate;
        else insertObj.validate = JSON.stringify(column.validate);
      }
      extractedColumnMetas.push(insertObj);

      columns.push(colWithId);
    }

    // bulk insert columns
    await ncMeta.bulkMetaInsert(
      null,
      null,
      MetaTable.COLUMNS,
      extractedColumnMetas,
      true,
    );

    await Column.bulkInsertColOption(columns, ncMeta);

    return columns;
  }

  private static async bulkInsertColOption<T>(
    columns: (Partial<T> & { source_id?: string; [p: string]: any })[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertGroups = new Map<UITypes, Record<string, any>[]>();

    for (const column of columns) {
      let insertArr = insertGroups.get(
        column.uidt === UITypes.MultiSelect
          ? UITypes.SingleSelect
          : column.uidt,
      );
      if (!insertArr) {
        insertGroups.set(column.uidt, (insertArr = []));
      }
      switch (column.uidt || column.ui_data_type) {
        case UITypes.Lookup:
          // LookupColumn.insert()
          insertArr.push({
            fk_column_id: column.id,
            fk_relation_column_id: column.fk_relation_column_id,
            fk_lookup_column_id: column.fk_lookup_column_id,
          });
          break;

        case UITypes.Rollup: {
          insertArr.push({
            fk_column_id: column.id,
            fk_relation_column_id: column.fk_relation_column_id,

            fk_rollup_column_id: column.fk_rollup_column_id,
            rollup_function: column.rollup_function,
          });
          break;
        }
        case UITypes.Links:
        case UITypes.LinkToAnotherRecord: {
          insertArr.push({
            fk_column_id: column.id,
            type: column.type,

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
          });
          break;
        }
        case UITypes.QrCode: {
          insertArr.push(
            {
              fk_column_id: column.id,
              fk_qr_value_column_id: column.fk_qr_value_column_id,
            },
            ncMeta,
          );
          break;
        }
        case UITypes.Barcode: {
          insertArr.push({
            fk_column_id: column.id,
            fk_barcode_value_column_id: column.fk_barcode_value_column_id,
            barcode_format: column.barcode_format,
          });
          break;
        }
        case UITypes.Formula: {
          insertArr.push({
            fk_column_id: column.id,
            formula: column.formula,
            formula_raw: column.formula_raw,
            parsed_tree: column.parsed_tree,
          });
          break;
        }
        case UITypes.MultiSelect: {
          if (!column.colOptions?.options) {
            for (const [i, option] of column.dtxp?.split(',').entries() ||
              [].entries()) {
              insertArr.push({
                fk_column_id: column.id,
                title: option.replace(/^'/, '').replace(/'$/, ''),
                order: i + 1,
                color: selectColors[i % selectColors.length],
              });
            }
          } else {
            for (const [i, option] of column.colOptions.options.entries() ||
              [].entries()) {
              // Trim end of enum/set
              if (column.dt === 'enum' || column.dt === 'set') {
                option.title = option.title.trimEnd();
              }
              insertArr.push({
                color: selectColors[i % selectColors.length], // in case color is not provided
                ...extractProps(option, ['title', 'fk_column_id', 'color']),
                fk_column_id: column.id,
                order: i + 1,
              });
            }
          }
          break;
        }
        case UITypes.SingleSelect: {
          if (!column.colOptions?.options) {
            for (const [i, option] of column.dtxp?.split(',').entries() ||
              [].entries()) {
              insertArr.push({
                fk_column_id: column.id,
                title: option.replace(/^'/, '').replace(/'$/, ''),
                order: i + 1,
                color: selectColors[i % selectColors.length],
              });
            }
          } else {
            for (const [i, option] of column.colOptions.options.entries() ||
              [].entries()) {
              // Trim end of enum/set
              if (column.dt === 'enum' || column.dt === 'set') {
                option.title = option.title.trimEnd();
              }
              insertArr.push({
                color: selectColors[i % selectColors.length], // in case color is not provided
                ...extractProps(option, ['title', 'fk_column_id', 'color']),
                fk_column_id: column.id,
                order: i + 1,
              });
            }
          }
          break;
        }
      }
    }

    // bulk insert column options
    for (const group of insertGroups.keys()) {
      switch (group) {
        case UITypes.SingleSelect:
        case UITypes.MultiSelect:
          await ncMeta.bulkMetaInsert(
            null,
            null,
            MetaTable.COL_SELECT_OPTIONS,
            insertGroups.get(group),
          );
          break;

        case UITypes.Lookup:
          await ncMeta.bulkMetaInsert(
            null,
            null,
            MetaTable.COL_LOOKUP,
            insertGroups.get(group),
          );
          break;

        case UITypes.Rollup:
          await ncMeta.bulkMetaInsert(
            null,
            null,
            MetaTable.COL_ROLLUP,
            insertGroups.get(group),
          );
          break;
        case UITypes.Links:
        case UITypes.LinkToAnotherRecord:
          await ncMeta.bulkMetaInsert(
            null,
            null,
            MetaTable.COL_RELATIONS,
            insertGroups.get(group),
          );
          break;
        case UITypes.QrCode:
          await ncMeta.bulkMetaInsert(
            null,
            null,
            MetaTable.COL_QRCODE,
            insertGroups.get(group),
          );
          break;
        case UITypes.Barcode:
          await ncMeta.bulkMetaInsert(
            null,
            null,
            MetaTable.COL_BARCODE,
            insertGroups.get(group),
          );
          break;
        case UITypes.Formula:
          await ncMeta.bulkMetaInsert(
            null,
            null,
            MetaTable.COL_FORMULA,
            insertGroups.get(group),
          );
          break;
      }
    }
  }
}
