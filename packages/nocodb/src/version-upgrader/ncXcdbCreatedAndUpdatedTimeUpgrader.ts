import { UITypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcUpgraderCtx } from './NcUpgrader';
import type { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { Column, Model } from '~/models';
import { getUniqueColumnAliasName, getUniqueColumnName } from '~/helpers/getUniqueName'
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT'
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2'
import { Altered } from '~/services/columns.service'

// An upgrader for upgrading created_at and updated_at columns
// to system column and convert to new uidt CreatedTime and LastModifiedTime

const logger = new Logger('ncXcdbCreatedAndUpdatedTimeUpgrader');

async function upgradeModels({
  ncMeta,
  source,
}: {
  ncMeta: MetaService;
  source: any;
}) {
  const models = await Model.list(
    {
      base_id: source.base_id,
      source_id: source.id,
    },
    ncMeta,
  );

  await Promise.all(
    models.map(async (model: any) => {
      const columns = await model.getColumns(ncMeta);
      let isCreatedTimeExists = false;
      let isLastModifiedTimeExists = false;
      for (const column of columns) {
        if (column.uidt !== UITypes.DateTime) continue;
        if (column.column_name === 'created_at') {
          isCreatedTimeExists = true;
          await Column.update(
            column.id,
            {
              uidt: UITypes.CreatedTime,
              system: true,
            },
            ncMeta,
          );
        }
        if (column.uidt === 'updated_at') {
          isLastModifiedTimeExists = true;
          await Column.update(
            column.id,
            {
              uidt: UITypes.LastModifiedTime,
              system: true,
            },
            ncMeta,
          );
        }
      }

      if(!isCreatedTimeExists || !isLastModifiedTimeExists) {
        // create created_at and updated_at columns

       /* if (!existingColumn) {
          columnName =
            colBody.uidt === UITypes.CreatedTime
              ? 'created_at'
              : 'updated_at';
          // const sqlClient = await reuseOrSave('sqlClient', reuse, async () =>
          //   NcConnectionMgrv2.getSqlClient(source),
          // );
          // const dbColumns = (
          //   await sqlClient.columnList({
          //     tn: table.table_name,
          //     schema: source.getConfig()?.schema,
          //   })
          // )?.data?.list;

          // todo:  check type as well
          const dbColumn = columns.find((c) => c.column_name === columnName);

          if (dbColumn) {
            columnName = getUniqueColumnName(columns, columnName);
          }

          {
            colBody = await getColumnPropsFromUIDT(colBody, source);

            // remove default value for SQLite since it doesn't support default value as function when adding column
            // only support default value as constant value
            if (source.type === 'sqlite3') {
              colBody.cdf = null;
            }

            // create column in db
            const tableUpdateBody = {
              ...table,
              tn: table.table_name,
              originalColumns: table.columns.map((c) => ({
                ...c,
                cn: c.column_name,
              })),
              columns: [
                ...table.columns.map((c) => ({ ...c, cn: c.column_name })),
                {
                  ...colBody,
                  cn: columnName,
                  altered: Altered.NEW_COLUMN,
                },
              ],
            };
            const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
              ProjectMgrv2.getSqlMgr({ id: source.base_id }),
            );
            await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
          }

          const title = getUniqueColumnAliasName(
            table.columns,
            UITypes.CreatedTime ? 'CreatedAt' : 'UpdatedAt',
          );

          await Column.insert({
            ...colBody,
            title,
            system: 1,
            fk_model_id: table.id,
            column_name: columnName,
          });
        }*/


      }

      logger.log(`Upgraded model ${model.name} from source ${source.name}`);
    }),
  );
}

// database to virtual relation and create an index for it
export default async function ({ ncMeta }: NcUpgraderCtx) {
  // get all xcdb sources
  const sources = await ncMeta.metaList2(null, null, MetaTable.BASES, {
    condition: {
      is_meta: 1,
    },
    orderBy: {},
  });

  // iterate and upgrade each base
  for (const source of sources) {
    logger.log(`Upgrading source ${source.name}`);
    // update the meta props
    await upgradeModels({ ncMeta, source });
  }
}
