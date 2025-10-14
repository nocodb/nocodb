import { customAlphabet, nanoid } from 'nanoid';

const NC_DATA_REFLECTION_SETTINGS = {
  host:
    process.env.NC_DATA_REFLECTION_HOST ||
    process.env.NC_PUBLIC_URL?.replace(/(^\w+:|^)\/\//, '').replace(/\/$/, ''),
  port: +process.env.NC_DATA_REFLECTION_PORT || 5433,
};

const genSuffix = customAlphabet('1234567890abcdef', 6);
const genPassword = () => nanoid(128);

const grantAccessToSchema = async (knex, schema, username) => {
  const query = `
  GRANT USAGE ON SCHEMA :schema: TO :username:;
  GRANT SELECT ON ALL TABLES IN SCHEMA :schema: TO :username:;
  ALTER DEFAULT PRIVILEGES IN SCHEMA :schema: GRANT SELECT ON TABLES TO :username:;
  `;

  const preparedQuery = knex.raw(query, { schema, username }).toQuery();

  await knex.raw(preparedQuery);
};

const revokeAccessToSchema = async (knex, schema, username) => {
  const query = `
  REVOKE ALL ON SCHEMA :schema: FROM :username:;
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA :schema: FROM :username:;
  ALTER DEFAULT PRIVILEGES IN SCHEMA :schema: REVOKE ALL ON TABLES FROM :username:;
  `;

  const preparedQuery = knex.raw(query, { schema, username }).toQuery();

  await knex.raw(preparedQuery);
};

const createDatabaseUser = async (knex, username, password, database) => {
  const query = `
  CREATE USER :username: WITH PASSWORD :password;
  REVOKE ALL ON SCHEMA public FROM :username:;
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM :username:;
  GRANT CONNECT ON DATABASE :database: TO :username:;
  `;

  const preparedQuery = knex
    .raw(query, { username, password, database })
    .toQuery();

  await knex.raw(preparedQuery);
};

const dropDatabaseUser = async (knex, username, database) => {
  const query = `
  REVOKE ALL ON DATABASE :database: FROM :username:;
  DROP USER IF EXISTS :username:;
  `;

  const preparedQuery = knex.raw(query, { username, database }).toQuery();

  await knex.raw(preparedQuery);
};

function inInterceptor(table: string, column: string, values: string[]) {
  return {
    type: 'binary_expr',
    operator: 'in',
    left: {
      type: 'column_ref',
      table,
      column: {
        expr: {
          type: 'default',
          value: column,
        },
      },
    },
    right: {
      type: 'expr_list',
      value: values.map((schema) => ({
        type: 'string',
        value: schema,
      })),
    },
  };
}

function eqInterceptor(table: string, column: string, value: string) {
  return {
    type: 'binary_expr',
    operator: '=',
    left: {
      type: 'column_ref',
      table,
      column: {
        expr: {
          type: 'default',
          value: column,
        },
      },
    },
    right: {
      type: 'string',
      value,
    },
  };
}

function generateWhereClause(
  table: string,
  column: string,
  type: 'in' | 'eq',
  value: string | string[],
) {
  if (type === 'in') {
    return inInterceptor(table, column, Array.isArray(value) ? value : [value]);
  }

  return eqInterceptor(table, column, value as string);
}

export {
  NC_DATA_REFLECTION_SETTINGS,
  grantAccessToSchema,
  revokeAccessToSchema,
  createDatabaseUser,
  dropDatabaseUser,
  genSuffix,
  genPassword,
  generateWhereClause,
};
