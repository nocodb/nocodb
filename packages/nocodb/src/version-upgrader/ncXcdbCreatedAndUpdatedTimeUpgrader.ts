import { UITypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcUpgraderCtx } from './NcUpgrader';
import type { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Source } from '~/models';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from '~/services/columns.service';

// An upgrader for upgrading created_at and updated_at columns
// to system column and convert to new uidt CreatedTime and LastModifiedTime

const logger = new Logger('ncXcdbCreatedAndUpdatedTimeUpgrader');

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
      if (model.mm) return;

      const columns = await model.getColumns(ncMeta);
      const oldColumns = columns.map((c) => ({ ...c, cn: c.column_name }));
      let isCreatedTimeExists = false;
      let isLastModifiedTimeExists = false;
      for (const column of columns) {
        if (column.uidt !== UITypes.DateTime) continue;
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
          );
        }
      }

      if (!isCreatedTimeExists || !isLastModifiedTimeExists) {
        // create created_at and updated_at columns

        const newColumns = [];

        if (!isCreatedTimeExists) {
          newColumns.push({
            ...(await getColumnPropsFromUIDT(
              {
                uidt: UITypes.CreatedTime,
                column_name: getUniqueColumnName(columns, 'created_at'),
                title: getUniqueColumnAliasName(columns, 'Created At'),
              },
              source,
            )),
            cdf: null,
            system: true,
            altered: Altered.NEW_COLUMN,
          });
        }

        if (!isLastModifiedTimeExists) {
          newColumns.push({
            ...(await getColumnPropsFromUIDT(
              {
                uidt: UITypes.LastModifiedTime,
                column_name: getUniqueColumnName(columns, 'updated_at'),
                title: getUniqueColumnAliasName(columns, 'Updated At'),
              },
              source,
            )),
            cdf: null,
            system: true,
            altered: Altered.NEW_COLUMN,
          });
        }

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

        for (const newColumn of newColumns) {
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

      logger.log(`Upgraded model ${model.name} from source ${source.name}`);
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

  // iterate and upgrade each base
  for (const source of sources) {
    logger.log(`Upgrading source ${source.name}`);
    // update the meta props
    await upgradeModels({ ncMeta, source: new Source(source) });
  }
}
