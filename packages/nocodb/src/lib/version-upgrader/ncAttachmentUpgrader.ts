import { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '../utils/globals';
import Base from '../models/Base';
import Model from '../models/Model';
import { XKnex } from '../db/sql-data-mapper/index';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { UITypes } from 'nocodb-sdk';

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
    return knex.raw('??.??', [schema, tb.table_name]);
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
  const bases: Base[] = await ncMeta.metaList2(null, null, MetaTable.BASES);
  for (const base of bases) {
    const knex: XKnex = base.is_meta
      ? ncMeta.knexConnection
      : NcConnectionMgrv2.get(base);
    const models = await (await Base.get(base.id, ncMeta)).getModels(ncMeta);
    for (const model of models) {
      const updateRecords = [];
      const columns = await (
        await Model.get(model.id, ncMeta)
      ).getColumns(ncMeta);
      const attachmentColumns = columns
        .filter((c) => c.uidt === UITypes.Attachment)
        .map((c) => c.column_name);
      if (attachmentColumns.length === 0) {
        continue;
      }
      const primaryKeys = columns.filter((c) => c.pk).map((c) => c.column_name);
      const records = await knex(getTnPath(knex, model)).select([
        ...primaryKeys,
        ...attachmentColumns,
      ]);
      for (const record of records) {
        for (const attachmentColumn of attachmentColumns) {
          const attachmentMeta =
            typeof record[attachmentColumn] === 'string'
              ? JSON.parse(record[attachmentColumn])
              : record[attachmentColumn];
          if (attachmentMeta) {
            const newAttachmentMeta = [];
            for (const attachment of attachmentMeta) {
              if ('url' in attachment) {
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
                .where(where)
            );
          }
        }
      }
      await Promise.all(updateRecords);
    }
  }
}
