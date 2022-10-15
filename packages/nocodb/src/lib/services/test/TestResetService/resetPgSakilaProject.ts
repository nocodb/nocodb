import axios from 'axios';
import Knex from 'knex';

import { promises as fs } from 'fs';
const util = require('util');
const exec = util.promisify(require('child_process').exec);

import Audit from '../../../models/Audit';
import Project from '../../../models/Project';

const config = {
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'postgres',
    multipleStatements: true,
  },
  searchPath: ['public', 'information_schema'],
  pool: { min: 0, max: 5 },
};

const extMysqlProject = (title, parallelId) => ({
  title,
  bases: [
    {
      type: 'pg',
      config: {
        client: 'pg',
        connection: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: 'password',
          database: `sakila_${parallelId}`,
        },
        searchPath: ['public'],
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
});

const isSakilaPgToBeReset = async (knex: Knex, project?: Project) => {
  const tablesInDb: Array<string> = (
    await knex.raw(
      `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`
    )
  ).rows.map((row) => row.table_name);

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

const resetSakilaPg = async (pgknex: Knex, parallelId: string) => {
  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  await pgknex.raw(`DROP DATABASE IF EXISTS sakila_${parallelId}`);
  await pgknex.raw(`CREATE DATABASE sakila_${parallelId}`);

  const sakilaKnex = Knex(sakilaKnexConfig(parallelId));

  const schemaFile = await fs.readFile(
    `${testsDir}/pg-sakila-db/03-postgres-sakila-schema.sql`
  );
  await sakilaKnex.raw(schemaFile.toString());

  const dataFilePath = `${testsDir}/pg-sakila-db/04-postgres-sakila-insert-data.sql`;
  await exec(
    `export PGPASSWORD='${config.connection.password}';psql sakila_${parallelId} -h localhost -U postgres -w -f ${dataFilePath}`
  );

  await sakilaKnex.destroy();
};

const sakilaKnexConfig = (parallelId: string) => ({
  ...config,
  connection: {
    ...config.connection,
    database: `sakila_${parallelId}`,
  },
});

const resetPgSakilaProject = async ({
  token,
  title,
  parallelId,
  oldProject,
}: {
  token: string;
  title: string;
  parallelId: string;
  oldProject?: Project | undefined;
}) => {
  const pgknex = Knex(config);

  try {
    await pgknex.raw(`CREATE DATABASE sakila_${parallelId}`);
  } catch (e) {}

  const sakilaKnex = Knex(sakilaKnexConfig(parallelId));

  if (await isSakilaPgToBeReset(sakilaKnex, oldProject)) {
    await sakilaKnex.destroy();
    await resetSakilaPg(pgknex, parallelId);
  } else {
    await sakilaKnex.destroy();
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

  await pgknex.destroy();
};

export default resetPgSakilaProject;
