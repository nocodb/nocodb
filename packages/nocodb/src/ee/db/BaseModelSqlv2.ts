import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  UITypes,
} from 'nocodb-sdk';
import {
  _wherePk,
  BaseModelSqlv2 as BaseModelSqlv2CE,
  extractCondition,
  extractFilterFromXwhere,
  extractSortsObject,
  getListArgs,
  populatePk,
} from 'src/db/BaseModelSqlv2';
import DOMPurify from 'isomorphic-dompurify';
import axios from 'axios';
import type { Knex } from 'knex';
import type { Column, Model } from '~/models';
import { Audit, ModelStat, Source } from '~/models';
import { getSingleQueryReadFn } from '~/services/data-opt/helpers';
import { canUseOptimisedQuery } from '~/utils';
import { extractProps } from '~/helpers/extractProps';
import {
  UPDATE_MODEL_STAT,
  UPDATE_WORKSPACE_COUNTER,
} from '~/services/update-stats.service';
import Noco from '~/Noco';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { NcError } from '~/helpers/catchError';
import { sanitize, unsanitize } from '~/helpers/sqlSanitize';

async function runExternal(query: string, config: any) {
  const { data } = await axios.post(`http://localhost:9000/query`, {
    query,
    config,
  });
  return data;
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
  ) {
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
      data =
        this.isPg || this.isSnowflake
          ? (await this.dbDriver.raw(query))?.rows
          : query.slice(0, 6) === 'select' && !this.isMssql
          ? await this.dbDriver.from(
              this.dbDriver.raw(query).wrap('(', ') __nc_alias'),
            )
          : await this.dbDriver.raw(query);
    }

    // update attachment fields
    data = await this.convertAttachmentType(data, childTable);

    // update date time fields
    data = this.convertDateFormat(data, childTable);

    return data;
  }

  public async execAndParseFirst(
    qb: Knex.QueryBuilder | string,
    childTable?: Model,
  ) {
    if (typeof qb !== 'string') {
      qb = qb.limit(1);
    }
    return (await this.execAndParse(qb, childTable))?.[0];
  }

  public async execRaw(qb: Knex.QueryBuilder | string) {
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
      data =
        this.isPg || this.isSnowflake
          ? (await this.dbDriver.raw(query))?.rows
          : query.slice(0, 6) === 'select' && !this.isMssql
          ? await this.dbDriver.from(
              this.dbDriver.raw(query).wrap('(', ') __nc_alias'),
            )
          : await this.dbDriver.raw(query);
    }

    return data;
  }

  public async execRawFirst(qb: Knex.QueryBuilder | string) {
    if (typeof qb !== 'string') {
      qb = qb.limit(1);
    }
    return (await this.execRaw(qb))?.[0];
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

      await this.prepareAttachmentData(insertObj);

      await this.model.getColumns();
      let response;
      // const driver = trx ? trx : this.dbDriver;

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
              id: data[ag.title],
              params: {},
              view: null,
              source,
              getHiddenColumn: true,
            })
          : this.readByPk(
              data[ag.title],
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
          ? response?.[0]?.[ai.title]
          : response?.[ai.title];
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

      await this.execAndParse(query);

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

  prepareAttachmentData(data) {
    if (this.model.columns.some((c) => c.uidt === UITypes.Attachment)) {
      for (const column of this.model.columns) {
        if (column.uidt === UITypes.Attachment) {
          if (data[column.column_name]) {
            if (Array.isArray(data[column.column_name])) {
              for (let attachment of data[column.column_name]) {
                attachment = extractProps(attachment, [
                  'url',
                  'path',
                  'title',
                  'mimetype',
                  'size',
                  'icon',
                ]);
              }
            }
          }
        }
      }
    }
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
}

export {
  BaseModelSqlv2,
  _wherePk,
  extractCondition,
  extractFilterFromXwhere,
  extractSortsObject,
  getListArgs,
};
