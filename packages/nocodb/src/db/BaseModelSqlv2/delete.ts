import { Logger } from '@nestjs/common';
import {
  AuditV1OperationTypes,
  extractFilterFromXwhere,
  isLinksOrLTAR,
  UITypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { NcRequest } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import { _wherePk, getCompositePkValue } from '~/helpers/dbHelpers';
import conditionV2 from '~/db/conditionV2';
import { Column, FileReference, Filter, Model } from '~/models';

export type ExecQueryType = (param: {
  trx: Knex.Transaction | CustomKnex;
  qb: any;
  ids: any[];
  rows: any[];
}) => any[];

export type MetaQueryType = (param: {
  qb: any;
  ids: any[];
  rows: any[];
}) => void | any;

// use class to support override
export class BaseModelDelete {
  constructor(protected readonly baseModel: IBaseModelSqlV2) {}
  logger = new Logger(BaseModelDelete.name);

  get isDbExternal() {
    return false;
  }

  async prepareBulkDeleteAll({
    args = {},
  }: {
    cookie: NcRequest;
    skip_hooks?: boolean;
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipPks?: string;
    };
  }) {
    const columns = await this.baseModel.model.getColumns(
      this.baseModel.context,
    );
    const { where } = this.baseModel._getListArgs(args);
    const qb = this.baseModel.dbDriver(this.baseModel.tnPath);
    const aliasColObjMap = await this.baseModel.model.getAliasColObjMap(
      this.baseModel.context,
      columns,
    );

    // If skipPks provided then add it in qb
    if (args.skipPks) {
      qb.where((innerQb) => {
        args.skipPks.split(',').forEach((pk) => {
          innerQb.andWhereNot(_wherePk(this.baseModel.model.primaryKeys, pk));
        });
        return innerQb;
      });
    }

    const { filters: filterObj } = extractFilterFromXwhere(
      this.baseModel.context,
      where,
      aliasColObjMap,
      true,
    );

    await conditionV2(
      this.baseModel,
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
          ? await Filter.rootFilterList(this.baseModel.context, {
              viewId: args.viewId,
            })
          : []),
      ],
      qb,
      undefined,
      true,
    );
    const execQueries: ExecQueryType[] = [];

    const metaQueries: MetaQueryType[] = [];
    const source = await this.baseModel.getSource();
    const isMeta = source.isMeta();

    for (const column of this.baseModel.model.columns) {
      // if not meta or has composite pk then do not care about links
      if (!isMeta || this.baseModel.model.primaryKeys.length > 1) break;
      if (!isLinksOrLTAR(column)) continue;

      const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
        this.baseModel.context,
      );

      const { refContext, mmContext, parentContext, childContext } =
        await colOptions.getParentChildContext(this.baseModel.context);

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
        dbDriver: this.baseModel.dbDriver,
      });

      const childTn = childBaseModel.getTnPath(childTable);

      switch (colOptions.type) {
        case 'mm':
          {
            const vChildCol = await colOptions.getMMChildColumn(mmContext);
            const vTable = await colOptions.getMMModel(mmContext);
            const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
              model: vTable,
              dbDriver: this.baseModel.dbDriver,
            });
            const vTn = assocBaseModel.getTnPath(vTable);

            execQueries.push(({ trx, ids }) => [
              trx(vTn).whereIn(vChildCol.column_name, ids).delete(),
            ]);
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

            execQueries.push(({ trx, ids }) => {
              const query = trx(childTn)
                .whereIn(childColumn.column_name, ids)
                .update({
                  [childColumn.column_name]: null,
                });
              return [query];
            });
          }
          break;
      }
    }

    // remove FileReferences for attachment fields
    const attachmentColumns = columns.filter(
      (c) => c.uidt === UITypes.Attachment,
    );

    metaQueries.push(async ({ rows }) => {
      const fileReferenceIds: string[] = [];
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
              // ignore error
            }
          }
        }
      }
      await FileReference.delete(this.baseModel.context, fileReferenceIds);
    });

    // delete the rows in table
    execQueries.push(({ trx, qb, ids }) => {
      if (this.baseModel.model.primaryKeys.length === 1) {
        return [
          (this.isDbExternal ? qb : qb.transacting(trx))
            .whereIn(this.baseModel.model.primaryKey.column_name, ids)
            .del(),
        ];
      } else {
        return ids.map((id) =>
          (this.isDbExternal ? qb : qb.transacting(trx))
            .where(_wherePk(this.baseModel.model.primaryKeys, id))
            .del(),
        );
      }
    });
    return {
      metaQueries,
      // TODO: exec queries returned can be
      // modified to just a single object and not array
      // inside, it'll promise.all
      execQueries,
      source,
      qb,
      attachmentColumns,
      filterObj,
    };
  }

  async executeBulkAll({
    execQueries,
    metaQueries,
    ids,
    rows,
    qb,
  }: {
    execQueries: ExecQueryType[];
    metaQueries: MetaQueryType[];
    ids: any[];
    rows: any[];
    qb: any;
  }) {
    const response: any[] = [];

    const oldRecords = await this.baseModel.list(
      {
        pks: ids
          .map((id) =>
            getCompositePkValue(this.baseModel.model.primaryKeys, id),
          )
          .join(','),
      },
      {
        limitOverride: ids.length,
        ignoreViewFilterAndSort: true,
      },
    );
    const trx = await this.baseModel.dbDriver.transaction();
    try {
      for (const execQuery of execQueries) {
        await Promise.all(execQuery({ trx, qb: qb.clone(), ids, rows }));
      }
      await trx.commit();
      response.push(...oldRecords);
    } catch (ex) {
      await trx.rollback();
      // silent error, may be improved to log into response
      this.logger.error(ex.message);
    }
    for (const metaQuery of metaQueries) {
      await metaQuery({ qb: qb.clone(), ids, rows });
    }
    return response;
  }

  async bulkAll(params: {
    cookie: NcRequest;
    skip_hooks?: boolean;
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipPks?: string;
    };
  }) {
    const { skip_hooks = false, cookie } = params;
    const { metaQueries, execQueries, qb, filterObj, attachmentColumns } =
      await this.prepareBulkDeleteAll(params);

    const offset = 0;
    const limit = 100;
    const response = [];

    // paginate all the records and find file reference ids
    const selectQb = qb
      .clone()
      .select(
        attachmentColumns
          .map((c) => c.column_name)
          .concat(this.baseModel.model.primaryKeys.map((pk) => pk.column_name)),
      );
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await this.baseModel.execAndParse(
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

      const chunkPrimaryKeyObjects = rows.map((row) => {
        const primaryData = {};

        for (const pk of this.baseModel.model.primaryKeys) {
          primaryData[pk.title] = row[pk.column_name];
        }
        return primaryData;
      }) as any[];
      const ids =
        this.baseModel.model.primaryKeys.length > 1
          ? chunkPrimaryKeyObjects
          : chunkPrimaryKeyObjects.map(
              (row) => row[this.baseModel.model.primaryKey.title],
            );

      const chunkResponse = await this.executeBulkAll({
        execQueries,
        metaQueries,
        ids,
        rows,
        qb,
      });
      response.push(...chunkResponse);
      // insert records updating record details to audit table
      await this.baseModel.bulkAudit({
        qb: qb.clone(),
        conditions: filterObj,
        req: cookie,
        event: AuditV1OperationTypes.DATA_BULK_DELETE,
      });

      if (!skip_hooks) {
        await this.baseModel.afterBulkDelete(
          chunkResponse,
          this.baseModel.dbDriver,
          cookie,
          true,
        );
      }

      if (lastPage) {
        break;
      }
    }
    return response;
  }
}
