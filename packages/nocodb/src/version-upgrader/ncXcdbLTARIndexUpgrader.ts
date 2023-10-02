import { Logger } from '@nestjs/common';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { MetaService } from '~/meta/meta.service';
import type { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '~/utils/globals';
import { Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Model } from '~/models';

const logger = new Logger('LTARIndexUpgrader');

// An upgrader for adding missing index of LTAR relations in XCDB sources
async function upgradeModelRelationsIndex({
  model,
  indexes,
  ncMeta,
  sqlClient,
}: {
  ncMeta: MetaService;
  model: Model;
  sqlClient: ReturnType<
    (typeof NcConnectionMgrv2)['getSqlClient']
  > extends Promise<infer U>
    ? U
    : ReturnType<(typeof NcConnectionMgrv2)['getSqlClient']>;
  indexes: {
    cn: string;
    key_name: string;

    type: string;
    rqd: boolean | number;
    cst: string;
    cstn: string;
  }[];
}) {
  // Iterate over each column and upgrade LTAR
  for (const column of await model.getColumns(ncMeta)) {
    if (column.uidt !== UITypes.LinkToAnotherRecord) {
      continue;
    }

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      ncMeta,
    );

    // if colOptions not found then skip
    if (!colOptions) {
      continue;
    }

    switch (colOptions.type) {
      // use belongs to since child column belongs to current table in that case
      case RelationTypes.BELONGS_TO:
        {
          // const parentCol = await colOptions.getParentColumn(ncMeta);
          const childCol = await colOptions.getChildColumn(ncMeta);

          // const parentModel = await parentCol.getModel(ncMeta);
          const childModel = await childCol.getModel(ncMeta);

          // check index already exists or not
          const indexExists = indexes.find((index) => {
            return index.cn === childCol.column_name;
          });

          if (indexExists) {
            continue;
          }

          logger.log(`Creating index for column '${childCol.column_name}'`);
          // create a new index for the column
          const indexArgs = {
            columns: [childCol.column_name],
            tn: childModel.table_name,
            non_unique: true,
          };
          await sqlClient.indexCreate(indexArgs);
        }
        break;
    }
  }
}

// An upgrader for adding missing index for LTAR relations in XCDB sources
async function upgradeBaseRelations({
  ncMeta,
  source,
}: {
  ncMeta: MetaService;
  source: Source;
}) {
  const sqlClient = await NcConnectionMgrv2.getSqlClient(source, ncMeta.knex);

  // get models for the base
  const models = await ncMeta.metaList2(null, source.id, MetaTable.MODELS);

  // get all columns and filter out relations and create index if not exists
  for (const model of models) {
    logger.log(`Upgrading model '${model.title}'`);

    logger.log(`Fetching index list of model '${model.title}'`);
    const indexes = await sqlClient.indexList({
      tn: model.table_name,
    });
    const indexList = indexes.data?.list ?? [];

    // exclude composite indexes
    const filteredIndexList = indexList.filter((indexObj, i) => {
      return indexList.every((indexObj2, j) => {
        if (i === j) return true;
        return indexObj2.key_name !== indexObj.key_name;
      });
    });

    await upgradeModelRelationsIndex({
      ncMeta,
      model: new Model(model),
      sqlClient,
      indexes: filteredIndexList,
    });
    logger.log(`Upgraded model '${model.title}'`);
  }
}

// Add missing index for LTAR relations
export default async function ({ ncMeta }: NcUpgraderCtx) {
  logger.log(
    'Starting upgrade for LTAR relations in XCDB sources to add missing index',
  );

  // get all xcdb sources
  const sources = await ncMeta.metaList2(null, null, MetaTable.BASES, {
    condition: {
      is_meta: 1,
    },
    orderBy: {},
  });

  if (!sources.length) return;

  // iterate and upgrade each base
  for (const _base of sources) {
    const source = new Source(_base);

    // skip if not pg, since for other db we don't need to upgrade
    if (ncMeta.knex.clientType() !== 'pg') {
      continue;
    }
    const base = await source.getProject(ncMeta);

    // skip deleted bases
    if (!base || base.deleted) continue;

    logger.log(`Upgrading source '${source.alias}'(${base.title})`);

    await upgradeBaseRelations({
      ncMeta,
      source,
    });

    logger.log(`Upgraded source '${source.alias}'(${base.title})`);
  }

  logger.log(
    'Finished upgrade for LTAR relations in XCDB sources to add missing index',
  );
}
