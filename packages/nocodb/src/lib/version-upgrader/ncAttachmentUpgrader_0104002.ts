import { Knex } from 'knex';
import { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '../utils/globals';
import Base from '../models/Base';
import Model from '../models/Model';
import { XKnex } from '../db/sql-data-mapper/index';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { BaseType, UITypes } from 'nocodb-sdk';

// after 0101002 upgrader, the attachment object would be unexpectedly saved when switching views after updating a singleSelect field
// since `url` will be enriched the attachment cell, and `saveOrUpdateRecords` in Grid.vue will be triggered
// in this way, the attachment value will be corrupted like
// {"{\"path\":\"download/noco/xcdb2/attachment2/a/JRubxMQgPlcumdm3jL.jpeg\",\"title\":\"haha.jpeg\",\"mimetype\":\"image/jpeg\",\"size\":6494,\"url\":\"http://localhost:8080/download/noco/xcdb2/attachment2/a/JRubxMQgPlcumdm3jL.jpeg\"}"}
// while the expected one is
// [{"path":"download/noco/xcdb2/attachment2/a/JRubxMQgPlcumdm3jL.jpeg","title":"haha.jpeg","mimetype":"image/jpeg","size":6494}]
// hence, this upgrader is to revert back these corrupted values

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

    const isProjectDeleted = project.deleted;

    const knex: Knex = base.is_meta
      ? ncMeta.knexConnection
      : NcConnectionMgrv2.get(base);
    const models = await base.getModels(ncMeta);

    for (const model of models) {
      try {
        // if the table is missing in database, skip
        if (!(await knex.schema.hasTable(getTnPath(knex, model)))) {
          continue;
        }

        const updateRecords = [];

        // get all attachment & primary key columns
        // and filter out the columns that are missing in database
        const columns = await (await Model.get(model.id, ncMeta))
          .getColumns(ncMeta)
          .then(async (columns) => {
            const filteredColumns = [];

            for (const column of columns) {
              if (column.uidt !== UITypes.Attachment && !column.pk) continue;
              if (
                !(await knex.schema.hasColumn(
                  getTnPath(knex, model),
                  column.column_name
                ))
              )
                continue;
              filteredColumns.push(column);
            }

            return filteredColumns;
          });

        const attachmentColumns = columns
          .filter((c) => c.uidt === UITypes.Attachment)
          .map((c) => c.column_name);
        if (attachmentColumns.length === 0) {
          continue;
        }
        const primaryKeys = columns
          .filter((c) => c.pk)
          .map((c) => c.column_name);

        const records = await knex(getTnPath(knex, model)).select();

        for (const record of records) {
          const where = primaryKeys
            .map((key) => {
              return { [key]: record[key] };
            })
            .reduce((acc, val) => Object.assign(acc, val), {});
          for (const attachmentColumn of attachmentColumns) {
            if (typeof record[attachmentColumn] === 'string') {
              // potentially corrupted
              try {
                JSON.parse(record[attachmentColumn]);
                // it works fine - skip
                continue;
              } catch {
                try {
                  // corrupted
                  let corruptedAttachment = record[attachmentColumn];
                  // replace the first and last character with `[` and `]`
                  // and parse it again
                  corruptedAttachment = JSON.parse(
                    `[${corruptedAttachment.slice(
                      1,
                      corruptedAttachment.length - 1
                    )}]`
                  );
                  let newAttachmentMeta = [];
                  for (const attachment of corruptedAttachment) {
                    newAttachmentMeta.push(JSON.parse(attachment));
                  }
                  updateRecords.push(
                    await knex(getTnPath(knex, model))
                      .update({
                        [attachmentColumn]: JSON.stringify(newAttachmentMeta),
                      })
                      .where(where)
                  );
                } catch {
                  // if parsing failed ignore the cell
                  continue;
                }
              }
            }
          }
        }
        await Promise.all(updateRecords);
      } catch (e) {
        // ignore the error related to deleted project
        if (!isProjectDeleted) {
          throw e;
        }
      }
    }
  }
}
