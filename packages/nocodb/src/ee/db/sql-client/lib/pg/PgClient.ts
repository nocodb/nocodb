import PGClientCE from 'src/db/sql-client/lib/pg/PgClient';
import knex from 'knex';
import find from 'lodash/find';
import Debug from '~/db/util/Debug';
import Result from '~/db/util/Result';
import { runExternal } from '~/helpers/muxHelpers';

const log = new Debug('PGClient');

const isKnexWrapped = Symbol('isKnexWrapped');

class PGClient extends PGClientCE {
  constructor(connectionConfig) {
    super(connectionConfig);

    if (!this.sqlClient[isKnexWrapped]) {
      this.sqlClient[isKnexWrapped] = true;

      const knexRaw = this.sqlClient.raw;
      const self = this;

      Object.defineProperties(this.sqlClient, {
        raw: {
          enumerable: true,
          value: function (...args) {
            const builder = knexRaw.apply(this, args);

            const originalThen = builder.then;

            builder.then = function (onFulfilled, onRejected) {
              if (self.sqlClient && self.sqlClient.isExternal) {
                return runExternal(builder.toQuery(), self.sqlClient.extDb, {
                  raw: true,
                })
                  .then(onFulfilled)
                  .catch(onRejected);
              }
              return originalThen.call(builder, onFulfilled, onRejected);
            };

            return builder;
          },
        },
      });
    }
  }

  /**
   *
   * @param {Object} args
   * @param {String} args.database
   * @returns {Result}
   */
  async createDatabaseIfNotExists(args: any = {}) {
    const _func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    let tempSqlClient;

    try {
      const connectionParamsWithoutDb = JSON.parse(
        JSON.stringify(this.connectionConfig),
      );
      let rows = [];
      try {
        connectionParamsWithoutDb.connection.database = 'postgres';
        tempSqlClient = knex(connectionParamsWithoutDb);

        log.debug('checking if db exists');
        rows = (
          await tempSqlClient.raw(
            `SELECT datname as database FROM pg_database WHERE datistemplate = false and datname = ?`,
            [args.database],
          )
        ).rows;
      } catch (e) {
        log.debug('checking if db exists');
        rows = (
          await this.sqlClient.raw(
            `SELECT datname as database FROM pg_database WHERE datistemplate = false and datname = ?`,
            [args.database],
          )
        ).rows;
      }
      if (rows.length === 0) {
        log.debug('creating database:', args);
        await tempSqlClient.raw(`CREATE DATABASE ?? ENCODING 'UTF8'`, [
          args.database,
        ]);
      }

      const schemaName =
        args.schema || this.connectionConfig.searchPath?.[0] || 'public';

      // Check schemaExists because `CREATE SCHEMA IF NOT EXISTS` requires permissions of `CREATE ON DATABASE`
      const schemaExists = !!(
        await this.sqlClient.raw(
          `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`,
          [schemaName],
        )
      ).rows?.[0];

      if (!schemaExists) {
        await this.sqlClient.raw(
          `CREATE SCHEMA IF NOT EXISTS ??  AUTHORIZATION ?? `,
          [schemaName, this.connectionConfig.connection.user],
        );
      }

      // this.sqlClient = knex(this.connectionConfig);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    } finally {
      if (tempSqlClient) {
        await tempSqlClient.destroy();
      }
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - columns
   * @property {String} - columns[].tn
   * @property {String} - columns[].cn
   * @property {String} - columns[].dt
   * @property {String} - columns[].dtx
   * @property {String} - columns[].np
   * @property {String} - columns[].ns -
   * @property {String} - columns[].clen -
   * @property {String} - columns[].dp -
   * @property {String} - columns[].cop -
   * @property {String} - columns[].pk -
   * @property {String} - columns[].nrqd -
   * @property {String} - columns[].not_nullable -
   * @property {String} - columns[].ct -
   * @property {String} - columns[].un -
   * @property {String} - columns[].ai -
   * @property {String} - columns[].unique -
   * @property {String} - columns[].cdf -
   * @property {String} - columns[].cc -
   * @property {String} - columns[].csn -
   */

  async columnList(args: any = {}) {
    const _func = this.columnList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const versionQuery = await this.sqlClient.raw('SELECT version()');

      // Example output of `SELECT version()`
      // PostgreSQL 14.4 (Debian 14.4-1.pgdg110+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 10.2.1-6) 10.2.1 20210110, 64-bit
      const majorVersion = versionQuery.rows[0]?.version
        ?.split(' ')?.[1]
        ?.split('.')?.[0];

      const identitySelector =
        +majorVersion >= 10 ? 'c.is_identity as ii,' : '';

      args.databaseName = this.connectionConfig.connection.database;
      const response = await this.sqlClient.raw(
        `select
                    c.table_name as tn, c.column_name as cn, c.data_type as dt,
                    (CASE WHEN  trg.trigger_name is NULL THEN false  else  true end) as au,
                    pk.constraint_type as ck,
                    c.character_maximum_length as clen,
                    c.numeric_precision as np,
                    c.numeric_scale as ns,
                    c.datetime_precision as dp,
                    c.ordinal_position as cop,
                    c.is_nullable as nrqd,
                    c.column_default as cdf,
                    c.generation_expression,
                    c.character_octet_length,
                    c.character_set_name as csn,
                    pk.ordinal_position as pk_ordinal_position,
                    pk.constraint_name as pk_constraint_name,
                    pk1.ordinal_position as pk_ordinal_position1,
                    pk1.constraint_name as pk_constraint_name1,
                    c.udt_name,
                    ${identitySelector}

       (SELECT count(*)
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc1
                inner join INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE cu
                    on cu.CONSTRAINT_NAME = tc1.CONSTRAINT_NAME
            where
                tc1.CONSTRAINT_TYPE = 'UNIQUE'
                and tc1.TABLE_NAME = c.TABLE_NAME
                and cu.COLUMN_NAME = c.COLUMN_NAME
                and tc1.TABLE_SCHEMA=c.TABLE_SCHEMA) IsUnique,
                (SELECT
        string_agg(enumlabel, ',')
        FROM "pg_enum" "e"
        INNER JOIN "pg_type" "t" ON "t"."oid" = "e"."enumtypid"
        INNER JOIN "pg_namespace" "n" ON "n"."oid" = "t"."typnamespace"
        WHERE "n"."nspname" = table_schema AND "t"."typname"=udt_name
                ) enum_values
            from information_schema.columns c
                          LEFT JOIN (
                     SELECT
                            kc.constraint_name,
                            kc.table_name,
                            kc.column_name,
                            kc.ordinal_position,
                            tc.constraint_type
                     FROM
                            information_schema.key_column_usage kc
                            INNER JOIN information_schema.table_constraints AS tc ON kc.constraint_name = tc.constraint_name
                                   AND kc.constraint_schema = tc.constraint_schema
                                   AND tc.constraint_type in('PRIMARY KEY')
                     WHERE
                            kc.table_catalog = :database
                            AND kc.table_schema = :schema) pk1 ON pk1.table_name = c.table_name
              AND pk1.column_name = c.column_name
           
              left join
                ( 
                    select 
                      pc.conrelid::regclass::text AS table_name,
                      pc.conname as constraint_name,
                      col.attname as column_name,
                      pc.contype as constraint_type,
                      kc.ordinal_position as ordinal_position
                    from
                        pg_constraint pc
                    JOIN pg_namespace n
                        ON n.oid = pc.connamespace
                    INNER JOIN pg_catalog.pg_class rel
                         ON rel.oid = pc.conrelid
                    LEFT JOIN LATERAL UNNEST(pc.conkey)  WITH ORDINALITY AS u(attnum, attposition)   ON TRUE
                    LEFT JOIN pg_attribute col ON (col.attrelid = pc.conrelid AND col.attnum = u.attnum)
                    left join information_schema.key_column_usage as kc
                      on pc.conname = kc.constraint_name 
                      and col.attname = kc.column_name
                      and kc.constraint_schema = n.nspname
                      and pc.conrelid::regclass::text = kc.table_name
                    WHERE n.nspname = :schema
                      AND rel.relname = :table 
                      and pc.contype = 'p' and pc.conrelid::regclass::text = :table
                 ) pk
                on
                pk.table_name = c.table_name and pk.column_name=c.column_name
                left join information_schema.triggers trg on trg.event_object_table = c.table_name and trg.trigger_name = CONCAT('xc_trigger_' , 'scans' , '_' , c.column_name)
              where c.table_catalog=:database and c.table_schema=:schema and c.table_name=:table
              order by c.table_name, c.ordinal_position`,
        {
          schema: this.getEffectiveSchema(args),
          table: args.tn,
          database: args.databaseName,
        },
      );

      const columns = [];

      for (let i = 0; i < response.rows.length; ++i) {
        const column: any = {};

        column.tn = response.rows[i].tn;
        column.cn = response.rows[i].cn;
        column.cno = response.rows[i].cn;
        column.dt = response.rows[i].dt;
        column.np = response.rows[i].np;
        column.ns = response.rows[i].ns;
        column.clen = response.rows[i].clen;
        column.dp = response.rows[i].dp;
        column.cop = response.rows[i].cop;

        // todo : there are lot of types in pg - handle them
        //column.dtx = this.getKnexDataType(column.dt);
        column.dtx = response.rows[i].dt;
        column.pk =
          response.rows[i].pk_constraint_name !== null ||
          response.rows[i].pk_constraint_name1 !== null;

        column.nrqd = response.rows[i].nrqd !== 'NO';
        column.not_nullable = !column.nrqd;
        column.rqd = !column.nrqd;

        // todo: there is no type of unsigned in postgres
        response.rows[i].ct = response.rows[i].dt || '';
        column.un = response.rows[i].ct.indexOf('unsigned') !== -1;

        column.ai = false;
        if (response.rows[i].cdf) {
          column.ai = response.rows[i].cdf.indexOf('nextval') !== -1;
        }

        // todo : need to find if column is unique or not
        // column['unique'] = response.rows[i]['cst'].indexOf('UNIQUE') === -1 ? false : true;

        column.cdf = response.rows[i].cdf
          ? response.rows[i].cdf.replace(/::[\w ]+$/, '').replace(/^'|'$/g, '')
          : response.rows[i].cdf;

        // todo : need to find column comment
        column.cc = response.rows[i].cc;

        column.csn = response.rows[i].csn;
        column.dtxp =
          response.rows[i].clen || response.rows[i].np || response.rows[i].dp;
        column.dtxs = response.rows[i].ns;
        column.au = response.rows[i].au;
        column.data_type_custom = response.rows[i].udt_name;
        if (column.dt === 'USER-DEFINED') {
          column.dtxp = response.rows[i].enum_values;
        }

        // handle identity column
        if (+majorVersion >= 10) {
          if (response.rows[i].ii === 'YES') {
            column.ai = true;
          }
        }

        columns.push(column);
      }

      result.data.list = columns;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - relations
   * @property {String} - relations[].tn
   * @property {String} - relations[].cstn -
   * @property {String} - relations[].tn -
   * @property {String} - relations[].cn -
   * @property {String} - relations[].rtn -
   * @property {String} - relations[].rcn -
   * @property {String} - relations[].puc -
   * @property {String} - relations[].ur -
   * @property {String} - relations[].dr -
   * @property {String} - relations[].mo -
   */
  async relationList(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      // The relationList & relationListAll queries is may look needlessly long, but it is a way
      // to get relationships without the `information_schema.constraint_column_usage` table (view).
      // As that view only returns fk relations if the pg user is the table owner.
      // Resource: https://dba.stackexchange.com/a/218969
      // Remove clause `WHERE clause: AND f_sch.nspname = sch.nspname` for x-schema relations.
      const { rows } = await this.sqlClient.raw(
        `SELECT 
          sch.nspname    AS ts,
          pc.conname     AS cstn,
          tbl.relname    AS tn,
          col.attname    AS cn,
          f_sch.nspname  AS foreign_table_schema,
          f_tbl.relname  AS rtn,
          f_col.attname  AS rcn,
          pc.confupdtype AS ur,
          pc.confdeltype AS dr
        FROM pg_constraint pc
          LEFT JOIN LATERAL UNNEST(pc.conkey)  WITH ORDINALITY AS u(attnum, attposition)   ON TRUE
          LEFT JOIN LATERAL UNNEST(pc.confkey) WITH ORDINALITY AS f_u(attnum, attposition) ON f_u.attposition = u.attposition
          JOIN pg_class tbl ON tbl.oid = pc.conrelid
          JOIN pg_namespace sch ON sch.oid = tbl.relnamespace
          LEFT JOIN pg_attribute col ON (col.attrelid = tbl.oid AND col.attnum = u.attnum)
          LEFT JOIN pg_class f_tbl ON f_tbl.oid = pc.confrelid
          LEFT JOIN pg_namespace f_sch ON f_sch.oid = f_tbl.relnamespace
          LEFT JOIN pg_attribute f_col ON (f_col.attrelid = f_tbl.oid AND f_col.attnum = f_u.attnum)
        WHERE pc.contype = 'f' AND sch.nspname = ? AND f_sch.nspname = sch.nspname AND tbl.relname=?;`,
        [this.getEffectiveSchema(args), args.tn],
      );

      const ruleMapping = {
        a: 'NO ACTION',
        c: 'CASCADE',
        r: 'RESTRICT',
        n: 'SET NULL',
        d: 'SET DEFAULT',
      };

      for (const row of rows) {
        row.ur = ruleMapping[row.ur];
        row.dr = ruleMapping[row.dr];
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   */
  async testConnection(args: any = {}) {
    const _func = this.testConnection.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    let unsupportedVariant = false;
    const defaultParseVersionFn = this.sqlClient.client.__proto__._parseVersion;

    try {
      // override parseVersion to handle unsupported variants and return 0.0.0
      // so that the version check does not end up crashing the app
      this.sqlClient.client.__proto__._parseVersion = (v) => {
        try {
          return defaultParseVersionFn(v);
        } catch {
          unsupportedVariant = v.split(' ')[0];
          return '0.0.0';
        }
      };

      this.sqlClient.client.__proto__.checkVersion = async (connection) => {
        return new Promise((resolve, reject) => {
          connection.query('select version();', (err, resp) => {
            if (err) return reject(err);

            if (!resp.rows || !resp.rows[0] || !resp.rows[0].version) {
              unsupportedVariant = true;
              return reject(
                new Error(
                  'Invalid version response, please confirm if your PG variant is supported.',
                ),
              );
            }

            resolve(
              this.sqlClient.client.__proto__._parseVersion(
                resp.rows[0].version,
              ),
            );
          });
        });
      };

      await this.raw('SELECT 1+1 as data');
    } catch (e1) {
      const connectionParamsWithoutDb = JSON.parse(
        JSON.stringify(this.connectionConfig),
      );
      connectionParamsWithoutDb.connection.database = 'postgres';
      const tempSqlClient = knex({
        ...connectionParamsWithoutDb,
        pool: { min: 0, max: 1 },
      });
      try {
        await tempSqlClient.raw('SELECT 1+1 as data');
        await tempSqlClient.destroy();
      } catch (e) {
        if (!/^database "[\w\d_]+" does not exist$/.test(e.message)) {
          log.ppe(e);
          result.code = -1;
          // send back original error message
          result.message = e1.message;
        }
      }
    } finally {
      log.api(`${_func}:result:`, result);
      this.sqlClient.client.__proto__._parseVersion = defaultParseVersionFn;
    }

    // if unsupported variant is found, return error message
    if (unsupportedVariant) {
      result.code = -1;
      result.message = `${unsupportedVariant} Postgres variant is not supported at the moment`;
    }

    return result;
  }
}
export default PGClient;
