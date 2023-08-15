import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { knex } from 'knex';
import Audit from '../../../models/Audit';
import type { Knex } from 'knex';
import type Project from '../../../models/Project';

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
  project?: Project,
) => {
  const tablesInDbInfo: Array<any> = await knex.raw(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'test_sakila_${parallelId}'`,
  );

  const nonMetaTablesInDb = tablesInDbInfo[0]
    .map((t) => t['TABLE_NAME'])
    .filter((table) => table !== 'nc_evolutions');

  const mysqlSakilaTablesAndViews = [
    ...mysqlSakilaTables,
    ...mysqlSakilaSqlViews,
  ];

  if (
    nonMetaTablesInDb.length === 0 ||
    // If there are sakila tables
    !nonMetaTablesInDb.includes(`actor`) ||
    // If there are no pg sakila tables in tables in db
    !(
      nonMetaTablesInDb.length === mysqlSakilaTablesAndViews.length &&
      nonMetaTablesInDb.every((t) => mysqlSakilaTablesAndViews.includes(t))
    )
  ) {
    return true;
  }

  if (!project) return true;

  const audits = await Audit.projectAuditList(project.id, {});

  // todo: Will be fixed in the data resetting revamp
  console.log(`audits:resetMysqlSakilaProject:${parallelId}`, audits?.length);
  return true;
};

const resetSakilaMysql = async (
  knex: Knex,
  parallelId: string,
  isEmptyProject: boolean,
) => {
  const testsDir = path.join(process.cwd(), '/tests');

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
      `${testsDir}/mysql-sakila-db/03-test-sakila-schema.sql`,
    );
    const dataFile = await fs.readFile(
      `${testsDir}/mysql-sakila-db/04-test-sakila-data.sql`,
    );

    await trx.raw(
      schemaFile
        .toString()
        .replace(/test_sakila/g, `test_sakila_${parallelId}`),
    );
    await trx.raw(
      dataFile.toString().replace(/test_sakila/g, `test_sakila_${parallelId}`),
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
  const nc_knex = knex(config);

  try {
    await nc_knex.raw(`USE test_sakila_${parallelId}`);
  } catch (e) {
    await nc_knex.raw(`CREATE DATABASE test_sakila_${parallelId}`);
    await nc_knex.raw(`USE test_sakila_${parallelId}`);
  }

  if (
    isEmptyProject ||
    (await isSakilaMysqlToBeReset(nc_knex, parallelId, oldProject))
  ) {
    await resetSakilaMysql(nc_knex, parallelId, isEmptyProject);
  }

  const response = await axios.post(
    'http://localhost:8080/api/v1/db/meta/projects/',
    extMysqlProject(title, parallelId),
    {
      headers: {
        'xc-auth': token,
      },
    },
  );
  if (response.status !== 200) {
    console.error('Error creating project', response.data);
  }

  await nc_knex.destroy();
};

const mysqlSakilaTables = [
  'actor',
  'address',
  'category',
  'city',
  'country',
  'customer',
  'film',
  'film_text',
  'film_actor',
  'film_category',
  'inventory',
  'language',
  'payment',
  'rental',
  'staff',
  'store',
];

const mysqlSakilaSqlViews = [
  'actor_info',
  'customer_list',
  'film_list',
  'nicer_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

export default resetMysqlSakilaProject;
