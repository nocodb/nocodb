import { customAlphabet, nanoid } from 'nanoid';
import { ncSiteUrl } from '~/utils/envs';

const NC_DATA_REFLECTION_SETTINGS = {
  host:
    process.env.NC_DATA_REFLECTION_HOST ||
    ncSiteUrl?.replace(/(^\w+:|^)\/\//, '').replace(/\/$/, ''),
  port: +process.env.NC_DATA_REFLECTION_PORT || 5433,
};

const genSuffix = customAlphabet('1234567890abcdef', 6);
const genPassword = () => nanoid(128);

// Identifier validator — usernames are `nc_<sanitized_title>_readonly_<hex>` and
// schemas are nanoid base ids, so both fit `[A-Za-z0-9_]`. Anything outside that
// alphabet would be unsafe to inline as an identifier and is treated as a bug.
const SAFE_PG_IDENT = /^[A-Za-z0-9_]+$/;

const assertSafePgIdent = (label: string, value: string) => {
  if (!value || !SAFE_PG_IDENT.test(value)) {
    throw new Error(
      `Invalid ${label} for data reflection helper: refusing to run DDL`,
    );
  }
};

// Escape a string literal for embedding as a quoted SQL value (used inside
// DO $$ ... $$ bodies where parameter binding doesn't apply).
const pgStringLiteral = (value: string) =>
  `'${String(value).replace(/'/g, "''")}'`;

const grantAccessToSchema = async (knex, schema, username) => {
  assertSafePgIdent('schema', schema);
  assertSafePgIdent('username', username);

  const usernameLit = pgStringLiteral(username);
  const schemaLit = pgStringLiteral(schema);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${usernameLit}) THEN
        RAISE NOTICE 'data reflection role missing, skipping grant';
        RETURN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${schemaLit}) THEN
        RAISE NOTICE 'data reflection schema missing, skipping grant';
        RETURN;
      END IF;
      GRANT USAGE ON SCHEMA "${schema}" TO "${username}";
      GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO "${username}";
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${username}";
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT SELECT ON TABLES TO "${username}";
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT USAGE, SELECT ON SEQUENCES TO "${username}";
    END $$;
  `);
};

const revokeAccessToSchema = async (knex, schema, username) => {
  assertSafePgIdent('schema', schema);
  assertSafePgIdent('username', username);

  const usernameLit = pgStringLiteral(username);
  const schemaLit = pgStringLiteral(schema);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${usernameLit}) THEN
        RAISE NOTICE 'data reflection role missing, skipping revoke';
        RETURN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${schemaLit}) THEN
        RAISE NOTICE 'data reflection schema missing, skipping revoke';
        RETURN;
      END IF;
      REVOKE ALL ON SCHEMA "${schema}" FROM "${username}";
      REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schema}" FROM "${username}";
      REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${schema}" FROM "${username}";
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" REVOKE ALL ON TABLES FROM "${username}";
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" REVOKE ALL ON SEQUENCES FROM "${username}";
    END $$;
  `);
};

const createDatabaseUser = async (knex, username, password, database) => {
  assertSafePgIdent('username', username);
  assertSafePgIdent('database', database);

  // Same shape as the original — knex's named binding renders identifiers via
  // :name: and values via :name. We rely on callers having already dropped any
  // pre-existing role with the same name (refreshAccess does this).
  const query = `
    CREATE USER :username: WITH PASSWORD :password;
    REVOKE ALL ON SCHEMA public FROM :username:;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM :username:;
    REVOKE TEMPORARY ON DATABASE :database: FROM :username:;
    GRANT CONNECT ON DATABASE :database: TO :username:;
    ALTER ROLE :username: SET statement_timeout = '60s';
    ALTER ROLE :username: SET idle_in_transaction_session_timeout = '60s';
  `;
  const preparedQuery = knex
    .raw(query, { username, password, database })
    .toQuery();
  await knex.raw(preparedQuery);
};

const dropDatabaseUser = async (knex, username, database) => {
  assertSafePgIdent('username', username);
  assertSafePgIdent('database', database);

  const usernameLit = pgStringLiteral(username);

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${usernameLit}) THEN
        -- Drop all dependent grants in the current DB before DROP USER so
        -- there are no remaining references in this database.
        -- RESTRICT (the default) is defense-in-depth: our readonly role has
        -- no CREATE privilege and therefore can't own objects, so this should
        -- only ever revoke grants. If it ever fails it means the role drifted
        -- and someone needs to look at it — better than silently dropping
        -- whatever the role accidentally owns.
        EXECUTE format('REVOKE ALL ON DATABASE %I FROM %I', '${database}', '${username}');
        EXECUTE format('DROP OWNED BY %I RESTRICT', '${username}');
        EXECUTE format('DROP USER %I', '${username}');
      END IF;
    END $$;
  `);
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
