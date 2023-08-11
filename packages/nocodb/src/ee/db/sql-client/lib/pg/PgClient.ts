import PGClientCE from 'src/db/sql-client/lib/pg/PgClient';
import knex from 'knex';
import find from 'lodash/find';
import Debug from '~/db/util/Debug';
import Result from '~/db/util/Result';

const log = new Debug('PGClient');

class PGClient extends PGClientCE {
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
   * @param args {tn}
   * @returns
   */
  async createTableIfNotExists(args) {
    const _func = this.createTableIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      /** ************** START : create _evolution table if not exists *************** */
      const exists = await this.sqlClient.raw(
        `SELECT table_schema,table_name as tn, table_catalog FROM information_schema.tables where table_schema=? and
         table_name = ? and table_catalog = ?`,
        [
          args.schema || this.schema,
          args.tn,
          this.connectionConfig.connection.database,
        ],
      );

      if (exists.rows.length === 0) {
        const data = await this.sqlClient.schema.createTable(
          args.tn,
          function (table) {
            table.increments();
            table.string('title').notNullable();
            table.string('titleDown').nullable();
            table.string('description').nullable();
            table.integer('batch').nullable();
            table.string('checksum').nullable();
            table.integer('status').nullable();
            table.dateTime('created');
            table.timestamps();
          },
        );
        log.debug('Table created:', `${args.tn}`, data);
      } else {
        log.debug(`${args.tn} tables exists`);
      }
      /** ************** END : create _evolution table if not exists *************** */
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async hasTable(args: any = {}) {
    const _func = this.hasTable.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT table_schema,table_name as tn, table_catalog FROM information_schema.tables where table_schema=? and table_name = ? and table_catalog = ?'`,
        [
          args.schema || this.schema,
          args.tn,
          this.connectionConfig.connection.database,
        ],
      );
      result.data.value = rows.length > 0;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - tables
   * @property {String} - tables[].tn
   */
  async tableList(args: any = {}) {
    const _func = this.tableList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { rows } = await this.raw(
        `SELECT table_schema as ts, table_name as tn,table_type
              FROM information_schema.tables
              where table_schema = ?
              ORDER BY table_schema, table_name`,
        [args.schema || this.schema],
      );

      result.data.list = rows.filter(
        ({ table_type }) => table_type.toLowerCase() === 'base table',
      );
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
          schema: args.schema || this.schema,
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

        column.cdf = response.rows[i].cdf;
        // ? response.rows[i].cdf.split("::")[0].replace(/'/g, "")
        // : response.rows[i].cdf;

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
   * @returns {Object[]} - indexes
   * @property {String} - indexes[].table -
   * @property {String} - indexes[].cn -
   * @property {String} - indexes[].key_name -
   * @property {String} - indexes[].non_unique -
   * @property {String} - indexes[].seq_in_index -
   * @property {String} - indexes[].collation -
   * @property {String} - indexes[].cardinality -
   * @property {String} - indexes[].sub_part -
   * @property {String} - indexes[].packed -
   * @property {String} - indexes[].null -
   * @property {String} - indexes[].index_type -
   * @property {String} - indexes[].comment -
   * @property {String} - indexes[].index_comment -
   * @property {String} - indexes[].cstn -
   * @property {String} - indexes[].cst - c = check constraint, f = foreign key constraint, p = primary key constraint, u = unique constraint, t = constraint trigger, x = exclusion constraint
   */
  async indexList(args: any = {}) {
    const _func = this.indexList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { rows } = await this.sqlClient.raw(
        `SELECT
      f.attname AS cn,
      i.relname as key_name,
      ix.indnatts, ix.indkey, f.attnum as seq_in_index,
      pg_catalog.format_type(f.atttypid,f.atttypmod) AS type,
      f.attnotnull as rqd,
      p.contype as cst,
      p.conname as cstn,
      CASE
          WHEN i.oid<>0 THEN true
          ELSE false
      END AS is_index,
      CASE
          WHEN p.contype = 'p' THEN true
          ELSE false
      END AS primarykey,
      CASE
          WHEN p.contype = 'u' THEN 0
      WHEN p.contype = 'p' THEN 0
          ELSE 1
      END AS non_unique_original,
      CASE
          WHEN p.contype = 'p' THEN true
          ELSE false
      END AS primarykey,
      CASE
          WHEN p.contype = 'u' THEN 0
      WHEN p.contype = 'p' THEN 0
          ELSE 1
      END AS non_unique,
      CASE
          WHEN f.atthasdef = 't' THEN pg_get_expr(d.adbin, d.adrelid)
      END AS default  FROM pg_attribute f
      JOIN pg_class c ON c.oid = f.attrelid
      JOIN pg_type t ON t.oid = f.atttypid
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = f.attnum
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_constraint p ON p.conrelid = c.oid AND f.attnum = ANY (p.conkey)
      LEFT JOIN pg_class AS g ON p.confrelid = g.oid
      LEFT JOIN pg_index AS ix ON f.attnum = ANY(ix.indkey) and c.oid = f.attrelid and c.oid = ix.indrelid
      LEFT JOIN pg_class AS i ON ix.indexrelid = i.oid
      WHERE
        c.relkind = 'r'::char
      AND n.nspname = ?
      AND c.relname = ?
      and i.oid<>0
      AND f.attnum > 0
      ORDER BY i.relname, f.attnum;`,
        [args.schema || this.schema, args.tn],
      );
      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
   * @param {String} - args.indexName
   * @param {String} - args.non_unique
   * @param {String[]} - args.columns
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async indexCreate(args) {
    const _func = this.indexCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const indexName = args.indexName || null;

    try {
      args.table = args.schema ? `${args.schema}.${args.tn}` : args.tn;

      // s = await this.sqlClient.schema.index(Object.keys(args.columns));
      await this.sqlClient.schema.table(args.table, function (table) {
        if (args.non_unique) {
          table.index(args.columns, indexName);
        } else {
          table.unique(args.columns, indexName);
        }
      });

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique) {
              table.index(args.columns, indexName);
            } else {
              table.unique(args.columns, indexName);
            }
          })
          .toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique) {
              table.dropIndex(args.columns, indexName);
            } else {
              table.dropUnique(args.columns, indexName);
            }
          })
          .toQuery();

      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };

      // result.data.object = {
      //   upStatement,
      //   downStatement
      // };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
   * @param {String[]} - args.columns
   * @param {String} - args.indexName
   * @param {String} - args.non_unique
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async indexDelete(args) {
    const _func = this.indexDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const indexName = args.indexName || null;

    try {
      args.table = args.schema ? `${args.schema}.${args.tn}` : args.tn;

      // s = await this.sqlClient.schema.index(Object.keys(args.columns));
      await this.sqlClient.schema.table(args.table, function (table) {
        if (args.non_unique_original) {
          table.dropIndex(args.columns, indexName);
        } else {
          table.dropUnique(args.columns, indexName);
        }
      });

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique_original) {
              table.dropIndex(args.columns, indexName);
            } else {
              table.dropUnique(args.columns, indexName);
            }
          })
          .toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.table, function (table) {
            if (args.non_unique_original) {
              table.index(args.columns, indexName);
            } else {
              table.unique(args.columns, indexName);
            }
          })
          .toQuery();

      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.parentTable
   * @param {String} - args.parentColumn
   * @param {String} - args.childColumn
   * @param {String} - args.childTable
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async relationCreate(args) {
    const _func = this.relationCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const foreignKeyName = args.foreignKeyName || null;

    args.childTableWithSchema = args.schema
      ? `${args.schema}.${args.childTable}`
      : args.childTable;

    args.parentTableWithSchema = args.schema
      ? `${args.schema}.${args.parentTable}`
      : args.parentTable;

    try {
      const upQb = this.sqlClient.schema.table(
        args.childTableWithSchema,
        function (table) {
          table = table
            .foreign(args.childColumn, foreignKeyName)
            .references(args.parentColumn)
            .on(args.parentTableWithSchema);

          if (args.onUpdate) {
            table = table.onUpdate(args.onUpdate);
          }
          if (args.onDelete) {
            table.onDelete(args.onDelete);
          }
        },
      );

      await upQb;

      const upStatement = this.querySeparator() + upQb.toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTableWithSchema, function (table) {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery();

      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.parentTable
   * @param {String} - args.parentColumn
   * @param {String} - args.childColumn
   * @param {String} - args.childTable
   * @param {String} - args.foreignKeyName
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async relationDelete(args) {
    const _func = this.relationDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    const foreignKeyName = args.foreignKeyName || null;

    args.childTableWithSchema = args.schema
      ? `${args.schema}.${args.childTable}`
      : args.childTable;

    args.parentTableWithSchema = args.schema
      ? `${args.schema}.${args.parentTable}`
      : args.parentTable;

    try {
      // const self = this;

      await this.sqlClient.schema.table(
        args.childTableWithSchema,
        function (table) {
          table.dropForeign(args.childColumn, foreignKeyName);
        },
      );

      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .table(args.childTableWithSchema, function (table) {
            table.dropForeign(args.childColumn, foreignKeyName);
          })
          .toQuery();

      const downStatement =
        this.querySeparator() +
        (await this.sqlClient.schema
          .table(args.childTableWithSchema, function (table) {
            table
              .foreign(args.childColumn, foreignKeyName)
              .references(args.parentColumn)
              .on(args.parentTableWithSchema);
          })
          .toQuery());

      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

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
        [args.schema || this.schema, args.tn],
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
  async relationListAll(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
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
        WHERE pc.contype = 'f' AND sch.nspname = ?
        ORDER BY tn;`,
        [args.schema || this.schema],
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
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.tn -
   * @returns {Object[]} - triggers
   * @property {String} - triggers[].trigger
   * @property {String} - triggers[].event
   * @property {String} - triggers[].table
   * @property {String} - triggers[].statement
   * @property {String} - triggers[].timing
   * @property {String} - triggers[].created
   * @property {String} - triggers[].sql_mode
   * @property {String} - triggers[].definer
   * @property {String} - triggers[].character_set_client
   * @property {String} - triggers[].collation_connection
   * @property {String} - triggers[].database collation
   */
  async triggerList(args: any = {}) {
    const _func = this.triggerList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.sqlClient.raw(
        `select * from information_schema.triggers where trigger_schema=? and event_object_table=?`,
        [args.schema || this.schema, args.tn],
      );

      for (let i = 0; i < rows.length; ++i) {
        rows[i].statement = rows[i].action_statement;
        rows[i].table = rows[i].event_object_table;
        rows[i].trigger = rows[i].trigger_name;
        rows[i].event = rows[i].event_manipulation;
        rows[i].timing = rows[i].action_timing;
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
   *
   * @param {Object} - args - Input arguments
   * @returns {Object[]} - functions
   * @property {String} - functions[].function_name
   * @property {String} - functions[].type
   * @property {String} - functions[].definer
   * @property {String} - functions[].modified
   * @property {String} - functions[].created
   * @property {String} - functions[].security_type
   * @property {String} - functions[].comment
   * @property {String} - functions[].character_set_client
   * @property {String} - functions[].collation_connection
   * @property {String} - functions[].database collation
   */
  async functionList(args: any = {}) {
    const _func = this.functionList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.raw(
        `SELECT *
              FROM pg_catalog.pg_namespace n
                     JOIN pg_catalog.pg_proc p
                          ON pronamespace = n.oid
              WHERE nspname = ?;`,
        [args.schema || this.schema],
      );
      const functionRows = [];
      for (let i = 0; i < rows.length; ++i) {
        if (!('prokind' in rows[i]) || rows[i].prokind !== 'p')
          functionRows.push({
            create_function: rows[i].prosrc,
            function_name: rows[i].proname,
          });
      }

      result.data.list = functionRows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   * @todo Remove the function - pg doesn't support procedure
   *
   * @param {Object} - args - For future reasons
   * @returns {Object[]} - procedures
   * @property {String} - procedures[].procedure_name
   * @property {String} - procedures[].type
   * @property {String} - procedures[].definer
   * @property {String} - procedures[].modified
   * @property {String} - procedures[].created
   * @property {String} - procedures[].security_type
   * @property {String} - procedures[].comment
   * @property {String} - procedures[].definer
   * @property {String} - procedures[].character_set_client
   * @property {String} - procedures[].collation_connection
   * @property {String} - procedures[].database collation
   */
  async procedureList(args: any = {}) {
    const _func = this.procedureList.name;
    const result = new Result();
    result.data.list = [];
    log.api(`${_func}:args:`, args);

    // todo: update query - https://dataedo.com/kb/query/postgresql/list-stored-procedures
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.raw(
        `SELECT *
              FROM pg_catalog.pg_namespace n
                     JOIN pg_catalog.pg_proc p
                          ON pronamespace = n.oid
              WHERE nspname = ?;`,
        [args.schema || this.schema],
      );
      const procedureRows = [];
      for (let i = 0; i < rows.length; ++i) {
        if ('prokind' in rows[i] && rows[i].prokind === 'p')
          procedureRows.push({
            create_procedure: rows[i].prosrc,
            procedure_name: rows[i].proname,
          });
      }

      result.data.list = procedureRows;
    } catch (e) {
      // todo: enable log
      // log.ppe(e, _func);
      // throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @returns {Object[]} - views
   * @property {String} - views[].sql_mode
   * @property {String} - views[].create_function
   * @property {String} - views[].database collation
   * @property {String} - views[].collation_connection
   * @property {String} - views[].character_set_client
   */
  async viewList(args: any = {}) {
    const _func = this.viewList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const { rows } = await this.sqlClient.raw(
        `select *
           from INFORMATION_SCHEMA.views
           WHERE table_schema = ?;`,
        [args.schema || this.schema],
      );

      for (let i = 0; i < rows.length; ++i) {
        rows[i].view_name = rows[i].tn || rows[i].table_name;
        // rows[i].view_definition = rows[i].view_definition;
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
   *
   * @param {Object} - args - Input arguments
   * @param {Object} - args.function_name -
   * @returns {Object[]} - functions
   * @property {String} - create_function
   * @property {String} - function_declaration
   */
  async functionRead(args: any = {}) {
    const _func = this.functionRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const { rows } = await this.sqlClient.raw(
        `SELECT format('%I.%I(%s)', ns.nspname, p.proname, oidvectortypes(p.proargtypes)) as function_declaration, pg_get_functiondef(p.oid) as create_function
                FROM pg_proc p INNER JOIN pg_namespace ns ON (p.pronamespace = ns.oid)
            WHERE ns.nspname = ? and p.proname = ?;`,
        [args.schema || this.schema, args.function_name],
      );

      // log.debug(response);

      for (let i = 0; i < rows.length; ++i) {
        rows[i].function_name = args.function_name;
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async afterTableCreate(args) {
    const result = { upStatement: [], downStatement: [] };
    let upQuery = '';
    let downQuery = '';

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au) {
        const triggerFnName = args.schema
          ? `xc_au_${args.schema}_${args.tn}_${column.cn}`
          : `xc_au_${args.tn}_${column.cn}`;
        const triggerName = args.schema
          ? `xc_trigger_${args.schema}_${args.tn}_${column.cn}`
          : `xc_trigger_${args.tn}_${column.cn}`;

        const triggerFnQuery = this.genQuery(
          `CREATE OR REPLACE FUNCTION ??()
                          RETURNS TRIGGER AS $$
                          BEGIN
                            NEW.?? = NOW();
                            RETURN NEW;
                          END;
                          $$ LANGUAGE plpgsql;`,
          [triggerFnName, column.cn],
        );

        upQuery +=
          this.querySeparator() +
          triggerFnQuery +
          this.querySeparator() +
          this.genQuery(
            `CREATE TRIGGER ??
            BEFORE UPDATE ON ??
            FOR EACH ROW
            EXECUTE PROCEDURE ??();`,
            [
              triggerName,
              args.schema ? `${args.schema}.${args.tn}` : args.tn,
              triggerFnName,
            ],
          );

        downQuery +=
          this.querySeparator() +
          this.genQuery(`DROP TRIGGER IF EXISTS ?? ON ??;`, [
            triggerName,
            args.schema ? `${args.schema}.${args.tn}` : args.tn,
          ]) +
          this.querySeparator() +
          this.genQuery(`DROP FUNCTION IF EXISTS ??()`, [triggerFnName]);
      }
    }
    if (upQuery !== '') await this.sqlClient.raw(upQuery);
    result.upStatement[0] = { sql: upQuery };
    result.downStatement[0] = { sql: downQuery };

    return result;
  }

  async afterTableUpdate(args) {
    const result = { upStatement: [], downStatement: [] };
    let upQuery = '';
    let downQuery = '';

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au && column.altered === 1) {
        const triggerFnName = args.schema
          ? `xc_au_${args.schema}_${args.tn}_${column.cn}`
          : `xc_au_${args.tn}_${column.cn}`;
        const triggerName = args.schema
          ? `xc_trigger_${args.schema}_${args.tn}_${column.cn}`
          : `xc_trigger_${args.tn}_${column.cn}`;

        const triggerFnQuery = this.genQuery(
          `CREATE OR REPLACE FUNCTION ??()
                          RETURNS TRIGGER AS $$
                          BEGIN
                            NEW.?? = NOW();
                            RETURN NEW;
                          END;
                          $$ LANGUAGE plpgsql;`,
          [triggerFnName, column.cn],
        );

        upQuery +=
          this.querySeparator() +
          triggerFnQuery +
          this.querySeparator() +
          this.genQuery(
            `CREATE TRIGGER ??
            BEFORE UPDATE ON ??
            FOR EACH ROW
            EXECUTE PROCEDURE ??();`,
            [
              triggerName,
              args.schema ? `${args.schema}.${args.tn}` : args.tn,
              triggerFnName,
            ],
          );

        downQuery +=
          this.querySeparator() +
          this.genQuery(`DROP TRIGGER IF EXISTS ?? ON ??;`, [
            triggerName,
            args.tn,
          ]) +
          this.querySeparator() +
          this.genQuery(`DROP FUNCTION IF EXISTS ??()`, [triggerFnName]);
      }
    }
    if (upQuery !== '') await this.sqlClient.raw(upQuery);
    result.upStatement[0] = { sql: upQuery };
    result.downStatement[0] = { sql: downQuery };

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.table
   * @param {String} - args.table
   * @param {Object[]} - args.columns
   * @param {String} - args.columns[].tn
   * @param {String} - args.columns[].cn
   * @param {String} - args.columns[].dt
   * @param {String} - args.columns[].np
   * @param {String} - args.columns[].ns -
   * @param {String} - args.columns[].clen -
   * @param {String} - args.columns[].dp -
   * @param {String} - args.columns[].cop -
   * @param {String} - args.columns[].pk -
   * @param {String} - args.columns[].nrqd -
   * @param {String} - args.columns[].not_nullable -
   * @param {String} - args.columns[].ct -
   * @param {String} - args.columns[].un -
   * @param {String} - args.columns[].ai -
   * @param {String} - args.columns[].unique -
   * @param {String} - args.columns[].cdf -
   * @param {String} - args.columns[].cc -
   * @param {String} - args.columns[].csn -
   * @param {Number} - args.columns[].altered - 1,2,4 = addition,edited,deleted
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableUpdate(args) {
    const _func = this.tableUpdate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.schema ? `${args.schema}.${args.tn}` : args.tn;
      const originalColumns = args.originalColumns;
      args.connectionConfig = this._connectionConfig;
      args.sqlClient = this.sqlClient;

      let upQuery = '';
      let downQuery = '';

      for (let i = 0; i < args.columns.length; ++i) {
        const oldColumn = find(originalColumns, {
          cn: args.columns[i].cno,
        });

        if (args.columns[i].altered & 4) {
          // col remove
          upQuery += this.alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableAddColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 2 || args.columns[i].altered & 8) {
          // col edit
          upQuery += this.alterTableChangeColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableChangeColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 1) {
          // col addition
          upQuery += this.alterTableAddColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += this.alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            downQuery,
          );
        }
      }

      upQuery +=
        (upQuery ? ';' : '') +
        this.alterTablePK(
          args.table,
          args.columns,
          args.originalColumns,
          upQuery,
        );
      downQuery +=
        (downQuery ? ';' : '') +
        this.alterTablePK(
          args.table,
          args.originalColumns,
          args.columns,
          downQuery,
        );

      if (upQuery) {
        //upQuery = `ALTER TABLE "${args.columns[0].tn}" ${upQuery};`;
        //downQuery = `ALTER TABLE "${args.columns[0].tn}" ${downQuery};`;
      }

      if (upQuery !== '') await this.sqlClient.raw(upQuery);

      // console.log(upQuery);

      const afterUpdate = await this.afterTableUpdate(args);

      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + upQuery },
          ...afterUpdate.upStatement,
        ],
        downStatement: [
          ...afterUpdate.downStatement,
          { sql: this.querySeparator() + downQuery },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param args.tn
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableDelete(args) {
    const _func = this.tableDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      // const { columns } = args;
      args.sqlClient = this.sqlClient;

      /** ************** create up & down statements *************** */
      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .dropTable(args.schema ? `${args.schema}.${args.tn}` : args.tn)
          .toString();
      let downQuery = this.createTable(args.tn, args);

      /**

       columnList
       relationList
       indexesList
       createAggregatedIndexes
       filterOutPkAndFk

       downQuery
       create table    - via columnList - we are doing this
       + create fks      - via relationList
       + create indexes  - slightly tricky

       */

      let relationsList: any = await this.relationList(args);

      relationsList = relationsList.data.list;

      for (const relation of relationsList) {
        downQuery +=
          this.querySeparator() +
          (await this.sqlClient.schema
            .table(relation.tn, function (table) {
              table = table
                .foreign(relation.cn, null)
                .references(relation.rcn)
                .on(relation.rtn);

              if (relation.ur) {
                table = table.onUpdate(relation.ur);
              }
              if (relation.dr) {
                table.onDelete(relation.dr);
              }
            })
            .toQuery());
      }

      let indexList: any = await this.indexList(args);

      indexList = indexList.data.list.filter(
        ({ cst }) => cst !== 'p' && cst !== 'f',
      );

      const indexesMap: { [key: string]: any } = {};

      for (const { key_name, non_unique, cn } of indexList) {
        if (!(key_name in indexesMap)) {
          indexesMap[key_name] = {
            tn: args.tn,
            indexName: key_name,
            non_unique,
            columns: [],
          };
        }
        indexesMap[key_name].columns.push(cn);
      }

      for (const { non_unique, tn, columns, indexName } of Object.values(
        indexesMap,
      )) {
        downQuery +=
          this.querySeparator() +
          this.sqlClient.schema
            .table(tn, function (table) {
              if (non_unique) {
                table.index(columns, indexName);
              } else {
                table.unique(columns, indexName);
              }
            })
            .toQuery();
      }

      this.emit(`Success : ${upStatement}`);

      /** ************** drop tn *************** */
      await this.sqlClient.schema.dropTable(
        args.schema ? `${args.schema}.${args.tn}` : args.tn,
      );

      /** ************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: this.querySeparator() + downQuery }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  createTable(table, args) {
    let query = '';

    for (let i = 0; i < args.columns.length; ++i) {
      query += this.createTableColumn(table, args.columns[i], null, query);
    }

    query += this.alterTablePK(table, args.columns, [], query, true);

    query = this.genQuery(`CREATE TABLE ?? (${query});`, [
      args.schema ? `${args.schema}.${args.tn}` : args.tn,
    ]);

    return query;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
   * @param {String} - args.tn_old
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableRename(args) {
    const _func = this.tableCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.tn;

      /** ************** create table *************** */
      await this.sqlClient.schema.renameTable(
        this.sqlClient.raw('??.??', [args.schema || this.schema, args.tn_old]),
        args.tn,
      );

      /** ************** create up & down statements *************** */
      const upStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .renameTable(
            this.sqlClient.raw('??.??', [args.schema || this.schema, args.tn]),
            args.tn_old,
          )
          .toQuery();

      this.emit(`Success : ${upStatement}`);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema
          .renameTable(
            this.sqlClient.raw('??.??', [
              args.schema || this.schema,
              args.tn_old,
            ]),
            args.tn,
          )
          .toQuery();

      /** ************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upStatement }],
        downStatement: [{ sql: downStatement }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }
}
export default PGClient;
