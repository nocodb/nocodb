import {
  AppEvents,
  AuditV1OperationTypes,
  convertDurationToSeconds,
  enumColors,
  extractFilterFromXwhere,
  isAIPromptCol,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isOrderCol,
  isSystemColumn,
  isVirtualCol,
  NcErrorType,
  ncIsUndefined,
  PlanLimitTypes,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import BigNumber from 'bignumber.js';
import { BaseModelSqlv2 as BaseModelSqlv2CE } from 'src/db/BaseModelSqlv2';
import dayjs from 'dayjs';
import conditionV2 from 'src/db/conditionV2';
import { customValidators } from 'src/db/util/customValidators';
import { v4 as uuidv4 } from 'uuid';
import { customAlphabet } from 'nanoid';
import { NcApiVersion } from 'nocodb-sdk';
import type {
  DataBulkDeletePayload,
  DataBulkUpdateAllPayload,
  DataBulkUpdatePayload,
  DataDeletePayload,
  DataInsertPayload,
  DataLinkPayload,
  DataUnlinkPayload,
  DataUpdatePayload,
  FilterType,
  NcRequest,
  UpdatePayload,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { LinkToAnotherRecordColumn, Source, View } from '~/models';
import type { NcContext } from '~/interface/config';
import {
  batchUpdate,
  extractColsMetaForAudit,
  extractExcludedColumnNames,
  generateAuditV1Payload,
  populateUpdatePayloadDiff,
  remapWithAlias,
} from '~/utils';
import {
  Column,
  FileReference,
  Filter,
  Model,
  ModelStat,
  RecordAudit,
} from '~/models';
import { getSingleQueryReadFn } from '~/services/data-opt/pg-helpers';
import { canUseOptimisedQuery, removeBlankPropsAndMask } from '~/utils';
import {
  UPDATE_WORKSPACE_COUNTER,
  UPDATE_WORKSPACE_STAT,
} from '~/services/update-stats.service';
import Noco from '~/Noco';
import { NcError, OptionsNotExistsError } from '~/helpers/catchError';
import { sanitize } from '~/helpers/sqlSanitize';
import { runExternal } from '~/helpers/muxHelpers';
import { checkLimit, getLimit } from '~/helpers/paymentHelpers';
import { extractMentions } from '~/utils/richTextHelper';
import { MetaTable } from '~/utils/globals';
import {
  _wherePk,
  extractSortsObject,
  formatDataForAudit,
  getAs,
  getColumnName,
  getCompositePkValue,
  getListArgs,
  haveFormulaColumn,
  populatePk,
  validateFuncOnColumn,
} from '~/helpers/dbHelpers';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const ORDER_STEP_INCREMENT = 1;
const MAX_RECURSION_DEPTH = 2;

export function replaceDynamicFieldWithValue(
  row: any,
  rowId,
  tableColumns: Column[],
  readByPk: typeof BaseModelSqlv2.prototype.readByPk,
  queryParams?: Record<string, string>,
) {
  const replaceWithValue = async (conditions: Filter[]) => {
    const filters: Filter[] = [];

    for (let i = 0; i < conditions.length; i++) {
      if (conditions[i].is_group) {
        const children = await replaceWithValue(conditions[i].children);
        filters.push({
          ...conditions[i],
          children,
        } as Filter);
        continue;
      } else if (!conditions[i].fk_value_col_id) {
        filters.push(conditions[i]);
        continue;
      }

      const condition = { ...conditions[i] } as Filter;

      // if value follows pattern like '{{ columnName }}' then replace it with row value
      if (!row) {
        row = await readByPk(
          rowId,
          false,
          {},
          { ignoreView: true, getHiddenColumn: true },
        );

        // if linkRowData is passed over queryParams, then override props from the row
        if (queryParams?.linkRowData) {
          try {
            const rowDataFromReq = JSON.parse(queryParams.linkRowData);
            if (rowDataFromReq && typeof rowDataFromReq === 'object')
              Object.assign(row, rowDataFromReq);
          } catch {
            // do nothing
          }
        }
      }
      const columnName = tableColumns.find(
        (c) => c.id === condition.fk_value_col_id,
      )?.title;

      condition.value = row[columnName] ?? null;
      filters.push(condition);
    }

    return filters;
  };
  return replaceWithValue;
}

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 extends BaseModelSqlv2CE {
  public context: NcContext;

  constructor({
    dbDriver,
    model,
    viewId,
    schema,
    context,
  }: {
    [key: string]: any;
    model: Model;
    schema?: string;
  }) {
    super({ dbDriver, model, viewId });
    this.schema = schema;
    this.context = context;
  }

  public getTnPath(tb: { table_name: string } | string, alias?: string) {
    const tn = typeof tb === 'string' ? tb : tb.table_name;
    const schema = (this.dbDriver as any).searchPath?.();
    if (this.isPg && this.schema) {
      return `${this.schema}.${tn}${alias ? ` as ${alias}` : ``}`;
    } else if (this.isMssql && schema) {
      return this.dbDriver.raw(`??.??${alias ? ' as ??' : ''}`, [
        schema,
        tn,
        ...(alias ? [alias] : []),
      ]);
    } else if (this.isSnowflake) {
      return `${[
        this.dbDriver.extDb?.connection?.database ||
          this.dbDriver.client.config.connection.database,
        this.dbDriver.extDb?.connection?.schema ||
          this.dbDriver.client.config.connection.schema,
        tn,
      ].join('.')}${alias ? ` as ${alias}` : ``}`;
    } else {
      return `${tn}${alias ? ` as ${alias}` : ``}`;
    }
  }

  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
    options: {
      skipDateConversion?: boolean;
      skipAttachmentConversion?: boolean;
      skipSubstitutingColumnIds?: boolean;
      skipUserConversion?: boolean;
      skipJsonConversion?: boolean;
      bulkAggregate?: boolean;
      raw?: boolean; // alias for skipDateConversion and skipAttachmentConversion
      first?: boolean;
      apiVersion?: NcApiVersion;
    } = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      bulkAggregate: false,
      skipJsonConversion: false,
      raw: false,
      first: false,
      apiVersion: NcApiVersion.V2,
    },
  ) {
    if (options.raw || options.bulkAggregate) {
      options.skipDateConversion = true;
      options.skipAttachmentConversion = true;
      options.skipSubstitutingColumnIds = true;
      options.skipUserConversion = true;
      options.skipJsonConversion = true;
    }

    if (options.first && typeof qb !== 'string') {
      qb = qb.limit(1);
    }

    const query = typeof qb === 'string' ? qb : qb.toQuery();

    let data;

    if ((this.dbDriver as any).isExternal) {
      data = await runExternal(
        this.sanitizeQuery(query),
        (this.dbDriver as any).extDb,
      );
    } else {
      data = await this.execAndGetRows(query);
    }

    if (!this.model?.columns) {
      await this.model.getColumns(this.context);
    }

    // we need to post process lookup fields based on the looked up column instead of the lookup column
    const aliasColumns = {};

    if (!dependencyColumns) {
      const nestedColumns = this.model?.columns.filter(
        (col) => col.uidt === UITypes.Lookup,
      );

      for (const col of nestedColumns) {
        const nestedColumn = await this.getNestedColumn(col);
        if (
          nestedColumn &&
          [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(
            nestedColumn.colOptions?.type,
          )
        ) {
          aliasColumns[col.id] = nestedColumn;
        }
      }
    }

    // update attachment fields
    if (!options.skipAttachmentConversion) {
      data = await this.convertAttachmentType(data, dependencyColumns);
    }

    // update date time fields
    if (!options.skipDateConversion) {
      data = this.convertDateFormat(data, dependencyColumns);
    }

    // update user fields
    if (!options.skipUserConversion) {
      data = await this.convertUserFormat(
        data,
        dependencyColumns,
        options?.apiVersion,
      );
    }
    // Update button fields
    if (!options.skipJsonConversion) {
      data = await this.convertJsonTypes(data, dependencyColumns);
    }

    if (options.bulkAggregate) {
      data = data.map(async (d) => {
        for (const key in d) {
          let data = d[key];

          if (typeof data === 'string' && data.startsWith('{')) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              // do nothing
            }
          }

          d[key] =
            (
              await this.substituteColumnIdsWithColumnTitles(
                [data],
                dependencyColumns,
                aliasColumns,
              )
            )[0] ?? {};
        }
        return d;
      });
    }

    if (!options.skipSubstitutingColumnIds) {
      data = await this.substituteColumnIdsWithColumnTitles(
        data,
        dependencyColumns,
        aliasColumns,
      );
    }
    if (options.apiVersion === NcApiVersion.V3) {
      data = await this.convertMultiSelectTypes(data, dependencyColumns);
    }

    if (options.first) {
      return data?.[0];
    }

    return data;
  }

  public async handleRichTextMentions(
    prevData,
    newData: Record<string, any> | Array<Record<string, any>>,
    req,
  ) {
    newData = Array.isArray(newData) ? newData : [newData];

    prevData = Array.isArray(prevData) ? prevData : prevData ? [prevData] : [];

    const columns = (await this.model.getColumns(this.context)).filter(
      (c) => c.uidt === UITypes.LongText && c.meta?.richMode,
    );

    newData.forEach((newRow, index) => {
      const prevRow = prevData[index];
      for (const column of columns) {
        const prevMentions = extractMentions(
          prevRow?.[column.column_name] ?? '',
        );
        const newMentions = extractMentions(newRow[column.column_name]);

        const uniqMentions = newMentions.filter(
          (m) => !prevMentions.includes(m),
        );

        if (uniqMentions.length > 0) {
          Noco.eventEmitter.emit(AppEvents.ROW_USER_MENTION, {
            mentions: uniqMentions,
            user: req?.user,
            column,
            rowId: this.extractPksValues(newRow, true),
            model: this.model,
            req,
          });
        }
      }
    });
  }

  async runOps(ops: Promise<string>[], trx = this.dbDriver) {
    const queries = await Promise.all(ops);
    if ((this.dbDriver as any).isExternal) {
      await runExternal(
        this.sanitizeQuery(queries),
        (this.dbDriver as any).extDb,
      );
    } else {
      for (const query of queries) {
        await trx.raw(this.sanitizeQuery(query));
      }
    }
  }

  async insert(data, trx?, cookie?, disableOptimization = false) {
    try {
      const columns = await this.model.getColumns(this.context);

      // exclude auto increment columns in body
      for (const col of columns) {
        if (col.ai) {
          const keyName =
            data?.[col.column_name] !== undefined ? col.column_name : col.title;

          if (data[keyName]) {
            delete data[keyName];
          }
        }
      }

      await populatePk(this.context, this.model, data);

      // todo: filter based on view
      const insertObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );

      await this.validate(insertObj, columns);

      if ('beforeInsert' in this) {
        await this.beforeInsert(insertObj, trx, cookie);
      }

      await this.prepareNocoData(insertObj, true, cookie);

      let response;
      // const driver = trx ? trx : this.dbDriver;

      const query = this.dbDriver(this.tnPath).insert(insertObj);
      if ((this.isPg || this.isMssql) && this.model.primaryKey) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.id}`,
        );
        response = await this.execAndParse(query, null, { raw: true });
      }

      const ai = this.model.columns.find((c) => c.ai);

      let ag: Column;
      if (!ai) ag = this.model.columns.find((c) => c.meta?.ag);

      const source = await this.getSource();

      // handle if autogenerated primary key is used
      if (ag) {
        if (!response) await this.execAndParse(query);
        const rowId = this.extractCompositePK({
          rowId: insertObj[ag.column_name],
          insertObj,
          ag,
          ai,
        });

        response = await ((await canUseOptimisedQuery(this.context, {
          source,
          disableOptimization,
        }))
          ? getSingleQueryReadFn(source)(this.context, {
              model: this.model,
              id: rowId,
              params: {},
              view: null,
              source,
              getHiddenColumn: true,
            })
          : this.readByPk(
              rowId,
              false,
              {},
              { ignoreView: true, getHiddenColumn: true },
            ));
      } else if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          const res = await this.execAndParse(query, null, {
            raw: true,
          });
          id = res.id ?? res[0]?.insertId ?? res;
        }

        if (ai) {
          if (this.isSqlite || this.isDatabricks) {
            // sqlite doesnt return id after insert
            id = (
              await this.execAndParse(
                this.dbDriver(this.tnPath)
                  .select(ai.column_name)
                  .max(ai.column_name, { as: 'id' }),
                null,
                { first: true },
              )
            ).id;
          } else if (this.isSnowflake) {
            id = (
              await this.execAndParse(
                this.dbDriver(this.tnPath).max(ai.column_name, {
                  as: 'id',
                }),
                null,
                { first: true },
              )
            ).id;
          }
          response = await this.readByPk(
            this.extractCompositePK({ rowId: id, insertObj, ai, ag }),
            false,
            {},
            { ignoreView: true, getHiddenColumn: true },
          );
        } else {
          response = data;
        }
      } else if (ai) {
        const id = Array.isArray(response)
          ? response?.[0]?.[ai.id]
          : response?.[ai.id];

        const rowId = this.extractCompositePK({ rowId: id, insertObj, ai, ag });

        response = (await canUseOptimisedQuery(this.context, {
          source,
          disableOptimization,
        }))
          ? await getSingleQueryReadFn(source)(this.context, {
              model: this.model,
              id: rowId,
              view: null,
              params: {},
              source,
              getHiddenColumn: true,
            })
          : await this.readByPk(
              rowId,
              false,
              {},
              { ignoreView: true, getHiddenColumn: true },
            );
      }

      await this.afterInsert({
        data: response,
        trx,
        req: cookie,
        insertData: data,
      });

      await this.statsUpdate({
        count: 1,
      });

      return Array.isArray(response) ? response[0] : response;
    } catch (e) {
      await this.errorInsert(e, data, trx, cookie);
      throw e;
    }
  }

  public async readRecord(param: {
    idOrRecord: string | Record<string, any>;
    fieldsSet?: Set<string>;
    ignoreView?: boolean;
    getHiddenColumn?: boolean;
    validateFormula?: boolean;
    source: Source;
    disableOptimization?: boolean;
    view?: View;
  }): Promise<any> {
    return (await canUseOptimisedQuery(this.context, {
      source: param.source,
      disableOptimization: param.disableOptimization,
    }))
      ? await getSingleQueryReadFn(param.source)(this.context, {
          model: this.model,
          id:
            // todo: update read method to accept both string and object
            typeof param.idOrRecord === 'object'
              ? this.model.primaryKeys
                  .map((c) => {
                    const idVal =
                      param.idOrRecord?.[c.title] ??
                      param.idOrRecord?.[c.column_name];

                    if (this.model.primaryKeys.length > 1) {
                      return idVal?.toString?.().replaceAll('_', '\\_') ?? null;
                    }
                    return idVal;
                  })
                  .join('___')
              : param.idOrRecord,
          view: param.view,
          params: {},
          source: param.source,
          getHiddenColumn: true,
        })
      : super.readRecord(param);
  }

  async updateByPk(id, data, trx?, cookie?, disableOptimization = false) {
    try {
      const columns = await this.model.getColumns(this.context);

      const updateObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );

      await this.validate(data, columns);

      await this.beforeUpdate(data, trx, cookie);

      const btForeignKeyColumn = columns.find(
        (c) =>
          c.uidt === UITypes.ForeignKey && data[c.column_name] !== undefined,
      );

      const btColumn = btForeignKeyColumn
        ? columns.find(
            (c) =>
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions?.fk_child_column_id === btForeignKeyColumn.id,
          )
        : null;

      const source = await this.getSource();
      const prevData = (await canUseOptimisedQuery(this.context, {
        source,
        disableOptimization,
      }))
        ? await getSingleQueryReadFn(source)(this.context, {
            model: this.model,
            id,
            view: null,
            params: {},
            source,
            getHiddenColumn: true,
          })
        : await this.readByPk(
            id,
            false,
            {},
            { ignoreView: true, getHiddenColumn: true },
          );

      if (!prevData) {
        NcError.recordNotFound(id);
      }

      await this.prepareNocoData(updateObj, false, cookie, prevData);

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id, true));

      await this.execAndParse(query, null, { raw: true });

      const newId = this.extractPksValues({ ...prevData, ...updateObj }, true);

      const newData = (await canUseOptimisedQuery(this.context, {
        source,
        disableOptimization,
      }))
        ? await getSingleQueryReadFn(source)(this.context, {
            model: this.model,
            id: newId,
            view: null,
            params: {},
            source,
            getHiddenColumn: true,
          })
        : await this.readByPk(
            newId,
            false,
            {},
            { ignoreView: true, getHiddenColumn: true },
          );
      if (btColumn && Object.keys(data || {}).length === 1) {
        await this.addChild({
          colId: btColumn.id,
          rowId: newId,
          childId: updateObj[btForeignKeyColumn.title],
          cookie,
          onlyUpdateAuditLogs: true,
          prevData,
        });
      } else {
        await this.afterUpdate(prevData, newData, trx, cookie, updateObj);
      }
      return newData;
    } catch (e) {
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  public async getHighestOrderInTable(): Promise<BigNumber> {
    const orderColumn = this.model.columns.find(
      (c) => c.uidt === UITypes.Order,
    );

    if (!orderColumn) {
      return null;
    }

    const orderQuery = this.dbDriver(this.tnPath)
      .max(`${orderColumn.column_name} as max_order`)
      .first();

    let res;

    if ((this.dbDriver as any).isExternal) {
      res = await runExternal(
        this.sanitizeQuery(orderQuery.toQuery()),
        (this.dbDriver as any).extDb,
      );
    } else {
      res = await orderQuery;
    }

    const order = new BigNumber(res ? res['max_order'] || 0 : 0);

    return order.plus(ORDER_STEP_INCREMENT);
  }

  async getUniqueOrdersBeforeItem(before: unknown, amount = 1, depth = 0) {
    try {
      if (depth > MAX_RECURSION_DEPTH) {
        NcError.reorderFailed();
      }

      const orderColumn = this.model.columns.find((c) => isOrderCol(c));
      if (!orderColumn) {
        return;
      }

      if (!before) {
        const highestOrder = await this.getHighestOrderInTable();

        return Array.from({ length: amount }).map((_, i) => {
          return highestOrder?.plus(i + 1);
        });
      }

      const row = await this.readByPk(
        before,
        false,
        {},
        { extractOrderColumn: true },
      );

      if (!row) {
        return await this.getUniqueOrdersBeforeItem(null, amount, depth);
      }

      const currentRowOrder = new BigNumber(row[orderColumn.title] ?? 0);

      const resultQuery = this.dbDriver(this.tnPath)
        .where(orderColumn.column_name, '<', currentRowOrder.toString())
        .max(orderColumn.column_name + ' as maxOrder')
        .first();

      let result;

      if ((this.dbDriver as any).isExternal) {
        result = await runExternal(
          this.sanitizeQuery(resultQuery.toQuery()),
          (this.dbDriver as any).extDb,
        );
      } else {
        result = await resultQuery;
      }

      const adjacentOrder = new BigNumber(result.maxOrder || 0);

      const orders = [];

      for (let i = 0; i < amount; i++) {
        const intermediateOrder = this.findIntermediateOrder(
          adjacentOrder.plus(i),
          currentRowOrder,
        );

        if (
          intermediateOrder.eq(adjacentOrder) ||
          intermediateOrder.eq(currentRowOrder)
        ) {
          throw NcError.cannotCalculateIntermediateOrderError();
        }

        orders.push(intermediateOrder);
      }

      return orders;
    } catch (error) {
      if (error.error === NcErrorType.CANNOT_CALCULATE_INTERMEDIATE_ORDER) {
        console.error('Error in getUniqueOrdersBeforeItem:', error);
        await this.recalculateFullOrder();
        return await this.getUniqueOrdersBeforeItem(before, amount, depth + 1);
      }
      throw error;
    }
  }

  async recalculateFullOrder() {
    const primaryKeys = this.model.primaryKeys.map((pk) => pk.column_name);
    const sql = {
      mysql2: {
        modern: `UPDATE ?? SET ?? = ROW_NUMBER() OVER (ORDER BY ?? ASC)`, // 8.0+
        legacy: {
          // 5.x and below
          init: 'SET @row_number = 0;',
          update:
            'UPDATE ?? SET ?? = (@row_number:=@row_number+1) ORDER BY ?? ASC',
        },
      },
      pg: `UPDATE ?? t SET ?? = s.rn FROM (SELECT ??, ${primaryKeys
        .map((_pk) => `??`)
        .join(
          ', ',
        )}, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s WHERE ${this.model.primaryKeys
        .map((_pk) => `t.?? = s.??`)
        .join(' AND ')}`,
      sqlite3: `WITH rn AS (SELECT ${this.model.primaryKeys
        .map((_pk) => `??`)
        .join(
          ', ',
        )}, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) UPDATE ?? SET ?? = (SELECT rn FROM rn WHERE ${this.model.primaryKeys
        .map((_pk) => `rn.?? = ??.??`)
        .join(' AND ')})`,
    };

    const orderColumn = this.model.columns.find((c) => isOrderCol(c));
    if (!orderColumn) {
      NcError.badRequest('Order column not found to recalculateOrder');
    }

    const client = this.dbDriver.client.config.client;
    if (!sql[client]) {
      NcError.notImplemented(
        'Recalculate order not implemented for this database',
      );
    }

    const params = {
      mysql2: [this.tnPath, orderColumn.column_name, orderColumn.column_name],
      pg: [
        this.tnPath,
        orderColumn.column_name,
        orderColumn.column_name,
        ...primaryKeys,
        orderColumn.column_name,
        this.tnPath,
        ...primaryKeys.flatMap((pk) => [pk, pk]), // Flatten pk array for binding
      ],
      sqlite3: [
        ...primaryKeys,
        orderColumn.column_name,
        this.tnPath,
        this.tnPath,
        orderColumn.column_name,
        ...primaryKeys.flatMap((pk) => [pk, this.tnPath, pk]), // Flatten pk array for binding
      ],
    };

    const executeQuery = async (query, parameters = []) => {
      let response;
      const formattedQuery = this.dbDriver.raw(query, parameters).toQuery();

      if ((this.dbDriver as any).isExternal) {
        response = await runExternal(
          this.sanitizeQuery(formattedQuery),
          (this.dbDriver as any).extDb,
        );
      } else {
        response = await this.execAndGetRows(formattedQuery);
      }
      return response;
    };

    if (client === 'mysql2') {
      const version = await executeQuery('SELECT VERSION()');
      const isMySql8Plus = parseFloat(version[0]?.[0]?.['VERSION()']) >= 8.0;

      if (isMySql8Plus) {
        await executeQuery(sql[client].modern, params[client]);
      } else {
        await executeQuery(sql[client].legacy.init);
        await executeQuery(sql[client].legacy.update, params[client]);
      }
    } else {
      await executeQuery(sql[client], params[client]);
    }
  }

  async moveRecord({
    rowId,
    beforeRowId,
  }: {
    rowId: string;
    beforeRowId: string;
    cookie?: { user?: any };
  }) {
    const columns = await this.model.getColumns(this.context);

    const row = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    if (!row) {
      NcError.recordNotFound(rowId);
    }

    const newRecordOrder = (
      await this.getUniqueOrdersBeforeItem(beforeRowId, 1)
    )[0];

    const query = this.dbDriver(this.tnPath)
      .update({
        [columns.find((c) => c.uidt === UITypes.Order).column_name]:
          newRecordOrder.toString(),
      })
      .where(await this._wherePk(rowId, true))
      .toQuery();

    let response;

    if ((this.dbDriver as any).isExternal) {
      response = await runExternal(
        this.sanitizeQuery(query),
        (this.dbDriver as any).extDb,
      );
    } else {
      response = await this.dbDriver.raw(query);
    }

    return response;
  }

  async prepareNocoData(
    data,
    isInsertData = false,
    cookie?: { user?: any },
    oldData?,
    extra?: {
      ncOrder?: BigNumber;
      before?: string;
      undo?: boolean;
      raw?: boolean;
    },
  ) {
    if (this.isDatabricks) {
      for (const column of this.model.columns) {
        if (column.unique && data[column.column_name]) {
          const query = this.dbDriver(this.tnPath)
            .select(1)
            .where(column.column_name, data[column.column_name])
            .limit(1);
          const res = await this.execAndParse(query, null, { first: true });
          if (res) {
            NcError.badRequest(
              `Duplicate entry for '${
                data[column.column_name]
              }' in the field '${
                column.title
              }', violating the unique constraint.`,
            );
          }
        }
      }
    }

    await super.prepareNocoData(data, isInsertData, cookie, oldData, extra);

    // AI column isStale handling
    const aiColumns = this.model.columns.filter((c) => isAIPromptCol(c));

    for (const aiColumn of aiColumns) {
      if (
        !oldData ||
        !oldData[aiColumn.title] ||
        oldData[aiColumn.title]?.isStale === true
      ) {
        continue;
      }

      const oldAiData = data[aiColumn.column_name]
        ? JSON.parse(data[aiColumn.column_name])
        : oldData[aiColumn.title];

      const referencedColumnIds = aiColumn.colOptions.prompt
        ?.match(/{(.*?)}/g)
        ?.map((id) => id.replace(/{|}/g, ''));

      if (!referencedColumnIds) continue;

      const referencedColumns = referencedColumnIds.map(
        (id) => this.model.columnsById[id],
      );

      if (referencedColumns.some((c) => c.column_name in data)) {
        data[aiColumn.column_name] = JSON.stringify({
          ...oldAiData,
          isStale: true,
        });
      }
    }
  }

  public async beforeInsert(
    data: any,
    _trx: any,
    req,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    const { allowSystemColumn = false } = params || {};

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    let workspaceRowCount = workspaceStats ? workspaceStats.row_count : null;

    // initial case
    if (workspaceRowCount === null) {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_STAT, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        force: true,
      });

      workspaceRowCount = 0;
    }

    await checkLimit({
      workspaceId: this.model.fk_workspace_id,
      type: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      count: workspaceRowCount,
      message: ({ limit }) =>
        `Only ${limit} records are allowed in your workspace, for more please upgrade your plan`,
    });

    if (!allowSystemColumn && this.model.synced) {
      NcError.badRequest('Cannot insert into synced table');
    }

    await this.handleHooks('before.insert', null, data, req);
  }

  public async beforeBulkInsert(
    data: any,
    _trx: any,
    req,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    const { allowSystemColumn = false } = params || {};

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    let workspaceRowCount = workspaceStats ? workspaceStats.row_count : null;

    // initial case
    if (workspaceRowCount === null) {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_STAT, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        force: true,
      });

      workspaceRowCount = 0;
    }

    await checkLimit({
      workspaceId: this.model.fk_workspace_id,
      type: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      count: workspaceRowCount,
      message: ({ limit }) =>
        `Only ${limit} records are allowed in your workspace, for more please upgrade your plan`,
    });

    if (!allowSystemColumn && this.model.synced) {
      NcError.badRequest('Cannot insert into synced table');
    }

    await this.handleHooks('before.bulkInsert', null, data, req);
  }

  public async afterInsert({
    data,
    insertData,
    trx: _trx,
    req,
  }: {
    data: any;
    insertData: any;
    trx: any;
    req: NcRequest;
  }): Promise<void> {
    await this.handleHooks('after.insert', null, data, req);
    const id = this.extractPksValues(data);
    const filteredAuditData = removeBlankPropsAndMask(insertData || data, [
      'CreatedAt',
      'UpdatedAt',
      // exclude virtual columns
      ...this.model.columns
        .filter((c) => isVirtualCol(c) || isSystemColumn(c))
        .map((c) => c.title),
    ]);
    if (await this.isDataAuditEnabled())
      await RecordAudit.insert(
        await generateAuditV1Payload<DataInsertPayload>(
          AuditV1OperationTypes.DATA_INSERT,
          {
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(id, true),
            },
            details: {
              data: formatDataForAudit(filteredAuditData, this.model.columns),
              column_meta: extractColsMetaForAudit(
                this.model.columns,
                filteredAuditData,
              ),
            },
            req,
          },
        ),
      );

    await this.handleRichTextMentions(null, data, req);
  }

  public async afterBulkInsert(data: any[], _trx: any, req): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);
    if (await this.isDataAuditEnabled()) {
      let parentAuditId;
      if (!req.ncParentAuditId) {
        parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

        await RecordAudit.insert(
          await generateAuditV1Payload<DataBulkDeletePayload>(
            AuditV1OperationTypes.DATA_BULK_INSERT,
            {
              details: {},
              context: {
                ...this.context,
                source_id: this.model.source_id,
                fk_model_id: this.model.id,
              },
              req,
              id: parentAuditId,
            },
          ),
        );

        req.ncParentAuditId = parentAuditId;
      }
      // data here is not mapped to column alias
      await RecordAudit.insert(
        await Promise.all(
          data.map((d) => {
            const data = remapWithAlias({
              data: d,
              columns: this.model.columns,
            });

            return generateAuditV1Payload<DataInsertPayload>(
              AuditV1OperationTypes.DATA_INSERT,
              {
                context: {
                  ...this.context,
                  source_id: this.model.source_id,
                  fk_model_id: this.model.id,
                  row_id: this.extractPksValues(data, true),
                },
                details: {
                  data: formatDataForAudit(
                    removeBlankPropsAndMask(data, [
                      'created_at',
                      'updated_at',
                      'created_by',
                      'updated_by',
                    ]),
                    this.model.columns,
                  ),
                  column_meta: extractColsMetaForAudit(
                    this.model.columns,
                    data,
                  ),
                },
                req,
              },
            );
          }),
        ),
      );
    }

    await this.handleRichTextMentions(null, data, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    const id = this.extractPksValues(data);
    if (await this.isDataAuditEnabled()) {
      await RecordAudit.insert(
        await generateAuditV1Payload<DataDeletePayload>(
          AuditV1OperationTypes.DATA_DELETE,
          {
            details: {
              data: formatDataForAudit(
                removeBlankPropsAndMask(data, ['CreatedAt', 'UpdatedAt']),
                this.model.columns,
              ),
              column_meta: extractColsMetaForAudit(this.model.columns, data),
            },
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(id, true),
            },
            req,
          },
        ),
      );
    }

    await this.handleHooks('after.delete', null, data, req);
  }

  public async afterBulkDelete(
    data: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    if (!isBulkAllOperation) {
      await this.handleHooks('after.bulkDelete', null, data, req);
    }

    if (await this.isDataAuditEnabled()) {
      const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      await RecordAudit.insert(
        await generateAuditV1Payload<DataBulkDeletePayload>(
          AuditV1OperationTypes.DATA_BULK_DELETE,
          {
            details: {},
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
            },
            req,
            id: parentAuditId,
          },
        ),
      );
      req.ncParentAuditId = parentAuditId;

      const column_meta = extractColsMetaForAudit(this.model.columns);
      await RecordAudit.insert(
        await Promise.all(
          data?.map?.((d) =>
            generateAuditV1Payload<DataDeletePayload>(
              AuditV1OperationTypes.DATA_DELETE,
              {
                details: {
                  data: d
                    ? formatDataForAudit(
                        removeBlankPropsAndMask(d, ['CreatedAt', 'UpdatedAt']),
                        this.model.columns,
                      )
                    : null,
                  column_meta,
                },
                context: {
                  ...this.context,
                  source_id: this.model.source_id,
                  fk_model_id: this.model.id,
                  row_id: this.extractPksValues(d, true),
                },
                req,
              },
            ),
          ),
        ),
      );
    }
  }

  async delByPk(id, _trx?, cookie?) {
    const queries: string[] = [];
    try {
      // retrieve data for handling params in hook
      const data = await this.readByPk(
        id,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );
      await this.beforeDelete(id, null, cookie);

      const execQueries: ((trx: CustomKnex) => Knex.QueryBuilder)[] = [];

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        const { mmContext, refContext } = colOptions.getRelContext(
          this.context,
        );

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(
                this.context,
                colOptions.fk_mm_model_id,
              );

              const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
                model: mmTable,
                dbDriver: this.dbDriver,
              });

              const mmParentColumn = await Column.get(mmContext, {
                colId: colOptions.fk_mm_child_column_id,
              });

              execQueries.push((trx) =>
                trx(mmBaseModel.getTnPath(mmTable.table_name))
                  .del()
                  .where(mmParentColumn.column_name, id),
              );
            }
            break;
          case 'hm':
            {
              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(refContext);

              if (relatedTable.mm) {
                break;
              }

              const refBaseModel = await Model.getBaseModelSQL(refContext, {
                model: relatedTable,
                dbDriver: this.dbDriver,
              });

              const childColumn = await Column.get(refContext, {
                colId: colOptions.fk_child_column_id,
              });

              execQueries.push((trx) =>
                trx(refBaseModel.getTnPath(relatedTable.table_name))
                  .update({
                    [childColumn.column_name]: null,
                  })
                  .where(childColumn.column_name, id),
              );
            }
            break;
          case 'bt':
            {
              // nothing to do
            }
            break;
        }
      }
      const where = await this._wherePk(id);

      for (const q of execQueries) {
        queries.push(q(this.dbDriver).toQuery());
      }

      queries.push(this.dbDriver(this.tnPath).del().where(where).toQuery());

      let responses;

      if ((this.dbDriver as any).isExternal) {
        responses = await runExternal(
          this.sanitizeQuery(queries),
          (this.dbDriver as any).extDb,
        );
        responses = Array.isArray(responses) ? responses : [responses];
      } else {
        const trx = await this.dbDriver.transaction();

        try {
          responses = [];
          for (const q of queries) {
            responses.push(await trx.raw(this.sanitizeQuery(q)));
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      await this.clearFileReferences({
        oldData: [data],
        columns: this.model.columns,
      });

      await this.afterDelete(data, null, cookie);

      await this.statsUpdate({
        count: -1,
      });

      return responses.pop()?.rowCount;
    } catch (e) {
      await this.errorDelete(e, id, null, cookie);
      throw e;
    }
  }

  async bulkInsert(
    datas: any[],
    {
      chunkSize: _chunkSize = 100,
      cookie,
      foreign_key_checks = true,
      skip_hooks = false,
      raw = false,
      insertOneByOneAsFallback = false,
      isSingleRecordInsertion = false,
      typecast = false,
      allowSystemColumn = false,
      undo = false,
      apiVersion = NcApiVersion.V2,
    }: {
      chunkSize?: number;
      cookie?: any;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
      typecast?: boolean;
      allowSystemColumn?: boolean;
      apiVersion?: NcApiVersion;
      undo?: boolean;
    } = {},
  ) {
    const queries: string[] = [];

    try {
      // TODO: ag column handling for raw bulk insert
      const insertDatas = raw ? datas : [];
      const postInsertOpsMap: Record<
        number,
        ((rowId: any) => Promise<string>)[]
      > = {};
      let preInsertOps: (() => Promise<string>)[] = [];
      let aiPkCol: Column;
      let agPkCol: Column;

      if (!raw) {
        const nestedCols = (await this.model.getColumns(this.context)).filter(
          (c) => isLinksOrLTAR(c),
        );

        await this.model.getColumns(this.context);

        const order = await this.getHighestOrderInTable();

        for (const [index, d] of datas.entries()) {
          const insertObj = {};

          // populate pk, map alias to column, validate data
          for (let i = 0; i < this.model.columns.length; ++i) {
            const col = this.model.columns[i];

            if (col.title in d || col.id in d) {
              if (
                isCreatedOrLastModifiedTimeCol(col) ||
                isCreatedOrLastModifiedByCol(col)
              ) {
                NcError.badRequest(
                  `Column "${col.title}" is auto generated and cannot be updated`,
                );
              }

              if (isVirtualCol(col) && !isLinksOrLTAR(col)) {
                NcError.badRequest(
                  `Column "${col.title}" is virtual and cannot be updated`,
                );
              }

              if (
                col.system &&
                !allowSystemColumn &&
                UITypes.ForeignKey === col.uidt
              ) {
                NcError.badRequest(
                  `Column "${col.title}" is system column and cannot be updated`,
                );
              }

              if (!allowSystemColumn && col.readonly) {
                NcError.badRequest(
                  `Column "${col.title}" is readonly column and cannot be updated`,
                );
              }

              if (
                col.system &&
                !allowSystemColumn &&
                col.uidt !== UITypes.Order &&
                !undo
              ) {
                NcError.badRequest(
                  `Column "${col.title}" is system column and cannot be updated`,
                );
              }
            }

            // populate pk columns
            if (col.pk) {
              if (col.meta?.ag && !(d[col.title] ?? d[col.id])) {
                if (d[col.id]) {
                  d[col.title] = d[col.id];
                } else {
                  d[col.title] =
                    col.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
                }
              }
            }

            // map alias to column
            if (!isVirtualCol(col)) {
              let val = !ncIsUndefined(d?.[col.column_name])
                ? d?.[col.column_name]
                : !ncIsUndefined(d?.[col.title])
                ? d?.[col.title]
                : d?.[col.id];

              if (val !== undefined) {
                if (
                  col.uidt === UITypes.Attachment &&
                  typeof val !== 'string'
                ) {
                  val = JSON.stringify(val);
                }
                if (
                  this.context.api_version !== NcApiVersion.V3 &&
                  col.uidt === UITypes.DateTime &&
                  dayjs(val).isValid()
                ) {
                  const { isMySQL, isSqlite, isMssql, isPg } = this.clientMeta;
                  if (
                    val.indexOf('-') < 0 &&
                    val.indexOf('+') < 0 &&
                    val.slice(-1) !== 'Z'
                  ) {
                    // if no timezone is given,
                    // then append +00:00 to make it as UTC
                    val += '+00:00';
                  }
                  if (isMySQL) {
                    // first convert the value to utc
                    // from UI
                    // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
                    // from API
                    // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
                    // if timezone info is not found - considered as utc
                    // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
                    // if timezone info is found
                    // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
                    // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
                    // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
                    // then we use CONVERT_TZ to convert that in the db timezone
                    val = this.dbDriver.raw(
                      `CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss')],
                    );
                  } else if (isSqlite) {
                    // convert to UTC
                    // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
                    val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
                  } else if (isPg) {
                    // convert to UTC
                    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
                    // then convert to db timezone
                    val = this.dbDriver.raw(
                      `? AT TIME ZONE CURRENT_SETTING('timezone')`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
                    );
                  } else if (isMssql) {
                    // convert ot UTC
                    // e.g. 2023-05-10T08:49:32.000Z -> 2023-05-10 08:49:32-08:00
                    // then convert to db timezone
                    val = this.dbDriver.raw(
                      `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
                    );
                  } else {
                    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
                    val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
                  }
                }
                if (
                  this.context.api_version !== NcApiVersion.V3 &&
                  this.isPg &&
                  col.uidt === UITypes.Checkbox
                ) {
                  val = val ? true : false;
                }

                if (
                  this.context.api_version !== NcApiVersion.V3 &&
                  col.uidt === UITypes.Duration
                ) {
                  if (col.meta?.duration !== undefined) {
                    const duration = convertDurationToSeconds(
                      val,
                      col.meta.duration,
                    );
                    if (duration._isValid) {
                      val = duration._sec;
                    }
                  }
                }
                insertObj[sanitize(col.column_name)] = val;
              }
            }
            try {
              await this.validateOptions(col, insertObj);
            } catch (ex) {
              if (ex instanceof OptionsNotExistsError && typecast) {
                await Column.update(this.context, col.id, {
                  ...col,
                  colOptions: {
                    options: [
                      ...col.colOptions.options,
                      ...ex.options.map((k, index) => ({
                        fk_column_id: col.id,
                        title: k,
                        color: enumColors.get(
                          'light',
                          (col.colOptions.options ?? []).length + index,
                        ),
                      })),
                    ],
                  },
                });
              } else {
                throw ex;
              }
            }

            // validate data
            if (col?.meta?.validate && col?.validate) {
              const validate = col.getValidators();
              const cn = col.column_name;
              const columnTitle = col.title;
              if (validate) {
                await validateFuncOnColumn({
                  value:
                    insertObj?.[cn] ??
                    insertObj?.[columnTitle] ??
                    insertObj?.[col.id],
                  column: col,
                  apiVersion: this.context.api_version,
                  customValidators: customValidators as any,
                });
              }
            }
          }

          await this.prepareNocoData(insertObj, true, cookie, null, {
            ncOrder: order?.plus(index),
            undo: undo,
          });

          // prepare nested link data for insert only if it is single record insertion
          if (isSingleRecordInsertion || apiVersion === NcApiVersion.V3) {
            const operations = await this.prepareNestedLinkQb({
              nestedCols,
              data: d,
              req: cookie,
              insertObj,
            });

            postInsertOpsMap[index] = operations.postInsertOps;
            preInsertOps = operations.preInsertOps;
          }

          insertDatas.push(insertObj);
        }

        // used for post insert operations
        aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);
        agPkCol = this.model.primaryKeys.find((pk) => pk.meta?.ag);
      } else {
        await this.model.getColumns(this.context);

        const order = await this.getHighestOrderInTable();

        await Promise.all(
          insertDatas.map(
            async (d, i) =>
              await this.prepareNocoData(d, true, cookie, null, {
                raw,
                ncOrder: order?.plus(i),
                undo: undo,
              }),
          ),
        );
      }

      if ('beforeBulkInsert' in this) {
        await this.beforeBulkInsert(insertDatas, null, cookie, {
          allowSystemColumn,
        });
      }

      await this.runOps(preInsertOps.map((f) => f()));

      // await this.beforeInsertb(insertDatas, null);

      // fallbacks to `10` if database client is sqlite
      // to avoid `too many SQL variables` error
      // refer : https://www.sqlite.org/limits.html
      const chunkSize = this.isSqlite ? 10 : _chunkSize;

      let trimLeading = 0;
      let trimTrailing = 0;

      if (!foreign_key_checks) {
        if (this.isPg) {
          queries.push(
            this.dbDriver
              .raw('set session_replication_role to replica;')
              .toQuery(),
          );
          trimLeading++;
        } else if (this.isMySQL) {
          queries.push(
            this.dbDriver.raw('SET foreign_key_checks = 0;').toQuery(),
          );
          trimLeading++;
        }
      }

      // insert one by one as fallback to get ids for sqlite and mysql
      if (insertOneByOneAsFallback && (this.isSqlite || this.isMySQL)) {
        // sqlite and mysql doesnt support returning, so insert one by one and return ids
        // response = [];

        // const aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);

        for (const insertData of insertDatas) {
          queries.push(this.dbDriver(this.tnPath).insert(insertData).toQuery());
        }
      } else {
        const batches = [];

        const returningObj: Record<string, string> = {};

        for (const col of this.model.primaryKeys) {
          returningObj[col.title] = col.column_name;
        }

        for (let i = 0; i < insertDatas.length; i += chunkSize) {
          batches.push(insertDatas.slice(i, i + chunkSize));
        }

        for (const batch of batches) {
          if (this.isPg || this.isMssql) {
            queries.push(
              this.dbDriver(this.tnPath)
                .insert(batch)
                .returning(
                  this.model.primaryKeys?.length ? (returningObj as any) : '*',
                )
                .toQuery(),
            );
          } else {
            queries.push(this.dbDriver(this.tnPath).insert(batch).toQuery());
          }
        }
      }

      if (!foreign_key_checks) {
        if (this.isPg) {
          queries.push(
            this.dbDriver
              .raw('set session_replication_role to origin;')
              .toQuery(),
          );
          trimTrailing++;
        } else if (this.isMySQL) {
          queries.push(
            this.dbDriver.raw('SET foreign_key_checks = 1;').toQuery(),
          );
          trimTrailing++;
        }
      }

      let responses;

      const postSingleRecordInsertionCbk = async (responses, trx?) => {
        // insert nested link data for single record insertion
        if (isSingleRecordInsertion || apiVersion === NcApiVersion.V3) {
          for (let i = 0; i < responses.length; i++) {
            const row = responses[i];
            let rowId;
            if (this.isSqlite || this.isMySQL) {
              if (this.isMySQL && this.isSqlite) {
                rowId = row;
              }

              if (agPkCol) {
                // ??? insertDatas should be an array
                rowId = insertDatas[agPkCol.column_name];
              }
            } else {
              rowId = row[this.model.primaryKey?.title];
            }

            if (aiPkCol || agPkCol) {
              rowId = this.extractCompositePK({
                rowId,
                ai: aiPkCol,
                ag: agPkCol,
                insertObj: insertDatas[i],
              });
            }

            await this.runOps(
              postInsertOpsMap[i].map((f) => f(rowId)),
              trx,
            );
          }
        }
      };

      if ((this.dbDriver as any).isExternal) {
        responses = await runExternal(
          this.sanitizeQuery(queries),
          (this.dbDriver as any).extDb,
        );
        responses = Array.isArray(responses) ? responses : [responses];
        if (!raw) await postSingleRecordInsertionCbk(responses);
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          responses = [];
          for (const q of queries) {
            responses.push(...(await this.execAndGetRows(q, trx)));
          }
          if (!raw) await postSingleRecordInsertionCbk(responses, trx);
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      // we have extra queries other than insert if foreign_key_checks is false to disable foreign key checks
      // we need to trim the leading and trailing extra queries
      if (trimLeading) {
        responses = responses.slice(trimLeading);
      }
      if (trimTrailing) {
        responses = responses.slice(0, -trimTrailing);
      }

      if (!raw && !skip_hooks) {
        // we will wrap returning primary key values with primary key column name
        if (this.isMySQL) {
          responses = responses.map((r) => ({
            [this.model.primaryKey.column_name]: r,
          }));
        }

        if (isSingleRecordInsertion) {
          const insertData = await this.readByPk(responses[0]);
          await this.afterInsert({
            data: insertData,
            trx: this.dbDriver,
            req: cookie,
            insertData: datas?.[0],
          });
        } else {
          await this.afterBulkInsert(
            insertDatas.map((r, i) => {
              return { ...(r || {}), ...(responses?.[i] || {}) };
            }),
            this.dbDriver,
            cookie,
          );
        }
      }

      await this.statsUpdate({
        count: insertDatas.length,
      });

      return responses;
    } catch (e) {
      // await this.errorInsertb(e, data, null);
      throw e;
    }
  }

  async bulkUpsert(
    datas: any[],
    {
      _chunkSize = 100,
      cookie,
      raw = false,
      foreign_key_checks = true,
      insertOneByOneAsFallback = false,
      undo = false,
    }: {
      _chunkSize?: number;
      cookie?: any;
      raw?: boolean;
      foreign_key_checks?: boolean;
      insertOneByOneAsFallback?: boolean;
      undo?: boolean;
    } = {},
  ) {
    const insertQueries: string[] = [];
    const updateQueries: string[] = [];

    try {
      const columns = await this.model.getColumns(this.context);

      let order = await this.getHighestOrderInTable();

      // validate and prepare data
      const preparedDatas = raw
        ? datas
        : await Promise.all(
            datas.map(async (d) => {
              await this.validate(d, columns);
              return this.model.mapAliasToColumn(
                this.context,
                d,
                this.clientMeta,
                this.dbDriver,
                columns,
              );
            }),
          );

      const dataWithPks = [];
      const dataWithoutPks = [];

      const updatePkValues = [];

      for (const data of preparedDatas) {
        const pkValues = this.extractPksValues(data, true);
        if (pkValues !== 'N/A' && pkValues !== undefined) {
          dataWithPks.push({ pk: pkValues, data });
        } else {
          // const insertObj = this.handleValidateBulkInsert(data, columns);
          await this.prepareNocoData(data, true, cookie, null, {
            ncOrder: order,
            undo,
          });
          order = order?.plus(1);
          dataWithoutPks.push(data);
        }
      }
      // Check which records with PKs exist in the database

      const existingRecords = await this.chunkList({
        pks: dataWithPks.map((v) => v.pk),
      });

      const existingPkSet = new Set(
        existingRecords.map((r) => this.extractPksValues(r, true)),
      );

      const toInsert = [...dataWithoutPks];
      const toUpdate = [];

      for (const { pk, data } of dataWithPks) {
        if (existingPkSet.has(pk)) {
          await this.prepareNocoData(data, false, cookie);
          toUpdate.push(data);

          updatePkValues.push(
            getCompositePkValue(this.model.primaryKeys, {
              ...data,
            }),
          );
        } else {
          await this.prepareNocoData(data, true, cookie, null, {
            ncOrder: order,
            undo,
          });
          order = order?.plus(1);
          // const insertObj = this.handleValidateBulkInsert(data, columns);
          toInsert.push(data);
        }
      }

      const chunkSize = this.isSqlite ? 10 : 100;
      let trimLeading = 0;
      let trimTrailing = 0;
      if (toInsert.length > 0) {
        if (!foreign_key_checks) {
          if (this.isPg) {
            insertQueries.push(
              this.dbDriver
                .raw('set session_replication_role to replica;')
                .toQuery(),
            );
            trimLeading++;
          } else if (this.isMySQL) {
            insertQueries.push(
              this.dbDriver.raw('SET foreign_key_checks = 0;').toQuery(),
            );
            trimLeading++;
          }
        }

        if (insertOneByOneAsFallback && (this.isSqlite || this.isMySQL)) {
          for (const insertData of toInsert) {
            insertQueries.push(
              this.dbDriver(this.tnPath).insert(insertData).toQuery(),
            );
          }
        } else {
          const batches = [];

          const returningObj: Record<string, string> = {};

          for (const col of this.model.primaryKeys) {
            returningObj[col.title] = col.column_name;
          }

          for (let i = 0; i < toInsert.length; i += chunkSize) {
            batches.push(toInsert.slice(i, i + chunkSize));
          }

          for (const batch of batches) {
            if (this.isPg || this.isMssql) {
              insertQueries.push(
                this.dbDriver(this.tnPath)
                  .insert(batch)
                  .returning(
                    this.model.primaryKeys?.length
                      ? (returningObj as any)
                      : '*',
                  )
                  .toQuery(),
              );
            } else {
              insertQueries.push(
                this.dbDriver(this.tnPath).insert(batch).toQuery(),
              );
            }
          }
        }

        if (!foreign_key_checks) {
          if (this.isPg) {
            insertQueries.push(
              this.dbDriver
                .raw('set session_replication_role to origin;')
                .toQuery(),
            );
            trimTrailing++;
          } else if (this.isMySQL) {
            insertQueries.push(
              this.dbDriver.raw('SET foreign_key_checks = 1;').toQuery(),
            );
            trimTrailing++;
          }
        }
      }

      if (toUpdate.length > 0) {
        for (const d of toUpdate) {
          const pkValues = getCompositePkValue(
            this.model.primaryKeys,
            this.extractPksValues(d),
          );

          const wherePk = await this._wherePk(pkValues, true);

          // remove pk from update data for databricks
          if (this.isDatabricks) {
            const dWithoutPk = {};

            for (const k in d) {
              if (!(k in wherePk)) {
                dWithoutPk[k] = d[k];
              }
            }

            updateQueries.push(
              this.dbDriver(this.tnPath)
                .update(dWithoutPk)
                .where(wherePk)
                .toQuery(),
            );
          } else {
            updateQueries.push(
              this.dbDriver(this.tnPath).update(d).where(wherePk).toQuery(),
            );
          }
        }
      }

      let updateResponses = [];
      let insertResponses = [];

      if ((this.dbDriver as any).isExternal) {
        insertResponses = await runExternal(
          this.sanitizeQuery(insertQueries),
          (this.dbDriver as any).extDb,
        );

        await runExternal(
          this.sanitizeQuery(updateQueries),
          (this.dbDriver as any).extDb,
        );
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of insertQueries) {
            insertResponses.push(...(await this.execAndGetRows(q, trx)));
          }
          for (const q of updateQueries) {
            await trx.raw(this.sanitizeQuery(q));
          }

          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      if (trimLeading) {
        insertResponses = insertResponses.slice(trimLeading);
      }
      if (trimTrailing) {
        insertResponses = insertResponses.slice(0, -trimTrailing);
      }

      if (!raw) {
        // Insertion
        if (this.isMySQL) {
          insertResponses = insertResponses.map((r) => ({
            [this.model.primaryKey.column_name]: r,
          }));
        }

        insertResponses = await this.chunkList({
          pks: insertResponses.map((d) => this.extractPksValues(d)),
        });

        if (insertResponses.length === 1) {
          const insertData = await this.readByPk(insertResponses[0]);
          await this.afterInsert({
            data: insertData,
            trx: this.dbDriver,
            req: cookie,
            insertData: datas[0],
          });
        } else {
          await this.afterBulkInsert(insertResponses, this.dbDriver, cookie);
        }

        // Updated Records
        updateResponses = await this.chunkList({
          pks: updatePkValues,
        });

        if (!raw) {
          if (updateResponses.length === 1) {
            await this.afterUpdate(
              existingRecords[0],
              updateResponses[0],
              null,
              cookie,
              toUpdate[0],
            );
          } else {
            await this.afterBulkUpdate(
              toUpdate,
              updateResponses,
              this.dbDriver,
              cookie,
            );
          }
        }
      }

      await this.statsUpdate({
        count: insertResponses.length,
      });

      return [...updateResponses, ...insertResponses];
    } catch (e) {
      throw e;
    }
  }

  async bulkUpdate(
    datas: any[],
    {
      cookie,
      raw = false,
      throwExceptionIfNotExist = false,
      isSingleRecordUpdation = false,
      allowSystemColumn = false,
      typecast = false,
      skip_hooks = false,
      apiVersion,
    }: {
      cookie?: any;
      raw?: boolean;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordUpdation?: boolean;
      allowSystemColumn?: boolean;
      typecast?: boolean;
      skip_hooks?: boolean;
      apiVersion?: NcApiVersion;
    } = {},
  ) {
    const queries: string[] = [];
    const readChunkSize = 100;

    try {
      const columns = await this.model.getColumns(this.context);

      if (!raw) {
        for (const d of datas) {
          await this.validate(d, columns, { allowSystemColumn, typecast });
        }
      }

      const updateDatas = raw
        ? datas
        : await Promise.all(
            datas.map((d) =>
              this.model.mapAliasToColumn(
                this.context,
                d,
                this.clientMeta,
                this.dbDriver,
                columns,
              ),
            ),
          );

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      const pkAndData: { pk: string; data: any }[] = [];

      for (const d of updateDatas) {
        const pkValues = this.extractPksValues(d, true);

        if (pkValues === null || pkValues === undefined) {
          if (throwExceptionIfNotExist) NcError.recordNotFound(pkValues);
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      for (let i = 0; i < pkAndData.length; i += readChunkSize) {
        const chunk = pkAndData.slice(i, i + readChunkSize);
        const pksToRead = chunk.map((v) => v.pk);

        const oldRecords = await this.list(
          { pks: pksToRead.join(',') },
          { limitOverride: chunk.length, ignoreViewFilterAndSort: true },
        );

        const oldRecordsMap = new Map<string, any>(
          oldRecords.map((r) => [this.extractPksValues(r, true), r]),
        );

        for (const { pk, data } of chunk) {
          const oldRecord = oldRecordsMap.get(pk);

          if (!oldRecord) {
            if (throwExceptionIfNotExist) NcError.recordNotFound(pk);
            continue;
          }

          await this.prepareNocoData(data, false, cookie, oldRecord);

          prevData.push(oldRecord);

          const wherePk = await this._wherePk(pk, true);

          const dataToUpdate = this.isDatabricks
            ? Object.fromEntries(
                Object.entries(data).filter(([k]) => !(k in wherePk)),
              )
            : data;

          toBeUpdated.push({ d: dataToUpdate, wherePk });

          updatePkValues.push(
            this.extractPksValues(
              {
                ...oldRecord,
                ...data,
              },
              true,
            ),
          );
        }
      }

      if (
        this.model.primaryKeys.length === 1 &&
        (this.isPg || this.isMySQL || this.isSqlite)
      ) {
        const batchQb = batchUpdate(
          this.dbDriver,
          this.tnPath,
          toBeUpdated.map((o) => o.d),
          this.model.primaryKey.column_name,
        );

        if (batchQb) {
          queries.push(
            batchUpdate(
              this.dbDriver,
              this.tnPath,
              toBeUpdated.map((o) => o.d),
              this.model.primaryKey.column_name,
            ).toQuery(),
          );
        }
      } else {
        queries.push(
          ...toBeUpdated.map((o) =>
            this.dbDriver(this.tnPath).update(o.d).where(o.wherePk).toQuery(),
          ),
        );
      }

      if ((this.dbDriver as any).isExternal) {
        await runExternal(
          this.sanitizeQuery(queries),
          (this.dbDriver as any).extDb,
        );
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of queries) {
            await trx.raw(this.sanitizeQuery(q));
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      if (apiVersion === NcApiVersion.V3) {
        for (const d of datas) {
          // remove LTAR/Links if part of the update request
          await this.updateLTARCols({
            rowId: this.extractPksValues(d, true),
            cookie,
            newData: d,
          });
        }
      }

      if (!raw) {
        for (let i = 0; i < updatePkValues.length; i += readChunkSize) {
          const pksChunk = updatePkValues.slice(i, i + readChunkSize);

          const updatedRecords = await this.list(
            { pks: pksChunk.join(',') },
            { limitOverride: pksChunk.length },
          );

          const updatedRecordsMap = new Map(
            updatedRecords.map((record) => {
              const compositePk = getCompositePkValue(
                this.model.primaryKeys,
                record,
              );
              return [
                typeof compositePk === 'string'
                  ? compositePk
                  : compositePk.toString(),
                record,
              ];
            }),
          );
          for (const pk of pksChunk) {
            if (updatedRecordsMap.has(pk)) {
              newData.push(updatedRecordsMap.get(pk));
            }
          }
        }
      }

      if (!raw && !skip_hooks) {
        if (isSingleRecordUpdation) {
          await this.afterUpdate(
            prevData[0],
            newData[0],
            null,
            cookie,
            datas[0],
          );
        } else {
          await this.afterBulkUpdate(prevData, newData, this.dbDriver, cookie);
        }
      }
      return newData;
    } catch (e) {
      throw e;
    }
  }

  public async afterAddChild({
    columnTitle,
    columnId,
    rowId,
    refRowId,
    req,
    model = this.model,
    refModel = this.model,
    displayValue,
    refDisplayValue,
    type,
  }: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model: Model;
    refModel: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void> {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) {
      return;
    }
    if (!refDisplayValue) {
      refDisplayValue = await this.readByPkFromModel(
        refModel,
        undefined,
        true,
        refRowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    if (!displayValue) {
      displayValue = await this.readByPkFromModel(
        model,
        undefined,
        true,
        rowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await RecordAudit.insert(
      await generateAuditV1Payload<DataLinkPayload>(
        AuditV1OperationTypes.DATA_LINK,
        {
          context: {
            ...this.context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: rowId,
            ref_row_id: refRowId,
            display_value: displayValue,
            ref_display_value: refDisplayValue,
            type,
          },
          req,
        },
      ),
    );
  }

  public async afterRemoveChild({
    columnTitle,
    columnId,
    rowId,
    refRowId,
    req,
    model = this.model,
    refModel = this.model,
    displayValue,
    refDisplayValue,
    type,
  }: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model: Model;
    refModel: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void> {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) {
      return;
    }

    if (!refDisplayValue) {
      refDisplayValue = await this.readByPkFromModel(
        refModel,
        undefined,
        true,
        refRowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    if (!displayValue) {
      displayValue = await this.readByPkFromModel(
        model,
        undefined,
        true,
        rowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await RecordAudit.insert(
      await generateAuditV1Payload<DataUnlinkPayload>(
        AuditV1OperationTypes.DATA_UNLINK,
        {
          context: {
            ...this.context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: rowId,
            ref_row_id: refRowId,
            display_value: displayValue,
            ref_display_value: refDisplayValue,
            type,
          },
          req,
        },
      ),
    );
  }

  async bulkDelete(
    ids: any[],
    {
      cookie,
      throwExceptionIfNotExist = false,
      isSingleRecordDeletion = false,
    }: {
      cookie?: any;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordDeletion?: boolean;
    } = {},
  ) {
    const queries: string[] = [];
    try {
      const columns = await this.model.getColumns(this.context);

      const deleteIds = await Promise.all(
        ids.map((d) =>
          this.model.mapAliasToColumn(
            this.context,
            d,
            this.clientMeta,
            this.dbDriver,
            columns,
          ),
        ),
      );

      const deleted = [];
      const res = [];
      const pkAndData: { pk: any; data: any }[] = [];
      const readChunkSize = 100;
      for (const [i, d] of deleteIds.entries()) {
        const pkValues = getCompositePkValue(
          this.model.primaryKeys,
          this.extractPksValues(d),
        );
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.recordNotFound(pkValues);
          }
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });

        if (pkAndData.length >= readChunkSize || i === deleteIds.length - 1) {
          const tempToRead = pkAndData.splice(0, pkAndData.length);
          const oldRecords = await this.list(
            {
              pks: tempToRead.map((v) => v.pk).join(','),
            },
            {
              limitOverride: tempToRead.length,
              ignoreViewFilterAndSort: true,
            },
          );

          if (oldRecords.length === tempToRead.length) {
            deleted.push(...oldRecords);
            res.push(...tempToRead.map((v) => v.data));
          } else {
            for (const { pk, data } of tempToRead) {
              const oldRecord = oldRecords.find((r) =>
                this.comparePks(this.extractPksValues(r), pk),
              );

              if (!oldRecord) {
                // throw or skip if no record found
                if (throwExceptionIfNotExist) {
                  NcError.recordNotFound(pkValues);
                }
                continue;
              }

              deleted.push(oldRecord);
              res.push(data);
            }
          }
        }
      }

      await this.beforeBulkDelete(deleted, this.dbDriver, cookie);

      const execQueries: ((
        trx: CustomKnex,
        ids: any[],
      ) => Knex.QueryBuilder)[] = [];

      const base = await this.getSource();

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        const { childContext, refContext, mmContext } =
          await colOptions.getParentChildContext(this.context);

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(
                mmContext,
                colOptions.fk_mm_model_id,
              );
              const mmParentColumn = await Column.get(mmContext, {
                colId: colOptions.fk_mm_child_column_id,
              });

              execQueries.push((trx, ids) =>
                trx(this.getTnPath(mmTable.table_name))
                  .del()
                  .whereIn(mmParentColumn.column_name, ids),
              );
            }
            break;
          case 'hm':
            {
              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(refContext);
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(childContext, {
                colId: colOptions.fk_child_column_id,
              });

              execQueries.push((trx, ids) =>
                trx(this.getTnPath(relatedTable.table_name))
                  .update({
                    [childColumn.column_name]: null,
                  })
                  .whereIn(childColumn.column_name, ids),
              );
            }
            break;
          case 'bt':
            {
              // nothing to do
            }
            break;
        }
      }

      const idsVals = res.map((d) => d[this.model.primaryKey.column_name]);

      if (base.isMeta() && execQueries.length > 0) {
        for (const execQuery of execQueries) {
          queries.push(execQuery(this.dbDriver, idsVals).toQuery());
        }
      }

      for (const d of res) {
        queries.push(this.dbDriver(this.tnPath).del().where(d).toQuery());
      }

      if ((this.dbDriver as any).isExternal) {
        await runExternal(
          this.sanitizeQuery(queries),
          (this.dbDriver as any).extDb,
        );
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of queries) {
            await trx.raw(this.sanitizeQuery(q));
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      await this.clearFileReferences({
        oldData: deleted,
        columns,
      });

      if (isSingleRecordDeletion) {
        await this.afterDelete(deleted[0], null, cookie);
      } else {
        await this.afterBulkDelete(deleted, this.dbDriver, cookie);
      }

      await this.statsUpdate({
        count: -deleted.length,
      });

      return res;
    } catch (e) {
      throw e;
    }
  }

  async bulkDeleteAll(
    args: { where?: string; filterArr?: Filter[]; viewId?: string } = {},
    { cookie, skip_hooks = false }: { cookie: NcRequest; skip_hooks?: boolean },
  ) {
    const queries: string[] = [];
    try {
      const columns = await this.model.getColumns(this.context);
      const { where } = this._getListArgs(args);
      const qb = this.dbDriver(this.tnPath);
      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        this.context,
        where,
        aliasColObjMap,
      );

      await conditionV2(
        this,
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
          ...(args.viewId
            ? await Filter.rootFilterList(this.context, {
                viewId: args.viewId,
              })
            : []),
        ],
        qb,
      );
      const execQueries: ((trx: CustomKnex, qb: any) => Knex.QueryBuilder)[] =
        [];
      // qb.del();

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        const { parentContext, childContext, refContext, mmContext } =
          await colOptions.getParentChildContext(this.context);

        if (colOptions.type === 'bt') {
          continue;
        }

        const childColumn = await colOptions.getChildColumn(childContext);
        const parentColumn = await colOptions.getParentColumn(parentContext);
        const parentTable = await parentColumn.getModel(parentContext);
        const childTable = await childColumn.getModel(childContext);
        await childTable.getColumns(childContext);
        await parentTable.getColumns(parentContext);

        const childBaseModel = await Model.getBaseModelSQL(childContext, {
          model: childTable,
          dbDriver: this.dbDriver,
        });

        const childTn = childBaseModel.getTnPath(childTable);

        switch (colOptions.type) {
          case 'mm':
            {
              const vChildCol = await colOptions.getMMChildColumn(mmContext);
              const vTable = await colOptions.getMMModel(mmContext);

              const vTn = this.getTnPath(vTable);

              execQueries.push(() =>
                this.dbDriver(vTn)
                  .where({
                    [vChildCol.column_name]: this.dbDriver(childTn)
                      .select(childColumn.column_name)
                      .first(),
                  })
                  .delete(),
              );
            }
            break;
          case 'hm':
            {
              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(refContext);
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(childContext, {
                colId: colOptions.fk_child_column_id,
              });

              execQueries.push((trx, qb) =>
                trx(childTn)
                  .where({
                    [childColumn.column_name]: this.dbDriver.from(
                      qb
                        .select(parentColumn.column_name)
                        // .where(_wherePk(parentTable.primaryKeys, rowId))
                        .first()
                        .as('___cn_alias'),
                    ),
                  })
                  .update({
                    [childColumn.column_name]: null,
                  }),
              );
            }
            break;
        }
      }

      const source = await this.getSource();

      // remove FileReferences for attachments
      const attachmentColumns = columns.filter(
        (c) => c.uidt === UITypes.Attachment,
      );

      // paginate all the records and find file reference ids
      const selectQb = qb
        .clone()
        .select(
          attachmentColumns
            .map((c) => c.column_name)
            .concat(this.model.primaryKeys.map((pk) => pk.column_name)),
        );

      const response = [];

      let offset = 0;
      const limit = 100;

      const fileReferenceIds: string[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const rows = await this.execAndParse(
          selectQb
            .clone()
            .offset(offset)
            .limit(limit + 1),
          null,
          {
            raw: true,
          },
        );

        if (rows.length === 0) {
          break;
        }

        let lastPage = false;

        if (rows.length > limit) {
          rows.pop();
        } else {
          lastPage = true;
        }

        for (const row of rows) {
          for (const c of attachmentColumns) {
            if (row[c.column_name]) {
              try {
                let attachments;
                if (typeof row[c.column_name] === 'string') {
                  attachments = JSON.parse(row[c.column_name]);
                  for (const attachment of attachments) {
                    if (attachment.id) {
                      fileReferenceIds.push(attachment.id);
                    }
                  }
                }

                if (Array.isArray(attachments)) {
                  for (const attachment of attachments) {
                    if (attachment.id) {
                      fileReferenceIds.push(attachment.id);
                    }
                  }
                }
              } catch (e) {
                continue;
              }
            }
          }

          const primaryData = {};

          for (const pk of this.model.primaryKeys) {
            primaryData[pk.title] = row[pk.column_name];
          }

          response.push(primaryData);
        }

        if (lastPage) {
          break;
        }

        offset += limit;
      }

      await FileReference.delete(this.context, fileReferenceIds);

      // unlink LTAR data
      if (source.isMeta()) {
        for (const execQuery of execQueries) {
          queries.push(execQuery(this.dbDriver, qb.clone()).toQuery());
        }
      }

      queries.push(qb.clone().del().toQuery());

      let responses;

      if ((this.dbDriver as any).isExternal) {
        responses = await runExternal(
          this.sanitizeQuery(queries),
          (this.dbDriver as any).extDb,
          {
            raw: true,
          },
        );
        responses = Array.isArray(responses) ? responses : [responses];
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          responses = [];
          for (const q of queries) {
            const res = await trx.raw(this.sanitizeQuery(q));
            responses.push(res);
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      if (!skip_hooks) {
        await this.afterBulkDelete(response, this.dbDriver, cookie, true);
      }

      await this.statsUpdate({
        count: -response.length,
      });

      return response;
    } catch (e) {
      throw e;
    }
  }

  public async afterUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    updateObj?: Record<string, any>,
  ): Promise<void> {
    // TODO this is a temporary fix for the audit log / DOMPurify causes issue for long text
    const id = this.extractPksValues(newData);

    const oldData: { [key: string]: any } = {};
    const data: { [key: string]: any } = {};

    if (updateObj) {
      updateObj = await this.model.mapColumnToAlias(this.context, updateObj);

      for (const k of Object.keys(updateObj)) {
        oldData[k] = prevData[k];
        data[k] = newData[k];
      }
    } else {
      Object.assign(oldData, prevData);
      Object.assign(data, newData);
    }

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      const formattedOldData = formatDataForAudit(oldData, this.model.columns);
      const formattedData = formatDataForAudit(data, this.model.columns);

      const updateDiff = populateUpdatePayloadDiff({
        keepUnderModified: true,
        prev: formattedOldData,
        next: formattedData,
        exclude: extractExcludedColumnNames(this.model.columns),
        excludeNull: false,
        excludeBlanks: false,
        keepNested: true,
      }) as UpdatePayload;

      if (updateDiff) {
        await RecordAudit.insert(
          await generateAuditV1Payload<DataUpdatePayload>(
            AuditV1OperationTypes.DATA_UPDATE,
            {
              context: {
                ...this.context,
                source_id: this.model.source_id,
                fk_model_id: this.model.id,
                row_id: this.extractPksValues(id, true),
              },
              details: {
                old_data: updateDiff.previous_state,
                data: updateDiff.modifications,
                column_meta: extractColsMetaForAudit(
                  this.model.columns.filter(
                    (c) => c.title in updateDiff.modifications,
                  ),
                  data,
                  oldData,
                ),
              },
              req,
            },
          ),
        );
      }
    }

    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('after.update', prevData, newData, req);
    }
    await this.handleRichTextMentions(prevData, newData, req);
  }

  public async afterBulkUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    if (!isBulkAllOperation) {
      await this.handleHooks('after.bulkUpdate', prevData, newData, req);
    }

    // disable external source audit in cloud
    if ((await this.isDataAuditEnabled()) && newData && newData.length > 0) {
      const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      await RecordAudit.insert(
        await generateAuditV1Payload<DataBulkUpdatePayload>(
          AuditV1OperationTypes.DATA_BULK_UPDATE,
          {
            details: {},
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
            },
            req,
            id: parentAuditId,
          },
        ),
      );

      req.ncParentAuditId = parentAuditId;

      await RecordAudit.insert(
        (
          await Promise.all(
            newData.map(async (d, i) => {
              const formattedOldData = prevData?.[i]
                ? formatDataForAudit(prevData?.[i], this.model.columns)
                : {};
              const formattedData = formatDataForAudit(d, this.model.columns);

              const updateDiff = populateUpdatePayloadDiff({
                keepUnderModified: true,
                prev: formattedOldData,
                next: formattedData,
                exclude: extractExcludedColumnNames(this.model.columns),
                excludeNull: false,
                excludeBlanks: false,
                keepNested: true,
              }) as UpdatePayload;

              if (updateDiff) {
                return await generateAuditV1Payload<DataUpdatePayload>(
                  AuditV1OperationTypes.DATA_UPDATE,
                  {
                    context: {
                      ...this.context,
                      source_id: this.model.source_id,
                      fk_model_id: this.model.id,
                      row_id: this.extractPksValues(d, true),
                    },
                    details: {
                      old_data: updateDiff.previous_state,
                      data: updateDiff.modifications,
                      column_meta: extractColsMetaForAudit(
                        this.model.columns.filter(
                          (c) => c.title in updateDiff.modifications,
                        ),
                        d,
                        prevData?.[i],
                      ),
                    },
                    req,
                  },
                );
              } else {
                return [];
              }
            }),
          )
        ).flat(),
      );
    }

    await this.handleRichTextMentions(prevData, newData, req);
  }

  public async bulkUpdateAudit({
    rowIds,
    req,
    conditions,
    data,
  }: {
    rowIds: any[];
    conditions: FilterType[];
    data?: Record<string, any>;
    req: NcRequest;
  }) {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) {
      return;
    }
    const auditUpdateObj = [];
    for (const rowId of rowIds) {
      auditUpdateObj.push(
        await generateAuditV1Payload<DataBulkUpdateAllPayload>(
          AuditV1OperationTypes.DATA_BULK_ALL_UPDATE,
          {
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(rowId, true),
            },
            details: {
              data: removeBlankPropsAndMask(data, ['CreatedAt', 'UpdatedAt']),
              old_data: removeBlankPropsAndMask(rowId, [
                'CreatedAt',
                'UpdatedAt',
              ]),
              conditions: conditions,
              column_meta: extractColsMetaForAudit(this.model.columns, data),
            },
            req,
          },
        ),
      );
    }
    await RecordAudit.insert(auditUpdateObj);
  }

  async getCustomConditionsAndApply({
    column,
    qb,
    view,
    filters,
    args,
    rowId,
    columns,
  }: {
    view?: View;
    column: Column<any>;
    qb?;
    filters?;
    args;
    rowId;
    columns?: Column[];
  }): Promise<any> {
    const listArgs: any = { ...args };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    const customConditions = column.meta?.enableConditions
      ? (await Filter.rootFilterListByLink(this.context, {
          columnId: column.id,
        })) || []
      : [];

    const row: any = null;
    const tableColumns =
      columns ||
      this.model.columns ||
      (await this.model.getColumns(this.context));

    const replaceWithValue = replaceDynamicFieldWithValue(
      row,
      rowId,
      tableColumns,
      this.readByPk,
      args,
    );

    await conditionV2(
      this,
      [
        ...(view
          ? [
              new Filter({
                children:
                  (await Filter.rootFilterList(this.context, {
                    viewId: view.id,
                  })) || [],
                is_group: true,
              }),
            ]
          : []),
        new Filter({
          children: filters,
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: await replaceWithValue(customConditions),
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: listArgs.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
      undefined,
    );
  }

  async statsUpdate(args: { count: number }) {
    const count = Math.abs(args.count || 1);

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    const workspaceRowCount = workspaceStats ? workspaceStats.row_count : 0;

    const { limit: workspaceRowLimit } = await getLimit(
      PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      this.model.fk_workspace_id,
    );

    // force update workspace stat if already over limit
    if (workspaceRowCount >= workspaceRowLimit) {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_STAT, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        force: true,
      });
    } else {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        base_id: this.model.base_id,
        fk_model_id: this.model.id,
        count,
      });
    }
  }
}

export {
  BaseModelSqlv2,
  _wherePk,
  extractSortsObject,
  getListArgs,
  haveFormulaColumn,
  getColumnName,
  getAs,
};
