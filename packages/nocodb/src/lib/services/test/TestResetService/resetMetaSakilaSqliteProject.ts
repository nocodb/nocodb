import axios from 'axios';
import Knex from 'knex';

import fs from 'fs';
import Audit from '../../../models/Audit';
import { sakilaTableNames } from '../../../utils/globals';

const sqliteSakilaSqlViews = [
  'actor_info',
  'customer_list',
  'film_list',
  'nice_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

const dropTablesAndViews = async (metaKnex: Knex, prefix: string) => {
  for (const view of sqliteSakilaSqlViews) {
    try {
      await metaKnex.raw(`DROP VIEW IF EXISTS ${prefix}${view}`);
    } catch (e) {
      console.log('Error dropping sqlite view', e);
    }
  }

  for (const table of sakilaTableNames) {
    try {
      await metaKnex.raw(`DROP TABLE IF EXISTS ${prefix}${table}`);
    } catch (e) {
      console.log('Error dropping sqlite table', e);
    }
  }
};

const isMetaSakilaSqliteToBeReset = async (metaKnex: Knex, project: any) => {
  const tablesInDb: Array<string> = await metaKnex.raw(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '${project.prefix}%'`
  );

  if (
    tablesInDb.length === 0 ||
    (tablesInDb.length > 0 && !tablesInDb.includes(`${project.prefix}actor`))
  ) {
    return true;
  }

  const audits = await Audit.projectAuditList(project.id, {});

  return audits?.length > 0;
};

const resetMetaSakilaSqlite = async (metaKnex: Knex, prefix: string) => {
  await dropTablesAndViews(metaKnex, prefix);

  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  const trx = await metaKnex.transaction();

  try {
    const schemaFile = fs
      .readFileSync(
        `${testsDir}/sqlite-sakila-db/03-sqlite-prefix-sakila-schema.sql`
      )
      .toString()
      .replace(/prefix___/g, prefix);

    const dataFile = fs
      .readFileSync(
        `${testsDir}/sqlite-sakila-db/04-sqlite-prefix-sakila-insert-data.sql`
      )
      .toString()
      .replace(/prefix___/g, prefix);

    const schemaSqlQueries = schemaFile.split(';');
    for (const sqlQuery of schemaSqlQueries) {
      if (sqlQuery.trim().length > 0) {
        await trx.raw(
          sqlQuery
            .trim()
            .replace(/WHERE rowid = new.rowid/g, 'WHERE rowid = new.rowid;')
        );
      }
    }

    const dataSqlQueries = dataFile.split(';');
    for (const sqlQuery of dataSqlQueries) {
      if (sqlQuery.trim().length > 0) {
        await trx.raw(sqlQuery.trim());
      }
    }
    await trx.commit();
  } catch (e) {
    console.log('Error resetting sqlite db', e);
    await trx.rollback(e);
  }
};

const resetMetaSakilaSqliteProject = async ({
  metaKnex,
  token,
  title,
}: {
  metaKnex: Knex;
  token: string;
  title: string;
}) => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/db/meta/projects/',
    { title },
    {
      headers: {
        'xc-auth': token,
      },
    }
  );
  if (response.status !== 200) {
    console.error('Error creating project', response.data);
  }
  const project = response.data;

  if (await isMetaSakilaSqliteToBeReset(metaKnex, project)) {
    await resetMetaSakilaSqlite(metaKnex, project.prefix);
  }

  await axios.post(
    `http://localhost:8080/api/v1/db/meta/projects/${project.id}/meta-diff`,
    {},
    {
      headers: {
        'xc-auth': token,
      },
    }
  );
};

export default resetMetaSakilaSqliteProject;
