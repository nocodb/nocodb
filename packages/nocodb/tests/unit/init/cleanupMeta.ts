import Model from "../../../src/lib/models/Model";
import Project from "../../../src/lib/models/Project";
import NcConnectionMgrv2 from "../../../src/lib/utils/common/NcConnectionMgrv2";
import { orderedMetaTables } from "../../../src/lib/utils/globals";

const dropTablesAllNonExternalProjects = async (knexClient) => {
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

  await knexClient.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const tableName of userCreatedTableNames) {
    await knexClient.raw(`DROP TABLE ${tableName}`);
  }
  await knexClient.raw('SET FOREIGN_KEY_CHECKS = 1');
};

const cleanupMetaTables = async (knexClient) => {
  await knexClient.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const tableName of orderedMetaTables) {
    try {
      await knexClient.raw(`DELETE FROM ${tableName}`);
    } catch (e) {}
  }
  await knexClient.raw('SET FOREIGN_KEY_CHECKS = 1');
};

export default async function (knexClient) {
  try {
    await NcConnectionMgrv2.destroyAll();

    await dropTablesAllNonExternalProjects(knexClient);
    await cleanupMetaTables(knexClient);
  } catch (e) {
    console.error('cleanupMeta', e);
  }
}
