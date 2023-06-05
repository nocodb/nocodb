import { RelationTypes, UITypes } from 'nocodb-sdk';
import ProjectMgrv2 from '../db/sql-mgr/v2/ProjectMgrv2';
import type SqlMgrv2 from '../db/sql-mgr/v2/SqlMgrv2';
import type { MetaService } from '../meta/meta.service';
import type { LinkToAnotherRecordColumn, Model } from '../models';
import type { NcUpgraderCtx } from './NcUpgrader';

async function upgradeModelRelations({
  model,
  sqlMgr,
  ncMeta,
}: {
  ncMeta: MetaService;
  model: Model;
  sqlMgr: SqlMgrv2;
}) {
  // Iterate over each column and upgrade LTAR
  for (const column of await model.getColumns()) {
    if (column.uidt !== UITypes.LinkToAnotherRecord) {
      continue;
    }

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    switch (colOptions.type) {
      // case RelationTypes.MANY_TO_MANY:
      //
      //   break;
      case RelationTypes.HAS_MANY:
        {
          // delete the foreign key constraint if exists
          // create a new index for the column
        }

        break;
      // case RelationTypes.BELONGS_TO:
      //   break;
    }
  }
}

// An upgrader for upgrading any existing relation in xcdb
async function upgradeBaseRelations({
  ncMeta,
  base,
}: {
  ncMeta: MetaService;
  base: any;
}) {
  const sqlMgr = ProjectMgrv2.getSqlMgr({ id: base.project_id }, ncMeta);

  // get models for the base
  const models = await ncMeta.metaList2(null, base.id, 'models');

  // get all columns and filter out relations and upgrade
  for (const model of models) {
    await upgradeModelRelations({ ncMeta, model, sqlMgr });
  }
}

// database to virtual relation and create an index for it
export default async function ({ ncMeta }: NcUpgraderCtx) {
  // get all xcdb bases
  const bases = await ncMeta.metaList2(null, null, 'bases', {
    condition: {
      is_meta: 1,
    },
    orderBy: {},
  });

  // iterate and upgrade each base
  for (const base of bases) {
    await upgradeBaseRelations({
      ncMeta,
      base,
    });
  }
}
