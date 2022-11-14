import autoBind from 'auto-bind';
import _ from 'lodash';

import Model from '../../../../models/Model';
import SelectOption from '../../../../models/SelectOption';
import { XKnex } from '../../index';
import LinkToAnotherRecordColumn from '../../../../models/LinkToAnotherRecordColumn';
import RollupColumn from '../../../../models/RollupColumn';
import LookupColumn from '../../../../models/LookupColumn';
import DataLoader from 'dataloader';
import Column from '../../../../models/Column';
import { XcFilter, XcFilterWithAlias } from '../BaseModel';
import conditionV2 from './conditionV2';
import Filter from '../../../../models/Filter';
import sortV2 from './sortV2';
import Sort from '../../../../models/Sort';
import FormulaColumn from '../../../../models/FormulaColumn';
import genRollupSelectv2 from './genRollupSelectv2';
import formulaQueryBuilderv2 from './formulav2/formulaQueryBuilderv2';
import { Knex } from 'knex';
import View from '../../../../models/View';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  isVirtualCol,
  RelationTypes,
  SortType,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import formSubmissionEmailTemplate from '../../../../utils/common/formSubmissionEmailTemplate';
import ejs from 'ejs';
import Audit from '../../../../models/Audit';
import FormView from '../../../../models/FormView';
import Hook from '../../../../models/Hook';
import NcPluginMgrv2 from '../../../../meta/helpers/NcPluginMgrv2';
import {
  _transformSubmittedFormDataForEmail,
  invokeWebhook,
} from '../../../../meta/helpers/webhookHelpers';
import Validator from 'validator';
import { customValidators } from './customValidators';
import { NcError } from '../../../../meta/helpers/catchError';
import { customAlphabet } from 'nanoid';
import DOMPurify from 'isomorphic-dompurify';
import { sanitize, unsanitize } from './helpers/sanitize';

const GROUP_COL = '__nc_group_id';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const { v4: uuidv4 } = require('uuid');

async function populatePk(model: Model, insertObj: any) {
  await model.getColumns();
  for (const pkCol of model.primaryKeys) {
    if (!pkCol.meta?.ag || insertObj[pkCol.title]) continue;
    insertObj[pkCol.title] =
      pkCol.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
  }
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

  public async readByPk(id?: any): Promise<any> {
    const qb = this.dbDriver(this.tnPath);

    await this.selectObject({ qb });

    qb.where(_wherePk(this.model.primaryKeys, id));

    const data = (await this.extractRawQueryAndExec(qb))?.[0];

    if (data) {
      const proto = await this.getProto();
      data.__proto__ = proto;
    }
    return data;
  }

  public async exist(id?: any): Promise<any> {
    const qb = this.dbDriver(this.tnPath);
    await this.selectObject({ qb });
    const pks = this.model.primaryKeys;
    if ((id + '').split('___').length != pks.length) {
      return false;
    }
    return !!(await qb.where(_wherePk(pks, id)).first());
  }

  // todo: add support for sortArrJson
  public async findOne(
    args: {
      where?: string;
      filterArr?: Filter[];
      sort?: string | string[];
    } = {}
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const qb = this.dbDriver(this.tnPath);
    await this.selectObject({ qb });

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
      this.dbDriver
    );

    if (Array.isArray(sorts) && sorts?.length) {
      await sortV2(sorts, qb, this.dbDriver);
    } else if (this.model.primaryKey) {
      qb.orderBy(this.model.primaryKey.column_name);
    }

    const data = await qb.first();

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
    } = {},
    ignoreFilterSort = false
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.tnPath);
    await this.selectObject({ qb });
    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap();
    let sorts = extractSortsObject(rest?.sort, aliasColObjMap);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    // todo: replace with view id
    if (!ignoreFilterSort && this.viewId) {
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
        this.dbDriver
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
        this.dbDriver
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

    if (!ignoreFilterSort) applyPaginate(qb, rest);
    const proto = await this.getProto();
    const data = await this.extractRawQueryAndExec(qb);

    return data?.map((d) => {
      d.__proto__ = proto;
      return d;
    });
  }

  public async count(
    args: { where?: string; limit?; filterArr?: Filter[] } = {},
    ignoreFilterSort = false
  ): Promise<any> {
    await this.model.getColumns();
    const { where } = this._getListArgs(args);

    const qb = this.dbDriver(this.tnPath);

    // qb.xwhere(where, await this.model.getAliasColMapping());
    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    if (!ignoreFilterSort && this.viewId) {
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
        this.dbDriver
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
        this.dbDriver
      );
    }

    qb.count(sanitize(this.model.primaryKey?.column_name) || '*', {
      as: 'count',
    }).first();
    const res = (await this.dbDriver.raw(unsanitize(qb.toQuery()))) as any;
    return (this.isPg ? res.rows[0] : res[0][0] ?? res[0]).count;
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
    }
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
      this.dbDriver
    );
    qb.groupBy(args.column_name);
    if (sorts) await sortV2(sorts, qb, this.dbDriver);
    applyPaginate(qb, rest);
    const data = await qb;
    return data;
  }

  async multipleHmList({ colId, ids }, args: { limit?; offset? } = {}) {
    try {
      const { where, sort, ...rest } = this._getListArgs(args as any);
      // todo: get only required fields

      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId
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
      await childModel.selectObject({ qb });
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
                    .where(_wherePk(parentTable.primaryKeys, p))
                );
              // todo: sanitize
              query.limit(+rest?.limit || 25);
              query.offset(+rest?.offset || 0);

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite
          )
          .as('list')
      );

      const children = await this.extractRawQueryAndExec(childQb);
      const proto = await (
        await Model.getBaseModelSQL({
          id: childTable.id,
          dbDriver: this.dbDriver,
        })
      ).getProto();

      return _.groupBy(
        children.map((c) => {
          c.__proto__ = proto;
          return c;
        }),
        GROUP_COL
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
        (c) => c.id === colId
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
                .where(_wherePk(parentTable.primaryKeys, p))
            )
            .first();

          return this.isSqlite ? this.dbDriver.select().from(query) : query;
        }),
        !this.isSqlite
      );

      return children.map(({ count }) => count);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async hmList({ colId, id }, args: { limit?; offset? } = {}) {
    try {
      const { where, sort, ...rest } = this._getListArgs(args as any);
      // todo: get only required fields

      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId
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
          .where(_wherePk(parentTable.primaryKeys, id))
      );
      // todo: sanitize
      qb.limit(+rest?.limit || 25);
      qb.offset(+rest?.offset || 0);

      await childModel.selectObject({ qb });

      const children = await this.extractRawQueryAndExec(qb);

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
        (c) => c.id === colId
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
            .where(_wherePk(parentTable.primaryKeys, id))
        )
        .first();
      const { count } = await query;
      return count;
      // return _.groupBy(children, cn);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  public async multipleMmList(
    { colId, parentIds },
    args: { limit?; offset? } = {}
  ) {
    const { where, sort, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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

    await childModel.selectObject({ qb });

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
              .where(_wherePk(parentTable.primaryKeys, id))
          )
          .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));

        // todo: sanitize
        query.limit(+rest?.limit || 25);
        query.offset(+rest?.offset || 0);

        return this.isSqlite ? this.dbDriver.select().from(query) : query;
      }),
      !this.isSqlite
    );

    let children = await this.extractRawQueryAndExec(finalQb);
    if (this.isMySQL) {
      children = children[0];
    }
    const proto = await (
      await Model.getBaseModelSQL({
        id: rtnId,
        dbDriver: this.dbDriver,
      })
    ).getProto();
    const gs = _.groupBy(
      children.map((c) => {
        c.__proto__ = proto;
        return c;
      }),
      GROUP_COL
    );
    return parentIds.map((id) => gs[id] || []);
  }

  public async mmList({ colId, parentId }, args: { limit?; offset? } = {}) {
    const { where, sort, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
          .where(_wherePk(parentTable.primaryKeys, parentId))
      );

    await childModel.selectObject({ qb });

    await this.applySortAndFilter({ table: childTable, where, qb, sort });

    // todo: sanitize
    qb.limit(+rest?.limit || 25);
    qb.offset(+rest?.offset || 0);

    const children = await this.extractRawQueryAndExec(qb);
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
      (c) => c.id === colId
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
              .where(_wherePk(parentTable.primaryKeys, id))
          )
          .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));
        // this._paginateAndSort(query, { sort, limit, offset }, null, true);
        return this.isSqlite ? this.dbDriver.select().from(query) : query;
      }),
      !this.isSqlite
    );

    const gs = _.groupBy(children, GROUP_COL);
    return parentIds.map((id) => gs?.[id]?.[0] || []);
  }

  public async mmListCount({ colId, parentId }) {
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
          .where(_wherePk(parentTable.primaryKeys, parentId))
      )
      .first();

    const { count } = await qb;

    return count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedListCount(
    { colId, pid = null },
    args
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
                .where(_wherePk(parentTable.primaryKeys, pid))
            )
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
    args
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
                .where(_wherePk(parentTable.primaryKeys, pid))
            )
        )
        .orWhereNull(rcn)
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
    args
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
            .where(_wherePk(parentTable.primaryKeys, pid))
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
    args
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
          .where(_wherePk(parentTable.primaryKeys, pid))
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
    const data = await this.extractRawQueryAndExec(qb);

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedListCount(
    { colId, cid = null },
    args
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
            .whereNotNull(cn)
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
    args
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId
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
          .whereNotNull(cn)
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
    const data = await this.extractRawQueryAndExec(qb);

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
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
                      (listLoader as any).args
                    );
                    return ids.map((id: string) => (data[id] ? data[id] : []));
                  } else {
                    return [
                      await this.hmList(
                        {
                          colId: column.id,
                          id: ids[0],
                        },
                        (listLoader as any).args
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
                  getCompositePk(self.model.primaryKeys, this)
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
                      (listLoader as any).args
                    );

                    return data;
                  } else {
                    return [
                      await this.mmList(
                        {
                          parentId: ids[0],
                          colId: column.id,
                        },
                        (listLoader as any).args
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
                  getCompositePk(self.model.primaryKeys, this)
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
                    },
                    true
                  );
                  const gs = _.groupBy(data, pCol.title);
                  return ids.map(async (id: string) => gs?.[id]?.[0]);
                } catch (e) {
                  console.log(e);
                  return [];
                }
              });

              // defining HasMany count method within GQL Type class
              proto[column.title] = async function () {
                if (
                  this?.[cCol?.title] === null ||
                  this?.[cCol?.title] === undefined
                )
                  return null;

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
        this.config.limitMax
      ),
      this.config.limitMin
    );
    obj.offset = Math.max(+(args.offset || args.o) || 0, 0);
    obj.fields = args.fields || args.f || '*';
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

  public async selectObject({
    qb,
    columns: _columns,
  }: {
    qb: Knex.QueryBuilder;
    columns?: Column[];
  }): Promise<void> {
    const res = {};
    const columns = _columns ?? (await this.model.getColumns());
    for (const column of columns) {
      switch (column.uidt) {
        case 'LinkToAnotherRecord':
        case 'Lookup':
          break;
        case 'Formula':
          {
            const formula = await column.getColOptions<FormulaColumn>();
            if (formula.error) continue;
            const selectQb = await formulaQueryBuilderv2(
              formula.formula,
              null,
              this.dbDriver,
              this.model
              // this.aliasToColumn
            );
            // todo:  verify syntax of as ? / ??
            qb.select(
              this.dbDriver.raw(`?? as ??`, [
                selectQb.builder,
                sanitize(column.title),
              ])
            );
          }
          break;
        case 'Rollup':
          qb.select(
            (
              await genRollupSelectv2({
                // tn: this.title,
                knex: this.dbDriver,
                // column,
                columnOptions: (await column.getColOptions()) as RollupColumn,
              })
            ).builder.as(sanitize(column.title))
          );
          break;
        default:
          res[sanitize(column.title || column.column_name)] = sanitize(
            `${this.model.table_name}.${column.column_name}`
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
      const insertObj = await this.model.mapAliasToColumn(data);

      await this.validate(insertObj);

      if ('beforeInsert' in this) {
        await this.beforeInsert(insertObj, trx, cookie);
      }

      // if ('beforeInsert' in this) {
      //   await this.beforeInsert(insertObj, trx, cookie);
      // }
      await this.model.getColumns();
      let response;
      // const driver = trx ? trx : this.dbDriver;

      const query = this.dbDriver(this.tnPath).insert(insertObj);
      if ((this.isPg || this.isMssql) && this.model.primaryKey) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.title}`
        );
        response = await this.extractRawQueryAndExec(query);
      }

      const ai = this.model.columns.find((c) => c.ai);

      let ag: Column;
      if (!ai) ag = this.model.columns.find((c) => c.meta?.ag);

      // handle if autogenerated primary key is used
      if (ag) {
        if (!response) await this.extractRawQueryAndExec(query);
        response = await this.readByPk(data[ag.title]);
      } else if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          const res = await this.extractRawQueryAndExec(query);
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
          }
          response = await this.readByPk(id);
        } else {
          response = data;
        }
      } else if (ai) {
        response = await this.readByPk(
          Array.isArray(response)
            ? response?.[0]?.[ai.title]
            : response?.[ai.title]
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
      // retrieve data for handling paramas in hook
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
      (c) => c.uidt === UITypes.LinkToAnotherRecord
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
          } is a LinkToAnotherRecord of ${childModel.title}`
        );
      }
    }
    return res;
  }

  async updateByPk(id, data, trx?, cookie?) {
    try {
      const updateObj = await this.model.mapAliasToColumn(data);

      await this.validate(data);

      await this.beforeUpdate(data, trx, cookie);

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id));

      await this.extractRawQueryAndExec(query);

      const response = await this.readByPk(id);
      await this.afterUpdate(response, trx, cookie);
      return response;
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
    const table =
      this.isMssql && schema
        ? this.dbDriver.raw('??.??', [schema, tb.table_name])
        : tb.table_name;
    return table;
  }

  public get tnPath() {
    return this.getTnPath(this.model);
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

  get clientType() {
    return this.dbDriver.clientType();
  }

  async nestedInsert(data, _trx = null, cookie?) {
    // const driver = trx ? trx : await this.dbDriver.transaction();
    try {
      await populatePk(this.model, data);
      const insertObj = await this.model.mapAliasToColumn(data);

      let rowId = null;
      const postInsertOps = [];

      const nestedCols = (await this.model.getColumns()).filter(
        (c) => c.uidt === UITypes.LinkToAnotherRecord
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
                      nestedData?.map((r) => r[childModel.primaryKey.title])
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
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.title}`
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
          // response = await this.readByPk(id)
          response = await this.readByPk(id);
        } else {
          response = data;
        }
      } else if (ai) {
        response = await this.readByPk(
          Array.isArray(response)
            ? response?.[0]?.[ai.title]
            : response?.[ai.title]
        );
      }
      response = Array.isArray(response) ? response[0] : response;
      if (response)
        rowId =
          response[this.model.primaryKey.title] ||
          response[this.model.primaryKey.column_name];
      await Promise.all(postInsertOps.map((f) => f()));

      // if (!trx) {
      //   await driver.commit();
      // }

      await this.afterInsert(response, this.dbDriver, cookie);

      return response;
    } catch (e) {
      console.log(e);
      // await this.errorInsert(e, data, trx, cookie);
      // if (!trx) {
      //   await driver.rollback(e);
      // }
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
    } = {}
  ) {
    try {
      const insertDatas = await Promise.all(
        datas.map(async (d) => {
          await populatePk(this.model, d);
          return this.model.mapAliasToColumn(d);
        })
      );

      // await this.beforeInsertb(insertDatas, null);

      for (const data of datas) {
        await this.validate(data);
      }
      // let chunkSize = 50;
      //
      // if (this.isSqlite && datas[0]) {
      //   chunkSize = Math.max(1, Math.floor(999 / Object.keys(datas[0]).length));
      // }

      // fallbacks to `10` if database client is sqlite
      // to avoid `too many SQL variables` error
      // refer : https://www.sqlite.org/limits.html
      const chunkSize = this.isSqlite ? 10 : _chunkSize;

      const response =
        this.isPg || this.isMssql
          ? await this.dbDriver
              .batchInsert(this.model.table_name, insertDatas, chunkSize)
              .returning(this.model.primaryKey?.column_name)
          : await this.dbDriver.batchInsert(
              this.model.table_name,
              insertDatas,
              chunkSize
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
        datas.map((d) => this.model.mapAliasToColumn(d))
      );

      transaction = await this.dbDriver.transaction();

      // await this.beforeUpdateb(updateDatas, transaction);
      const res = [];
      for (const d of updateDatas) {
        await this.validate(d);
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // pk not specified - bypass
          continue;
        }
        const wherePk = await this._wherePk(pkValues);
        const response = await transaction(this.model.table_name)
          .update(d)
          .where(wherePk);
        res.push(response);
      }

      await this.afterBulkUpdate(updateDatas.length, this.dbDriver, cookie);
      transaction.commit();

      return res;
    } catch (e) {
      if (transaction) transaction.rollback();
      // console.log(e);
      // await this.errorUpdateb(e, data, null);
      throw e;
    }
  }

  async bulkUpdateAll(
    args: { where?: string; filterArr?: Filter[] } = {},
    data,
    { cookie }: { cookie?: any } = {}
  ) {
    let queryResponse;
    try {
      const updateData = await this.model.mapAliasToColumn(data);
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
          this.dbDriver
        );

        qb.update(updateData);
        queryResponse = (await qb) as any;
      }

      const count = queryResponse ?? 0;
      await this.afterBulkUpdate(count, this.dbDriver, cookie);

      return count;
    } catch (e) {
      throw e;
    }
  }

  async bulkDelete(ids: any[], { cookie }: { cookie?: any } = {}) {
    let transaction;
    try {
      transaction = await this.dbDriver.transaction();
      // await this.beforeDeleteb(ids, transaction);

      const res = [];
      for (const d of ids) {
        if (Object.keys(d).length) {
          const response = await transaction(this.model.table_name)
            .del()
            .where(d);
          res.push(response);
        }
      }
      // await this.afterDeleteb(res, transaction);

      transaction.commit();

      await this.afterBulkDelete(ids.length, this.dbDriver, cookie);

      return res;
    } catch (e) {
      if (transaction) transaction.rollback();
      console.log(e);
      // await this.errorDeleteb(e, ids);
      throw e;
    }
  }

  async bulkDeleteAll(
    args: { where?: string; filterArr?: Filter[] } = {},
    { cookie }: { cookie?: any } = {}
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
        this.dbDriver
      );
      qb.del();
      const count = (await qb) as any;

      await this.afterBulkDelete(count, this.dbDriver, cookie);

      return count;
    } catch (e) {
      throw e;
    }
  }

  /**
   *  Hooks
   * */

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('Before.insert', data, req);
  }

  public async afterInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('After.insert', data, req);
    // if (req?.headers?.['xc-gui']) {
    const id = this._extractPksValues(data);
    await Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.INSERT,
      description: DOMPurify.sanitize(
        `${id} inserted into ${this.model.title}`
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
    // }
  }

  public async afterBulkUpdate(count: number, _trx: any, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_UPDATE,
      description: DOMPurify.sanitize(
        `${count} records bulk updated in ${this.model.title}`
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkDelete(count: number, _trx: any, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_DELETE,
      description: DOMPurify.sanitize(
        `${count} records bulk deleted in ${this.model.title}`
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkInsert(data: any[], _trx: any, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_INSERT,
      description: DOMPurify.sanitize(
        `${data.length} records bulk inserted into ${this.model.title}`
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
      await this.handleHooks('Before.update', data, req);
    }
  }

  public async afterUpdate(data: any, _trx: any, req): Promise<void> {
    const id = this._extractPksValues(data);
    await Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UPDATE,
      description: DOMPurify.sanitize(`${id} updated in ${this.model.title}`),
      // details: JSON.stringify(data),
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
      await this.handleHooks('After.update', data, req);
    }
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('Before.delete', data, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    // if (req?.headers?.['xc-gui']) {
    const id = req?.params?.id;
    await Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.DELETE,
      description: DOMPurify.sanitize(`${id} deleted from ${this.model.title}`),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
    // }
    await this.handleHooks('After.delete', data, req);
  }

  private async handleHooks(hookName, data, req): Promise<void> {
    // const data = _data;

    const view = await View.get(this.viewId);

    // handle form view data submission
    if (hookName === 'After.insert' && view.type === ViewTypes.FORM) {
      try {
        const formView = await view.getView<FormView>();
        const { columns } = await FormView.getWithInfo(formView.fk_view_id);
        const allColumns = await this.model.getColumns();
        const fieldById = columns.reduce(
          (o: Record<string, any>, f: Record<string, any>) => ({
            ...o,
            [f.fk_column_id]: f,
          }),
          {}
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
              a.order - b.order
          )
          .filter(
            (f: Record<string, any>) =>
              f.show &&
              f.uidt !== UITypes.Rollup &&
              f.uidt !== UITypes.Lookup &&
              f.uidt !== UITypes.Formula &&
              f.uidt !== UITypes.SpecificDBType
          )
          .sort(
            (a: Record<string, any>, b: Record<string, any>) =>
              a.order - b.order
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
            data,
            formView,
            filteredColumns
          );
          (await NcPluginMgrv2.emailAdapter())?.mailSend({
            to: emails.join(','),
            subject: 'NocoDB Form',
            html: ejs.render(formSubmissionEmailTemplate, {
              data: transformedData,
              tn: this.model.table_name,
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
        invokeWebhook(hook, this.model, data, req?.user);
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
      if (!column?.meta?.validate && !column?.validate) continue;

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
              .replace(/\{cn}/g, columnTitle)
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
                  .as('___cn_alias')
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
                  .as('___cn_alias')
              ),
            })
            .where(_wherePk(childTable.primaryKeys, rowId));
        }
        break;
    }

    await this.afterAddChild(rowId, childId, cookie);
  }

  public async afterAddChild(rowId, childId, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.LINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] record linked with record [id:${rowId}] record in ${this.model.title}`
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

    await this.afterRemoveChild(rowId, childId, cookie);
  }

  public async afterRemoveChild(rowId, childId, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] record unlinked with record [id:${rowId}] record in ${this.model.title}`
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async groupedList(
    args: {
      groupColumnId: string;
      ignoreFilterSort?: boolean;
      options?: (string | number | null | boolean)[];
    } & Partial<XcFilter>
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
          (colOptions?.options ?? []).map((opt) => opt.title)
        );
        groupingValues.add(null);
      } else {
        groupingValues = new Set(
          (
            await this.dbDriver(this.model.table_name)
              .select(column.column_name)
              .distinct()
          ).map((row) => row[column.column_name])
        );
        groupingValues.add(null);
      }

      const qb = this.dbDriver(this.model.table_name);
      qb.limit(+rest?.limit || 25);
      qb.offset(+rest?.offset || 0);

      await this.selectObject({ qb });

      // todo: refactor and move to a method (applyFilterAndSort)
      const aliasColObjMap = await this.model.getAliasColObjMap();
      let sorts = extractSortsObject(args?.sort, aliasColObjMap);
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
      // todo: replace with view id
      if (!args.ignoreFilterSort && this.viewId) {
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
          this.dbDriver
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
          this.dbDriver
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
            !this.isSqlite
          )
          .as('__nc_grouped_list')
      );

      const proto = await this.getProto();

      const result = (await groupedQb)?.map((d) => {
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
        new Map()
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
    args: { groupColumnId: string; ignoreFilterSort?: boolean } & XcFilter
  ) {
    const column = await this.model
      .getColumns()
      .then((cols) => cols?.find((col) => col.id === args.groupColumnId));

    if (!column) NcError.notFound('Column not found');
    if (isVirtualCol(column))
      NcError.notImplemented('Grouping for virtual columns not implemented');

    const qb = this.dbDriver(this.model.table_name)
      .count('*', { as: 'count' })
      .groupBy(column.column_name);

    // todo: refactor and move to a common method (applyFilterAndSort)
    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);
    // todo: replace with view id

    if (!args.ignoreFilterSort && this.viewId) {
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
        this.dbDriver
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
        this.dbDriver
      );
    }

    await this.selectObject({
      qb,
      columns: [new Column({ ...column, title: 'key' })],
    });

    return await qb;
  }

  private async extractRawQueryAndExec(qb: Knex.QueryBuilder) {
    let query = qb.toQuery();
    if (!this.isPg && !this.isMssql) {
      query = unsanitize(qb.toQuery());
    } else {
      query = sanitize(query);
    }
    return this.isPg
      ? (await this.dbDriver.raw(query))?.rows
      : query.slice(0, 6) === 'select' && !this.isMssql
      ? await this.dbDriver.from(
          this.dbDriver.raw(query).wrap('(', ') __nc_alias')
        )
      : await this.dbDriver.raw(query);
  }
}

function extractSortsObject(
  _sorts: string | string[],
  aliasColObjMap: { [columnAlias: string]: Column }
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
  aliasColObjMap: { [columnAlias: string]: Column }
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
        /(?=~(?:or(?:not)?|and(?:not)?|not)\()/
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
        .slice(-10)} : Closing bracket not found`
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
        aliasColObjMap
      ),
    }),
    // RHS of nested query(recursion)
    ...extractFilterFromXwhere(str.substring(closingIndex + 2), aliasColObjMap)
  );
  return nestedArrayConditions;
}

function extractCondition(nestedArrayConditions, aliasColObjMap) {
  return nestedArrayConditions?.map((str) => {
    // eslint-disable-next-line prefer-const
    let [logicOp, alias, op, value] =
      str.match(/(?:~(and|or|not))?\((.*?),(\w+),(.*)\)/)?.slice(1) || [];
    if (op === 'in') value = value.split(',');

    return new Filter({
      comparison_op: op,
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
  }: XcFilter & { ignoreLimit?: boolean }
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

export { BaseModelSqlv2 };
