import { UITypes } from 'nocodb-sdk';
import { throwTimeoutError } from './ncUpgradeErrors';
import type { XKnex } from '~/db/CustomKnex';
import type { Knex } from 'knex';
import type { NcUpgraderCtx } from './NcUpgrader';
// import type { XKnex } from '~/db/sql-data-mapper';
import type { SourceType } from 'nocodb-sdk';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Model from '~/models/Model';
import Source from '~/models/Source';
import { MetaTable } from '~/utils/globals';

// before 0.103.0, an attachment object was like
// [{
//   "url": "http://localhost:8080/download/noco/xcdb/Sheet-1/title5/39A410.jpeg",
//   "title": "foo.jpeg",
//   "mimetype": "image/jpeg",
//   "size": 6494
// }]
// in this way, if the base url is changed, the url will be broken
// this upgrader is to convert the existing local attachment object to the following format
// [{
//   "url": "http://localhost:8080/download/noco/xcdb/Sheet-1/title5/39A410.jpeg",
//   "path": "download/noco/xcdb/Sheet-1/title5/39A410.jpeg",
//   "title": "foo.jpeg",
//   "mimetype": "image/jpeg",
//   "size": 6494
// }]
// the new url will be constructed by `${ncSiteUrl}/${path}` in UI. the old url will be used for fallback
// while other non-local attachments will remain unchanged

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
          for (const attachmentColumn of attachmentColumns) {
            let attachmentMeta: Array<{
              url: string;
            }>;

            // if parsing failed ignore the cell
            try {
              attachmentMeta =
                typeof record[attachmentColumn] === 'string'
                  ? JSON.parse(record[attachmentColumn])
                  : record[attachmentColumn];
            } catch {}

            // if cell data is not an array, ignore it
            if (!Array.isArray(attachmentMeta)) {
              continue;
            }

            if (attachmentMeta) {
              const newAttachmentMeta = [];
              for (const attachment of attachmentMeta) {
                if ('url' in attachment && typeof attachment.url === 'string') {
                  const match = attachment.url.match(/^(.*)\/download\/(.*)$/);
                  if (match) {
                    // e.g. http://localhost:8080/download/noco/xcdb/Sheet-1/title5/ee2G8p_nute_gunray.png
                    // match[1] = http://localhost:8080
                    // match[2] = download/noco/xcdb/Sheet-1/title5/ee2G8p_nute_gunray.png
                    const path = `download/${match[2]}`;

                    newAttachmentMeta.push({
                      ...attachment,
                      path,
                    });
                  } else {
                    // keep it as it is
                    newAttachmentMeta.push(attachment);
                  }
                }
              }
              const where = primaryKeys
                .map((key) => {
                  return { [key]: record[key] };
                })
                .reduce((acc, val) => Object.assign(acc, val), {});
              updateRecords.push(
                await knex(getTnPath(knex, model))
                  .update({
                    [attachmentColumn]: JSON.stringify(newAttachmentMeta),
                  })
                  .where(where),
              );
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
