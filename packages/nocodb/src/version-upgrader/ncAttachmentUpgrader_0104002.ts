import { UITypes } from 'nocodb-sdk';
import { throwTimeoutError } from './ncUpgradeErrors';
import type { XKnex } from '~/db/CustomKnex';
import type { Knex } from 'knex';
import type { NcUpgraderCtx } from './NcUpgrader';
import type { SourceType } from 'nocodb-sdk';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Model from '~/models/Model';
import Source from '~/models/Source';
import { MetaTable } from '~/utils/globals';

// after 0101002 upgrader, the attachment object would become broken when
// (1) switching views after updating a singleSelect field
// since `url` will be enriched the attachment cell, and `saveOrUpdateRecords` in Grid.vue will be triggered
// in this way, the attachment value will be corrupted like
// {"{\"path\":\"download/noco/xcdb2/attachment2/a/JRubxMQgPlcumdm3jL.jpeg\",\"title\":\"haha.jpeg\",\"mimetype\":\"image/jpeg\",\"size\":6494,\"url\":\"http://localhost:8080/download/noco/xcdb2/attachment2/a/JRubxMQgPlcumdm3jL.jpeg\"}"}
// while the expected one is
// [{"path":"download/noco/xcdb2/attachment2/a/JRubxMQgPlcumdm3jL.jpeg","title":"haha.jpeg","mimetype":"image/jpeg","size":6494}]
// (2) or reordering attachments
// since the incoming value is not string, the value will be broken
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
  const sources: SourceType[] = await ncMeta.metaList2(
    null,
    null,
    MetaTable.BASES,
  );
  for (const _base of sources) {
    const source = new Source(_base);

    // skip if the base_id is missing
    if (!source.base_id) {
      continue;
    }

    const base = await ncMeta.metaGet2(null, null, MetaTable.PROJECT, {
      id: source.base_id,
    });

    // skip if the base is missing
    if (!base) {
      continue;
    }

    const isProjectDeleted = base.deleted;

    const knex: Knex = source.is_meta
      ? ncMeta.knexConnection
      : await NcConnectionMgrv2.get(source);
    const models = await source.getModels(ncMeta);

    // used in timeout error message
    const timeoutErrorInfo = {
      baseTitle: base.title,
      connection: knex.client.config.connection,
    };

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
                  column.column_name,
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
                      corruptedAttachment.length - 1,
                    )}]`,
                  );
                  const newAttachmentMeta = [];
                  for (const attachment of corruptedAttachment) {
                    newAttachmentMeta.push(JSON.parse(attachment));
                  }
                  updateRecords.push(
                    await knex(getTnPath(knex, model))
                      .update({
                        [attachmentColumn]: JSON.stringify(newAttachmentMeta),
                      })
                      .where(where),
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
        // ignore the error related to deleted base
        if (!isProjectDeleted) {
          // throw the custom timeout error message if applicable
          throwTimeoutError(e, timeoutErrorInfo);
          // throw general error
          throw e;
        }
      }
    }
  }
}
