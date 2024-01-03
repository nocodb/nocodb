import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  isVirtualCol,
  UITypes,
} from 'nocodb-sdk';
import {
  _wherePk,
  BaseModelSqlv2 as BaseModelSqlv2CE,
  extractCondition,
  extractFilterFromXwhere,
  extractSortsObject,
  getColumnName,
  getListArgs,
  haveFormulaColumn,
  populatePk,
} from 'src/db/BaseModelSqlv2';
import DOMPurify from 'isomorphic-dompurify';
import axios from 'axios';
import dayjs from 'dayjs';
import conditionV2 from 'src/db/conditionV2';
import Validator from 'validator';
import { customValidators } from 'src/db/util/customValidators';
import { v4 as uuidv4 } from 'uuid';
import { customAlphabet } from 'nanoid';
import type { Knex } from 'knex';
import type { LinkToAnotherRecordColumn } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import { Audit, Column, Filter, Model, ModelStat, Source } from '~/models';
import { getSingleQueryReadFn } from '~/services/data-opt/helpers';
import { canUseOptimisedQuery } from '~/utils';
import {
  UPDATE_MODEL_STAT,
  UPDATE_WORKSPACE_COUNTER,
} from '~/services/update-stats.service';
import Noco from '~/Noco';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { NcError } from '~/helpers/catchError';
import { sanitize, unsanitize } from '~/helpers/sqlSanitize';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

async function runExternal(
  query: string | string[],
  config: any,
  extraOptions: {
    raw?: boolean;
  } = {},
) {
  if (!config) {
    console.log(query);
    throw new Error('External DB config not found');
  }

  const { dbMux, sourceId, ...rest } = config;

  try {
    const { data } = await axios.post(`${dbMux}/query/${sourceId}`, {
      query,
      config: rest,
      ...extraOptions,
    });
    return data;
  } catch (e) {
    if (e.response?.data?.error) {
      throw e.response.data.error;
    }
    throw e;
  }
}

async function execAndGetRows(
  baseModel: BaseModelSqlv2,
  query: string,
  kn?: Knex | CustomKnex,
) {
  kn = kn || baseModel.dbDriver;

  if (baseModel.isPg || baseModel.isSnowflake) {
    return (await kn.raw(query))?.rows;
  } else if (/^(\(|)select/i.test(query) && !baseModel.isMssql) {
    return await kn.from(kn.raw(query).wrap('(', ') __nc_alias'));
  } else if (/^(\(|)insert/i.test(query) && baseModel.isMySQL) {
    const res = await kn.raw(query);
    if (res && res[0] && res[0].insertId) {
      return res[0].insertId;
    }
    return res;
  } else {
    return await kn.raw(query);
  }
}

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 extends BaseModelSqlv2CE {
  public schema?: string;

  constructor({
    dbDriver,
    model,
    viewId,
    schema,
  }: {
    [key: string]: any;
    model: Model;
    schema?: string;
  }) {
    super({ dbDriver, model, viewId });
    this.schema = schema;
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
        this.dbDriver.client.config.connection.database,
        this.dbDriver.client.config.connection.schema,
        tn,
      ].join('.')}${alias ? ` as ${alias}` : ``}`;
    } else {
      return `${tn}${alias ? ` as ${alias}` : ``}`;
    }
  }

  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    childTable?: Model,
    options: {
      skipDateConversion?: boolean;
      skipAttachmentConversion?: boolean;
      skipSubstitutingColumnIds?: boolean;
      skipUserConversion?: boolean;
      raw?: boolean; // alias for skipDateConversion and skipAttachmentConversion
      first?: boolean;
    } = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      raw: false,
      first: false,
    },
  ) {
    if (options.raw) {
      options.skipDateConversion = true;
      options.skipAttachmentConversion = true;
      options.skipSubstitutingColumnIds = true;
      options.skipUserConversion = true;
    }

    if (options.first && typeof qb !== 'string') {
      qb = qb.limit(1);
    }

    let query = typeof qb === 'string' ? qb : qb.toQuery();
    if (!this.isPg && !this.isMssql && !this.isSnowflake) {
      query = unsanitize(query);
    } else {
      query = sanitize(query);
    }

    let data;

    if ((this.dbDriver as any).isExternal) {
      data = await runExternal(
        this.dbDriver.raw(query).toQuery(),
        (this.dbDriver as any).extDb,
      );
    } else {
      data = await execAndGetRows(this, query);
    }

    // update attachment fields
    if (!options.skipAttachmentConversion) {
      data = await this.convertAttachmentType(data, childTable);
    }

    // update date time fields
    if (!options.skipDateConversion) {
      data = this.convertDateFormat(data, childTable);
    }

    // update user fields
    if (!options.skipUserConversion) {
      data = await this.convertUserFormat(data, childTable);
    }

    if (!options.skipSubstitutingColumnIds) {
      data = await this.substituteColumnIdsWithColumnTitles(data, childTable);
    }

    if (options.first) {
      return data?.[0];
    }

    return data;
  }

  async insert(data, trx?, cookie?, disableOptimization = false) {
    try {
      await populatePk(this.model, data);

      // todo: filter based on view
      const insertObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
        this.dbDriver,
      );

      await this.validate(insertObj);

      if ('beforeInsert' in this) {
        await this.beforeInsert(insertObj, trx, cookie);
      }

      await this.prepareNocoData(insertObj, true);

      await this.model.getColumns();
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

      const source = await Source.get(this.model.source_id);

      // handle if autogenerated primary key is used
      if (ag) {
        if (!response) await this.execAndParse(query);
        response = await ((await canUseOptimisedQuery({
          source,
          disableOptimization,
        }))
          ? getSingleQueryReadFn(source)({
              model: this.model,
              id: insertObj[ag.column_name],
              params: {},
              view: null,
              source,
              getHiddenColumn: true,
            })
          : this.readByPk(
              insertObj[ag.column_name],
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
          if (this.isSqlite) {
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
            id,
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
        response = (await canUseOptimisedQuery({
          source,
          disableOptimization,
        }))
          ? await getSingleQueryReadFn(source)({
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
      }

      await this.afterInsert(response, trx, cookie);
      return Array.isArray(response) ? response[0] : response;
    } catch (e) {
      console.log(e);
      await this.errorInsert(e, data, trx, cookie);
      throw e;
    }
  }

  async updateByPk(id, data, trx?, cookie?, disableOptimization = false) {
    try {
      const updateObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
        this.dbDriver,
      );

      await this.validate(data);

      await this.beforeUpdate(data, trx, cookie);

      await this.prepareNocoData(updateObj);

      const source = await Source.get(this.model.source_id);
      const prevData = (await canUseOptimisedQuery({
        source,
        disableOptimization,
      }))
        ? await getSingleQueryReadFn(source)({
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

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id));

      await this.execAndParse(query, null, { raw: true });

      // const newData = await this.readByPk(id, false, {}, { ignoreView: true, getHiddenColumn: true });

      // const prevData = await this.readByPk(id);

      const newData = (await canUseOptimisedQuery({
        source,
        disableOptimization,
      }))
        ? await getSingleQueryReadFn(source)({
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
      await this.afterUpdate(prevData, newData, trx, cookie, updateObj);
      return newData;
    } catch (e) {
      console.log(e);
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  async prepareNocoData(data, isInsertData = false) {
    return super.prepareNocoData(data, isInsertData);
  }

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    /*
    const workspaceId = await getWorkspaceForBase(this.model.base_id);

    const modelStats = await ModelStat.get(workspaceId, this.model.id);

    const workspaceStats = await ModelStat.getWorkspaceSum(workspaceId);

    const rowCount = modelStats ? modelStats.row_count : 0;

    const workspaceRowCount = workspaceStats ? workspaceStats.row_count : 0;

    const modelRowLimit = await getLimit(
      PlanLimitTypes.TABLE_ROW_LIMIT,
      workspaceId,
    );

    const workspaceRowLimit = await getLimit(
      PlanLimitTypes.WORKSPACE_ROW_LIMIT,
      workspaceId,
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
    */

    await this.handleHooks('before.insert', null, data, req);
  }

  public async beforeBulkInsert(data: any, _trx: any, req): Promise<void> {
    const workspaceId = await getWorkspaceForBase(this.model.base_id);

    const modelStats = await ModelStat.get(workspaceId, this.model.id);

    const workspaceStats = await ModelStat.getWorkspaceSum(workspaceId);

    const rowCount = modelStats ? modelStats.row_count : 0;

    const workspaceRowCount = workspaceStats ? workspaceStats.row_count : 0;

    const modelRowLimit = await getLimit(
      PlanLimitTypes.TABLE_ROW_LIMIT,
      workspaceId,
    );

    const workspaceRowLimit = getLimit(
      PlanLimitTypes.WORKSPACE_ROW_LIMIT,
      workspaceId,
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

    await this.handleHooks('before.bulkInsert', null, data, req);
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

    /*
    const workspaceId = await getWorkspaceForBase(this.model.base_id);
    const modelStats = await ModelStat.get(workspaceId, this.model.id);
    if (modelStats) {
      await ModelStat.upsert(workspaceId, this.model.id, {
        row_count: modelStats.row_count + 1,
      });
    }
    */

    Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
      base_id: this.model.base_id,
      fk_model_id: this.model.id,
      count: 1,
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

    /*
    const workspaceId = await getWorkspaceForBase(this.model.base_id);
    const modelStats = await ModelStat.get(workspaceId, this.model.id);
    if (modelStats) {
      await ModelStat.upsert(workspaceId, this.model.id, {
        row_count: modelStats.row_count + data.length,
      });
    }
    */

    // TODO env
    if (data.length > 500) {
      Noco.eventEmitter.emit(UPDATE_MODEL_STAT, {
        base_id: this.model.base_id,
        fk_model_id: this.model.id,
      });
    } else {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
        base_id: this.model.base_id,
        fk_model_id: this.model.id,
        count: data.length,
      });
    }
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

    const workspaceId = await getWorkspaceForBase(this.model.base_id);
    const modelStats = await ModelStat.get(workspaceId, this.model.id);
    if (modelStats) {
      await ModelStat.upsert(workspaceId, this.model.id, {
        row_count: modelStats.row_count - 1,
      });
    }

    Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
      base_id: this.model.base_id,
      fk_model_id: this.model.id,
      count: 1,
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

    const workspaceId = await getWorkspaceForBase(this.model.base_id);
    const modelStats = await ModelStat.get(workspaceId, this.model.id);
    if (modelStats) {
      await ModelStat.upsert(workspaceId, this.model.id, {
        row_count: modelStats.row_count - noOfDeletedRecords,
      });
    }

    // TODO env
    if (noOfDeletedRecords > 500) {
      Noco.eventEmitter.emit(UPDATE_MODEL_STAT, {
        base_id: this.model.base_id,
        fk_model_id: this.model.id,
      });
    } else {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
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
          await column.getColOptions<LinkToAnotherRecordColumn>();

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(colOptions.fk_mm_model_id);
              const mmParentColumn = await Column.get({
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
              const relatedTable = await colOptions.getRelatedTable();
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get({
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
        responses = await runExternal(queries, (this.dbDriver as any).extDb);
      } else {
        const trx = await this.dbDriver.transaction();

        try {
          responses = [];
          for (const q of queries) {
            responses.push(await trx.raw(q));
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

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
    }: {
      chunkSize?: number;
      cookie?: any;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
    } = {},
  ) {
    const queries: string[] = [];
    try {
      // TODO: ag column handling for raw bulk insert
      const insertDatas = raw ? datas : [];

      if (!raw) {
        await this.model.getColumns();

        for (const d of datas) {
          const insertObj = {};

          // populate pk, map alias to column, validate data
          for (let i = 0; i < this.model.columns.length; ++i) {
            const col = this.model.columns[i];

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

          await this.prepareNocoData(insertObj, true);

          insertDatas.push(insertObj);
        }
      }

      if ('beforeBulkInsert' in this) {
        await this.beforeBulkInsert(insertDatas, null, cookie);
      }

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

        for (let i = 0; i < insertDatas.length; i += chunkSize) {
          batches.push(insertDatas.slice(i, i + chunkSize));
        }

        for (const batch of batches) {
          if (this.isPg || this.isMssql) {
            queries.push(
              this.dbDriver(this.tnPath)
                .insert(batch)
                .returning(this.model.primaryKey?.column_name)
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

      if ((this.dbDriver as any).isExternal) {
        responses = await runExternal(queries, (this.dbDriver as any).extDb);
        responses = Array.isArray(responses) ? responses : [responses];
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          responses = [];
          for (const q of queries) {
            responses.push(...(await execAndGetRows(this, q, trx)));
          }
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
      if (raw) await this.model.getColumns();

      const updateDatas = raw
        ? datas
        : await Promise.all(
            datas.map((d) =>
              this.model.mapAliasToColumn(d, this.clientMeta, this.dbDriver),
            ),
          );

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      for (const d of updateDatas) {
        if (!raw) await this.validate(d);
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.unprocessableEntity(
              `Record with pk ${JSON.stringify(pkValues)} not found`,
            );
          }
          continue;
        }
        if (!raw) {
          await this.prepareNocoData(d);

          const oldRecord = await this.readByPk(pkValues);
          if (!oldRecord) {
            // throw or skip if no record found
            if (throwExceptionIfNotExist) {
              NcError.unprocessableEntity(
                `Record with pk ${JSON.stringify(pkValues)} not found`,
              );
            }
            continue;
          }
          prevData.push(oldRecord);
        }
        const wherePk = await this._wherePk(pkValues);
        toBeUpdated.push({ d, wherePk });
        updatePkValues.push(pkValues);
      }

      for (const o of toBeUpdated) {
        queries.push(
          this.dbDriver(this.tnPath).update(o.d).where(o.wherePk).toQuery(),
        );
      }

      if ((this.dbDriver as any).isExternal) {
        await runExternal(queries, (this.dbDriver as any).extDb);
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of queries) {
            await trx.raw(q);
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      if (!raw) {
        for (const pkValues of updatePkValues) {
          const updatedRecord = await this.readByPk(pkValues);
          newData.push(updatedRecord);
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
      const deleteIds = await Promise.all(
        ids.map((d) =>
          this.model.mapAliasToColumn(d, this.clientMeta, this.dbDriver),
        ),
      );

      const deleted = [];
      const res = [];
      for (const d of deleteIds) {
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.unprocessableEntity(
              `Record with pk ${JSON.stringify(pkValues)} not found`,
            );
          }
          continue;
        }

        const deletedRecord = await this.readByPk(pkValues);
        if (!deletedRecord) {
          // throw or skip if no record found
          if (throwExceptionIfNotExist) {
            NcError.unprocessableEntity(
              `Record with pk ${JSON.stringify(pkValues)} not found`,
            );
          }
          continue;
        }
        deleted.push(deletedRecord);

        res.push(d);
      }

      const execQueries: ((
        trx: CustomKnex,
        ids: any[],
      ) => Knex.QueryBuilder)[] = [];

      const base = await Source.get(this.model.source_id);

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>();

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(colOptions.fk_mm_model_id);
              const mmParentColumn = await Column.get({
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
              const relatedTable = await colOptions.getRelatedTable();
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get({
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
        await runExternal(queries, (this.dbDriver as any).extDb);
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of queries) {
            await trx.raw(q);
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

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
      await this.model.getColumns();
      const { where } = this._getListArgs(args);
      const qb = this.dbDriver(this.tnPath);
      const aliasColObjMap = await this.model.getAliasColObjMap();
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
          await column.getColOptions<LinkToAnotherRecordColumn>();

        if (colOptions.type === 'bt') {
          continue;
        }

        const childColumn = await colOptions.getChildColumn();
        const parentColumn = await colOptions.getParentColumn();
        const parentTable = await parentColumn.getModel();
        const childTable = await childColumn.getModel();
        await childTable.getColumns();
        await parentTable.getColumns();

        const childTn = this.getTnPath(childTable);

        switch (colOptions.type) {
          case 'mm':
            {
              const vChildCol = await colOptions.getMMChildColumn();
              const vTable = await colOptions.getMMModel();

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
              const relatedTable = await colOptions.getRelatedTable();
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get({
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

      const source = await Source.get(this.model.source_id);

      // unlink LTAR data
      if (source.isMeta()) {
        for (const execQuery of execQueries) {
          queries.push(execQuery(this.dbDriver, qb.clone()).toQuery());
        }
      }

      queries.push(qb.clone().del().toQuery());

      let responses;

      if ((this.dbDriver as any).isExternal) {
        responses = await runExternal(queries, (this.dbDriver as any).extDb, {
          raw: true,
        });
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          responses = [];
          for (const q of queries) {
            const res = await trx.raw(q);
            responses.push(res);
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      const count = responses.pop()?.rowCount;

      await this.afterBulkDelete(count, this.dbDriver, cookie, true);

      return count;
    } catch (e) {
      throw e;
    }
  }
}

export {
  BaseModelSqlv2,
  _wherePk,
  extractCondition,
  extractFilterFromXwhere,
  extractSortsObject,
  getListArgs,
  haveFormulaColumn,
  getColumnName,
};
