import {
  AppEvents,
  AuditV1OperationTypes,
  convertDurationToSeconds,
  enumColors,
  isAIPromptCol,
  isAttachment,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isMMOrMMLike,
  isOrderCol,
  isSelfLinkCol,
  isSystemColumn,
  isVirtualCol,
  NcErrorType,
  ncIsUndefined,
  PermissionEntity,
  PermissionKey,
  PlanLimitTypes,
  ProjectRoles,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { BaseModelSqlv2 as BaseModelSqlv2CE } from 'src/db/BaseModelSqlv2';
import dayjs from 'dayjs';
import conditionV2 from 'src/db/conditionV2';
import { customValidators } from 'src/db/util/customValidators';
import { v4 as uuidv4 } from 'uuid';
import { customAlphabet } from 'nanoid';
import { NcApiVersion } from 'nocodb-sdk';
import { AttachmentUrlUploadPreparator } from 'src/db/BaseModelSqlv2/attachment-url-upload-preparator';
import { ncIsStringHasValue } from 'src/db/field-handler/utils/handlerUtils';
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
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type { XcFilter } from '~/db/sql-data-mapper/lib/BaseModel';
// import type { SelectOption } from '~/models';
import { PrincipalAssignment, Source, View } from '~/models';
import { BaseModelDelete } from '~/db/BaseModelSqlv2/delete';
import {
  batchUpdate,
  extractColsMetaForAudit,
  extractExcludedColumnNames,
  generateAuditV1Payload,
  nocoExecute,
  populateUpdatePayloadDiff,
  remapWithAlias,
} from '~/utils';
import { Audit, Column, Filter, Model, ModelStat, Permission } from '~/models';
import DateDependency from '~/models/DateDependency';
import {
  applyDateDependencyFieldSync,
  buildDateDependencyPropagationSQL,
} from '~/helpers/dateDependencyHelper';
import {
  getSingleQueryReadFn,
  singleQueryGroupedList,
  singleQueryList,
} from '~/services/data-opt/pg-helpers';
import { canUseOptimisedQuery, removeBlankPropsAndMask } from '~/utils';
import {
  UPDATE_WORKSPACE_COUNTER,
  UPDATE_WORKSPACE_STAT,
} from '~/services/update-stats.service';
import { isCloud } from '~/utils';
import Noco from '~/Noco';
import { NcError, OptionsNotExistsError } from '~/helpers/catchError';
import { sanitize } from '~/helpers/sqlSanitize';
import { runExternal, runExternalStream } from '~/helpers/muxHelpers';
import { checkLimit, getLimit } from '~/helpers/paymentHelpers';
import { extractMentions } from '~/utils/richTextHelper';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
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
  shouldCascadeLinkCleanup,
  validateFuncOnColumn,
} from '~/helpers/dbHelpers';
import { getProjectRole } from '~/utils/roleHelper';
import NocoSocket from '~/socket/NocoSocket';
import { chunkArray } from '~/utils/tsUtils';
import { singleQueryList as mysqlSingleQueryList } from '~/services/data-opt/mysql-helpers';
import { Profiler } from '~/helpers/profiler';
import { handleUniqueConstraintError } from '~/helpers/uniqueConstraintErrorHandler';
import getAst from '~/helpers/getAst';
import {
  resolveRlsDynamicValues,
  resolveRlsPolicies,
} from '~/utils/rls-resolver';
import { getMemberUserIdsForTeamsAndDescendants } from '~/utils/team-subject-matcher';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const ORDER_STEP_INCREMENT = 1;
const MAX_RECURSION_DEPTH = 2;
const READ_CHUNK_SIZE = 100;

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
    queryQueue,
  }: {
    [key: string]: any;
    model: Model;
    schema?: string;
  }) {
    super({ dbDriver, model, viewId, queryQueue });
    this.schema = schema;
    this.context = context;
  }

  // need to override for it to return ee version
  /**
   * Creates a new BaseModelSqlv2 instance that uses the base database driver
   * instead of any active transaction. This is useful for operations that need
   * to run outside of the current transaction context, such as broadcasting
   * link updates to avoid transaction conflicts.
   *
   * @returns A new BaseModelSqlv2 instance with non-transactional database access
   */
  public override getNonTransactionalClone() {
    return new BaseModelSqlv2({
      dbDriver: this._dbDriver,
      model: this.model,
      viewId: this.viewId,
      context: this.context,
      schema: this.schema,
      queryQueue: this._queryQueue,
    });
  }

  public async readByPk(
    id?: any,
    validateFormula = false,
    query: any = {},
    {
      ignoreView = false,
      getHiddenColumn = false,
      throwErrorIfInvalidParams = false,
      extractOnlyPrimaries = false,
      apiVersion,
      extractOrderColumn = false,
      ignoreRls = false,
    }: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      extractOnlyPrimaries?: boolean;
      apiVersion?: NcApiVersion;
      extractOrderColumn?: boolean;
      ignoreRls?: boolean;
    } = {},
    disableOptimization = false,
  ): Promise<any> {
    const source = await this.getSource();

    // Use optimized query for PostgreSQL/MySQL when available
    if (
      await canUseOptimisedQuery(this.context, {
        source,
        disableOptimization,
      })
    ) {
      const view =
        ignoreView || !this.viewId
          ? null
          : await View.get(this.context, this.viewId);

      const result = await getSingleQueryReadFn(source)(this.context, {
        model: this.model,
        id,
        view,
        params: query || {},
        source,
        getHiddenColumn,
        throwErrorIfInvalidParams,
        validateFormula,
        apiVersion: apiVersion ?? this.context.api_version,
        extractOnlyPrimaries,
        extractOrderColumn,
        ignoreRls,
      });

      // Ensure we return null instead of undefined for consistency with CE version
      return result ?? null;
    }

    // Fallback to superclass implementation when optimization is not available
    return super.readByPk(id, validateFormula, query, {
      ignoreView,
      getHiddenColumn,
      throwErrorIfInvalidParams,
      extractOnlyPrimaries,
      apiVersion,
      extractOrderColumn,
      ignoreRls,
    });
  }

  public getTnPath(tb: { table_name: string } | string, alias?: string) {
    const tn = typeof tb === 'string' ? tb : tb.table_name;
    if (this.isPg && this.schema) {
      return `${this.schema}.${tn}${alias ? ` as ${alias}` : ``}`;
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

    if (typeof qb !== 'string') {
      this.knex.applyCte(qb);
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
    const queries = (await Promise.all(ops)).filter((query) =>
      ncIsStringHasValue(query),
    );
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
      if (this.isPg && this.model.primaryKey) {
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
              ignoreRls: true,
            })
          : this.readByPk(
              rowId,
              false,
              {},
              { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
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
            { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
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
              ignoreRls: true,
            })
          : await this.readByPk(
              rowId,
              false,
              {},
              { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
            );
      }

      // Check if the inserted row is visible under the user's RLS policy
      const rlsConditions = await this.getRlsConditions();
      if (rlsConditions.length && response) {
        const row = Array.isArray(response) ? response[0] : response;
        if (row) {
          const isVisible = await this.exist(this.extractPksValues(row, true));
          if (!isVisible) row.__nc_rls_hidden = true;
        }
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
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
        insertData: data,
      });
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
    ignoreRls?: boolean;
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
          ignoreRls: param.ignoreRls,
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
        NcError.get(this.context).recordNotFound(id);
      }

      await this.prepareNocoData(updateObj, false, cookie, prevData);

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id, true));

      const rlsConditions = await this.getRlsConditions();
      if (rlsConditions.length) {
        await conditionV2(
          this,
          [new Filter({ children: rlsConditions, is_group: true })],
          query,
          undefined,
          true,
        );
      }

      try {
        await this.execAndParse(query, null, { raw: true });
      } catch (e: any) {
        // Handle unique constraint violations (throws if it's a unique constraint error)
        await handleUniqueConstraintError({
          error: e,
          baseModel: this,
          insertData: updateObj,
        });
        // If not a unique constraint error, re-throw the original error
        throw e;
      }

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
            ignoreRls: true,
          })
        : await this.readByPk(
            newId,
            false,
            {},
            { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
          );

      // Check if the updated row is still visible under the user's RLS policy
      const rlsConditionsForVisibility = await this.getRlsConditions();
      if (rlsConditionsForVisibility.length && newData) {
        const isVisible = await this.exist(
          this.extractPksValues(newData, true),
        );
        if (!isVisible) newData.__nc_rls_hidden = true;
      }

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
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
        insertData: data,
      });
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
        NcError.get(this.context).reorderFailed();
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
          NcError.get(this.context).cannotCalculateIntermediateOrderError();
        }

        orders.push(intermediateOrder);
      }

      return orders;
    } catch (error) {
      if (error.error === NcErrorType.ERR_CANNOT_CALCULATE_INTERMEDIATE_ORDER) {
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
      NcError.get(this.context).badRequest(
        'Order column not found to recalculateOrder',
      );
    }

    const client = this.dbDriver.client.config.client;
    if (!sql[client]) {
      NcError.get(this.context).notImplemented(
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
      NcError.get(this.context).recordNotFound(rowId);
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

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id: rowId,
          action: 'reorder',
          payload: row,
          before: beforeRowId,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

    return response;
  }

  async prepareNocoData(
    data,
    isInsertData = false,
    cookie?: { user?: any; permissions?: Permission[] },
    oldData?,
    extra?: {
      ncOrder?: BigNumber;
      before?: string;
      undo?: boolean;
      raw?: boolean;
    },
  ) {
    for (const column of this.model.columns) {
      if (this.isDatabricks) {
        if (column.unique && data[column.column_name]) {
          const query = this.dbDriver(this.tnPath)
            .select(1)
            .where(column.column_name, data[column.column_name])
            .limit(1);
          const res = await this.execAndParse(query, null, { first: true });
          if (res) {
            NcError.get(this.context).badRequest(
              `Duplicate entry for '${
                data[column.column_name]
              }' in the field '${
                column.title
              }', violating the unique constraint.`,
            );
          }
        }
      }

      if (
        data[column.column_name] !== undefined &&
        // if inserting data with column default value, skip permission check
        !(isInsertData && column.cdf === data[column.column_name])
      ) {
        await this.checkPermission({
          entity: PermissionEntity.FIELD,
          entityId: column.id,
          permission: PermissionKey.RECORD_FIELD_EDIT,
          user: cookie?.user,
          req: cookie,
        });
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

    // Date dependency field sync
    await this.applyDateDependencySync(data, oldData);
  }

  protected async applyDateDependencySync(
    data: Record<string, any>,
    oldData: Record<string, any> | null,
  ): Promise<void> {
    const rule = await DateDependency.getByModelId(this.context, this.model.id);
    if (!rule?.is_active) return;

    applyDateDependencyFieldSync(data, oldData, rule, this.model.columns);
  }

  /**
   * Propagates date changes to successor rows using a recursive PostgreSQL CTE.
   * The CTE computes which rows need updating and their new dates (SELECT only).
   * Results are streamed in batches of 500 and bulk-updated so that updated_at,
   * updated_by, hooks, broadcasts, and audit all go through the standard path.
   */
  protected async propagateDateDependency(
    changedRowIds: string[],
    req: NcRequest,
  ): Promise<void> {
    if (!changedRowIds?.length) return;

    // Guard against infinite recursion — bulkUpdate triggers afterBulkUpdate
    // which calls propagateDateDependency again. Uses context.additionalContext
    // instead of an instance property so the flag survives across BaseModelSqlv2
    // instances (bulkUpdate creates a new instance internally).
    if (this.context.additionalContext?.isDatePropagating) return;

    // Recursive CTE: PostgreSQL and MySQL 8+ only
    if (!this.isPg && !this.isMySQL) return;

    const rule = await DateDependency.getByModelId(this.context, this.model.id);
    if (
      !rule?.is_active ||
      !rule.fk_dependency_linkrow_field_id ||
      rule.dependency_buffer_type === 'none'
    )
      return;

    if (!this.model.columns?.length) {
      await this.model.getColumns(this.context);
    }

    const startCol = this.model.columns.find(
      (c) => c.id === rule.fk_start_date_field_id,
    );
    const endCol = this.model.columns.find(
      (c) => c.id === rule.fk_end_date_field_id,
    );
    if (!startCol || !endCol) return;

    const linkCol = this.model.columns.find(
      (c) => c.id === rule.fk_dependency_linkrow_field_id,
    );
    if (!linkCol) return;

    const colOptions = await linkCol.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );
    if (!colOptions || !['hm', 'om', 'oo'].includes(colOptions.type)) return;

    const isV2 = colOptions.version === 2;

    // V1: direct FK in the main table (childCol=FK, parentCol=PK)
    // V2: junction table (mmChildCol→child PK, mmParentCol→parent PK)
    let pkColName: string;
    let fkColName: string;
    let junctionInfo:
      | { tn: string; parentColName: string; childColName: string }
      | undefined;

    if (isV2) {
      // V2 junction-based link
      const mmModel = await colOptions.getMMModel(this.context);
      const mmChildCol = await colOptions.getMMChildColumn(this.context);
      const mmParentCol = await colOptions.getMMParentColumn(this.context);
      if (!mmModel || !mmChildCol || !mmParentCol) return;

      // For V2 self-ref, the main table PK is used on both sides
      const parentCol = await colOptions.getParentColumn(this.context);
      if (!parentCol) return;
      pkColName = parentCol.column_name;
      fkColName = ''; // not used for V2 — junction replaces it
      // In the junction table for V2 self-ref OM links, the column naming is
      // inverted: mmParentCol stores the child/successor ID, mmChildCol stores
      // the parent/predecessor ID. Swap them so the CTE joins correctly.
      junctionInfo = {
        tn: this.getTnPath(mmModel),
        parentColName: mmChildCol.column_name,
        childColName: mmParentCol.column_name,
      };
    } else {
      // V1 direct FK link
      const childCol = await colOptions.getChildColumn(this.context);
      const parentCol = await colOptions.getParentColumn(this.context);
      if (!childCol || !parentCol) return;
      pkColName = parentCol.column_name;
      fkColName = childCol.column_name;
    }

    const primaryKeys = this.model.primaryKeys;
    if (!primaryKeys?.length) return;

    // For composite PKs, find the index of the parent (link) column within the PKs
    // and identify extra PK columns that need to be carried through the CTE
    const parentPkIndex = primaryKeys.findIndex(
      (pk) => pk.column_name === pkColName,
    );
    if (parentPkIndex === -1) return;

    const extraPkCols = primaryKeys.filter(
      (pk) => pk.column_name !== pkColName,
    );

    // Extract the parent column value from composite PK strings
    // Single PK: changedRowIds are the values directly
    // Composite PK: changedRowIds are "val1___val2" — extract the parentCol's value
    let seedIds: string[];
    if (primaryKeys.length === 1) {
      seedIds = changedRowIds;
    } else {
      seedIds = changedRowIds
        .map((compositeId) => {
          const parts = compositeId
            .split('___')
            .map((v) => v.replaceAll('\\_', '_'));
          // Guard: if the composite ID has fewer parts than expected, skip it
          if (parentPkIndex >= parts.length) return undefined;
          return parts[parentPkIndex];
        })
        .filter((id): id is string => id !== undefined);
    }
    // After filtering, all invalid IDs are removed — if none remain, bail out
    if (!seedIds.length) return;

    const commonParams = {
      tn: this.getTnPath(this.model),
      pkColName,
      extraPkColNames: extraPkCols.map((c) => c.column_name),
      fkColName,
      startColName: startCol.column_name,
      endColName: endCol.column_name,
      connectionType:
        (rule.dependency_connection_type as
          | 'end-to-start'
          | 'end-to-end'
          | 'start-to-start'
          | 'start-to-end') ?? 'end-to-start',
      bufferType:
        (rule.dependency_buffer_type as 'flexible' | 'fixed') ?? 'flexible',
      bufferDays: rule.dependency_buffer_days ?? 0,
      seedIds,
      dialect: (this.isPg ? 'pg' : 'mysql') as 'pg' | 'mysql',
      includeWeekends: rule.include_weekends ?? true,
      junction: junctionInfo,
    };

    // Build both backward (push predecessors earlier) and forward (push successors later) CTEs
    const backwardResult = buildDateDependencyPropagationSQL({
      ...commonParams,
      direction: 'backward',
    });
    const forwardResult = buildDateDependencyPropagationSQL({
      ...commonParams,
      direction: 'forward',
    });

    const BATCH_SIZE = 500;

    const toUpdateRow = (row: any) => {
      const updateObj: Record<string, any> = {
        [primaryKeys[parentPkIndex].title]: row.id,
        [startCol.title]: row.new_start,
        [endCol.title]: row.new_end,
      };
      // Map extra PK columns from CTE output (id_1, id_2, ...)
      extraPkCols.forEach((pk, i) => {
        updateObj[pk.title] = row[`id_${i + 1}`];
      });
      return updateObj;
    };

    // Clear socket_id so the sender also receives realtime updates
    // for cascaded rows (they didn't directly edit these rows)
    const savedSocketId = this.context.socket_id;
    this.context.socket_id = undefined;

    this.context.additionalContext = {
      ...this.context.additionalContext,
      isDatePropagating: true,
    };
    try {
      const isExternal = (this.dbDriver as any).isExternal;

      // Run backward propagation first (push predecessors earlier),
      // then forward propagation (push successors later)
      for (const { sql, bindings } of [backwardResult, forwardResult]) {
        if (isExternal) {
          // External sources: stream rows via NDJSON endpoint, batch updates
          const rawSql = this.dbDriver.raw(sql, bindings).toQuery();
          const rowStream = runExternalStream(
            this.sanitizeQuery(rawSql),
            (this.dbDriver as any).extDb,
          );
          let batch: Record<string, any>[] = [];

          for await (const row of rowStream) {
            batch.push(toUpdateRow(row));

            if (batch.length >= BATCH_SIZE) {
              await this.bulkUpdate(batch, { cookie: req });
              batch = [];
            }
          }

          if (batch.length) {
            await this.bulkUpdate(batch, { cookie: req });
          }
        } else {
          // Internal sources: stream in batches to avoid loading all into memory
          const stream = this.dbDriver.raw(sql, bindings).stream();
          let batch: Record<string, any>[] = [];

          for await (const row of stream) {
            batch.push(toUpdateRow(row));

            if (batch.length >= BATCH_SIZE) {
              await this.bulkUpdate(batch, { cookie: req });
              batch = [];
            }
          }

          if (batch.length) {
            await this.bulkUpdate(batch, { cookie: req });
          }
        }
      }
    } catch (err: any) {
      this.logger.error('Date dependency propagation failed', err.stack);
    } finally {
      this.context.additionalContext = {
        ...this.context.additionalContext,
        isDatePropagating: false,
      };
      this.context.socket_id = savedSocketId;
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

    if (isCloud) {
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
    }

    if (!allowSystemColumn && this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'insert',
      });
    }

    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_ADD,
      user: req?.user,
      req,
    });

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

    if (isCloud) {
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
    }

    if (!allowSystemColumn && this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'insert',
      });
    }

    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_ADD,
      user: req?.user,
      req,
    });

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

    // Strip __nc_rls_hidden from broadcast — other clients have different
    // RLS policies and the flag would be incorrect for them
    const { __nc_rls_hidden: _, ...broadcastPayload } = data || {};

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id,
          action: 'add',
          payload: broadcastPayload,
          before: req?.query?.before,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

    const filteredAuditData = removeBlankPropsAndMask(insertData || data, [
      'CreatedAt',
      'UpdatedAt',
      // exclude virtual columns
      ...this.model.columns
        .filter((c) => isVirtualCol(c) || isSystemColumn(c))
        .map((c) => c.title),
    ]);
    if (await this.isDataAuditEnabled())
      await Audit.insert(
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

    const insertedId = String(this.extractPksValues(data));
    await this.propagateDateDependency([insertedId], req);
  }

  public async afterBulkInsert(data: any[], _trx: any, req): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);

    for (const d of data) {
      const id = this.extractPksValues(d);
      // Strip __nc_rls_hidden from broadcast — other clients have different
      // RLS policies and the flag would be incorrect for them
      const { __nc_rls_hidden: _, ...broadcastPayload } = d || {};

      NocoSocket.broadcastDataEvent(
        this.context,
        {
          payload: {
            id,
            action: 'add',
            payload: broadcastPayload,
          },
          tableId: this.model.id,
        },
        this.context.socket_id,
      );
    }

    if (await this.isDataAuditEnabled()) {
      let parentAuditId;
      if (!req.ncParentAuditId) {
        parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

        await Audit.insert(
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
      await Audit.insert(
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

    // Propagate date changes to successors
    const insertedIds = data.map((d) => String(this.extractPksValues(d)));
    await this.propagateDateDependency(insertedIds, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    const id = this.extractPksValues(data);

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id,
          action: 'delete',
          payload: null,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
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
    _isBulkAllOperation = false,
  ): Promise<void> {
    await this.handleHooks('after.bulkDelete', null, data, req);

    for (const d of data) {
      const id = this.extractPksValues(d);
      NocoSocket.broadcastDataEvent(
        this.context,
        {
          payload: {
            id,
            action: 'delete',
            payload: null,
          },
          tableId: this.model.id,
        },
        this.context.socket_id,
      );
    }

    if (await this.isDataAuditEnabled()) {
      const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      await Audit.insert(
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
      await Audit.insert(
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

      if (!data) {
        NcError.get(this.context).recordNotFound(id);
      }

      await this.beforeDelete(id, null, cookie);

      const execQueries: ((trx: CustomKnex) => Knex.QueryBuilder)[] = [];

      const source = await this.getSource();

      for (const column of this.model.columns) {
        if (!isLinksOrLTAR(column)) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        const { mmContext, refContext } = colOptions.getRelContext(
          this.context,
        );

        const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;

        const shouldCascadeHere = await shouldCascadeLinkCleanup(this.context, {
          isMeta: !!source.isMeta(),
          relationType,
          colOptions,
          mmContext,
        });

        switch (relationType) {
          case 'mm':
            {
              if (!shouldCascadeHere) break;

              const mmTable = await Model.get(
                this.context,
                colOptions.fk_mm_model_id,
              );

              const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
                model: mmTable,
                dbDriver: this.dbDriver,
                queryQueue: this._queryQueue,
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
              if (!shouldCascadeHere) break;

              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(refContext);

              if (relatedTable.mm) {
                break;
              }

              const refBaseModel = await Model.getBaseModelSQL(refContext, {
                model: relatedTable,
                dbDriver: this.dbDriver,
                queryQueue: this._queryQueue,
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

      const delQb = this.dbDriver(this.tnPath).del().where(where);

      const rlsConditions = await this.getRlsConditions();
      if (rlsConditions.length) {
        await conditionV2(
          this,
          [new Filter({ children: rlsConditions, is_group: true })],
          delQb,
          undefined,
          true,
        );
      }

      queries.push(delQb.toQuery());

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
    const profiler = Profiler.start('base-model/bulkInsert');
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
        const columns = await this.model.getColumns(this.context);
        const nestedCols = columns.filter((c) => isLinksOrLTAR(c));
        const attachmentCols = columns.filter((c) => isAttachment(c));

        await this.model.getColumns(this.context);

        const order = await this.getHighestOrderInTable();
        profiler.log('getHighestOrderInTable done');
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
                NcError.get(this.context).badRequest(
                  `Column "${col.title}" is auto generated and cannot be updated`,
                );
              }

              if (isVirtualCol(col) && !isLinksOrLTAR(col)) {
                NcError.get(this.context).badRequest(
                  `Column "${col.title}" is virtual and cannot be updated`,
                );
              }

              if (col.system && !allowSystemColumn) {
                let shouldThrow = true;

                // allow updating order column during undo operation
                if (col.uidt === UITypes.Order && undo) {
                  shouldThrow = false;
                }
                // allow updating self link column (system counter part)
                else if (isSelfLinkCol(col)) {
                  shouldThrow = false;
                }

                if (shouldThrow) {
                  NcError.get(this.context).badRequest(
                    `Column "${col.title}" is system column and cannot be updated`,
                  );
                }
              }

              if (!allowSystemColumn && col.readonly) {
                NcError.get(this.context).badRequest(
                  `Column "${col.title}" is readonly column and cannot be updated`,
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
                  const { isMySQL, isSqlite, isPg } = this.clientMeta;
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

            if (attachmentCols.length > 0) {
              const attachmentOperations =
                await new AttachmentUrlUploadPreparator().prepareAttachmentUrlUpload(
                  this,
                  {
                    attachmentCols,
                    data: insertObj,
                    req: cookie,
                  },
                );
              postInsertOpsMap[index] = [
                ...(postInsertOpsMap[index] ?? []),
                ...(attachmentOperations.postInsertOps ?? []),
              ];
              preInsertOps = [
                ...(preInsertOps ?? []),
                ...(attachmentOperations.preInsertOps ?? []),
              ];
            }
          }

          insertDatas.push(insertObj);
        }
        profiler.log('validate & prepare noco data done');

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
        profiler.log('prepare noco data done on raw');
      }

      if ('beforeBulkInsert' in this) {
        await this.beforeBulkInsert(insertDatas, null, cookie, {
          allowSystemColumn,
        });
      }
      profiler.log('beforeBulkInsert done');

      await this.runOps(preInsertOps.map((f) => f()));
      profiler.log('preInsertOps done');

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
          if (this.isPg) {
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
              if (
                insertOneByOneAsFallback &&
                !(this.dbDriver as any).isExternal
              ) {
                // new path: row is {pk_col: id} from extractCompositePK
                rowId = row?.[this.model.primaryKey?.title];
              } else if (this.isMySQL) {
                // legacy path: execAndGetRows returned raw last-insert-id
                rowId = row;
              }

              if (agPkCol) {
                rowId = insertDatas[i]?.[agPkCol.column_name];
              }
            } else {
              rowId = row[this.model.primaryKey?.title];
            }

            rowId = this.extractCompositePK({
              rowId,
              ai: aiPkCol,
              ag: agPkCol,
              insertObj: insertDatas[i],
            });

            await this.runOps(
              (postInsertOpsMap[i] ?? []).map((f) => f(rowId)),
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
        profiler.log('runExternal done');

        responses = Array.isArray(responses) ? responses : [responses];
        if (!raw) await postSingleRecordInsertionCbk(responses);
        profiler.log('postSingleRecordInsertionCbk done');
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          responses = [];
          if (
            insertOneByOneAsFallback &&
            (this.clientMeta.isSqlite || this.clientMeta.isMySQL)
          ) {
            for (const insertData of insertDatas) {
              const query = trx(this.tnPath).insert(insertData);
              let id = (await query)[0];
              if (agPkCol) {
                id = insertData[agPkCol.column_name];
              }
              responses.push(
                this.extractCompositePK({
                  rowId: id,
                  ai: aiPkCol,
                  ag: agPkCol,
                  insertObj: insertData,
                  force: true,
                }) || insertData,
              );
            }
          } else {
            for (const q of queries) {
              const result = await this.execAndGetRows(q, trx);
              if (this.isMySQL && !Array.isArray(result)) {
                // this is the case of returnedId from mySql, which is number
                responses.push(result);
              } else {
                responses.push(...result);
              }
            }
          }
          profiler.log('execAndGetRows done');

          if (!raw) await postSingleRecordInsertionCbk(responses, trx);
          profiler.log('postSingleRecordInsertionCbk done');

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
        // only needed when responses are raw auto-increment IDs (batchInsert path)
        // skip when insertOneByOneAsFallback already wrapped them via extractCompositePK
        if (this.isMySQL && !insertOneByOneAsFallback) {
          responses = responses.map((r, idx) => {
            const rowId = this.extractCompositePK({
              rowId: r,
              ai: aiPkCol,
              ag: agPkCol,
              insertObj: insertDatas[idx],
            });
            if (rowId && typeof rowId === 'object') return rowId;
            return { [this.model.primaryKey.column_name]: rowId ?? r };
          });
        }

        if (isSingleRecordInsertion) {
          const insertData = await this.readByPk(
            responses[0],
            false,
            {},
            { ignoreRls: true },
          );
          await this.afterInsert({
            data: insertData,
            trx: this.dbDriver,
            req: cookie,
            insertData: datas?.[0],
          });
          profiler.log('single afterInsert done');
        } else {
          const insertResponses = await this.chunkList({
            pks: responses.map((d) => this.extractPksValues(d)),
            ignoreRls: true,
          });
          profiler.log('chunkList done');

          // Check which inserted rows are visible under the user's RLS policy
          const rlsConditionsForBulkInsert = await this.getRlsConditions();
          if (rlsConditionsForBulkInsert.length && insertResponses.length) {
            const insertPks = responses.map((d) => this.extractPksValues(d));
            const visibleInsertRecords = await this.chunkList({
              pks: insertPks,
            });
            const visibleInsertPks = new Set(
              visibleInsertRecords.map((r) =>
                this.extractPksValues(r, true)?.toString(),
              ),
            );
            for (const record of insertResponses) {
              const pk = this.extractPksValues(record, true)?.toString();
              if (!visibleInsertPks.has(pk)) {
                record.__nc_rls_hidden = true;
              }
            }
          }

          await this.afterBulkInsert(insertResponses, this.dbDriver, cookie);
          profiler.log('afterBulkInsert done');
        }
      }

      await this.statsUpdate({
        count: insertDatas.length,
      });
      profiler.log('statsUpdate done');
      profiler.end();

      return responses;
    } catch (e) {
      // Handle unique constraint violations - this will throw if it's a unique constraint error
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
        insertData: datas,
      });
      // await this.errorInsertb(e, data, null);
      throw e;
    }
  }

  async chunkList(args: {
    pks: string[];
    chunkSize?: number;
    apiVersion?: NcApiVersion;
    args?: Record<string, any>;
    ignoreRls?: boolean;
    extractOnlyPrimaries?: boolean;
  }) {
    const { pks, chunkSize = 1000 } = args;

    const data = [];

    const { ast } = await getAst(this.context, {
      model: this.model,
      query: args.args || {},
      extractOnlyPrimaries: args.extractOnlyPrimaries,
    });

    const chunkedPks = chunkArray(pks, chunkSize);

    const source = await this.getSource();

    for (const chunk of chunkedPks) {
      let chunkData;

      const ctx = {
        source,
        params: {
          pks: chunk.join(','),
          apiVersion: args.apiVersion,
          ...(args.args || {}),
        },
        limitOverride: chunk.length,
        ignoreViewFilterAndSort: true,
        ignoreRls: args.ignoreRls,
      };

      if (['mysql', 'mysql2'].includes(source.type)) {
        chunkData = await mysqlSingleQueryList(this.context, {
          ...ctx,
          skipPaginateWrapper: true,
          params: ctx.params,
          model: this.model,
          apiVersion: args.apiVersion,
        });
      } else if (['pg', 'postgres', 'postgresql'].includes(source.type)) {
        chunkData = await singleQueryList(this.context, {
          ...ctx,
          skipPaginateWrapper: true,
          params: ctx.params,
          model: this.model,
          apiVersion: args.apiVersion,
        });
      } else {
        // Fallback to regular list function
        chunkData = await this.list(
          {
            pks: chunk.join(','),
            apiVersion: args.apiVersion,
            ...(args.args || {}),
          },
          {
            limitOverride: chunk.length,
            ignoreViewFilterAndSort: true,
            ignoreRls: args.ignoreRls,
          },
        );
        chunkData = await nocoExecute(ast, chunkData, {}, args.args || {});
      }

      data.push(...chunkData);
    }

    return data;
  }

  public override async findByMergeFields(
    mergeColumns: Column[],
    mergeValuesPerRecord: any[][],
  ): Promise<Record<string, any>[]> {
    if (mergeValuesPerRecord.length === 0) return [];

    await this.model.getColumns(this.context);

    const mergeColNames = mergeColumns.map((col) => col.column_name);

    // Deduplicate merge value tuples
    const seen = new Set<string>();
    const uniqueTuples: any[][] = [];
    for (const tuple of mergeValuesPerRecord) {
      const key = tuple
        .map((v) => (v === null ? '\0NULL\0' : String(v)))
        .join('\0SEP\0');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTuples.push(tuple);
      }
    }

    // Build query: WHERE (col1 = ? AND col2 = ?) OR (col1 = ? AND col2 = ?) ...
    const qb = this.dbDriver(this.tnPath);

    qb.where((builder) => {
      for (const tuple of uniqueTuples) {
        builder.orWhere((inner) => {
          for (let i = 0; i < mergeColNames.length; i++) {
            if (tuple[i] === null || tuple[i] === undefined) {
              inner.whereNull(mergeColNames[i]);
            } else {
              inner.where(mergeColNames[i], tuple[i]);
            }
          }
        });
      }
    });

    // Apply RLS conditions
    const rlsConditions = await this.getRlsConditions();
    if (rlsConditions.length) {
      await conditionV2(
        this,
        [new Filter({ children: rlsConditions, is_group: true })],
        qb,
      );
    }

    // Only select PKs + merge columns (minimal data needed)
    const selectCols = [
      ...this.model.primaryKeys.map((pk) => pk.column_name),
      ...mergeColNames,
    ];
    qb.select(selectCols);

    return await qb;
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
      mergeColumns,
      throwOnDuplicate = false,
    }: {
      _chunkSize?: number;
      cookie?: any;
      raw?: boolean;
      foreign_key_checks?: boolean;
      insertOneByOneAsFallback?: boolean;
      undo?: boolean;
      mergeColumns?: Column[];
      throwOnDuplicate?: boolean;
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

      const toInsert = [];
      const toUpdate = [];
      const updatePkValues = [];

      let existingRecords: Record<string, any>[] = [];

      if (mergeColumns?.length) {
        // --- Merge-field-based matching ---
        const mergeColNames = mergeColumns.map((col) => col.column_name);

        const mergeValuesPerRecord = preparedDatas.map((data) =>
          mergeColNames.map((cn) => data[cn]),
        );

        const mergeMatchedRecords = await this.findByMergeFields(
          mergeColumns,
          mergeValuesPerRecord,
        );

        // Build a lookup map: stringified merge values → matched records
        const existingMap = new Map<string, Record<string, any>[]>();
        for (const record of mergeMatchedRecords) {
          const key = mergeColNames
            .map((cn) => {
              const v = record[cn];
              return v === null || v === undefined ? '\0NULL\0' : String(v);
            })
            .join('\0SEP\0');
          if (!existingMap.has(key)) {
            existingMap.set(key, [record]);
          } else {
            existingMap.get(key).push(record);
          }
        }

        for (let i = 0; i < preparedDatas.length; i++) {
          const data = preparedDatas[i];
          const key = mergeColNames
            .map((cn) => {
              const v = data[cn];
              return v === null || v === undefined ? '\0NULL\0' : String(v);
            })
            .join('\0SEP\0');
          const matchedRecords = existingMap.get(key);

          if (matchedRecords?.length > 1 && throwOnDuplicate) {
            NcError.get(this.context).invalidRequestBody(
              `Multiple records match fieldsToMergeOn [${mergeColNames.join(
                ', ',
              )}] — the combination must uniquely identify at most one record`,
            );
          }

          const existingRecord = matchedRecords?.[0];

          if (existingRecord) {
            for (const pk of this.model.primaryKeys) {
              data[pk.column_name] = existingRecord[pk.column_name];
            }
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
            toInsert.push(data);
          }
        }

        // Re-fetch full records for audit/webhook callbacks (merge lookup only returns PK + merge cols)
        if (toUpdate.length > 0) {
          existingRecords = await this.chunkList({ pks: updatePkValues });
        }
      } else {
        // --- Original PK-based matching ---
        const dataWithPks = [];
        const dataWithoutPks = [];

        for (const data of preparedDatas) {
          const pkValues = this.extractPksValues(data, true);
          if (pkValues !== 'N/A' && pkValues !== undefined) {
            dataWithPks.push({ pk: pkValues, data });
          } else {
            await this.prepareNocoData(data, true, cookie, null, {
              ncOrder: order,
              undo,
            });
            order = order?.plus(1);
            dataWithoutPks.push(data);
          }
        }

        existingRecords = await this.chunkList({
          pks: dataWithPks.map((v) => v.pk),
        });

        const existingPkSet = new Set(
          existingRecords.map((r) => this.extractPksValues(r, true)),
        );

        toInsert.push(...dataWithoutPks);

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
            toInsert.push(data);
          }
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
            if (this.isPg) {
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
        const rlsConditions = await this.getRlsConditions();
        const rlsFilterGroup = rlsConditions.length
          ? [new Filter({ children: rlsConditions, is_group: true })]
          : [];

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

            const qb = this.dbDriver(this.tnPath)
              .update(dWithoutPk)
              .where(wherePk);
            if (rlsFilterGroup.length) {
              await conditionV2(this, rlsFilterGroup, qb, undefined, true);
            }
            updateQueries.push(qb.toQuery());
          } else {
            const qb = this.dbDriver(this.tnPath).update(d).where(wherePk);
            if (rlsFilterGroup.length) {
              await conditionV2(this, rlsFilterGroup, qb, undefined, true);
            }
            updateQueries.push(qb.toQuery());
          }
        }
      }

      let updateResponses = [];
      let insertResponses = [];

      if ((this.dbDriver as any).isExternal) {
        const runExternalResponse = await runExternal(
          this.sanitizeQuery(insertQueries),
          (this.dbDriver as any).extDb,
        );
        insertResponses = Array.isArray(runExternalResponse)
          ? runExternalResponse
          : [runExternalResponse];

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
        } catch (e: any) {
          await trx.rollback();
          // Handle unique constraint violations (throws if it's a unique constraint error)
          await handleUniqueConstraintError({
            error: e,
            baseModel: this,
          });
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

        const insertPksForUpsert = insertResponses.map((d) =>
          this.extractPksValues(d),
        );

        insertResponses = await this.chunkList({
          pks: insertPksForUpsert,
          ignoreRls: true,
        });

        // Check which inserted rows are visible under the user's RLS policy
        const rlsConditionsForUpsertInsert = await this.getRlsConditions();
        if (rlsConditionsForUpsertInsert.length && insertResponses.length) {
          const visibleUpsertInserts = await this.chunkList({
            pks: insertPksForUpsert,
          });
          const visibleUpsertInsertPks = new Set(
            visibleUpsertInserts.map((r) =>
              this.extractPksValues(r, true)?.toString(),
            ),
          );
          for (const record of insertResponses) {
            const pk = this.extractPksValues(record, true)?.toString();
            if (!visibleUpsertInsertPks.has(pk)) {
              record.__nc_rls_hidden = true;
            }
          }
        }

        if (insertResponses.length === 1) {
          const insertData = await this.readByPk(
            insertResponses[0],
            false,
            {},
            { ignoreRls: true },
          );
          // Preserve RLS hidden flag from the chunk response
          if (insertResponses[0].__nc_rls_hidden) {
            insertData.__nc_rls_hidden = true;
          }
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
          ignoreRls: true,
        });

        // Check which updated rows are still visible under the user's RLS policy
        const rlsConditionsForUpsertUpdate = await this.getRlsConditions();
        if (rlsConditionsForUpsertUpdate.length && updateResponses.length) {
          const visibleUpsertUpdates = await this.chunkList({
            pks: updatePkValues,
          });
          const visibleUpsertUpdatePks = new Set(
            visibleUpsertUpdates.map((r) =>
              this.extractPksValues(r, true)?.toString(),
            ),
          );
          for (const record of updateResponses) {
            const pk = this.extractPksValues(record, true)?.toString();
            if (!visibleUpsertUpdatePks.has(pk)) {
              record.__nc_rls_hidden = true;
            }
          }
        }

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
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
      });
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
    const profiler = Profiler.start(`base-model/bulkUpdate`);

    try {
      const columns = await this.model.getColumns(this.context);

      if (!raw) {
        for (const d of datas) {
          await this.validate(d, columns, { allowSystemColumn, typecast });
        }
      }
      profiler.log('validate done');
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
      profiler.log('mapAliasToColumn done');

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      const pkAndData: { pk: string; data: any }[] = [];

      const attachmentCols = columns.filter((col) => isAttachment(col));
      let postUpdateOps: (() => Promise<string>)[] = [];

      for (const d of updateDatas) {
        const pkValues = this.extractPksValues(d, true);

        if (pkValues === null || pkValues === undefined) {
          if (throwExceptionIfNotExist)
            NcError.get(this.context).recordNotFound(pkValues);
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      const allPksToRead = pkAndData.map((v) => v.pk);

      profiler.log('this.chunkList start for old records');
      const oldRecords = await this.chunkList({
        pks: allPksToRead,
        chunkSize: READ_CHUNK_SIZE,
        apiVersion,
        args: { ignoreViewFilterAndSort: true },
      });
      profiler.log('this.chunkList done for old records');

      const oldRecordsMap = new Map<string, any>(
        oldRecords.map((r) => [this.extractPksValues(r, true), r]),
      );

      for (let i = 0; i < pkAndData.length; i += READ_CHUNK_SIZE) {
        const chunk = pkAndData.slice(i, i + READ_CHUNK_SIZE);

        for (const { pk, data } of chunk) {
          const oldRecord = oldRecordsMap.get(pk);

          if (!oldRecord) {
            if (throwExceptionIfNotExist)
              NcError.get(this.context).recordNotFound(pk);
            continue;
          }

          await this.prepareNocoData(data, false, cookie, oldRecord);
          prevData.push(oldRecord);
          if (attachmentCols.length > 0) {
            const attachmentOperation =
              await new AttachmentUrlUploadPreparator().prepareAttachmentUrlUpload(
                this,
                {
                  attachmentCols,
                  data,
                  req: cookie,
                },
              );
            postUpdateOps = postUpdateOps.concat(
              attachmentOperation.postInsertOps.map((ops) => {
                return () => ops(pk);
              }),
            );
          }

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
      profiler.log('prepareNocoData done');

      const rlsConditions = await this.getRlsConditions();
      const rlsFilterGroup = rlsConditions.length
        ? [new Filter({ children: rlsConditions, is_group: true })]
        : [];

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
          if (rlsFilterGroup.length) {
            await conditionV2(this, rlsFilterGroup, batchQb, undefined, true);
          }
          queries.push(batchQb.toQuery());
        }
      } else {
        for (const o of toBeUpdated) {
          const qb = this.dbDriver(this.tnPath).update(o.d).where(o.wherePk);
          if (rlsFilterGroup.length) {
            await conditionV2(this, rlsFilterGroup, qb, undefined, true);
          }
          queries.push(qb.toQuery());
        }
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
        } catch (e: any) {
          await trx.rollback();
          // Handle unique constraint violations (throws if it's a unique constraint error)
          await handleUniqueConstraintError({
            error: e,
            baseModel: this,
          });
          throw e;
        }
      }
      profiler.log('execute done');

      if (apiVersion === NcApiVersion.V3) {
        profiler.log('updateLTARCols start');
        // remove LTAR/Links if part of the update request
        await this.updateLTARCols({
          datas,
          cookie,
        });
        profiler.log('postUpdateOps start');
        await Promise.all(postUpdateOps.map((ops) => ops()));
        profiler.log('postUpdateOps done');
      }

      if (!raw) {
        profiler.log('this.chunkList start');
        const updatedRecords = await this.chunkList({
          pks: updatePkValues,
          chunkSize: READ_CHUNK_SIZE,
          apiVersion,
          ignoreRls: true,
        });
        profiler.log('this.chunkList done');

        // Check which updated rows are still visible under the user's RLS policy
        const rlsConditionsForCheck = await this.getRlsConditions();
        let rlsHiddenPks: Set<string> | null = null;
        if (rlsConditionsForCheck.length && updatedRecords.length) {
          const visibleRecords = await this.chunkList({
            pks: updatePkValues,
            chunkSize: READ_CHUNK_SIZE,
            apiVersion,
          });
          const visiblePks = new Set(
            visibleRecords.map((r) =>
              this.extractPksValues(r, true)?.toString(),
            ),
          );
          rlsHiddenPks = new Set(
            updatePkValues.filter((pk) => !visiblePks.has(pk?.toString())),
          );
        }

        const updatedRecordsMap = new Map(
          updatedRecords.map((record) => {
            const compositePk = getCompositePkValue(
              this.model.primaryKeys,
              record,
            );
            const pkStr =
              typeof compositePk === 'string'
                ? compositePk
                : compositePk.toString();
            if (rlsHiddenPks?.has(pkStr)) {
              record.__nc_rls_hidden = true;
            }
            return [pkStr, record];
          }),
        );
        for (const pk of updatePkValues) {
          if (updatedRecordsMap.has(pk)) {
            newData.push(updatedRecordsMap.get(pk));
          }
        }
      }
      profiler.log('Chunking to newData done');

      if (!raw && !skip_hooks) {
        profiler.log('after update start');
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
      profiler.end();
      return newData;
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
      });
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

    await Audit.insert(
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

    await Audit.insert(
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

      for (const d of deleteIds) {
        const pkValues = this.extractPksValues(d, true);
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.get(this.context).recordNotFound(pkValues);
          }
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      const allPksToRead = pkAndData.map((v) => v.pk);

      const oldRecords = await this.chunkList({
        pks: allPksToRead,
        chunkSize: READ_CHUNK_SIZE,
        args: { ignoreViewFilterAndSort: true },
      });

      const oldRecordsMap = new Map(
        oldRecords.map((r) => [this.extractPksValues(r, true), r]),
      );

      for (const { pk, data } of pkAndData) {
        const oldRecord = oldRecordsMap.get(pk);
        if (!oldRecord) {
          // throw or skip if no record found
          if (throwExceptionIfNotExist) {
            NcError.get(this.context).recordNotFound(pk);
          }
          continue;
        }

        deleted.push(oldRecord);
        res.push(data);
      }

      await this.beforeBulkDelete(deleted, this.dbDriver, cookie);

      const execQueries: ((
        trx: CustomKnex,
        ids: any[],
      ) => Knex.QueryBuilder)[] = [];

      const source = await this.getSource();

      for (const column of this.model.columns) {
        if (!isLinksOrLTAR(column)) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        const { childContext, refContext, mmContext } =
          await colOptions.getParentChildContext(this.context);

        const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;

        const shouldCascadeHere = await shouldCascadeLinkCleanup(this.context, {
          isMeta: !!source.isMeta(),
          relationType,
          colOptions,
          mmContext,
        });

        switch (relationType) {
          case 'mm':
            {
              if (!shouldCascadeHere) break;

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
              if (!shouldCascadeHere) break;

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

      // execQueries are pre-filtered above: pushed only when NocoDB must
      // cascade itself (meta source, or external FK with dr === 'NO ACTION').
      if (execQueries.length > 0) {
        for (const execQuery of execQueries) {
          queries.push(execQuery(this.dbDriver, idsVals).toQuery());
        }
      }

      const rlsConditions = await this.getRlsConditions();
      const rlsFilterGroup = rlsConditions.length
        ? [new Filter({ children: rlsConditions, is_group: true })]
        : [];

      for (const d of res) {
        const qb = this.dbDriver(this.tnPath).del().where(d);
        if (rlsFilterGroup.length) {
          await conditionV2(this, rlsFilterGroup, qb, undefined, true);
        }
        queries.push(qb.toQuery());
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
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipPks?: string;
    } = {},
    { cookie, skip_hooks = false }: { cookie: NcRequest; skip_hooks?: boolean },
  ) {
    return await new BaseModelDelete(this).bulkAll({
      args,
      cookie,
      skip_hooks,
    });
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

    // Strip __nc_rls_hidden from broadcast — other clients have different
    // RLS policies and the flag would be incorrect for them
    const { __nc_rls_hidden: _, ...broadcastPayload } = newData || {};

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id,
          action: 'update',
          payload: broadcastPayload,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

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
        await Audit.insert(
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
        NcError.get(this.context).badRequest(
          'ignoreWebhook value can be either true or false',
        );
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('after.update', prevData, newData, req);
    }
    await this.handleRichTextMentions(prevData, newData, req);

    // Propagate date changes to successors
    await this.propagateDateDependency(
      [String(this.extractPksValues(newData))],
      req,
    );
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

    if (newData && newData.length > 0) {
      for (const data of newData) {
        // Strip __nc_rls_hidden from broadcast — other clients have different
        // RLS policies and the flag would be incorrect for them
        const { __nc_rls_hidden: _, ...broadcastPayload } = data || {};

        NocoSocket.broadcastDataEvent(
          this.context,
          {
            payload: {
              id: this.extractPksValues(data),
              action: 'update',
              payload: broadcastPayload,
            },
            tableId: this.model.id,
          },
          this.context.socket_id,
        );
      }
    }

    // disable external source audit in cloud
    if ((await this.isDataAuditEnabled()) && newData && newData.length > 0) {
      const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      await Audit.insert(
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

      await Audit.insert(
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
                const isCascade =
                  this.context.additionalContext?.isDatePropagating;

                return await generateAuditV1Payload<DataUpdatePayload>(
                  isCascade
                    ? AuditV1OperationTypes.DATA_CASCADE_UPDATE
                    : AuditV1OperationTypes.DATA_UPDATE,
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
                      ...(isCascade ? { source: 'date_dependency' } : {}),
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

    // Propagate date changes to successors (skip bulk-all — no row data available)
    if (!isBulkAllOperation && newData?.length) {
      const rowIds = newData.map((d: any) => String(this.extractPksValues(d)));
      await this.propagateDateDependency(rowIds, req);
    }
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_DELETE,
      user: req?.user,
      req,
    });

    return super.beforeDelete(data, _trx, req);
  }

  public async beforeBulkDelete(_data: any, _trx: any, req): Promise<void> {
    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_DELETE,
      user: req?.user,
      req,
    });

    return super.beforeBulkDelete(_data, _trx, req);
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
      const prevData = typeof rowId === 'object' ? rowId : {};
      const updateDiff = populateUpdatePayloadDiff({
        keepUnderModified: true,
        prev: prevData,
        next: data,
        exclude: extractExcludedColumnNames(this.model.columns),
        excludeNull: false,
        excludeBlanks: false,
        keepNested: true,
      }) as UpdatePayload;

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
              old_data: updateDiff.previous_state,
              data: updateDiff.modifications,
              conditions: conditions,
              column_meta: extractColsMetaForAudit(
                this.model.columns,
                data,
                prevData,
              ),
            },
            req,
          },
        ),
      );
    }
    await Audit.insert(auditUpdateObj);
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
      ? (await Filter.rootFilterListByLink(
          { ...this.context, base_id: column.base_id },
          {
            columnId: column.id,
          },
        )) || []
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
    if (!isCloud) return;

    const count = args.count || 1;

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

  async checkPermission(params: {
    entity: PermissionEntity;
    entityId: string | string[];
    permission: PermissionKey;
    user: any;
    req: any;
  }) {
    const { entity, entityId, permission, user, req } = params;

    const permissionObj = req?.permissions?.find(
      (p) =>
        p.entity === entity &&
        (Array.isArray(entityId)
          ? entityId.includes(p.entity_id)
          : p.entity_id === entityId) &&
        p.permission === permission,
    );

    let errorMessage = 'You are not allowed for this action';

    switch (permission) {
      case PermissionKey.TABLE_VISIBILITY:
        errorMessage = 'You are not allowed to access this table';
        break;
      case PermissionKey.TABLE_RECORD_ADD:
        errorMessage = 'You are not allowed to insert into this table';
        break;
      case PermissionKey.TABLE_RECORD_DELETE:
        errorMessage = 'You are not allowed to delete records from this table';
        break;
      case PermissionKey.RECORD_FIELD_EDIT:
        errorMessage = `You are not allowed to edit field with ID: ${entityId}`;
        break;
      default:
        errorMessage = 'You are not allowed to access this table';
    }

    if (permissionObj) {
      if (!user) {
        NcError.get(this.context).forbidden(errorMessage);
      }

      const hasPermission = await Permission.isAllowed(
        this.context,
        permissionObj,
        {
          id: user.id,
          role: getProjectRole(user),
        },
      );

      if (!hasPermission) {
        NcError.get(this.context).forbidden(errorMessage);
      }
    }
  }

  /**
   * Optimized groupedList for PostgreSQL using singleQueryGroupedList
   * which handles nested columns/rollups in SQL without nocoExecute
   */
  public async groupedList(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
      includeRowColorColumns?: boolean;
      includeButtonFilterColumns?: boolean;
      options?: (string | number | null | boolean)[];
    } & Partial<XcFilter>,
  ): Promise<
    {
      key: string;
      value: Record<string, unknown>[];
    }[]
  > {
    // Use optimized version for PostgreSQL, fallback to base implementation for other databases
    if (!this.isPg) {
      return super.groupedList(args);
    }

    try {
      const source = await Source.get(this.context, this.model.source_id);

      // Use singleQueryGroupedList which handles nested columns/rollups in SQL
      // RLS conditions are resolved internally by singleQueryGroupedList
      return await singleQueryGroupedList(this.context, {
        model: this.model,
        view: this.viewId
          ? await View.get(this.context, this.viewId)
          : undefined,
        source,
        params: {
          ...args,
          options: args.options,
          filterArr: args.filterArr,
          sortArr: args.sortArr,
          sort: args.sort,
          where: args.where,
          limit: args.limit,
          offset: args.offset,
        },
        groupColumnId: args.groupColumnId,
        ignoreViewFilterAndSort: args.ignoreViewFilterAndSort,
        includeButtonFilterColumns: args.includeButtonFilterColumns,
        includeRowColourColumns: args.includeRowColorColumns,
        baseModel: this,
      });
    } catch (e) {
      throw e;
    }
  }

  /**
   * EE override: Returns RLS filter conditions for the current user.
   * Resolves applicable policies and returns filter conditions that
   * get AND'd with all other filters in the query.
   */
  public override async getRlsConditions(): Promise<Filter[]> {
    // Only apply RLS if user context is available
    if (!this.context?.user?.id) {
      return [];
    }

    const user = this.context.user;

    // Base owners are exempt from RLS
    if (user.base_roles) {
      const roles =
        typeof user.base_roles === 'string'
          ? JSON.parse(user.base_roles)
          : user.base_roles;
      if (roles?.[ProjectRoles.OWNER]) {
        return [];
      }
    }

    try {
      // Build user context for RLS resolution
      let baseRoles = '';
      if (user.base_roles) {
        const roles =
          typeof user.base_roles === 'string'
            ? JSON.parse(user.base_roles)
            : user.base_roles;
        baseRoles = Object.keys(roles)
          .filter((r) => roles[r])
          .join(',');
      }

      // Load user's team memberships for RLS
      // Use pre-loaded direct_teams from auth context when available (set by GlobalGuard)
      const teamIds: string[] = [];
      let teamResolutionFailed = false;

      try {
        const directTeams = user.direct_teams || [];

        if (directTeams.length > 0) {
          // Use pre-loaded team data from auth — no DB query needed
          for (const dt of directTeams) {
            teamIds.push(dt.team_id);
          }
        } else {
          // Fallback: query DB if direct_teams not available (e.g. socket/job contexts)
          const userTeamAssignments = await PrincipalAssignment.list(
            this.context,
            {
              principal_type: PrincipalType.USER,
              principal_ref_id: user.id,
              resource_type: ResourceType.TEAM,
            },
          );
          for (const assignment of userTeamAssignments) {
            teamIds.push(assignment.resource_id);
          }
        }
      } catch (_e) {
        // Teams may not be deployed — flag it so the resolver
        // can deny access if team-based policies exist (fail-closed)
        teamResolutionFailed = true;
      }

      // Resolve team hierarchy to member user IDs for {currentUser.teamWithDescendantMembers}
      let teamDescendantMemberUserIds: string[] = [];
      try {
        if (teamIds.length > 0) {
          teamDescendantMemberUserIds =
            await getMemberUserIdsForTeamsAndDescendants(this.context, teamIds);
        }
      } catch (_e) {
        // Same as above — fail-closed if team policies exist
        teamResolutionFailed = true;
      }

      const rlsUser = {
        id: user.id,
        email: user.email,
        roles: baseRoles,
        teams: teamIds,
        teamDescendantMemberUserIds,
      };

      const result = await resolveRlsPolicies(
        this.context,
        this.model.id,
        rlsUser,
        { teamResolutionFailed },
      );

      if (result.type === 'no_rls') {
        return [];
      }

      if (result.type === 'deny_all') {
        return this.getDenyAllFilter();
      }

      // Use the resolver's matched policy IDs directly
      const policyIdsToLoad = result.matchedPolicyIds;

      if (!policyIdsToLoad?.length) {
        return [];
      }

      // Load filter trees per policy: AND within each policy, OR between policies
      const policyFilterGroups: Filter[][] = [];
      for (const policyId of policyIdsToLoad) {
        const filters = await Filter.rootFilterListByRlsPolicy(this.context, {
          rlsPolicyId: policyId,
        });
        if (filters?.length) {
          const resolvedFilters = resolveRlsDynamicValues(filters, rlsUser);
          policyFilterGroups.push(resolvedFilters.map((f) => new Filter(f)));
        }
      }

      if (policyFilterGroups.length === 0) {
        return [];
      }

      // Single policy — return its filters directly (AND'd by default)
      if (policyFilterGroups.length === 1) {
        return policyFilterGroups[0];
      }

      // Multiple policies: wrap each policy's filters in an AND group,
      // then OR the groups together: (P1.F1 AND P1.F2) OR (P2.F1 AND P2.F2)
      const orChildren = policyFilterGroups.map((group, idx) => {
        const andGroup = new Filter({
          children: group,
          is_group: true,
          logical_op: 'and',
        });
        if (idx > 0) {
          andGroup.logical_op = 'or';
        }
        return andGroup;
      });

      return [
        new Filter({
          children: orChildren,
          is_group: true,
          logical_op: 'or',
        }),
      ];
    } catch (e) {
      // If RLS resolution fails, deny access (fail closed)
      new Logger('BaseModelSqlv2').error('RLS resolution error:', e.stack);
      return this.getDenyAllFilter();
    }
  }

  /**
   * Returns a filter that matches zero rows.
   * Uses (PK IS NULL AND PK IS NOT NULL) which is impossible regardless of data.
   * Used for deny_all default policy and fail-closed error handling.
   */
  private async getDenyAllFilter(): Promise<Filter[]> {
    await this.model.getColumns(this.context);
    const pkCol = this.model.primaryKey ?? this.model.columns?.[0];
    if (pkCol?.id) {
      // IS NULL AND IS NOT NULL — always false, column-value independent
      return [
        new Filter({
          children: [
            new Filter({
              comparison_op: 'null',
              fk_column_id: pkCol.id,
              is_group: false,
            }),
            new Filter({
              comparison_op: 'notnull',
              fk_column_id: pkCol.id,
              is_group: false,
              logical_op: 'and',
            }),
          ],
          is_group: true,
          logical_op: 'and',
        }),
      ];
    }
    return [];
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
