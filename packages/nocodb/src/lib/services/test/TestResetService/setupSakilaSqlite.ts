import fs from 'fs';
import Knex from 'knex';

const setupSakilaSqlite = async (metaKnex: Knex) => {
  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  const schemaFile = fs
    .readFileSync(`${testsDir}/pg-sakila-db/01-sqlite-sakila-schema.sql`)
    .toString();
  const dataFile = fs
    .readFileSync(`${testsDir}/pg-sakila-db/02-sqlite-sakila-insert-data.sql`)
    .toString();

  await metaKnex.raw(schemaFile);
  await metaKnex.raw(dataFile);
};

export default setupSakilaSqlite;
