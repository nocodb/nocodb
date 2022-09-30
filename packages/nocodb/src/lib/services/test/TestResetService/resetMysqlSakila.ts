import knex from 'knex';
import fs from 'fs';
import Project from '../../../models/Project';
import Audit from '../../../models/Audit';

const config = {
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'test_sakila',
    multipleStatements: true,
    dateStrings: true,
  },
};

const isMysqlSakilaToBeReset = async () => {
  const sakilaProject = await Project.getByTitle('externalREST');

  const audits =
    sakilaProject && (await Audit.projectAuditList(sakilaProject.id, {}));

  return audits?.length > 0;
};

const resetMysqlSakila = async () => {
  const knexClient = knex(config);

  try {
    await knexClient.raw(`DROP DATABASE test_sakila`);
  } catch (e) {
    console.log('Error dropping db', e);
  }
  await knexClient.raw(`CREATE DATABASE test_sakila`);

  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  const schemaFile = fs
    .readFileSync(`${testsDir}/mysql-sakila-db/03-test-sakila-schema.sql`)
    .toString();
  const dataFile = fs
    .readFileSync(`${testsDir}/mysql-sakila-db/04-test-sakila-data.sql`)
    .toString();
  await knexClient.raw(schemaFile);
  await knexClient.raw(dataFile);

  await knexClient.destroy();
};

export { resetMysqlSakila, isMysqlSakilaToBeReset };
