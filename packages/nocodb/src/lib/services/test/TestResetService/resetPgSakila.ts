import knex from 'knex';
import fs from 'fs';
import Project from '../../../models/Project';
import Audit from '../../../models/Audit';

const config = {
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'postgres',
  },
  searchPath: ['public'],
  meta: { dbtype: '' },
  pool: { min: 0, max: 5 },
};

const isPgSakilaToBeReset = async () => {
  const sakilaProject = await Project.getByTitle('pgExtREST');

  const audits =
    sakilaProject && (await Audit.projectAuditList(sakilaProject.id, {}));

  return audits?.length > 0;
};

const resetPgSakila = async () => {
  const knexClient = knex(config);

  try {
    await knexClient.raw(`DROP SCHEMA public CASCADE`);
  } catch (e) {
    console.log('Error dropping pg schema', e);
  }
  await knexClient.raw(`CREATE SCHEMA public`);

  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  const schemaFile = fs
    .readFileSync(`${testsDir}/pg-sakila-db/01-postgres-sakila-schema.sql`)
    .toString();
  const dataFile = fs
    .readFileSync(`${testsDir}/pg-sakila-db/02-postgres-sakila-insert-data.sql`)
    .toString();
  await knexClient.raw(schemaFile);
  await knexClient.raw(dataFile);

  await knexClient.destroy();
};

export { resetPgSakila, isPgSakilaToBeReset };
