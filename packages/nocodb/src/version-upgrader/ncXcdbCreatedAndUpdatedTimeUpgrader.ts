import { UITypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcUpgraderCtx } from './NcUpgrader';
import type { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { Column, Model } from '~/models';

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
      for (const column of columns) {
        if(column.uidt !== UITypes.DateTime) continue;
        if (column.column_name === 'created_at') {
          await Column.update(column.id, {
            uidt: UITypes.CreatedTime,
            system: true,
          });
        }
        if (column.uidt === 'updated_at') {
          await Column.update(column.id, {
            uidt: UITypes.LastModifiedTime,
            system: true,
          });
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
