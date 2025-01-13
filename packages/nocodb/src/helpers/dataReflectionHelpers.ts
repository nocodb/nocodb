import { customAlphabet, nanoid } from 'nanoid';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

const NC_DATA_REFLECTION_PORT = +process.env.NC_DATA_REFLECTION_PORT || 5433;

const genSuffix = customAlphabet('1234567890abcdef', 6);
const genPassword = () => nanoid(128);

const grantAccessToSchema = async (knex, schema, username) => {
  const query = `
  GRANT USAGE ON SCHEMA ?? TO ??;
  GRANT SELECT ON ALL TABLES IN SCHEMA ?? TO ??;
  ALTER DEFAULT PRIVILEGES IN SCHEMA ?? GRANT SELECT ON TABLES TO ??;
  `;

  const preparedQuery = knex
    .raw(query, [schema, username, schema, username, schema, username])
    .toQuery();

  await knex.raw(preparedQuery);
};

const revokeAccessToSchema = async (knex, schema, username) => {
  const query = `
  REVOKE ALL ON SCHEMA ?? FROM ??;
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ?? FROM ??;
  ALTER DEFAULT PRIVILEGES IN SCHEMA ?? REVOKE ALL ON TABLES FROM ??;
  `;

  const preparedQuery = knex
    .raw(query, [schema, username, schema, username, schema, username])
    .toQuery();

  await knex.raw(preparedQuery);
};

const createDatabaseUser = async (knex, username, password) => {
  const dataConfig = await NcConnectionMgrv2.getDataConfig();

  const database = (dataConfig.connection as any).database;

  const query = `
  CREATE USER ?? WITH PASSWORD ?;
  REVOKE ALL ON SCHEMA public FROM ??;
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ??;
  GRANT CONNECT ON DATABASE ?? TO ??;
  `;

  const preparedQuery = knex
    .raw(query, [username, password, username, username, database, username])
    .toQuery();

  await knex.raw(preparedQuery);
};

const dropDatabaseUser = async (knex, username) => {
  const dataConfig = await NcConnectionMgrv2.getDataConfig();

  const database = (dataConfig.connection as any).database;

  const query = `
  REVOKE ALL ON DATABASE ?? FROM ??;
  DROP USER IF EXISTS ??;
  `;

  const preparedQuery = knex
    .raw(query, [database, username, username])
    .toQuery();

  await knex.raw(preparedQuery);
};

export {
  NC_DATA_REFLECTION_PORT,
  grantAccessToSchema,
  revokeAccessToSchema,
  createDatabaseUser,
  dropDatabaseUser,
  genSuffix,
  genPassword,
};
