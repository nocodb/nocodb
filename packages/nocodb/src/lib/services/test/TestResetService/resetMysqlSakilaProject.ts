import axios from 'axios';
import Knex from 'knex';

import { promises as fs } from 'fs';
import Audit from '../../../models/Audit';
import Project from '../../../models/Project';

const config = {
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'sakila',
    multipleStatements: true,
    dateStrings: true,
  },
};

const extMysqlProject = (title, parallelId) => ({
  title,
  bases: [
    {
      type: 'mysql2',
      config: {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          port: '3306',
          user: 'root',
          password: 'password',
          database: `test_sakila_${parallelId}`,
        },
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
});

const isSakilaMysqlToBeReset = async (
  knex: Knex,
  parallelId: string,
  project?: Project
) => {
  const tablesInDb: Array<string> = await knex.raw(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'test_sakila_${parallelId}'`
  );

  if (
    tablesInDb.length === 0 ||
    (tablesInDb.length > 0 && !tablesInDb.includes(`actor`))
  ) {
    return true;
  }

  if (!project) return false;

  const audits = await Audit.projectAuditList(project.id, {});

  return audits?.length > 0;
};

const resetSakilaMysql = async (
  knex: Knex,
  parallelId: string,
  isEmptyProject: boolean
) => {
  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  try {
    await knex.raw(`DROP DATABASE test_sakila_${parallelId}`);
  } catch (e) {
    console.log('Error dropping db', e);
  }
  await knex.raw(`CREATE DATABASE test_sakila_${parallelId}`);

  if (isEmptyProject) return;

  const trx = await knex.transaction();

  try {
    const schemaFile = await fs.readFile(
      `${testsDir}/mysql-sakila-db/03-test-sakila-schema.sql`
    );
    const dataFile = await fs.readFile(
      `${testsDir}/mysql-sakila-db/04-test-sakila-data.sql`
    );

    await trx.raw(
      schemaFile.toString().replace(/test_sakila/g, `test_sakila_${parallelId}`)
    );
    await trx.raw(
      dataFile.toString().replace(/test_sakila/g, `test_sakila_${parallelId}`)
    );

    await trx.commit();
  } catch (e) {
    console.log('Error resetting mysql db', e);
    await trx.rollback(e);
  }
};

const resetMysqlSakilaProject = async ({
  token,
  title,
  parallelId,
  oldProject,
  isEmptyProject,
}: {
  token: string;
  title: string;
  parallelId: string;
  oldProject?: Project | undefined;
  isEmptyProject: boolean;
}) => {
  const knex = Knex(config);

  try {
    await knex.raw(`USE test_sakila_${parallelId}`);
  } catch (e) {
    await knex.raw(`CREATE DATABASE test_sakila_${parallelId}`);
    await knex.raw(`USE test_sakila_${parallelId}`);
  }

  if (
    isEmptyProject ||
    (await isSakilaMysqlToBeReset(knex, parallelId, oldProject))
  ) {
    await resetSakilaMysql(knex, parallelId, isEmptyProject);
  }

  const response = await axios.post(
    'http://localhost:8080/api/v1/db/meta/projects/',
    extMysqlProject(title, parallelId),
    {
      headers: {
        'xc-auth': token,
      },
    }
  );
  if (response.status !== 200) {
    console.error('Error creating project', response.data);
  }

  await knex.destroy();
};

export default resetMysqlSakilaProject;
