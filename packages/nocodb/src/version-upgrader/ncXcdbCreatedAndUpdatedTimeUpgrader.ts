import { UITypes } from 'nocodb-sdk';
import type { NcUpgraderCtx } from './NcUpgrader';
import type { MetaService } from '~/meta/meta.service';
import type { Base } from '~/models';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Source } from '~/models';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from '~/services/columns.service';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import getColumnUiType from '~/helpers/getColumnUiType';
import RequestQueue from '~/utils/RequestQueue';

// Example Usage:

// An upgrader for upgrading created_at and updated_at columns
// to system column and convert to new uidt CreatedTime and LastModifiedTime

const logger = {
  log: (message: string) => {
    console.log(
      `[ncXcdbCreatedAndUpdatedTimeUpgrader ${Date.now()}] ` + message,
    );
  },
};

/* Enable if planning to remove trigger
async function deletePgTrigger({
  column,
  ncMeta,
  model,
}: {
  ncMeta: MetaService;
  column: Column;
  model: Model;
}) {
  // delete pg trigger
  const triggerFnName = `xc_au_${model.table_name}_${column.column_name}`;
  const triggerName = `xc_trigger_${model.table_name}_${column.column_name}`;

  await ncMeta.knex.raw(`DROP TRIGGER IF EXISTS ?? ON ??;`, [
    triggerName,
    model.table_name,
  ]);
  await ncMeta.knex.raw(`DROP FUNCTION IF EXISTS ??()`, [triggerFnName]);
}
*/

async function upgradeModels({
  ncMeta,
  source,
  base,
}: {
  ncMeta: MetaService;
  source: Source;
  base: Base;
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
      if (model.mm) return;

      logger.log(
        `Upgrading model '${model.title}'(${model.id}) from base '${base.title}'(${base.id}})`,
      );

      const columns = await model.getColumns(ncMeta);
      const oldColumns = columns.map((c) => ({ ...c, cn: c.column_name }));
      let isCreatedTimeExists = false;
      let isLastModifiedTimeExists = false;
      for (const column of columns) {
        if (column.uidt !== UITypes.DateTime) continue;

        // if column is created_at or updated_at, update the uidt in meta
        if (column.column_name === 'created_at') {
          isCreatedTimeExists = true;
          await Column.update(
            column.id,
            {
              ...column,
              uidt: UITypes.CreatedTime,
              system: true,
            },
            ncMeta,
            true,
          );

          /*   Enable if planning to remove trigger
          if (source.type === 'pg') {
            // delete pg trigger if exists
            await deletePgTrigger({ column, ncMeta, model });
          }*/
        }
        if (column.column_name === 'updated_at') {
          isLastModifiedTimeExists = true;
          await Column.update(
            column.id,
            {
              ...column,
              uidt: UITypes.LastModifiedTime,
              system: true,
              cdf: '',
              au: false,
            },
            ncMeta,
            true,
          );
        }
      }

      if (!isCreatedTimeExists || !isLastModifiedTimeExists) {
        // get existing columns from database

        const sqlClient = await NcConnectionMgrv2.getSqlClient(
          source,
          ncMeta.knex,
        );

        const dbColumns =
          (
            await sqlClient.columnList({
              tn: model.table_name,
              schema: source.getConfig()?.schema,
            })
          )?.data?.list?.map((c) => ({ ...c, column_name: c.cn })) || [];

        // if no columns found skip since table might not be there
        if (!dbColumns.length) {
          logger.log(
            `Skipping upgrade of model '${model.title}'(${model.id}) from base '${base.title}'(${base.id}}) since columns not found`,
          );
          return;
        }

        // create created_at and updated_at columns
        const newColumns = [];
        const existingDbColumns = [];

        if (!isCreatedTimeExists) {
          // check column exist and add to meta if found
          const columnName = getUniqueColumnName(columns, 'created_at');
          const dbColumn = dbColumns.find((c) => c.cn === columnName);

          // if column already exist, just update the meta
          if (
            dbColumn &&
            getColumnUiType(source, dbColumn) === UITypes.DateTime
          ) {
            existingDbColumns.push({
              ...dbColumn,
              uidt: UITypes.CreatedTime,
              column_name: columnName,
              title: getUniqueColumnAliasName(columns, 'CreatedAt'),
              system: true,
            });
          } else {
            newColumns.push({
              ...(await getColumnPropsFromUIDT(
                {
                  uidt: UITypes.CreatedTime,
                  column_name: getUniqueColumnName(
                    [...columns, ...dbColumns],
                    'created_at',
                  ),
                  title: getUniqueColumnAliasName(columns, 'CreatedAt'),
                },
                source,
              )),
              cdf: null,
              system: true,
              altered: Altered.NEW_COLUMN,
            });
          }
        }

        if (!isLastModifiedTimeExists) {
          const columnName = getUniqueColumnName(columns, 'created_at');
          const dbColumn = dbColumns.find((c) => c.cn === columnName);

          // if column already exist, just update the meta
          if (
            dbColumn &&
            getColumnUiType(source, dbColumn) === UITypes.DateTime
          ) {
            existingDbColumns.push({
              uidt: UITypes.LastModifiedTime,
              ...dbColumn,
              column_name: columnName,
              title: getUniqueColumnAliasName(columns, 'UpdatedAt'),
              system: true,
            });
          } else {
            newColumns.push({
              ...(await getColumnPropsFromUIDT(
                {
                  uidt: UITypes.LastModifiedTime,
                  column_name: getUniqueColumnName(
                    [...columns, ...dbColumns],
                    'updated_at',
                  ),
                  title: getUniqueColumnAliasName(columns, 'UpdatedAt'),
                },
                source,
              )),
              cdf: null,
              system: true,
              altered: Altered.NEW_COLUMN,
            });
          }
        }

        // alter table and add new columns if any
        if (newColumns.length) {
          logger.log(
            `Altering table '${model.title}'(${model.id}) from base '${base.title}'(${base.id}}) for new columns`,
          );
          // update column in db
          const tableUpdateBody = {
            ...model,
            tn: model.table_name,
            originalColumns: oldColumns,
            columns: [...columns, ...newColumns].map((c) => ({
              ...c,
              cn: c.column_name,
            })),
          };
          const sqlMgr = ProjectMgrv2.getSqlMgr({ id: source.base_id }, ncMeta);
          await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
        }
        for (const newColumn of [...existingDbColumns, ...newColumns]) {
          await Column.insert(
            {
              ...newColumn,
              system: 1,
              fk_model_id: model.id,
            },
            ncMeta,
          );
        }
      }

      logger.log(
        `Upgraded model '${model.title}'(${model.id}) from base '${base.title}'(${base.id}})`,
      );
    }),
  );
}

// database to virtual relation and create an index for it
export default async function ({ ncMeta }: NcUpgraderCtx) {
  // get all xcdb sources
  const sources = await ncMeta.metaList2(null, null, MetaTable.BASES, {
    xcCondition: {
      _or: [
        {
          is_meta: {
            eq: 1,
          },
        },
        {
          is_local: {
            eq: 1,
          },
        },
      ],
    },
  });

  const requestQueue = new RequestQueue();
  // iterate and upgrade each base
  await Promise.all(
    sources.map(async (_source, i) => {
      const source = new Source(_source);

      const base = await source.getProject(ncMeta);

      // skip deleted base bases
      if (!base || base.deleted) {
        logger.log(
          `Skipped deleted base source '${source.alias || source.id}' - ${
            base.id
          }`,
        );
        return Promise.resolve();
      }

      // update the meta props
      return requestQueue.enqueue(async () => {
        logger.log(
          `Upgrading base ${base.title}(${base.id},${source.id}) (${i + 1}/${
            sources.length
          })`,
        );

        return upgradeModels({ ncMeta, source, base }).then(() => {
          logger.log(
            `Upgraded base '${base.title}'(${base.id},${source.id}) (${i + 1}/${
              sources.length
            })`,
          );
        });
      });
    }),
  );
}
