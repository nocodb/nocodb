import autoBind from 'auto-bind';
import groupBy from 'lodash/groupBy';
import DataLoader from 'dataloader';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { nocoExecute } from 'nc-help';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  BoolType,
  isSystemColumn,
  isVirtualCol,
  RelationTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import ejs from 'ejs';
import Validator from 'validator';
import { customAlphabet } from 'nanoid';
import DOMPurify from 'isomorphic-dompurify';
import { v4 as uuidv4 } from 'uuid';
import { NcError } from '../helpers/catchError';
import getAst from '../helpers/getAst';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import {
  _transformSubmittedFormDataForEmail,
  invokeWebhook,
} from '../helpers/webhookHelpers';
import {
  Audit,
  Base,
  Column,
  Filter,
  FormView,
  Hook,
  Model,
  Project,
  Sort,
  View,
} from '../models';
import { sanitize, unsanitize } from '../helpers/sqlSanitize';
import {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from '../models/Filter';
import formSubmissionEmailTemplate from '../utils/common/formSubmissionEmailTemplate';
import formulaQueryBuilderv2 from './formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from './genRollupSelectv2';
import conditionV2 from './conditionV2';
import sortV2 from './sortV2';
import { customValidators } from './util/customValidators';
import type { XKnex } from './CustomKnex';
import type {
  XcFilter,
  XcFilterWithAlias,
} from './sql-data-mapper/lib/BaseModel';
import type {
  BarcodeColumn,
  FormulaColumn,
  GridViewColumn,
  LinkToAnotherRecordColumn,
  QrCodeColumn,
  RollupColumn,
  SelectOption,
} from '../models';
import type { Knex } from 'knex';
import type { SortType } from 'nocodb-sdk';

dayjs.extend(utc);

const GROUP_COL = '__nc_group_id';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

export async function getViewAndModelByAliasOrId(param: {
  projectName: string;
  tableName: string;
  viewName?: string;
}) {
  const project = await Project.getWithInfoByTitleOrId(param.projectName);

  const model = await Model.getByAliasOrId({
    project_id: project.id,
    aliasOrId: param.tableName,
  });
  const view =
    param.viewName &&
    (await View.getByTitleOrId({
      titleOrId: param.viewName,
      fk_model_id: model.id,
    }));
  if (!model) NcError.notFound('Table not found');
  return { model, view };
}

async function populatePk(model: Model, insertObj: any) {
  await model.getColumns();
  for (const pkCol of model.primaryKeys) {
    if (!pkCol.meta?.ag || insertObj[pkCol.title]) continue;
    insertObj[pkCol.title] =
      pkCol.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
  }
}

function checkColumnRequired(
  column: Column<any>,
  fields: string[],
  extractPkAndPv?: boolean,
) {
  // if primary key or foreign key included in fields, it's required
  if (column.pk || column.uidt === UITypes.ForeignKey) return true;

  if (extractPkAndPv && column.pv) return true;

  // check fields defined and if not, then select all
  // if defined check if it is in the fields
  return !fields || fields.includes(column.title);
}

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 {
  protected dbDriver: XKnex;
  protected model: Model;
  protected viewId: string;
  private _proto: any;
  private _columns = {};

  private config: any = {
    limitDefault: Math.max(+process.env.DB_QUERY_LIMIT_DEFAULT || 25, 1),
    limitMin: Math.max(+process.env.DB_QUERY_LIMIT_MIN || 1, 1),
    limitMax: Math.max(+process.env.DB_QUERY_LIMIT_MAX || 1000, 1),
  };

  constructor({
    dbDriver,
    model,
    viewId,
  }: {
    [key: string]: any;
    model: Model;
  }) {
    this.dbDriver = dbDriver;
    this.model = model;
    this.viewId = viewId;
    autoBind(this);
  }

  public async readByPk(id?: any, validateFormula = false): Promise<any> {
    const qb = this.dbDriver(this.tnPath);

    await this.selectObject({ qb, validateFormula });

    qb.where(_wherePk(this.model.primaryKeys, id));

    let data;

    try {
      data = (await this.execAndParse(qb))?.[0];
    } catch (e) {
      if (validateFormula || !haveFormulaColumn(await this.model.getColumns()))
        throw e;
      console.log(e);
      return this.readByPk(id, true);
    }

    if (data) {
      const proto = await this.getProto();
      data.__proto__ = proto;
    }

    // retrieve virtual column data as well
    const project = await Project.get(this.model.project_id);
    const { model, view } = await getViewAndModelByAliasOrId({
      projectName: project.title,
      tableName: this.model.title,
    });
    const { ast } = await getAst({ model, view });
    return data ? await nocoExecute(ast, data, {}) : {};
  }

  public async exist(id?: any): Promise<any> {
    const qb = this.dbDriver(this.tnPath);
    await this.model.getColumns();
    const pks = this.model.primaryKeys;

    if (!pks.length) return false;

    qb.select(pks[0].column_name);

    if ((id + '').split('___').length != pks?.length) {
      return false;
    }
    qb.where(_wherePk(pks, id)).first();
    return !!(await qb);
  }

  // todo: add support for sortArrJson
  public async findOne(
    args: {
      where?: string;
      filterArr?: Filter[];
      sort?: string | string[];
    } = {},
    validateFormula = false,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const qb = this.dbDriver(this.tnPath);
    await this.selectObject({ qb, validateFormula });

    const aliasColObjMap = await this.model.getAliasColObjMap();
    const sorts = extractSortsObject(rest?.sort, aliasColObjMap);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(
      [
        new Filter({
          children: args.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
      this.dbDriver,
    );

    if (Array.isArray(sorts) && sorts?.length) {
      await sortV2(sorts, qb, this.dbDriver);
    } else if (this.model.primaryKey) {
      qb.orderBy(this.model.primaryKey.column_name);
    }

    let data;

    try {
      data = await qb.first();
    } catch (e) {
      if (validateFormula || !haveFormulaColumn(await this.model.getColumns()))
        throw e;
      console.log(e);
      return this.findOne(args, true);
    }

    if (data) {
      const proto = await this.getProto();
      data.__proto__ = proto;
    }
    return data;
  }

  public async list(
    args: {
      where?: string;
      limit?;
      offset?;
      filterArr?: Filter[];
      sortArr?: Sort[];
      sort?: string | string[];
      fieldsSet?: Set<string>;
    } = {},
    ignoreViewFilterAndSort = false,
    validateFormula = false,
  ): Promise<any> {
    const { where, fields, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.tnPath);

    await this.selectObject({
      qb,
      fieldsSet: args.fieldsSet,
      viewId: this.viewId,
      validateFormula,
    });
    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap();
    let sorts = extractSortsObject(rest?.sort, aliasColObjMap);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    // todo: replace with view id
    if (!ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        [
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        this.dbDriver,
      );

      if (!sorts)
        sorts = args.sortArr?.length
          ? args.sortArr
          : await Sort.list({ viewId: this.viewId });

      await sortV2(sorts, qb, this.dbDriver);
    } else {
      await conditionV2(
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        this.dbDriver,
      );

      if (!sorts) sorts = args.sortArr;

      await sortV2(sorts, qb, this.dbDriver);
    }

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (this.model.primaryKey && this.model.primaryKey.ai) {
      qb.orderBy(this.model.primaryKey.column_name);
    } else if (this.model.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    if (!ignoreViewFilterAndSort) applyPaginate(qb, rest);
    const proto = await this.getProto();

    let data;

    try {
      data = await this.execAndParse(qb);
    } catch (e) {
      if (validateFormula || !haveFormulaColumn(await this.model.getColumns()))
        throw e;
      console.log(e);
      return this.list(args, ignoreViewFilterAndSort, true);
    }
    return data?.map((d) => {
      d.__proto__ = proto;
      return d;
    });
  }

  public async count(
    args: { where?: string; limit?; filterArr?: Filter[] } = {},
    ignoreViewFilterAndSort = false,
  ): Promise<any> {
    await this.model.getColumns();
    const { where } = this._getListArgs(args);

    const qb = this.dbDriver(this.tnPath);

    // qb.xwhere(where, await this.model.getAliasColMapping());
    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    if (!ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        [
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
          ...(args.filterArr || []),
        ],
        qb,
        this.dbDriver,
      );
    } else {
      await conditionV2(
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
          ...(args.filterArr || []),
        ],
        qb,
        this.dbDriver,
      );
    }

    qb.count(sanitize(this.model.primaryKey?.column_name) || '*', {
      as: 'count',
    }).first();

    let sql = sanitize(qb.toQuery());
    if (!this.isPg && !this.isMssql && !this.isSnowflake) {
      sql = unsanitize(qb.toQuery());
    }

    const res = (await this.dbDriver.raw(sql)) as any;

    return (this.isPg || this.isSnowflake ? res.rows[0] : res[0][0] ?? res[0])
      .count;
  }

  // todo: add support for sortArrJson and filterArrJson
  async groupBy(
    args: {
      where?: string;
      column_name: string;
      limit?;
      offset?;
      sort?: string | string[];
    } = {
      column_name: '',
    },
  ) {
    const { where, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.tnPath);
    qb.count(`${this.model.primaryKey?.column_name || '*'} as count`);
    qb.select(args.column_name);

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap();

    const sorts = extractSortsObject(rest?.sort, aliasColObjMap);

    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(
      [
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
      this.dbDriver,
    );
    qb.groupBy(args.column_name);
    if (sorts) await sortV2(sorts, qb, this.dbDriver);
    applyPaginate(qb, rest);
    return await qb;
  }

  async multipleHmList(
    { colId, ids },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    try {
      const { where, sort, ...rest } = this._getListArgs(args as any);
      // todo: get only required fields

      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );

      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      const childModel = await Model.getBaseModelSQL({
        model: childTable,
        dbDriver: this.dbDriver,
      });
      await parentTable.getColumns();

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const qb = this.dbDriver(childTn);
      await childModel.selectObject({
        qb,
        extractPkAndPv: true,
        fieldsSet: args.fieldsSet,
      });
      await this.applySortAndFilter({ table: childTable, where, qb, sort });

      const childQb = this.dbDriver.queryBuilder().from(
        this.dbDriver
          .unionAll(
            ids.map((p) => {
              const query = qb
                .clone()
                .select(this.dbDriver.raw('? as ??', [p, GROUP_COL]))
                .whereIn(
                  chilCol.column_name,
                  this.dbDriver(parentTn)
                    .select(parentCol.column_name)
                    // .where(parentTable.primaryKey.cn, p)
                    .where(_wherePk(parentTable.primaryKeys, p)),
                );
              // todo: sanitize
              query.limit(+rest?.limit || 25);
              query.offset(+rest?.offset || 0);

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite,
          )
          .as('list'),
      );

      // console.log(childQb.toQuery())

      const children = await this.execAndParse(childQb, childTable);
      const proto = await (
        await Model.getBaseModelSQL({
          id: childTable.id,
          dbDriver: this.dbDriver,
        })
      ).getProto();

      return groupBy(
        children.map((c) => {
          c.__proto__ = proto;
          return c;
        }),
        GROUP_COL,
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  private async applySortAndFilter({
    table,
    where,
    qb,
    sort,
  }: {
    table: Model;
    where: string;
    qb;
    sort: string;
  }) {
    const childAliasColMap = await table.getAliasColObjMap();

    const filter = extractFilterFromXwhere(where, childAliasColMap);
    await conditionV2(filter, qb, this.dbDriver);
    if (!sort) return;
    const sortObj = extractSortsObject(sort, childAliasColMap);
    if (sortObj) await sortV2(sortObj, qb, this.dbDriver);
  }

  async multipleHmListCount({ colId, ids }) {
    try {
      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );
      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      await parentTable.getColumns();

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const children = await this.dbDriver.unionAll(
        ids.map((p) => {
          const query = this.dbDriver(childTn)
            .count(`${chilCol?.column_name} as count`)
            .whereIn(
              chilCol.column_name,
              this.dbDriver(parentTn)
                .select(parentCol.column_name)
                // .where(parentTable.primaryKey.cn, p)
                .where(_wherePk(parentTable.primaryKeys, p)),
            )
            .first();

          return this.isSqlite ? this.dbDriver.select().from(query) : query;
        }),
        !this.isSqlite,
      );

      return children.map(({ count }) => count);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async hmList(
    { colId, id },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    try {
      const { where, sort, ...rest } = this._getListArgs(args as any);
      // todo: get only required fields

      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );

      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      const childModel = await Model.getBaseModelSQL({
        model: childTable,
        dbDriver: this.dbDriver,
      });
      await parentTable.getColumns();

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const qb = this.dbDriver(childTn);
      await this.applySortAndFilter({ table: childTable, where, qb, sort });

      qb.whereIn(
        chilCol.column_name,
        this.dbDriver(parentTn)
          .select(parentCol.column_name)
          // .where(parentTable.primaryKey.cn, p)
          .where(_wherePk(parentTable.primaryKeys, id)),
      );
      // todo: sanitize
      qb.limit(+rest?.limit || 25);
      qb.offset(+rest?.offset || 0);

      await childModel.selectObject({ qb, fieldsSet: args.fieldSet });

      const children = await this.execAndParse(qb, childTable);

      const proto = await (
        await Model.getBaseModelSQL({
          id: childTable.id,
          dbDriver: this.dbDriver,
        })
      ).getProto();

      return children.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async hmListCount({ colId, id }) {
    try {
      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );
      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      await parentTable.getColumns();

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const query = this.dbDriver(childTn)
        .count(`${chilCol?.column_name} as count`)
        .whereIn(
          chilCol.column_name,
          this.dbDriver(parentTn)
            .select(parentCol.column_name)
            .where(_wherePk(parentTable.primaryKeys, id)),
        )
        .first();
      const { count } = await query;
      return count;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  public async multipleMmList(
    { colId, parentIds },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    const { where, sort, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn()).title;
    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;
    const rtnId = childTable.id;

    const qb = this.dbDriver(rtn).join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`);

    await childModel.selectObject({ qb, fieldsSet: args.fieldsSet });

    await this.applySortAndFilter({ table: childTable, where, qb, sort });

    const finalQb = this.dbDriver.unionAll(
      parentIds.map((id) => {
        const query = qb
          .clone()
          .whereIn(
            `${vtn}.${vcn}`,
            this.dbDriver(parentTn)
              .select(cn)
              // .where(parentTable.primaryKey.cn, id)
              .where(_wherePk(parentTable.primaryKeys, id)),
          )
          .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));

        // todo: sanitize
        query.limit(+rest?.limit || 25);
        query.offset(+rest?.offset || 0);

        return this.isSqlite ? this.dbDriver.select().from(query) : query;
      }),
      !this.isSqlite,
    );

    let children = await this.execAndParse(finalQb, childTable);
    if (this.isMySQL) {
      children = children[0];
    }
    const proto = await (
      await Model.getBaseModelSQL({
        id: rtnId,
        dbDriver: this.dbDriver,
      })
    ).getProto();
    const gs = groupBy(
      children.map((c) => {
        c.__proto__ = proto;
        return c;
      }),
      GROUP_COL,
    );
    return parentIds.map((id) => gs[id] || []);
  }

  public async mmList(
    { colId, parentId },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    const { where, sort, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn()).title;
    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;
    const rtnId = childTable.id;

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      .whereIn(
        `${vtn}.${vcn}`,
        this.dbDriver(parentTn)
          .select(cn)
          // .where(parentTable.primaryKey.cn, id)
          .where(_wherePk(parentTable.primaryKeys, parentId)),
      );

    await childModel.selectObject({ qb, fieldsSet: args.fieldsSet });

    await this.applySortAndFilter({ table: childTable, where, qb, sort });

    // todo: sanitize
    qb.limit(+rest?.limit || 25);
    qb.offset(+rest?.offset || 0);

    const children = await this.execAndParse(qb, childTable);
    const proto = await (
      await Model.getBaseModelSQL({ id: rtnId, dbDriver: this.dbDriver })
    ).getProto();

    return children.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  public async multipleMmListCount({ colId, parentIds }) {
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      // .select({
      //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
      // })
      .count(`${vtn}.${vcn}`, { as: 'count' });

    // await childModel.selectObject({ qb });
    const children = await this.dbDriver.unionAll(
      parentIds.map((id) => {
        const query = qb
          .clone()
          .whereIn(
            `${vtn}.${vcn}`,
            this.dbDriver(parentTn)
              .select(cn)
              // .where(parentTable.primaryKey.cn, id)
              .where(_wherePk(parentTable.primaryKeys, id)),
          )
          .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));
        // this._paginateAndSort(query, { sort, limit, offset }, null, true);
        return this.isSqlite ? this.dbDriver.select().from(query) : query;
      }),
      !this.isSqlite,
    );

    const gs = groupBy(children, GROUP_COL);
    return parentIds.map((id) => gs?.[id]?.[0] || []);
  }

  public async mmListCount({ colId, parentId }) {
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      // .select({
      //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
      // })
      .count(`${vtn}.${vcn}`, { as: 'count' })
      .whereIn(
        `${vtn}.${vcn}`,
        this.dbDriver(parentTn)
          .select(cn)
          // .where(parentTable.primaryKey.cn, id)
          .where(_wherePk(parentTable.primaryKeys, parentId)),
      )
      .first();

    const { count } = await qb;

    return count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;
    const qb = this.dbDriver(rtn)
      .count(`*`, { as: 'count' })
      .where((qb) => {
        qb.whereNotIn(
          rcn,
          this.dbDriver(rtn)
            .select(`${rtn}.${rcn}`)
            .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTn)
                .select(cn)
                // .where(parentTable.primaryKey.cn, pid)
                .where(_wherePk(parentTable.primaryKeys, pid)),
            ),
        ).orWhereNull(rcn);
      });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(filterObj, qb, this.dbDriver);
    return (await qb.first())?.count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;

    const qb = this.dbDriver(rtn).where((qb) =>
      qb
        .whereNotIn(
          rcn,
          this.dbDriver(rtn)
            .select(`${rtn}.${rcn}`)
            .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTn)
                .select(cn)
                // .where(parentTable.primaryKey.cn, pid)
                .where(_wherePk(parentTable.primaryKeys, pid)),
            ),
        )
        .orWhereNull(rcn),
    );

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await childModel.selectObject({ qb });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(filterObj, qb, this.dbDriver);

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (childTable.primaryKey && childTable.primaryKey.ai) {
      qb.orderBy(childTable.primaryKey.column_name);
    } else if (childTable.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await childModel.getProto();
    const data = await qb;
    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const tn = childTn;
    const rtn = parentTn;
    await parentTable.getColumns();

    const qb = this.dbDriver(tn)
      .count(`*`, { as: 'count' })
      .where((qb) => {
        qb.whereNotIn(
          cn,
          this.dbDriver(rtn)
            .select(rcn)
            // .where(parentTable.primaryKey.cn, pid)
            .where(_wherePk(parentTable.primaryKeys, pid)),
        ).orWhereNull(cn);
      });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(filterObj, qb, this.dbDriver);

    return (await qb.first())?.count;
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const tn = childTn;
    const rtn = parentTn;

    const qb = this.dbDriver(tn).where((qb) => {
      qb.whereNotIn(
        cn,
        this.dbDriver(rtn)
          .select(rcn)
          // .where(parentTable.primaryKey.cn, pid)
          .where(_wherePk(parentTable.primaryKeys, pid)),
      ).orWhereNull(cn);
    });

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await childModel.selectObject({ qb });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(filterObj, qb, this.dbDriver);

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (childTable.primaryKey && childTable.primaryKey.ai) {
      qb.orderBy(childTable.primaryKey.column_name);
    } else if (childTable.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await childModel.getProto();
    const data = await this.execAndParse(qb, childTable);

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedListCount(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns();

    const qb = this.dbDriver(rtn)
      .where((qb) => {
        qb.whereNotIn(
          rcn,
          this.dbDriver(tn)
            .select(cn)
            // .where(childTable.primaryKey.cn, cid)
            .where(_wherePk(childTable.primaryKeys, cid))
            .whereNotNull(cn),
        );
      })
      .count(`*`, { as: 'count' });

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(filterObj, qb, this.dbDriver);
    return (await qb.first())?.count;
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: parentTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns();

    const qb = this.dbDriver(rtn).where((qb) => {
      qb.whereNotIn(
        rcn,
        this.dbDriver(tn)
          .select(cn)
          // .where(childTable.primaryKey.cn, cid)
          .where(_wherePk(childTable.primaryKeys, cid))
          .whereNotNull(cn),
      ).orWhereNull(rcn);
    });

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await parentModel.selectObject({ qb });

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(filterObj, qb, this.dbDriver);

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (parentTable.primaryKey && parentTable.primaryKey.ai) {
      qb.orderBy(parentTable.primaryKey.column_name);
    } else if (
      parentTable.columns.find((c) => c.column_name === 'created_at')
    ) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await parentModel.getProto();
    const data = await this.execAndParse(qb, childTable);

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  private async getSelectQueryBuilderForFormula(
    column: Column<any>,
    tableAlias?: string,
    validateFormula = false,
    aliasToColumnBuilder = {},
  ) {
    const formula = await column.getColOptions<FormulaColumn>();
    if (formula.error) throw new Error(`Formula error: ${formula.error}`);
    const qb = await formulaQueryBuilderv2(
      formula.formula,
      null,
      this.dbDriver,
      this.model,
      column,
      aliasToColumnBuilder,
      tableAlias,
      validateFormula,
    );
    return qb;
  }

  async getProto() {
    if (this._proto) {
      return this._proto;
    }

    const proto: any = { __columnAliases: {} };
    const columns = await this.model.getColumns();
    for (const column of columns) {
      switch (column.uidt) {
        case UITypes.Rollup:
          {
            // @ts-ignore
            const colOptions: RollupColumn = await column.getColOptions();
          }
          break;
        case UITypes.Lookup:
          {
            // @ts-ignore
            const colOptions: LookupColumn = await column.getColOptions();
            proto.__columnAliases[column.title] = {
              path: [
                (await Column.get({ colId: colOptions.fk_relation_column_id }))
                  ?.title,
                (await Column.get({ colId: colOptions.fk_lookup_column_id }))
                  ?.title,
              ],
            };
          }
          break;
        case UITypes.LinkToAnotherRecord:
          {
            this._columns[column.title] = column;
            const colOptions =
              (await column.getColOptions()) as LinkToAnotherRecordColumn;
            // const parentColumn = await colOptions.getParentColumn();

            if (colOptions?.type === 'hm') {
              const listLoader = new DataLoader(async (ids: string[]) => {
                try {
                  if (ids.length > 1) {
                    const data = await this.multipleHmList(
                      {
                        colId: column.id,
                        ids,
                      },
                      (listLoader as any).args,
                    );
                    return ids.map((id: string) => (data[id] ? data[id] : []));
                  } else {
                    return [
                      await this.hmList(
                        {
                          colId: column.id,
                          id: ids[0],
                        },
                        (listLoader as any).args,
                      ),
                    ];
                  }
                } catch (e) {
                  console.log(e);
                  return [];
                }
              });
              const self: BaseModelSqlv2 = this;

              proto[column.title] = async function (args): Promise<any> {
                (listLoader as any).args = args;
                return listLoader.load(
                  getCompositePk(self.model.primaryKeys, this),
                );
              };

              // defining HasMany count method within GQL Type class
              // Object.defineProperty(type.prototype, column.alias, {
              //   async value(): Promise<any> {
              //     return listLoader.load(this[model.pk.alias]);
              //   },
              //   configurable: true
              // });
            } else if (colOptions.type === 'mm') {
              const listLoader = new DataLoader(async (ids: string[]) => {
                try {
                  if (ids?.length > 1) {
                    const data = await this.multipleMmList(
                      {
                        parentIds: ids,
                        colId: column.id,
                      },
                      (listLoader as any).args,
                    );

                    return data;
                  } else {
                    return [
                      await this.mmList(
                        {
                          parentId: ids[0],
                          colId: column.id,
                        },
                        (listLoader as any).args,
                      ),
                    ];
                  }
                } catch (e) {
                  console.log(e);
                  return [];
                }
              });

              const self: BaseModelSqlv2 = this;
              // const childColumn = await colOptions.getChildColumn();
              proto[column.title] = async function (args): Promise<any> {
                (listLoader as any).args = args;
                return await listLoader.load(
                  getCompositePk(self.model.primaryKeys, this),
                );
              };
            } else if (colOptions.type === 'bt') {
              // @ts-ignore
              const colOptions =
                (await column.getColOptions()) as LinkToAnotherRecordColumn;
              const pCol = await Column.get({
                colId: colOptions.fk_parent_column_id,
              });
              const cCol = await Column.get({
                colId: colOptions.fk_child_column_id,
              });
              const readLoader = new DataLoader(async (ids: string[]) => {
                try {
                  const data = await (
                    await Model.getBaseModelSQL({
                      id: pCol.fk_model_id,
                      dbDriver: this.dbDriver,
                    })
                  ).list(
                    {
                      // limit: ids.length,
                      where: `(${pCol.column_name},in,${ids.join(',')})`,
                      fieldsSet: (readLoader as any).args?.fieldsSet,
                    },
                    true,
                  );
                  const gs = groupBy(data, pCol.title);
                  return ids.map(async (id: string) => gs?.[id]?.[0]);
                } catch (e) {
                  console.log(e);
                  return [];
                }
              });

              // defining HasMany count method within GQL Type class
              proto[column.title] = async function (args?: any) {
                if (
                  this?.[cCol?.title] === null ||
                  this?.[cCol?.title] === undefined
                )
                  return null;

                (readLoader as any).args = args;

                return await readLoader.load(this?.[cCol?.title]);
              };
              // todo : handle mm
            }
          }
          break;
      }
    }
    this._proto = proto;
    return proto;
  }

  _getListArgs(args: XcFilterWithAlias): XcFilter {
    const obj: XcFilter = {};
    obj.where = args.where || args.w || '';
    obj.having = args.having || args.h || '';
    obj.shuffle = args.shuffle || args.r || '';
    obj.condition = args.condition || args.c || {};
    obj.conditionGraph = args.conditionGraph || {};
    obj.limit = Math.max(
      Math.min(
        args.limit || args.l || this.config.limitDefault,
        this.config.limitMax,
      ),
      this.config.limitMin,
    );
    obj.offset = Math.max(+(args.offset || args.o) || 0, 0);
    obj.fields = args.fields || args.f;
    obj.sort = args.sort || args.s;
    return obj;
  }

  public async shuffle({ qb }: { qb: Knex.QueryBuilder }): Promise<void> {
    if (this.isMySQL) {
      qb.orderByRaw('RAND()');
    } else if (this.isPg || this.isSqlite) {
      qb.orderByRaw('RANDOM()');
    } else if (this.isMssql) {
      qb.orderByRaw('NEWID()');
    }
  }

  // todo:
  //  pass view id as argument
  //  add option to get only pk and pv
  public async selectObject({
    qb,
    columns: _columns,
    fields: _fields,
    extractPkAndPv,
    viewId,
    fieldsSet,
    alias,
    validateFormula,
  }: {
    fieldsSet?: Set<string>;
    qb: Knex.QueryBuilder & Knex.QueryInterface;
    columns?: Column[];
    fields?: string[] | string;
    extractPkAndPv?: boolean;
    viewId?: string;
    alias?: string;
    validateFormula?: boolean;
  }): Promise<void> {
    // keep a common object for all columns to share across all columns
    const aliasToColumnBuilder = {};
    let viewOrTableColumns: Column[] | { fk_column_id?: string }[];

    const res = {};
    let view: View;
    let fields: string[];

    if (fieldsSet?.size) {
      viewOrTableColumns = _columns || (await this.model.getColumns());
    } else {
      view = await View.get(viewId);
      const viewColumns = viewId && (await View.getColumns(viewId));
      fields = Array.isArray(_fields) ? _fields : _fields?.split(',');

      // const columns = _columns ?? (await this.model.getColumns());
      // for (const column of columns) {
      viewOrTableColumns =
        _columns || viewColumns || (await this.model.getColumns());
    }
    for (const viewOrTableColumn of viewOrTableColumns) {
      const column =
        viewOrTableColumn instanceof Column
          ? viewOrTableColumn
          : await Column.get({
              colId: (viewOrTableColumn as GridViewColumn).fk_column_id,
            });
      // hide if column marked as hidden in view
      // of if column is system field and system field is hidden
      if (
        shouldSkipField(
          fieldsSet,
          viewOrTableColumn,
          view,
          column,
          extractPkAndPv,
        )
      ) {
        continue;
      }

      if (!checkColumnRequired(column, fields, extractPkAndPv)) continue;

      switch (column.uidt) {
        case 'LinkToAnotherRecord':
        case 'Lookup':
          break;
        case 'QrCode': {
          const qrCodeColumn = await column.getColOptions<QrCodeColumn>();
          const qrValueColumn = await Column.get({
            colId: qrCodeColumn.fk_qr_value_column_id,
          });

          // If the referenced value cannot be found: cancel current iteration
          if (qrValueColumn == null) {
            break;
          }

          switch (qrValueColumn.uidt) {
            case UITypes.Formula:
              try {
                const selectQb = await this.getSelectQueryBuilderForFormula(
                  qrValueColumn,
                  alias,
                  validateFormula,
                  aliasToColumnBuilder,
                );
                qb.select({
                  [column.column_name]: selectQb.builder,
                });
              } catch {
                continue;
              }
              break;
            default: {
              qb.select({ [column.column_name]: qrValueColumn.column_name });
              break;
            }
          }

          break;
        }
        case 'Barcode': {
          const barcodeColumn = await column.getColOptions<BarcodeColumn>();
          const barcodeValueColumn = await Column.get({
            colId: barcodeColumn.fk_barcode_value_column_id,
          });

          // If the referenced value cannot be found: cancel current iteration
          if (barcodeValueColumn == null) {
            break;
          }

          switch (barcodeValueColumn.uidt) {
            case UITypes.Formula:
              try {
                const selectQb = await this.getSelectQueryBuilderForFormula(
                  barcodeValueColumn,
                  alias,
                  validateFormula,
                  aliasToColumnBuilder,
                );
                qb.select({
                  [column.column_name]: selectQb.builder,
                });
              } catch {
                continue;
              }
              break;
            default: {
              qb.select({
                [column.column_name]: barcodeValueColumn.column_name,
              });
              break;
            }
          }

          break;
        }
        case 'Formula':
          {
            try {
              const selectQb = await this.getSelectQueryBuilderForFormula(
                column,
                alias,
                validateFormula,
                aliasToColumnBuilder,
              );
              qb.select(
                this.dbDriver.raw(`?? as ??`, [
                  selectQb.builder,
                  sanitize(column.title),
                ]),
              );
            } catch (e) {
              console.log(e);
              // return dummy select
              qb.select(
                this.dbDriver.raw(`'ERR' as ??`, [sanitize(column.title)]),
              );
            }
          }
          break;
        case 'Rollup':
          qb.select(
            (
              await genRollupSelectv2({
                // tn: this.title,
                knex: this.dbDriver,
                // column,
                alias,
                columnOptions: (await column.getColOptions()) as RollupColumn,
              })
            ).builder.as(sanitize(column.title)),
          );
          break;
        default:
          res[sanitize(column.title || column.column_name)] = sanitize(
            `${alias || this.model.table_name}.${column.column_name}`,
          );
          break;
      }
    }
    qb.select(res);
  }

  async insert(data, trx?, cookie?) {
    try {
      await populatePk(this.model, data);

      // todo: filter based on view
      const insertObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
      );

      await this.validate(insertObj);

      if ('beforeInsert' in this) {
        await this.beforeInsert(insertObj, trx, cookie);
      }

      await this.model.getColumns();
      let response;
      // const driver = trx ? trx : this.dbDriver;

      await this.setUtcTimezoneForPg();

      const query = this.dbDriver(this.tnPath).insert(insertObj);
      if ((this.isPg || this.isMssql) && this.model.primaryKey) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.title}`,
        );
        response = await this.execAndParse(query);
      }

      const ai = this.model.columns.find((c) => c.ai);

      let ag: Column;
      if (!ai) ag = this.model.columns.find((c) => c.meta?.ag);

      // handle if autogenerated primary key is used
      if (ag) {
        if (!response) await this.execAndParse(query);
        response = await this.readByPk(data[ag.title]);
      } else if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          const res = await this.execAndParse(query);
          id = res?.id ?? res[0]?.insertId;
        }

        if (ai) {
          if (this.isSqlite) {
            // sqlite doesnt return id after insert
            id = (
              await this.dbDriver(this.tnPath)
                .select(ai.column_name)
                .max(ai.column_name, { as: 'id' })
            )[0].id;
          } else if (this.isSnowflake) {
            id = (
              (await this.dbDriver(this.tnPath).max(ai.column_name, {
                as: 'id',
              })) as any
            )[0].id;
          }
          response = await this.readByPk(id);
        } else {
          response = data;
        }
      } else if (ai) {
        response = await this.readByPk(
          Array.isArray(response)
            ? response?.[0]?.[ai.title]
            : response?.[ai.title],
        );
      }

      await this.afterInsert(response, trx, cookie);
      return Array.isArray(response) ? response[0] : response;
    } catch (e) {
      console.log(e);
      await this.errorInsert(e, data, trx, cookie);
      throw e;
    }
  }

  async delByPk(id, trx?, cookie?) {
    try {
      // retrieve data for handling params in hook
      const data = await this.readByPk(id);
      await this.beforeDelete(id, trx, cookie);
      const response = await this.dbDriver(this.tnPath)
        .del()
        .where(await this._wherePk(id));
      await this.afterDelete(data, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorDelete(e, id, trx, cookie);
      throw e;
    }
  }

  async hasLTARData(rowId, model: Model): Promise<any> {
    const res = [];
    const LTARColumns = (await model.getColumns()).filter(
      (c) => c.uidt === UITypes.LinkToAnotherRecord,
    );
    let i = 0;
    for (const column of LTARColumns) {
      const colOptions =
        (await column.getColOptions()) as LinkToAnotherRecordColumn;
      const childColumn = await colOptions.getChildColumn();
      const parentColumn = await colOptions.getParentColumn();
      const childModel = await childColumn.getModel();
      await childModel.getColumns();
      const parentModel = await parentColumn.getModel();
      await parentModel.getColumns();
      let cnt = 0;
      if (colOptions.type === RelationTypes.HAS_MANY) {
        cnt = +(
          await this.dbDriver(childModel.table_name)
            .count(childColumn.column_name, { as: 'cnt' })
            .where(childColumn.column_name, rowId)
        )[0].cnt;
      } else if (colOptions.type === RelationTypes.MANY_TO_MANY) {
        const mmModel = await colOptions.getMMModel();
        const mmChildColumn = await colOptions.getMMChildColumn();
        cnt = +(
          await this.dbDriver(mmModel.table_name)
            .where(`${mmModel.table_name}.${mmChildColumn.column_name}`, rowId)
            .count(mmChildColumn.column_name, { as: 'cnt' })
        )[0].cnt;
      }
      if (cnt) {
        res.push(
          `${i++ + 1}. ${model.title}.${
            column.title
          } is a LinkToAnotherRecord of ${childModel.title}`,
        );
      }
    }
    return res;
  }

  async updateByPk(id, data, trx?, cookie?) {
    try {
      const updateObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
      );

      await this.validate(data);

      await this.beforeUpdate(data, trx, cookie);

      const prevData = await this.readByPk(id);

      await this.setUtcTimezoneForPg();

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id));

      await this.execAndParse(query);

      const newData = await this.readByPk(id);
      await this.afterUpdate(prevData, newData, trx, cookie, updateObj);
      return newData;
    } catch (e) {
      console.log(e);
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  async _wherePk(id) {
    await this.model.getColumns();
    return _wherePk(this.model.primaryKeys, id);
  }

  private getTnPath(tb: Model) {
    const schema = (this.dbDriver as any).searchPath?.();
    if (this.isMssql && schema) {
      return this.dbDriver.raw('??.??', [schema, tb.table_name]);
    } else if (this.isSnowflake) {
      return [
        this.dbDriver.client.config.connection.database,
        this.dbDriver.client.config.connection.schema,
        tb.table_name,
      ].join('.');
    } else {
      return tb.table_name;
    }
  }

  public get tnPath() {
    return this.getTnPath(this.model);
  }

  public get clientMeta() {
    return {
      isSqlite: this.isSqlite,
      isMssql: this.isMssql,
      isPg: this.isPg,
      isMySQL: this.isMySQL,
      // isSnowflake: this.isSnowflake,
    };
  }

  private async isXcdbBase() {
    const base = await Base.get(this.model.base_id);
    return base.is_meta;
  }

  get isSqlite() {
    return this.clientType === 'sqlite3';
  }

  get isMssql() {
    return this.clientType === 'mssql';
  }

  get isPg() {
    return this.clientType === 'pg';
  }

  get isMySQL() {
    return this.clientType === 'mysql2' || this.clientType === 'mysql';
  }

  get isSnowflake() {
    return this.clientType === 'snowflake';
  }

  get clientType() {
    return this.dbDriver.clientType();
  }

  async nestedInsert(data, _trx = null, cookie?) {
    // const driver = trx ? trx : await this.dbDriver.transaction();
    try {
      await populatePk(this.model, data);
      const insertObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
      );

      let rowId = null;
      const postInsertOps = [];

      const nestedCols = (await this.model.getColumns()).filter(
        (c) => c.uidt === UITypes.LinkToAnotherRecord,
      );

      for (const col of nestedCols) {
        if (col.title in data) {
          const colOptions =
            await col.getColOptions<LinkToAnotherRecordColumn>();

          // parse data if it's JSON string
          const nestedData =
            typeof data[col.title] === 'string'
              ? JSON.parse(data[col.title])
              : data[col.title];

          switch (colOptions.type) {
            case RelationTypes.BELONGS_TO:
              {
                const childCol = await colOptions.getChildColumn();
                const parentCol = await colOptions.getParentColumn();
                insertObj[childCol.column_name] = nestedData?.[parentCol.title];
              }
              break;
            case RelationTypes.HAS_MANY:
              {
                const childCol = await colOptions.getChildColumn();
                const childModel = await childCol.getModel();
                await childModel.getColumns();

                postInsertOps.push(async () => {
                  await this.dbDriver(childModel.table_name)
                    .update({
                      [childCol.column_name]: rowId,
                    })
                    .whereIn(
                      childModel.primaryKey.column_name,
                      nestedData?.map((r) => r[childModel.primaryKey.title]),
                    );
                });
              }
              break;
            case RelationTypes.MANY_TO_MANY: {
              postInsertOps.push(async () => {
                const parentModel = await colOptions
                  .getParentColumn()
                  .then((c) => c.getModel());
                await parentModel.getColumns();
                const parentMMCol = await colOptions.getMMParentColumn();
                const childMMCol = await colOptions.getMMChildColumn();
                const mmModel = await colOptions.getMMModel();

                const rows = nestedData.map((r) => ({
                  [parentMMCol.column_name]: r[parentModel.primaryKey.title],
                  [childMMCol.column_name]: rowId,
                }));
                await this.dbDriver(mmModel.table_name).insert(rows);
              });
            }
          }
        }
      }

      await this.validate(insertObj);

      await this.beforeInsert(insertObj, this.dbDriver, cookie);

      let response;
      const query = this.dbDriver(this.tnPath).insert(insertObj);

      if (this.isPg || this.isMssql) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.title}`,
        );
        response = await query;
      }

      const ai = this.model.columns.find((c) => c.ai);
      if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          id = (await query)[0];
        }

        if (ai) {
          if (this.isSqlite) {
            // sqlite doesnt return id after insert
            id = (
              await this.dbDriver(this.tnPath)
                .select(ai.column_name)
                .max(ai.column_name, { as: 'id' })
            )[0].id;
          } else if (this.isSnowflake) {
            id = (
              (await this.dbDriver(this.tnPath).max(ai.column_name, {
                as: 'id',
              })) as any
            ).rows[0].id;
          }
          response = await this.readByPk(id);
        } else {
          response = data;
        }
      } else if (ai) {
        response = await this.readByPk(
          Array.isArray(response)
            ? response?.[0]?.[ai.title]
            : response?.[ai.title],
        );
      }
      response = Array.isArray(response) ? response[0] : response;
      if (response)
        rowId =
          response[this.model.primaryKey.title] ||
          response[this.model.primaryKey.column_name];

      await Promise.all(postInsertOps.map((f) => f()));

      await this.afterInsert(response, this.dbDriver, cookie);

      return response;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async bulkInsert(
    datas: any[],
    {
      chunkSize: _chunkSize = 100,
      cookie,
    }: {
      chunkSize?: number;
      cookie?: any;
    } = {},
  ) {
    try {
      const insertDatas = await Promise.all(
        datas.map(async (d) => {
          await populatePk(this.model, d);
          return this.model.mapAliasToColumn(d, this.clientMeta);
        }),
      );

      // await this.beforeInsertb(insertDatas, null);

      for (const data of datas) {
        await this.validate(data);
      }

      // fallbacks to `10` if database client is sqlite
      // to avoid `too many SQL variables` error
      // refer : https://www.sqlite.org/limits.html
      const chunkSize = this.isSqlite ? 10 : _chunkSize;

      await this.setUtcTimezoneForPg();

      const response =
        this.isPg || this.isMssql
          ? await this.dbDriver
              .batchInsert(this.tnPath, insertDatas, chunkSize)
              .returning(this.model.primaryKey?.column_name)
          : await this.dbDriver.batchInsert(
              this.tnPath,
              insertDatas,
              chunkSize,
            );

      await this.afterBulkInsert(insertDatas, this.dbDriver, cookie);

      return response;
    } catch (e) {
      // await this.errorInsertb(e, data, null);
      throw e;
    }
  }

  async bulkUpdate(datas: any[], { cookie }: { cookie?: any } = {}) {
    let transaction;
    try {
      const updateDatas = await Promise.all(
        datas.map((d) => this.model.mapAliasToColumn(d, this.clientMeta)),
      );

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      const res = [];
      for (const d of updateDatas) {
        await this.validate(d);
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // pk not specified - bypass
          continue;
        }
        prevData.push(await this.readByPk(pkValues));
        const wherePk = await this._wherePk(pkValues);
        res.push(wherePk);
        toBeUpdated.push({ d, wherePk });
        updatePkValues.push(pkValues);
      }

      await this.setUtcTimezoneForPg();

      transaction = await this.dbDriver.transaction();

      for (const o of toBeUpdated) {
        await transaction(this.tnPath).update(o.d).where(o.wherePk);
      }

      await transaction.commit();

      for (const pkValues of updatePkValues) {
        newData.push(await this.readByPk(pkValues));
      }

      await this.afterBulkUpdate(prevData, newData, this.dbDriver, cookie);

      return res;
    } catch (e) {
      if (transaction) await transaction.rollback();
      throw e;
    }
  }

  async bulkUpdateAll(
    args: { where?: string; filterArr?: Filter[] } = {},
    data,
    { cookie }: { cookie?: any } = {},
  ) {
    try {
      let count = 0;
      const updateData = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
      );
      await this.validate(updateData);
      const pkValues = await this._extractPksValues(updateData);
      if (pkValues) {
        // pk is specified - by pass
      } else {
        await this.model.getColumns();
        const { where } = this._getListArgs(args);
        const qb = this.dbDriver(this.tnPath);
        const aliasColObjMap = await this.model.getAliasColObjMap();
        const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

        await conditionV2(
          [
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          qb,
          this.dbDriver,
        );

        qb.update(updateData);

        count = (await qb) as any;
      }

      await this.afterBulkUpdate(null, count, this.dbDriver, cookie, true);

      return count;
    } catch (e) {
      throw e;
    }
  }

  async bulkDelete(ids: any[], { cookie }: { cookie?: any } = {}) {
    let transaction;
    try {
      const deleteIds = await Promise.all(
        ids.map((d) => this.model.mapAliasToColumn(d, this.clientMeta)),
      );

      const deleted = [];
      const res = [];
      for (const d of deleteIds) {
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // pk not specified - bypass
          continue;
        }
        deleted.push(await this.readByPk(pkValues));
        res.push(d);
      }

      transaction = await this.dbDriver.transaction();

      for (const d of res) {
        await transaction(this.tnPath).del().where(d);
      }

      await transaction.commit();

      await this.afterBulkDelete(deleted, this.dbDriver, cookie);

      return res;
    } catch (e) {
      if (transaction) await transaction.rollback();
      console.log(e);
      throw e;
    }
  }

  async bulkDeleteAll(
    args: { where?: string; filterArr?: Filter[] } = {},
    { cookie }: { cookie?: any } = {},
  ) {
    try {
      await this.model.getColumns();
      const { where } = this._getListArgs(args);
      const qb = this.dbDriver(this.tnPath);
      const aliasColObjMap = await this.model.getAliasColObjMap();
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

      await conditionV2(
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        this.dbDriver,
      );

      qb.del();

      const count = (await qb) as any;

      await this.afterBulkDelete(count, this.dbDriver, cookie, true);

      return count;
    } catch (e) {
      throw e;
    }
  }

  /**
   *  Hooks
   * */

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.insert', null, data, req);
  }

  public async afterInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('after.insert', null, data, req);
    const id = this._extractPksValues(data);
    await Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.INSERT,
      description: DOMPurify.sanitize(
        `Record with ID ${id} has been inserted into Table ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    let noOfUpdatedRecords = newData;
    if (!isBulkAllOperation) {
      noOfUpdatedRecords = newData.length;
      await this.handleHooks('after.bulkUpdate', prevData, newData, req);
    }

    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_UPDATE,
      description: DOMPurify.sanitize(
        `${noOfUpdatedRecords} ${
          noOfUpdatedRecords > 1 ? 'records have' : 'record has'
        } been bulk updated in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkDelete(
    data: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    let noOfDeletedRecords = data;
    if (!isBulkAllOperation) {
      noOfDeletedRecords = data.length;
      await this.handleHooks('after.bulkDelete', null, data, req);
    }

    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_DELETE,
      description: DOMPurify.sanitize(
        `${noOfDeletedRecords} ${
          noOfDeletedRecords > 1 ? 'records have' : 'record has'
        } been bulk deleted in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkInsert(data: any[], _trx: any, req): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);

    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_INSERT,
      description: DOMPurify.sanitize(
        `${data.length} ${
          data.length > 1 ? 'records have' : 'record has'
        } been bulk inserted in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async beforeUpdate(data: any, _trx: any, req): Promise<void> {
    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('before.update', null, data, req);
    }
  }

  public async afterUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    updateObj?: Record<string, any>,
  ): Promise<void> {
    const id = this._extractPksValues(newData);
    let desc = `Record with ID ${id} has been updated in Table ${this.model.title}.`;
    let details = '';
    if (updateObj) {
      updateObj = await this.model.mapColumnToAlias(updateObj);
      for (const k of Object.keys(updateObj)) {
        const prevValue =
          typeof prevData[k] === 'object'
            ? JSON.stringify(prevData[k])
            : prevData[k];
        const newValue =
          typeof newData[k] === 'object'
            ? JSON.stringify(newData[k])
            : newData[k];
        desc += `\n`;
        desc += `Column "${k}" got changed from "${prevValue}" to "${newValue}"`;
        details += DOMPurify.sanitize(`<span class="">${k}</span>
  : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${prevValue}</span>
  <span class="black--text green lighten-4 px-2">${newValue}</span>`);
      }
    }
    await Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UPDATE,
      description: DOMPurify.sanitize(desc),
      details,
      ip: req?.clientIp,
      user: req?.user?.email,
    });

    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('after.update', prevData, newData, req);
    }
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.delete', null, data, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    const id = req?.params?.id;
    await Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.DELETE,
      description: DOMPurify.sanitize(
        `Record with ID ${id} has been deleted in Table ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
    await this.handleHooks('after.delete', null, data, req);
  }

  private async handleHooks(hookName, prevData, newData, req): Promise<void> {
    const view = await View.get(this.viewId);

    // handle form view data submission
    if (
      (hookName === 'after.insert' || hookName === 'after.bulkInsert') &&
      view.type === ViewTypes.FORM
    ) {
      try {
        const formView = await view.getView<FormView>();
        const { columns } = await FormView.getWithInfo(formView.fk_view_id);
        const allColumns = await this.model.getColumns();
        const fieldById = columns.reduce(
          (o: Record<string, any>, f: Record<string, any>) => ({
            ...o,
            [f.fk_column_id]: f,
          }),
          {},
        );
        let order = 1;
        const filteredColumns = allColumns
          ?.map((c: Record<string, any>) => ({
            ...c,
            fk_column_id: c.id,
            fk_view_id: formView.fk_view_id,
            ...(fieldById[c.id] ? fieldById[c.id] : {}),
            order: (fieldById[c.id] && fieldById[c.id].order) || order++,
            id: fieldById[c.id] && fieldById[c.id].id,
          }))
          .sort(
            (a: Record<string, any>, b: Record<string, any>) =>
              a.order - b.order,
          )
          .filter(
            (f: Record<string, any>) =>
              f.show &&
              f.uidt !== UITypes.Rollup &&
              f.uidt !== UITypes.Lookup &&
              f.uidt !== UITypes.Formula &&
              f.uidt !== UITypes.QrCode &&
              f.uidt !== UITypes.Barcode &&
              f.uidt !== UITypes.SpecificDBType,
          )
          .sort(
            (a: Record<string, any>, b: Record<string, any>) =>
              a.order - b.order,
          )
          .map((c: Record<string, any>) => ({
            ...c,
            required: !!(c.required || 0),
          }));

        const emails = Object.entries(JSON.parse(formView?.email) || {})
          .filter((a) => a[1])
          .map((a) => a[0]);
        if (emails?.length) {
          const transformedData = _transformSubmittedFormDataForEmail(
            newData,
            formView,
            filteredColumns,
          );
          (await NcPluginMgrv2.emailAdapter(false))?.mailSend({
            to: emails.join(','),
            subject: 'NocoDB Form',
            html: ejs.render(formSubmissionEmailTemplate, {
              data: transformedData,
              tn: this.tnPath,
              _tn: this.model.title,
            }),
          });
        }
      } catch (e) {
        console.log(e);
      }
    }

    try {
      const [event, operation] = hookName.split('.');
      const hooks = await Hook.list({
        fk_model_id: this.model.id,
        event,
        operation,
      });
      for (const hook of hooks) {
        if (hook.active) {
          invokeWebhook(hook, this.model, view, prevData, newData, req?.user);
        }
      }
    } catch (e) {
      console.log('hooks :: error', hookName, e);
    }
  }

  // @ts-ignore
  protected async errorInsert(e, data, trx, cookie) {}

  // @ts-ignore
  protected async errorUpdate(e, data, trx, cookie) {}

  // todo: handle composite primary key
  protected _extractPksValues(data: any) {
    // data can be still inserted without PK
    // TODO: return a meaningful value
    if (!this.model.primaryKey) return 'N/A';
    return (
      data[this.model.primaryKey.title] ||
      data[this.model.primaryKey.column_name]
    );
  }

  // @ts-ignore
  protected async errorDelete(e, id, trx, cookie) {}

  async validate(columns) {
    await this.model.getColumns();
    // let cols = Object.keys(this.columns);
    for (let i = 0; i < this.model.columns.length; ++i) {
      const column = this.model.columns[i];
      // skip validation if `validate` is undefined or false
      if (!column?.meta?.validate || !column?.validate) continue;

      const validate = column.getValidators();
      const cn = column.column_name;
      const columnTitle = column.title;
      if (!validate) continue;

      const { func, msg } = validate;
      for (let j = 0; j < func.length; ++j) {
        const fn =
          typeof func[j] === 'string'
            ? customValidators[func[j]]
              ? customValidators[func[j]]
              : Validator[func[j]]
            : func[j];
        const columnValue = columns?.[cn] || columns?.[columnTitle];
        const arg =
          typeof func[j] === 'string' ? columnValue + '' : columnValue;
        if (
          ![null, undefined, ''].includes(columnValue) &&
          !(fn.constructor.name === 'AsyncFunction' ? await fn(arg) : fn(arg))
        ) {
          NcError.badRequest(
            msg[j]
              .replace(/\{VALUE}/g, columnValue)
              .replace(/\{cn}/g, columnTitle),
          );
        }
      }
    }
    return true;
  }

  async addChild({
    colId,
    rowId,
    childId,
    cookie,
  }: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: any;
  }) {
    const columns = await this.model.getColumns();
    const column = columns.find((c) => c.id === colId);

    if (!column || column.uidt !== UITypes.LinkToAnotherRecord)
      NcError.notFound('Column not found');

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          const vTn = this.getTnPath(vTable);

          if (this.isSnowflake) {
            const parentPK = this.dbDriver(parentTn)
              .select(parentColumn.column_name)
              .where(_wherePk(parentTable.primaryKeys, childId))
              .first();

            const childPK = this.dbDriver(childTn)
              .select(childColumn.column_name)
              .where(_wherePk(childTable.primaryKeys, rowId))
              .first();

            await this.dbDriver.raw(
              `INSERT INTO ?? (??, ??) SELECT (${parentPK.toQuery()}), (${childPK.toQuery()})`,
              [vTn, vParentCol.column_name, vChildCol.column_name],
            );
          } else {
            await this.dbDriver(vTn).insert({
              [vParentCol.column_name]: this.dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(_wherePk(parentTable.primaryKeys, childId))
                .first(),
              [vChildCol.column_name]: this.dbDriver(childTn)
                .select(childColumn.column_name)
                .where(_wherePk(childTable.primaryKeys, rowId))
                .first(),
            });
          }
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          await this.dbDriver(childTn)
            .update({
              [childColumn.column_name]: this.dbDriver.from(
                this.dbDriver(parentTn)
                  .select(parentColumn.column_name)
                  .where(_wherePk(parentTable.primaryKeys, rowId))
                  .first()
                  .as('___cn_alias'),
              ),
            })
            .where(_wherePk(childTable.primaryKeys, childId));
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          await this.dbDriver(childTn)
            .update({
              [childColumn.column_name]: this.dbDriver.from(
                this.dbDriver(parentTn)
                  .select(parentColumn.column_name)
                  .where(_wherePk(parentTable.primaryKeys, childId))
                  .first()
                  .as('___cn_alias'),
              ),
            })
            .where(_wherePk(childTable.primaryKeys, rowId));
        }
        break;
    }

    const response = await this.readByPk(rowId);
    await this.afterInsert(response, this.dbDriver, cookie);
    await this.afterAddChild(rowId, childId, cookie);
  }

  public async afterAddChild(rowId, childId, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.LINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] has been linked with record [id:${rowId}] in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  async removeChild({
    colId,
    rowId,
    childId,
    cookie,
  }: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: any;
  }) {
    const columns = await this.model.getColumns();
    const column = columns.find((c) => c.id === colId);

    if (!column || column.uidt !== UITypes.LinkToAnotherRecord)
      NcError.notFound('Column not found');

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const prevData = await this.readByPk(rowId);

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          const vTn = this.getTnPath(vTable);

          await this.dbDriver(vTn)
            .where({
              [vParentCol.column_name]: this.dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(_wherePk(parentTable.primaryKeys, childId))
                .first(),
              [vChildCol.column_name]: this.dbDriver(childTn)
                .select(childColumn.column_name)
                .where(_wherePk(childTable.primaryKeys, rowId))
                .first(),
            })
            .delete();
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          await this.dbDriver(childTn)
            // .where({
            //   [childColumn.cn]: this.dbDriver(parentTable.tn)
            //     .select(parentColumn.cn)
            //     .where(parentTable.primaryKey.cn, rowId)
            //     .first()
            // })
            .where(_wherePk(childTable.primaryKeys, childId))
            .update({ [childColumn.column_name]: null });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          await this.dbDriver(childTn)
            // .where({
            //   [childColumn.cn]: this.dbDriver(parentTable.tn)
            //     .select(parentColumn.cn)
            //     .where(parentTable.primaryKey.cn, childId)
            //     .first()
            // })
            .where(_wherePk(childTable.primaryKeys, rowId))
            .update({ [childColumn.column_name]: null });
        }
        break;
    }

    const newData = await this.readByPk(rowId);
    await this.afterUpdate(prevData, newData, this.dbDriver, cookie);
    await this.afterRemoveChild(rowId, childId, cookie);
  }

  public async afterRemoveChild(rowId, childId, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] has been unlinked with record [id:${rowId}] in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async groupedList(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
      options?: (string | number | null | boolean)[];
    } & Partial<XcFilter>,
  ): Promise<
    {
      key: string;
      value: Record<string, unknown>[];
    }[]
  > {
    try {
      const { where, ...rest } = this._getListArgs(args as any);
      const column = await this.model
        .getColumns()
        .then((cols) => cols?.find((col) => col.id === args.groupColumnId));

      if (!column) NcError.notFound('Column not found');
      if (isVirtualCol(column))
        NcError.notImplemented('Grouping for virtual columns not implemented');

      // extract distinct group column values
      let groupingValues: Set<any>;
      if (args.options?.length) {
        groupingValues = new Set(args.options);
      } else if (column.uidt === UITypes.SingleSelect) {
        const colOptions = await column.getColOptions<{
          options: SelectOption[];
        }>();
        groupingValues = new Set(
          (colOptions?.options ?? []).map((opt) => opt.title),
        );
        groupingValues.add(null);
      } else {
        groupingValues = new Set(
          (
            await this.dbDriver(this.tnPath)
              .select(column.column_name)
              .distinct()
          ).map((row) => row[column.column_name]),
        );
        groupingValues.add(null);
      }

      const qb = this.dbDriver(this.tnPath);
      qb.limit(+rest?.limit || 25);
      qb.offset(+rest?.offset || 0);

      await this.selectObject({ qb, extractPkAndPv: true });

      // todo: refactor and move to a method (applyFilterAndSort)
      const aliasColObjMap = await this.model.getAliasColObjMap();
      let sorts = extractSortsObject(args?.sort, aliasColObjMap);
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
      // todo: replace with view id
      if (!args.ignoreViewFilterAndSort && this.viewId) {
        await conditionV2(
          [
            new Filter({
              children:
                (await Filter.rootFilterList({ viewId: this.viewId })) || [],
              is_group: true,
            }),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          qb,
          this.dbDriver,
        );

        if (!sorts)
          sorts = args.sortArr?.length
            ? args.sortArr
            : await Sort.list({ viewId: this.viewId });

        if (sorts?.['length']) await sortV2(sorts, qb, this.dbDriver);
      } else {
        await conditionV2(
          [
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          qb,
          this.dbDriver,
        );

        if (!sorts) sorts = args.sortArr;

        if (sorts?.['length']) await sortV2(sorts, qb, this.dbDriver);
      }

      // sort by primary key if not autogenerated string
      // if autogenerated string sort by created_at column if present
      if (this.model.primaryKey && this.model.primaryKey.ai) {
        qb.orderBy(this.model.primaryKey.column_name);
      } else if (
        this.model.columns.find((c) => c.column_name === 'created_at')
      ) {
        qb.orderBy('created_at');
      }

      const groupedQb = this.dbDriver.from(
        this.dbDriver
          .unionAll(
            [...groupingValues].map((r) => {
              const query = qb.clone();
              if (r === null) {
                query.whereNull(column.column_name);
              } else {
                query.where(column.column_name, r);
              }

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite,
          )
          .as('__nc_grouped_list'),
      );

      const proto = await this.getProto();

      const data = await groupedQb;
      const result = data?.map((d) => {
        d.__proto__ = proto;
        return d;
      });

      const groupedResult = result.reduce<Map<string | number | null, any[]>>(
        (aggObj, row) => {
          if (!aggObj.has(row[column.title])) {
            aggObj.set(row[column.title], []);
          }

          aggObj.get(row[column.title]).push(row);

          return aggObj;
        },
        new Map(),
      );

      const r = [...groupingValues].map((key) => ({
        key,
        value: groupedResult.get(key) ?? [],
      }));

      return r;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  public async groupedListCount(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
    } & XcFilter,
  ) {
    const column = await this.model
      .getColumns()
      .then((cols) => cols?.find((col) => col.id === args.groupColumnId));

    if (!column) NcError.notFound('Column not found');
    if (isVirtualCol(column))
      NcError.notImplemented('Grouping for virtual columns not implemented');

    const qb = this.dbDriver(this.tnPath)
      .count('*', { as: 'count' })
      .groupBy(column.column_name);

    // todo: refactor and move to a common method (applyFilterAndSort)
    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);
    // todo: replace with view id

    if (!args.ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        [
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        this.dbDriver,
      );
    } else {
      await conditionV2(
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        this.dbDriver,
      );
    }

    await this.selectObject({
      qb,
      columns: [new Column({ ...column, title: 'key' })],
    });

    return await qb;
  }

  private async execAndParse(qb: Knex.QueryBuilder, childTable?: Model) {
    let query = qb.toQuery();
    if (!this.isPg && !this.isMssql && !this.isSnowflake) {
      query = unsanitize(qb.toQuery());
    } else {
      query = sanitize(query);
    }
    let data =
      this.isPg || this.isSnowflake
        ? (await this.dbDriver.raw(query))?.rows
        : query.slice(0, 6) === 'select' && !this.isMssql
        ? await this.dbDriver.from(
            this.dbDriver.raw(query).wrap('(', ') __nc_alias'),
          )
        : await this.dbDriver.raw(query);

    // update attachment fields
    data = this.convertAttachmentType(data, childTable);

    // update date time fields
    const isXcdbBase = await this.isXcdbBase();
    data = this.convertDateFormat(data, isXcdbBase, childTable);

    return data;
  }

  private _convertAttachmentType(
    attachmentColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    try {
      if (d) {
        attachmentColumns.forEach((col) => {
          if (d[col.title] && typeof d[col.title] === 'string') {
            d[col.title] = JSON.parse(d[col.title]);
          }
        });
      }
    } catch {}
    return d;
  }

  private convertAttachmentType(data: Record<string, any>, childTable?: Model) {
    // attachment is stored in text and parse in UI
    // convertAttachmentType is used to convert the response in string to array of object in API response
    if (data) {
      const attachmentColumns = (
        childTable ? childTable.columns : this.model.columns
      ).filter((c) => c.uidt === UITypes.Attachment);
      if (attachmentColumns.length) {
        if (Array.isArray(data)) {
          data = data.map((d) =>
            this._convertAttachmentType(attachmentColumns, d),
          );
        } else {
          this._convertAttachmentType(attachmentColumns, data);
        }
      }
    }
    return data;
  }

  private _convertDateFormat(
    dateTimeColumns: Record<string, any>[],
    d: Record<string, any>,
    isXcdbBase: BoolType,
  ) {
    try {
      if (d) {
        dateTimeColumns.forEach((col) => {
          if (d[col.title] && typeof d[col.title] === 'string') {
            if (isXcdbBase) {
              // e.g. 01.01.2022 10:00:00+05:30 -> 2022-01-01 04:30:00+00:00
              d[col.title] = dayjs(d[col.title])
                .utc(true)
                .format('YYYY-MM-DD HH:mm:ssZ');
            } else {
              // e.g. 01.01.2022 10:00:00+05:30 -> 2022-01-01 04:30:00+00:00
              d[col.title] = dayjs(d[col.title])
                .utc()
                .format('YYYY-MM-DD HH:mm:ssZ');
            }
          }
        });
      }
    } catch {}
    return d;
  }

  private convertDateFormat(
    data: Record<string, any>,
    isXcdbBase: BoolType,
    childTable?: Model,
  ) {
    // MySQL converts TIMESTAMP values from the current time zone to UTC for storage.
    // Then, MySQL converts those values back from UTC to the current time zone for retrieval.
    // To make it consistent with other DB types, we show the result in UTC instead
    // e.g. 2022-01-01 04:30:00+00:00
    if (data) {
      const dateTimeColumns = (
        childTable ? childTable.columns : this.model.columns
      ).filter((c) => c.uidt === UITypes.DateTime);
      if (dateTimeColumns.length) {
        if (Array.isArray(data)) {
          data = data.map((d) =>
            this._convertDateFormat(dateTimeColumns, d, isXcdbBase),
          );
        } else {
          this._convertDateFormat(dateTimeColumns, data, isXcdbBase);
        }
      }
    }
    return data;
  }

  private async setUtcTimezoneForPg() {
    if (this.isPg && (await this.isXcdbBase())) {
      await this.dbDriver.raw(`SET TIME ZONE 'UTC'`);
    }
  }
}

function extractSortsObject(
  _sorts: string | string[],
  aliasColObjMap: { [columnAlias: string]: Column },
): Sort[] | void {
  if (!_sorts?.length) return;

  let sorts = _sorts;

  if (!Array.isArray(sorts)) sorts = sorts.split(',');

  return sorts.map((s) => {
    const sort: SortType = { direction: 'asc' };
    if (s.startsWith('-')) {
      sort.direction = 'desc';
      sort.fk_column_id = aliasColObjMap[s.slice(1)]?.id;
    } else sort.fk_column_id = aliasColObjMap[s]?.id;

    return new Sort(sort);
  });
}

function extractFilterFromXwhere(
  str,
  aliasColObjMap: { [columnAlias: string]: Column },
) {
  if (!str) {
    return [];
  }

  let nestedArrayConditions = [];

  let openIndex = str.indexOf('((');

  if (openIndex === -1) openIndex = str.indexOf('(~');

  let nextOpenIndex = openIndex;

  let closingIndex = str.indexOf('))');

  // if it's a simple query simply return array of conditions
  if (openIndex === -1) {
    if (str && str != '~not')
      nestedArrayConditions = str.split(
        /(?=~(?:or(?:not)?|and(?:not)?|not)\()/,
      );
    return extractCondition(nestedArrayConditions || [], aliasColObjMap);
  }

  // iterate until finding right closing
  while (
    (nextOpenIndex = str
      .substring(0, closingIndex)
      .indexOf('((', nextOpenIndex + 1)) != -1
  ) {
    closingIndex = str.indexOf('))', closingIndex + 1);
  }

  if (closingIndex === -1)
    throw new Error(
      `${str
        .substring(0, openIndex + 1)
        .slice(-10)} : Closing bracket not found`,
    );

  // getting operand starting index
  const operandStartIndex = str.lastIndexOf('~', openIndex);
  const operator =
    operandStartIndex != -1
      ? str.substring(operandStartIndex + 1, openIndex)
      : '';
  const lhsOfNestedQuery = str.substring(0, openIndex);

  nestedArrayConditions.push(
    ...extractFilterFromXwhere(lhsOfNestedQuery, aliasColObjMap),
    // calling recursively for nested query
    new Filter({
      is_group: true,
      logical_op: operator,
      children: extractFilterFromXwhere(
        str.substring(openIndex + 1, closingIndex + 1),
        aliasColObjMap,
      ),
    }),
    // RHS of nested query(recursion)
    ...extractFilterFromXwhere(str.substring(closingIndex + 2), aliasColObjMap),
  );
  return nestedArrayConditions;
}

// mark `op` and `sub_op` any for being assignable to parameter of type
function validateFilterComparison(uidt: UITypes, op: any, sub_op?: any) {
  if (!COMPARISON_OPS.includes(op)) {
    NcError.badRequest(`${op} is not supported.`);
  }

  if (sub_op) {
    if (![UITypes.Date, UITypes.DateTime].includes(uidt)) {
      NcError.badRequest(`'${sub_op}' is not supported for UI Type'${uidt}'.`);
    }
    if (!COMPARISON_SUB_OPS.includes(sub_op)) {
      NcError.badRequest(`'${sub_op}' is not supported.`);
    }
    if (
      (op === 'isWithin' && !IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op)) ||
      (op !== 'isWithin' && IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op))
    ) {
      NcError.badRequest(`'${sub_op}' is not supported for '${op}'`);
    }
  }
}

function extractCondition(nestedArrayConditions, aliasColObjMap) {
  return nestedArrayConditions?.map((str) => {
    // eslint-disable-next-line prefer-const
    let [logicOp, alias, op, value] =
      str.match(/(?:~(and|or|not))?\((.*?),(\w+),(.*)\)/)?.slice(1) || [];

    if (!alias && !op && !value) {
      // try match with blank filter format
      [logicOp, alias, op, value] =
        str.match(/(?:~(and|or|not))?\((.*?),(\w+)\)/)?.slice(1) || [];
    }
    let sub_op = null;

    if (aliasColObjMap[alias]) {
      if (
        [UITypes.Date, UITypes.DateTime].includes(aliasColObjMap[alias].uidt)
      ) {
        value = value?.split(',');
        // the first element would be sub_op
        sub_op = value?.[0];
        // remove the first element which is sub_op
        value?.shift();
        value = value?.[0];
      } else if (op === 'in') {
        value = value.split(',');
      }

      validateFilterComparison(aliasColObjMap[alias].uidt, op, sub_op);
    }

    return new Filter({
      comparison_op: op,
      ...(sub_op && { comparison_sub_op: sub_op }),
      fk_column_id: aliasColObjMap[alias]?.id,
      logical_op: logicOp,
      value,
    });
  });
}

function applyPaginate(
  query,
  {
    limit = 25,
    offset = 0,
    ignoreLimit = false,
  }: XcFilter & { ignoreLimit?: boolean },
) {
  query.offset(offset);
  if (!ignoreLimit) query.limit(limit);
  return query;
}

function _wherePk(primaryKeys: Column[], id) {
  const ids = (id + '').split('___');
  const where = {};
  for (let i = 0; i < primaryKeys.length; ++i) {
    where[primaryKeys[i].column_name] = ids[i];
  }
  return where;
}

function getCompositePk(primaryKeys: Column[], row) {
  return primaryKeys.map((c) => row[c.title]).join('___');
}

function haveFormulaColumn(columns: Column[]) {
  return columns.some((c) => c.uidt === UITypes.Formula);
}

function shouldSkipField(
  fieldsSet,
  viewOrTableColumn,
  view,
  column,
  extractPkAndPv,
) {
  if (fieldsSet) {
    return !fieldsSet.has(column.title);
  } else {
    if (!extractPkAndPv) {
      if (!(viewOrTableColumn instanceof Column)) {
        if (
          !(viewOrTableColumn as GridViewColumn)?.show &&
          !(column.rqd && !column.cdf && !column.ai) &&
          !column.pk &&
          column.uidt !== UITypes.ForeignKey
        )
          return true;
        if (
          !view?.show_system_fields &&
          column.uidt !== UITypes.ForeignKey &&
          !column.pk &&
          isSystemColumn(column)
        )
          return true;
      }
    }
    return false;
  }
}

export { BaseModelSqlv2 };
