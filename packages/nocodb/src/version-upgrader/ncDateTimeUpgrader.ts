import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { UITypes } from 'nocodb-sdk';
import { MetaTable } from '../utils/globals';
import Base from '../models/Base';
import Model from '../models/Model';
import { throwTimeoutError } from './ncUpgradeErrors';
import type { BaseType } from 'nocodb-sdk';
import type { NcUpgraderCtx } from './NcUpgrader';
import type { XKnex } from '../db/CustomKnex';
import type { Knex } from 'knex';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';

dayjs.extend(utc);

function getTnPath(knex: XKnex, tb: Model) {
  const schema = (knex as any).searchPath?.();
  const clientType = knex.clientType();
  if (clientType === 'mssql' && schema) {
    return knex.raw('??.??', [schema, tb.table_name]).toQuery();
  } else if (clientType === 'snowflake') {
    return [
      knex.client.config.connection.database,
      knex.client.config.connection.schema,
      tb.table_name,
    ].join('.');
  } else {
    return tb.table_name;
  }
}

function getTriggerPath(knex: XKnex, trigger: any) {
  const schema = (knex as any).searchPath?.();
  const clientType = knex.clientType();
  if (clientType === 'mssql' && schema) {
    return knex.raw('??.??', [schema, trigger.trigger_name]).toQuery();
  } else if (clientType === 'snowflake') {
    return [
      knex.client.config.connection.database,
      knex.client.config.connection.schema,
      trigger.trigger_name,
    ].join('.');
  } else {
    return trigger.trigger_name;
  }
}

// This upgrader is to update all datetime fields in xcdb base due to the datetime changes
// ref: https://github.com/nocodb/nocodb/pull/5505
// Originally, for XCDB-based projects, we store the local time in DB and display local time in UI
// After the above PR, we store UTC time in DB and display local time in UI
// Therefore, we convert all the target datetime to UTC format in DB
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const bases: BaseType[] = await ncMeta.metaList2(null, null, MetaTable.BASES);
  for (const _base of bases) {
    const base = new Base(_base);

    // skip if the project_id is missing
    if (!base.project_id) {
      continue;
    }

    const project = await ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
      id: base.project_id,
    });

    // skip if the project is missing
    if (!project) {
      continue;
    }

    // skip if the base is not meta
    if (!base.is_meta) {
      continue;
    }

    const isProjectDeleted = project.deleted;

    const knex: Knex = ncMeta.knexConnection;

    const models = await base.getModels(ncMeta);

    // used in timeout error message
    const timeoutErrorInfo = {
      projectTitle: project.title,
      connection: knex.client.config.connection,
    };

    for (const model of models) {
      let disableTriggers = [];
      let enableTriggers = [];

      try {
        // if the table is missing in database, skip
        if (!(await knex.schema.hasTable(getTnPath(knex, model)))) {
          continue;
        }

        // for normal date time fields
        const updateRecords = [];
        // for fields with auto update (e.g. updated_at)
        const updatedAtRecords = [];

        // get all date times columns
        // and filter out the columns that are missing in database
        const columns = await (await Model.get(model.id, ncMeta))
          .getColumns(ncMeta)
          .then(async (columns) => {
            const filteredColumns = [];
            for (const column of columns) {
              if (column.uidt !== UITypes.DateTime && !column.pk) continue;
              if (
                !(await knex.schema.hasColumn(
                  getTnPath(knex, model),
                  column.column_name,
                ))
              )
                continue;
              filteredColumns.push(column);
            }
            return filteredColumns;
          });

        const dateTimeColumns = columns.filter(
          (c) => c.uidt === UITypes.DateTime,
        );

        if (dateTimeColumns.length === 0) {
          continue;
        }

        const primaryKeys = columns
          .filter((c) => c.pk)
          .map((c) => c.column_name);

        // disable triggers for pg / mssql
        if (knex.clientType() === 'pg' || knex.clientType() === 'mssql') {
          // get sql clients
          const sqlClient = await NcConnectionMgrv2.getSqlClient(base);

          const triggerList = (
            await sqlClient.triggerList({
              tn: model.table_name,
            })
          ).data.list;
          for (const trigger of triggerList) {
            disableTriggers.push(
              knex.raw('ALTER TABLE ?? DISABLE TRIGGER ??', [
                getTnPath(knex, model),
                getTriggerPath(knex, trigger),
              ]),
            );
            enableTriggers.push(
              knex.raw('ALTER TABLE ?? ENABLE TRIGGER ??', [
                getTnPath(knex, model),
                getTriggerPath(knex, trigger),
              ]),
            );
          }
          await Promise.all(disableTriggers);
        }

        const records = await knex(getTnPath(knex, model)).select();

        for (const record of records) {
          const where = primaryKeys
            .map((key) => {
              return { [key]: record[key] };
            })
            .reduce((acc, val) => Object.assign(acc, val), {});

          for (const dateTimeColumn of dateTimeColumns) {
            if (!record[dateTimeColumn.column_name]) {
              // skip null case
              continue;
            }
            const action = knex(getTnPath(knex, model))
              .update({
                [dateTimeColumn.column_name]: dayjs(
                  record[dateTimeColumn.column_name],
                )
                  .utc()
                  .format(
                    knex.clientType().startsWith('mysql')
                      ? 'YYYY-MM-DD HH:mm:ss'
                      : 'YYYY-MM-DD HH:mm:ssZ',
                  ),
              })
              .where(where);
            if (
              dateTimeColumn.cdf ===
              'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP'
            ) {
              updatedAtRecords.push(action);
            } else {
              updateRecords.push(action);
            }
          }
        }
        // update those general date time fields first
        await Promise.all(updateRecords);
        // updated_at will be modified due to above change
        // update those right here
        await Promise.all(updatedAtRecords);
      } catch (e) {
        // ignore the error related to deleted project
        if (!isProjectDeleted) {
          // throw the custom timeout error message if applicable
          throwTimeoutError(e, timeoutErrorInfo);
          // throw general error
          throw e;
        }
      } finally {
        // enable triggers for pg / mssql back
        if (knex.clientType() === 'pg' || knex.clientType() === 'mssql') {
          await Promise.all(enableTriggers);
        }
      }
    }
  }
}
