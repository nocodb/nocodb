import Model from '../../../src/lib/models/Model';
import Project from '../../../src/lib/models/Project';
import NcConnectionMgrv2 from '../../../src/lib/utils/common/NcConnectionMgrv2';
import { orderedMetaTables } from '../../../src/lib/utils/globals';
import TestDbMngr from '../TestDbMngr';
import { isPg } from './db';

const dropTablesAllNonExternalProjects = async () => {
  const projects = await Project.list({});
  const userCreatedTableNames: string[] = [];
  await Promise.all(
    projects
      .filter((project) => project.is_meta)
      .map(async (project) => {
        await project.getBases();
        const base = project.bases && project.bases[0];
        if (!base) return;

        const models = await Model.list({
          project_id: project.id,
          base_id: base.id!,
        });
        models.forEach((model) => {
          userCreatedTableNames.push(model.table_name);
        });
      })
  );

  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.metaKnex);

  for (const tableName of userCreatedTableNames) {
    if (TestDbMngr.isPg()) {
      await TestDbMngr.metaKnex.raw(`DROP TABLE "${tableName}" CASCADE`);
    } else {
      await TestDbMngr.metaKnex.raw(`DROP TABLE ${tableName}`);
    }
  }

  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.metaKnex);
};

const cleanupMetaTables = async () => {
  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.metaKnex);
  for (const tableName of orderedMetaTables) {
    try {
      await TestDbMngr.metaKnex.raw(`DELETE FROM ${tableName}`);
    } catch (e) {}
  }
  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.metaKnex);
};

const cleanupDocPagesTables = async () => {
  const metaTables = await TestDbMngr.showAllTables(TestDbMngr.metaKnex);
  const docPagesTables = metaTables.filter((tableName) =>
    tableName.startsWith("nc_pages_")
  );

  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.metaKnex);
  for (const tableName of docPagesTables) {
    try {
      await TestDbMngr.metaKnex.raw(`DELETE FROM ${tableName}`);
    } catch (e) {}
  }
  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.metaKnex);
}

export default async function () {
  try {
    await NcConnectionMgrv2.destroyAll();

    await dropTablesAllNonExternalProjects();
    await cleanupMetaTables();
    await cleanupDocPagesTables();
  } catch (e) {
    console.error('cleanupMeta', e);
  }
}
