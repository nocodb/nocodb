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

// An upgrader for adding created_by and updated_by columns to all tables as system column

const logger = new Logger('ncXcdbCreatedAndUpdatedByUpgrader');

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

      const newColumns = [];

      const columns = await model.getColumns(ncMeta);
      const oldColumns = columns.map((c) => ({ ...c, cn: c.column_name }));

      newColumns.push({
        ...(await getColumnPropsFromUIDT(
          {
            uidt: UITypes.CreatedBy,
            column_name: getUniqueColumnName(columns, 'created_by'),
            title: getUniqueColumnAliasName(columns, 'nc_created_by'),
          },
          source,
        )),
        cdf: null,
        system: true,
        altered: Altered.NEW_COLUMN,
      });

      newColumns.push({
        ...(await getColumnPropsFromUIDT(
          {
            uidt: UITypes.LastModifiedBy,
            column_name: getUniqueColumnName(columns, 'updated_by'),
            title: getUniqueColumnAliasName(columns, 'nc_updated_by'),
          },
          source,
        )),
        cdf: null,
        system: true,
        altered: Altered.NEW_COLUMN,
      });

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

      logger.log(`Upgraded model ${model.name} from source ${source.name}`);
    }),
  );
}

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
