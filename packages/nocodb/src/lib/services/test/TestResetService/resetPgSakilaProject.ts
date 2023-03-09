import { promises as fs } from 'fs';
import axios from 'axios';
import { knex } from 'knex';

// const util = require('util');
// const exec = util.promisify(require('child_process').exec);

import Audit from '../../../models/Audit';
import type Project from '../../../models/Project';

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

const isSakilaPgToBeReset = async (parallelId: string, project?: Project) => {
  const sakilaKnex = knex(sakilaKnexConfig(parallelId));

  const tablesInDb: Array<string> = (
    await sakilaKnex.raw(
      `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`
    )
  ).rows.map((row) => row.table_name);

  await sakilaKnex.destroy();

  const nonMetaTablesInDb = tablesInDb.filter(
    (table) => table !== 'nc_evolutions'
  );
  const pgSakilaTablesAndViews = [...pgSakilaTables, ...pgSakilaSqlViews];

  if (
    tablesInDb.length === 0 ||
    // If there are sakila tables
    !tablesInDb.includes(`actor`) ||
    // If there are no pg sakila tables in tables in db
    !(
      nonMetaTablesInDb.length === pgSakilaTablesAndViews.length &&
      nonMetaTablesInDb.every((t) => pgSakilaTablesAndViews.includes(t))
    )
  ) {
    return true;
  }

  if (!project) return false;

  const audits = await Audit.projectAuditList(project.id, {});

  return audits?.length > 0;
};

const resetSakilaPg = async (parallelId: string, isEmptyProject: boolean) => {
  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  if (isEmptyProject) return;

  try {
    const sakilaKnex = knex(sakilaKnexConfig(parallelId));
    const schemaFile = await fs.readFile(
      `${testsDir}/pg-sakila-db/01-postgres-sakila-schema.sql`
    );
    await sakilaKnex.raw(schemaFile.toString());

    const trx = await sakilaKnex.transaction();
    const dataFile = await fs.readFile(
      `${testsDir}/pg-sakila-db/02-postgres-sakila-insert-data.sql`
    );
    await trx.raw(dataFile.toString());
    await trx.commit();

    await sakilaKnex.destroy();
  } catch (e) {
    console.error(`Error resetting pg sakila db: Worker ${parallelId}`);
    throw Error(`Error resetting pg sakila db: Worker ${parallelId}`);
  }
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
  isEmptyProject,
}: {
  token: string;
  title: string;
  parallelId: string;
  oldProject?: Project | undefined;
  isEmptyProject: boolean;
}) => {
  const pgknex = knex(config);

  try {
    await pgknex.raw(`CREATE DATABASE sakila_${parallelId}`);
  } catch (e) {}

  if (isEmptyProject || (await isSakilaPgToBeReset(parallelId, oldProject))) {
    await pgknex.raw(`DROP DATABASE IF EXISTS sakila_${parallelId}`);
    await pgknex.raw(`CREATE DATABASE sakila_${parallelId}`);
    await pgknex.destroy();

    await resetSakilaPg(parallelId, isEmptyProject);
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
    throw new Error('Error creating project', response.data);
  }
};

const pgSakilaTables = [
  'country',
  'city',
  'actor',
  'film_actor',
  'category',
  'film_category',
  'language',
  'film',
  'payment_p2007_01',
  'payment_p2007_02',
  'payment_p2007_03',
  'payment_p2007_04',
  'payment_p2007_05',
  'payment_p2007_06',
  'payment',
  'customer',
  'inventory',
  'rental',
  'address',
  'staff',
  'store',
];

const pgSakilaSqlViews = [
  'actor_info',
  'customer_list',
  'film_list',
  'nicer_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

export default resetPgSakilaProject;
