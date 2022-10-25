import axios from 'axios';
import Knex from 'knex';

import { promises as fs } from 'fs';
import { sakilaTableNames } from '../../../utils/globals';
import Project from '../../../models/Project';

const sqliteSakilaSqlViews = [
  'actor_info',
  'customer_list',
  'film_list',
  'nice_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

const resetMetaSakilaSqliteProject = async ({
  metaKnex,
  token,
  title,
  oldProject,
  isEmptyProject,
}: {
  metaKnex: Knex;
  token: string;
  title: string;
  oldProject: Project;
  isEmptyProject: boolean;
}) => {
  const project = await createProject(token, title);

  if (oldProject) await dropTablesAndViews(metaKnex, oldProject.prefix);
  await dropTablesAndViews(metaKnex, project.prefix);

  if (isEmptyProject) return;

  await resetMetaSakilaSqlite(metaKnex, project.prefix, oldProject);

  await syncMeta(project, token);
};

const createProject = async (token: string, title: string) => {
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
  return response.data;
};

const syncMeta = async (project: Project, token: string) => {
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

const dropTablesAndViews = async (metaKnex: Knex, prefix: string) => {
  try {
    for (const view of sqliteSakilaSqlViews) {
      await metaKnex.raw(`DROP VIEW IF EXISTS ${prefix}${view}`);
    }

    for (const table of sakilaTableNames) {
      await metaKnex.raw(`DROP TABLE IF EXISTS ${prefix}${table}`);
    }
  } catch (e) {
    console.error('Error dropping tables and views', e);
  }
};

const resetMetaSakilaSqlite = async (
  metaKnex: Knex,
  prefix: string,
  oldProject: Project
) => {
  await dropTablesAndViews(metaKnex, oldProject.prefix);

  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  try {
    const schemaFile = await fs.readFile(
      `${testsDir}/sqlite-sakila-db/03-sqlite-prefix-sakila-schema.sql`
    );
    const schemaFileStr = schemaFile.toString().replace(/prefix___/g, prefix);

    const schemaSqlQueries = schemaFileStr
      .split(';')
      .filter((str) => str.trim().length > 0)
      .map((str) => str.trim());
    for (const sqlQuery of schemaSqlQueries) {
      if (sqlQuery.trim().length > 0) {
        await metaKnex.raw(
          sqlQuery
            .trim()
            .replace(/WHERE rowid = new.rowid/g, 'WHERE rowid = new.rowid;')
        );
      }
    }
  } catch (e) {
    console.error('Error resetting meta sakila sqlite:db', e);
  }

  const dataFile = await fs.readFile(
    `${testsDir}/sqlite-sakila-db/04-sqlite-prefix-sakila-insert-data.sql`
  );
  const dataFileStr = dataFile.toString().replace(/prefix___/g, prefix);
  const dataSqlQueries = dataFileStr
    .split(';')
    .filter((str) => str.trim().length > 0)
    .map((str) => str.trim());

  const batchSize = 1000;
  const batches = dataSqlQueries.reduce((acc, _, i) => {
    if (!(i % batchSize)) {
      // if index is 0 or can be divided by the `size`...
      acc.push(dataSqlQueries.slice(i, i + batchSize)); // ..push a chunk of the original array to the accumulator
    }
    return acc;
  }, []);

  for (const sqlQueryBatch of batches) {
    const trx = await metaKnex.transaction();

    for (const sqlQuery of sqlQueryBatch) {
      await trx.raw(sqlQuery);
    }

    await trx.commit();
    // wait for 40 ms to avoid SQLITE_BUSY error
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
};

export default resetMetaSakilaSqliteProject;
