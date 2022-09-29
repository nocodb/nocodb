import Model from '../../../models/Model';
import Project from '../../../models/Project';
import { orderedMetaTables } from '../../../utils/globals';

const disableForeignKeyChecks = async (knex) => {
  await knex.raw('PRAGMA foreign_keys = OFF');
  // await this.knex.raw(`SET FOREIGN_KEY_CHECKS = 0`);
};

const enableForeignKeyChecks = async (knex) => {
  await knex.raw(`PRAGMA foreign_keys = ON;`);
  // await this.knex.raw(`SET FOREIGN_KEY_CHECKS = 1`);
};

const dropTablesAllNonExternalProjects = async (knex) => {
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

  await disableForeignKeyChecks(knex);

  for (const tableName of userCreatedTableNames) {
    await knex.raw(`DROP TABLE ${tableName}`);
  }

  await enableForeignKeyChecks(knex);
};

const resetMeta = async (knex) => {
  await dropTablesAllNonExternalProjects(knex);

  await disableForeignKeyChecks(knex);
  for (const tableName of orderedMetaTables) {
    try {
      await knex.raw(`DELETE FROM ${tableName}`);
    } catch (e) {
      console.error('cleanupMetaTables', e);
    }
  }
  await enableForeignKeyChecks(knex);
};

export default resetMeta;
