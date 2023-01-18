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
// this upgrader is to convert the existing attachment object to the following format
// [{
//   "path": "download/noco/xcdb/Sheet-1/title5/39A410.jpeg",
//   "title": "foo.jpeg",
//   "mimetype": "image/jpeg",
//   "size": 6494
// }]
// the url will be constructed by `${ncSiteUrl}/${path}`.

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
  // const attachmentColumns = await ncMeta.metaList2(
  //   null,
  //   null,
  //   MetaTable.COLUMNS,
  //   {
  //     condition: {
  //       uidt: UITypes.Attachment,
  //     },
  //   }
  // );
  // // groupByBase[base] = { base, table_name: [], column_name: [] };
  // const groupByBase: Record<string, any>;
  // for (const attachmentColumn of attachmentColumns) {
  //   //
  // }

  const bases = await ncMeta.metaList2(null, null, MetaTable.BASES);

  for (const base of bases) {
    const knex: XKnex = NcConnectionMgrv2.get(base);
    const models = await (await Base.get(base.id)).getModels();
    for (const model of models) {
      const updateRecords = [];
      const columns = await (await Model.get(model.id)).getColumns();
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
        console.log(record);
        for (const attachmentColumn of attachmentColumns) {
          let attachmentMeta =
            typeof record[attachmentColumn] === 'string'
              ? JSON.parse(record[attachmentColumn])
              : record[attachmentColumn];
          if (attachmentMeta) {
            if ('url' in attachmentMeta) {
              const ncSiteUrl = 'TODO';
              const path = attachmentMeta.url.split(ncSiteUrl)[1];
              if (path) {
                attachmentMeta = {
                  path,
                  ...attachmentMeta,
                };
              }
              delete attachmentMeta['url'];
              console.log(
                'update',
                knex(getTnPath(knex, model))
                  .update({ meta: attachmentMeta })
                  .where(primaryKeys.map((pk) => ({ [pk]: record[pk] })))
                  .toQuery()
              );
              updateRecords.push(
                await knex(getTnPath(knex, model))
                  .update({ meta: attachmentMeta })
                  .where(primaryKeys.map((pk) => ({ [pk]: record[pk] })))
              );
            }
          }
        }
      }
      await Promise.all(updateRecords);
    }
  }
}
