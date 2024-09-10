import {
  AppEvents,
  AuditOperationSubTypes,
  AuditOperationTypes,
  extractCondition,
  extractFilterFromXwhere,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isVirtualCol,
  PlanLimitTypes,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import {
  _wherePk,
  BaseModelSqlv2 as BaseModelSqlv2CE,
  extractSortsObject,
  getAs,
  getColumnName,
  getCompositePkValue,
  getListArgs,
  haveFormulaColumn,
  populatePk,
} from 'src/db/BaseModelSqlv2';
import DOMPurify from 'isomorphic-dompurify';
import dayjs from 'dayjs';
import conditionV2 from 'src/db/conditionV2';
import Validator from 'validator';
import { customValidators } from 'src/db/util/customValidators';
import { v4 as uuidv4 } from 'uuid';
import { customAlphabet } from 'nanoid';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { LinkToAnotherRecordColumn, Source, View } from '~/models';
import type { NcContext } from '~/interface/config';
import {
  Audit,
  Column,
  FileReference,
  Filter,
  Model,
  ModelStat,
} from '~/models';
import { getSingleQueryReadFn } from '~/services/data-opt/pg-helpers';
import { canUseOptimisedQuery } from '~/utils';
import {
  UPDATE_MODEL_STAT,
  UPDATE_WORKSPACE_COUNTER,
  UPDATE_WORKSPACE_STAT,
} from '~/services/update-stats.service';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { sanitize } from '~/helpers/sqlSanitize';
import { runExternal } from '~/helpers/muxHelpers';
import { getLimit } from '~/plan-limits';
import { extractMentions } from '~/utils/richTextHelper';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

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
    } = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      bulkAggregate: false,
      skipJsonConversion: false,
      raw: false,
      first: false,
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
      data = await this.convertUserFormat(data, dependencyColumns);
    }
    // Update button fields
    if (!options.skipJsonConversion) {
      data = await this.convertJsonTypes(data, dependencyColumns);
    }

    if (options.bulkAggregate) {
      data = data.map(async (d) => {
        for (let [key, data] of Object.entries(d)) {
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

      await this.afterInsert(response, trx, cookie);
      return Array.isArray(response) ? response[0] : response;
    } catch (e) {
      console.log(e);
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
      console.log(e);
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  async prepareNocoData(
    data,
    isInsertData = false,
    cookie?: { user?: any },
    oldData?,
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

    return super.prepareNocoData(data, isInsertData, cookie, oldData);
  }

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    const modelStats = await ModelStat.get(
      this.context,
      this.model.fk_workspace_id,
      this.model.id,
    );

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    const rowCount = modelStats ? modelStats.row_count : await this.count();

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

    const modelRowLimit = await getLimit(
      PlanLimitTypes.TABLE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    const workspaceRowLimit = await getLimit(
      PlanLimitTypes.WORKSPACE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    if (workspaceRowCount >= workspaceRowLimit) {
      NcError.badRequest(
        `Only ${workspaceRowLimit} records are allowed in your workspace, for more please upgrade your plan`,
      );
    }

    if (rowCount >= modelRowLimit) {
      NcError.badRequest(
        `Only ${modelRowLimit} records are allowed in your table, for more please upgrade your plan`,
      );
    }

    await this.handleHooks('before.insert', null, data, req);
  }

  public async beforeBulkInsert(data: any, _trx: any, req): Promise<void> {
    const modelStats = await ModelStat.get(
      this.context,
      this.model.fk_workspace_id,
      this.model.id,
    );

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    const rowCount = modelStats ? modelStats.row_count : await this.count();

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

    const modelRowLimit = await getLimit(
      PlanLimitTypes.TABLE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    const workspaceRowLimit = await getLimit(
      PlanLimitTypes.WORKSPACE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    if (workspaceRowCount + data.length >= workspaceRowLimit) {
      NcError.badRequest(
        `Only ${workspaceRowLimit} records are allowed in your workspace, for more please upgrade your plan`,
      );
    }

    if (rowCount + data.length >= modelRowLimit) {
      NcError.badRequest(
        `Only ${modelRowLimit} records are allowed in your table, for more please upgrade your plan`,
      );
    }

    await this.handleHooks('before.bulkInsert', null, data, req);
  }

  public async afterInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('after.insert', null, data, req);
    const id = this.extractPksValues(data);
    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
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

    await this.handleRichTextMentions(null, data, req);

    Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
      context: this.context,
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      fk_model_id: this.model.id,
      count: 1,
    });
  }

  public async afterBulkInsert(data: any[], _trx: any, req): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);

    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
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

    await this.handleRichTextMentions(null, data, req);

    Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
      context: this.context,
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      fk_model_id: this.model.id,
      count: data.length,
    });
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    const id = req?.params?.id;
    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
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

    const modelStats = await ModelStat.get(
      this.context,
      this.model.fk_workspace_id,
      this.model.id,
    );

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    const rowCount = modelStats ? modelStats.row_count : await this.count();

    const workspaceRowCount = workspaceStats ? workspaceStats.row_count : 0;

    const modelRowLimit = await getLimit(
      PlanLimitTypes.TABLE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    const workspaceRowLimit = await getLimit(
      PlanLimitTypes.WORKSPACE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    // force update workspace stat on delete if already over limit
    if (workspaceRowCount >= workspaceRowLimit || rowCount >= modelRowLimit) {
      Noco.eventEmitter.emit(UPDATE_MODEL_STAT, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        fk_model_id: this.model.id,
        updated_at: new Date().toISOString(),
      });
    } else {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        base_id: this.model.base_id,
        fk_model_id: this.model.id,
        count: 1,
      });
    }
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
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
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

    const modelStats = await ModelStat.get(
      this.context,
      this.model.fk_workspace_id,
      this.model.id,
    );

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    const rowCount = modelStats ? modelStats.row_count : await this.count();

    const workspaceRowCount = workspaceStats ? workspaceStats.row_count : 0;

    const modelRowLimit = await getLimit(
      PlanLimitTypes.TABLE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    const workspaceRowLimit = await getLimit(
      PlanLimitTypes.WORKSPACE_ROW_LIMIT,
      this.model.fk_workspace_id,
    );

    // force update workspace stat on delete if already over limit
    if (workspaceRowCount >= workspaceRowLimit || rowCount >= modelRowLimit) {
      Noco.eventEmitter.emit(UPDATE_MODEL_STAT, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        fk_model_id: this.model.id,
        updated_at: new Date().toISOString(),
      });
    } else {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        base_id: this.model.base_id,
        fk_model_id: this.model.id,
        count: noOfDeletedRecords,
      });
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

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(
                this.context,
                colOptions.fk_mm_model_id,
              );
              const mmParentColumn = await Column.get(this.context, {
                colId: colOptions.fk_mm_child_column_id,
              });

              execQueries.push((trx) =>
                trx(this.getTnPath(mmTable.table_name))
                  .del()
                  .where(mmParentColumn.column_name, id),
              );
            }
            break;
          case 'hm':
            {
              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(
                this.context,
              );
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(this.context, {
                colId: colOptions.fk_child_column_id,
              });

              execQueries.push((trx) =>
                trx(this.getTnPath(relatedTable.table_name))
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

      return responses.pop()?.rowCount;
    } catch (e) {
      console.log(e);
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
      allowSystemColumn = false,
    }: {
      chunkSize?: number;
      cookie?: any;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
      allowSystemColumn?: boolean;
    } = {},
  ) {
    const queries: string[] = [];
    try {
      // TODO: ag column handling for raw bulk insert
      const insertDatas = raw ? datas : [];
      let postInsertOps: ((rowId: any) => Promise<string>)[] = [];
      let preInsertOps: (() => Promise<string>)[] = [];
      let aiPkCol: Column;
      let agPkCol: Column;

      if (!raw) {
        const nestedCols = (await this.model.getColumns(this.context)).filter(
          (c) => isLinksOrLTAR(c),
        );

        await this.model.getColumns(this.context);

        for (const d of datas) {
          const insertObj = {};

          // populate pk, map alias to column, validate data
          for (let i = 0; i < this.model.columns.length; ++i) {
            const col = this.model.columns[i];

            if (col.title in d) {
              if (
                isCreatedOrLastModifiedTimeCol(col) ||
                isCreatedOrLastModifiedByCol(col)
              ) {
                NcError.badRequest(
                  `Column "${col.title}" is auto generated and cannot be updated`,
                );
              }

              if (
                col.system &&
                !allowSystemColumn &&
                col.uidt !== UITypes.ForeignKey
              ) {
                NcError.badRequest(
                  `Column "${col.title}" is system column and cannot be updated`,
                );
              }
            }

            // populate pk columns
            if (col.pk) {
              if (col.meta?.ag && !d[col.title]) {
                d[col.title] =
                  col.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
              }
            }

            // map alias to column
            if (!isVirtualCol(col)) {
              let val =
                d?.[col.column_name] !== undefined
                  ? d?.[col.column_name]
                  : d?.[col.title];
              if (val !== undefined) {
                if (
                  col.uidt === UITypes.Attachment &&
                  typeof val !== 'string'
                ) {
                  val = JSON.stringify(val);
                }
                if (col.uidt === UITypes.DateTime && dayjs(val).isValid()) {
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
                if (this.isPg && col.uidt === UITypes.Checkbox) {
                  val = val ? true : false;
                }
                insertObj[sanitize(col.column_name)] = val;
              }
            }

            await this.validateOptions(col, insertObj);

            // validate data
            if (col?.meta?.validate && col?.validate) {
              const validate = col.getValidators();
              const cn = col.column_name;
              const columnTitle = col.title;
              if (validate) {
                const { func, msg } = validate;
                for (let j = 0; j < func.length; ++j) {
                  const fn =
                    typeof func[j] === 'string'
                      ? customValidators[func[j]]
                        ? customValidators[func[j]]
                        : Validator[func[j]]
                      : func[j];
                  const columnValue =
                    insertObj?.[cn] || insertObj?.[columnTitle];
                  const arg =
                    typeof func[j] === 'string'
                      ? columnValue + ''
                      : columnValue;
                  if (
                    ![null, undefined, ''].includes(columnValue) &&
                    !(fn.constructor.name === 'AsyncFunction'
                      ? await fn(arg)
                      : fn(arg))
                  ) {
                    NcError.badRequest(
                      msg[j]
                        .replace(/\{VALUE}/g, columnValue)
                        .replace(/\{cn}/g, columnTitle),
                    );
                  }
                }
              }
            }
          }

          await this.prepareNocoData(insertObj, true, cookie);

          // prepare nested link data for insert only if it is single record insertion
          if (isSingleRecordInsertion) {
            const operations = await this.prepareNestedLinkQb({
              nestedCols,
              data: d,
              insertObj,
            });

            postInsertOps = operations.postInsertOps;
            preInsertOps = operations.preInsertOps;
          }

          insertDatas.push(insertObj);
        }

        // used for post insert operations
        aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);
        agPkCol = this.model.primaryKeys.find((pk) => pk.meta?.ag);
      } else {
        await this.model.getColumns(this.context);

        await Promise.all(
          insertDatas.map(
            async (d) => await this.prepareNocoData(d, true, cookie),
          ),
        );
      }

      if ('beforeBulkInsert' in this) {
        await this.beforeBulkInsert(insertDatas, null, cookie);
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
        if (isSingleRecordInsertion) {
          let rowId;
          if (this.isSqlite || this.isMySQL) {
            if (this.isMySQL && this.isSqlite) {
              rowId = responses[0];
            }

            if (agPkCol) {
              rowId = insertDatas[agPkCol.column_name];
            }
          } else {
            rowId = responses[0][this.model.primaryKey?.title];
          }

          if (aiPkCol || agPkCol) {
            rowId = this.extractCompositePK({
              rowId,
              ai: aiPkCol,
              ag: agPkCol,
              insertObj: insertDatas[0],
            });
          }

          await this.runOps(
            postInsertOps.map((f) => f(rowId)),
            trx,
          );
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
          await this.afterInsert(insertData, this.dbDriver, cookie);
        } else {
          await this.afterBulkInsert(insertDatas, this.dbDriver, cookie);
        }
      }

      return responses;
    } catch (e) {
      // await this.errorInsertb(e, data, null);
      throw e;
    }
  }

  async bulkUpsert(
    datas: any[],
    {
      chunkSize = 100,
      cookie,
      raw = false,
      foreign_key_checks = true,
      insertOneByOneAsFallback = false,
    }: {
      chunkSize?: number;
      cookie?: any;
      raw?: boolean;
      foreign_key_checks?: boolean;
      insertOneByOneAsFallback?: boolean;
    } = {},
  ) {
    const insertQueries: string[] = [];
    const updateQueries: string[] = [];

    try {
      const columns = await this.model.getColumns(this.context);

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
        if (!raw) {
          await this.prepareNocoData(data, true, cookie);
        }

        const pkValues = this.extractPksValues(data);
        if (pkValues !== 'N/A' && pkValues !== undefined) {
          dataWithPks.push({ pk: pkValues, data });
        } else {
          // const insertObj = this.handleValidateBulkInsert(data, columns);
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
          toUpdate.push(data);

          updatePkValues.push(
            getCompositePkValue(this.model.primaryKeys, {
              ...data,
            }),
          );
        } else {
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
          await this.afterInsert(insertData, this.dbDriver, cookie);
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
    }: {
      cookie?: any;
      raw?: boolean;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordUpdation?: boolean;
    } = {},
  ) {
    const queries: string[] = [];
    try {
      const columns = await this.model.getColumns(this.context);

      // validate update data
      if (!raw) {
        for (const d of datas) {
          await this.validate(d, columns);
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
      const pkAndData: { pk: any; data: any }[] = [];
      const readChunkSize = 100;
      for (const [i, d] of updateDatas.entries()) {
        const pkValues = getCompositePkValue(
          this.model.primaryKeys,
          this.extractPksValues(d),
        );
        if (pkValues === null || pkValues === undefined) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.recordNotFound(pkValues);
          }
          continue;
        }
        if (!raw) {
          pkAndData.push({
            pk: pkValues,
            data: d,
          });

          if (
            pkAndData.length >= readChunkSize ||
            i === updateDatas.length - 1
          ) {
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

            for (const record of tempToRead) {
              const oldRecord = oldRecords.find((r) =>
                this.comparePks(this.extractPksValues(r), record.pk),
              );

              if (!oldRecord) {
                // throw or skip if no record found
                if (throwExceptionIfNotExist) {
                  NcError.recordNotFound(pkValues);
                }
                continue;
              }

              await this.prepareNocoData(record.data, false, cookie, oldRecord);

              prevData.push(oldRecord);
            }

            for (let i = 0; i < tempToRead.length; i++) {
              const { pk, data } = tempToRead[i];
              const wherePk = await this._wherePk(pk, true);

              // remove pk from update data for databricks
              if (this.isDatabricks) {
                const dWithoutPk = {};

                for (const k in data) {
                  if (!(k in wherePk)) {
                    dWithoutPk[k] = data[k];
                  }
                }

                toBeUpdated.push({ d: dWithoutPk, wherePk });
              } else {
                toBeUpdated.push({ d: data, wherePk });
              }

              updatePkValues.push(
                getCompositePkValue(this.model.primaryKeys, {
                  ...prevData[i],
                  ...data,
                }),
              );
            }
          }
        } else {
          await this.prepareNocoData(d, false, cookie);

          const wherePk = await this._wherePk(pkValues, true);

          // remove pk from update data for databricks
          if (this.isDatabricks) {
            const dWithoutPk = {};

            for (const k in d) {
              if (!(k in wherePk)) {
                dWithoutPk[k] = d[k];
              }
            }

            toBeUpdated.push({ d: dWithoutPk, wherePk });
          } else {
            toBeUpdated.push({ d, wherePk });
          }

          updatePkValues.push(
            getCompositePkValue(this.model.primaryKeys, {
              ...pkValues,
              ...d,
            }),
          );
        }
      }

      for (const o of toBeUpdated) {
        queries.push(
          this.dbDriver(this.tnPath).update(o.d).where(o.wherePk).toQuery(),
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

      if (!raw) {
        while (updatePkValues.length) {
          const updatedRecords = await this.list(
            {
              pks: updatePkValues.splice(0, readChunkSize).join(','),
            },
            {
              limitOverride: readChunkSize,
            },
          );

          newData.push(...updatedRecords);
        }
      }

      if (!raw) {
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

      const execQueries: ((
        trx: CustomKnex,
        ids: any[],
      ) => Knex.QueryBuilder)[] = [];

      const base = await this.getSource();

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(
                this.context,
                colOptions.fk_mm_model_id,
              );
              const mmParentColumn = await Column.get(this.context, {
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
              const relatedTable = await colOptions.getRelatedTable(
                this.context,
              );
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(this.context, {
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

      return res;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async bulkDeleteAll(
    args: { where?: string; filterArr?: Filter[] } = {},
    { cookie }: { cookie?: any } = {},
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
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

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

        if (colOptions.type === 'bt') {
          continue;
        }

        const childColumn = await colOptions.getChildColumn(this.context);
        const parentColumn = await colOptions.getParentColumn(this.context);
        const parentTable = await parentColumn.getModel(this.context);
        const childTable = await childColumn.getModel(this.context);
        await childTable.getColumns(this.context);
        await parentTable.getColumns(this.context);

        const childTn = this.getTnPath(childTable);

        switch (colOptions.type) {
          case 'mm':
            {
              const vChildCol = await colOptions.getMMChildColumn(this.context);
              const vTable = await colOptions.getMMModel(this.context);

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
              const relatedTable = await colOptions.getRelatedTable(
                this.context,
              );
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(this.context, {
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

      await this.afterBulkDelete(response.length, this.dbDriver, cookie, true);

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
    _updateObj?: Record<string, any>,
  ): Promise<void> {
    // TODO this is a temporary fix for the audit log / DOMPurify causes issue for long text
    const id = this.extractPksValues(newData);
    const desc = `Record with ID ${id} has been updated in Table ${this.model.title}.`;
    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UPDATE,
      description: desc,
      details: '',
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
    await this.handleRichTextMentions(prevData, newData, req);
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
