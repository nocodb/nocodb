import knex from 'knex';
import mapKeys from 'lodash/mapKeys';
import find from 'lodash/find';
import KnexClient from '../KnexClient';
import Debug from '../../../util/Debug';
import Result from '../../../util/Result';
import deepClone from '~/helpers/deepClone';

const log = new Debug('OracleClient');

class OracleClient extends KnexClient {
  constructor(connectionConfig) {
    // connectionConfig.connection.user = connectionConfig.connection.user.toUpperCase();
    super(connectionConfig);
  }

  getKnexDataTypes() {
    const result = new Result();

    // result.data.list = [
    //   "integer",
    //   "bigInteger",
    //   "text",
    //   "string",
    //   "float",
    //   "decimal",
    //   "boolean",
    //   "date",
    //   // "datetime",
    //   "time",
    //   "timestamp",
    //   "binary",
    //   "enu",
    //   "json",
    //   "specificType"
    // ];

    result.data.list = [
      'bfile',
      'binary rowid',
      'binary double',
      'binary_float',
      'blob',
      'canoical',
      'cfile',
      'char',
      'clob',
      'content pointer',
      'contigous array',
      'date',
      'decimal',
      'double precision',
      'float',
      'integer',
      'interval day to second',
      'interval year to month',
      'lob pointer',
      'long',
      'long raw',
      'named collection',
      'named object',
      'nchar',
      'nclob',
      'number',
      'nvarchar2',
      'octet',
      'oid',
      'pointer',
      'raw',
      'real',
      'ref',
      'ref cursor',
      'rowid',
      'signed binary integer',
      'smallint',
      'table',
      'time',
      'time with tz',
      'timestamp',
      'timestamp with local time zone',
      'timestamp with local tz',
      'timestamp with timezone',
      'timestamp with tz',
      'unsigned binary integer',
      'urowid',
      'varchar',
      'varchar2',
      'varray',
      'varying array',
    ];

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

    try {
      await this.raw(`SELECT 1+1 AS "data" FROM DUAL`);
    } catch (e) {
      log.ppe(e);
      result.code = -1;
      result.message = e.message;
    } finally {
      log.api(`${_func}:result:`, result);
    }

    return result;
  }

  async version(args: any = {}) {
    const _func = this.version.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const rows = await this.raw(
        `SELECT * FROM PRODUCT_COMPONENT_VERSION WHERE product LIKE 'Oracle%'`,
      );
      result.data.object = {};

      let versionDetails = rows[0];
      versionDetails = mapKeys(versionDetails, (_v, k) => k.toLowerCase());
      const version = versionDetails.version.split('.');
      result.data.object.version = versionDetails.version;
      result.data.object.primary = version[0];
      result.data.object.major = version[1];
      result.data.object.minor = version[2];
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
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

    try {
      const connectionParamsWithoutDb = deepClone(this.connectionConfig);
      connectionParamsWithoutDb.connection.password =
        this.connectionConfig.connection.password;
      connectionParamsWithoutDb.connection.database = 'xe';
      connectionParamsWithoutDb.connection.user = 'system';
      connectionParamsWithoutDb.connection.password = 'oracle';
      // log.debug(connectionParamsWithoutDb);
      const tempSqlClient = knex(connectionParamsWithoutDb);

      log.debug('checking if db exists');
      const rows = await tempSqlClient.raw(
        `select USERNAME from SYS.ALL_USERS WHERE USERNAME = '${this.connectionConfig.connection.user}'`,
      );

      if (rows.length === 0) {
        log.debug('creating database:', args);
        await tempSqlClient.raw(
          `CREATE USER ${this.connectionConfig.connection.user} IDENTIFIED BY ${this.connectionConfig.connection.user}`,
        );
        await tempSqlClient.raw(
          `GRANT ALL PRIVILEGES TO ${this.connectionConfig.connection.user}`,
        );
        await tempSqlClient.raw(
          `GRANT EXECUTE ON DBMS_AQ TO ${this.connectionConfig.connection.user}`,
        );
        await tempSqlClient.raw(
          `GRANT EXECUTE ON DBMS_AQADM TO ${this.connectionConfig.connection.user}`,
        );
      }

      await tempSqlClient.destroy();
      // create new knex client
      this.sqlClient = knex(this.connectionConfig);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  async dropDatabase(args) {
    const _func = this.dropDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const connectionParamsWithoutDb = deepClone(this.connectionConfig);
      connectionParamsWithoutDb.connection.password =
        this.connectionConfig.connection.password;
      connectionParamsWithoutDb.connection.database = 'xe';
      connectionParamsWithoutDb.connection.user = 'system';
      connectionParamsWithoutDb.connection.password = 'oracle';
      // log.debug(connectionParamsWithoutDb);
      const tempSqlClient = knex(connectionParamsWithoutDb);
      await this.sqlClient.destroy();
      log.debug('dropping database:', this.connectionConfig.connection.user);
      // await tempSqlClient.raw(`ALTER SYSTEM enable restricted session`);
      const sessions =
        await tempSqlClient.raw(`select SID,SERIAL# from v$session where username =  '${this.connectionConfig.connection.user}'
      `);
      log.debug(
        `Active Sessions for ${this.connectionConfig.connection.user}: `,
        sessions,
      );
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        await tempSqlClient.raw(
          `alter system kill session '${session.SID},${session['SERIAL#']}' immediate`,
        );
      }

      // await tempSqlClient.raw(`ALTER SYSTEM disable restricted session`);
      await tempSqlClient.raw(
        `drop user ${this.connectionConfig.connection.user} cascade`,
      );
      log.debug('dropped database:', this.connectionConfig.connection.user);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
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
      const exists = await this.hasTable({ tn: args.tn });

      if (!exists.data.value) {
        await this.sqlClient.schema.createTable(args.tn, function (table) {
          // table.increments();
          table.string('title').notNullable();
          table.string('titleDown').nullable();
          table.string('description').nullable();
          table.integer('batch').nullable();
          table.string('checksum').nullable();
          table.integer('status').nullable();
          table.dateTime('created');
          table.timestamps();
        });
        log.debug('Table created:', `${args.tn}`);
      } else {
        log.debug(`${args.tn} tables exists`);
      }
      /** ************** END : create _evolution table if not exists *************** */
    } catch (e) {
      log.ppe(e, _func);
      if (
        // INFO: knex issue
        JSON.stringify(e.message).indexOf(
          'exact fetch returns more than requested number of rows',
        ) > -1
      ) {
        log.warn(
          `safely ignored Exception:exact fetch returns more than requested number of rows knex create table issue`,
        );
      } else {
        throw e;
      }
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  // async startTransaction() {
  //   let err = await this.raw("SET autocommit = 0");
  //   log.debug("SET autocommit = 0:", err);
  //   err = await this.raw("start transaction");
  //   log.debug("start transaction:", err);
  // }

  // async commit() {
  //   const err = await this.raw("commit");
  //   log.debug("commit:", err);
  //   await this.raw("SET autocommit = 1");
  //   log.debug("SET autocommit = 1:", err);
  // }

  // async rollback() {
  //   const err = await this.raw("rollback");
  //   log.debug("rollback:", err);
  //   await this.raw("SET autocommit = 1");
  //   log.debug("SET autocommit = 1:", err);
  // }

  async hasTable(args: any = {}) {
    const _func = this.hasTable.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const rows = await this.raw(
        `select TABLE_NAME as tn FROM all_tables WHERE OWNER = '${this.connectionConfig.connection.user}' AND tn = '${args.tn}'`,
      );
      result.data.value = rows.length > 0;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async hasDatabase(args: any = {}) {
    const _func = this.hasDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const rows = await this.raw(
        `select USERNAME from SYS.ALL_USERS WHERE USERNAME = '${args.databaseName}'`,
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
   * @returns {Object[]} - databases
   * @property {String} - databases[].database_name
   */
  async databaseList(args: any = {}) {
    const _func = this.databaseList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const rows = await this.raw(
        `select USERNAME as "database_name" from SYS.ALL_USERS order by USERNAME`,
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
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - tables
   * @property {String} - tables[].tn
   */
  async tableList(args: any = {}) {
    const _func = this.tableList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.databaseName = this.connectionConfig.connection.user;

      const rows = await this.raw(
        `select table_name FROM all_tables WHERE owner='${args.databaseName}'`,
      );
      for (let i = 0; i < rows.length; i++) {
        let el = rows[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        rows[i] = el;
      }

      result.data.list = rows;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async schemaList(args: any = {}) {
    const _func = this.schemaList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const rows = await this.raw(
        `SELECT username AS schema_name
                          FROM dba_users u
                         WHERE ACCOUNT_STATUS = 'OPEN' AND EXISTS (
                            SELECT 1
                              FROM dba_objects o
                             WHERE o.owner = u.username )
                           AND default_tablespace not in ('SYSTEM','SYSAUX') `,
      );
      for (let i = 0; i < rows.length; i++) {
        let el = rows[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        rows[i] = el;
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
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(`SELECT
      seq.sequence_name,
      CASE
        WHEN seq.sequence_name IS NOT NULL
        AND p.constraint_type = 'P' THEN 1
        ELSE 0
      END as ai,
      c.table_name as tn,
      c.column_name AS cn,
      c.column_id AS cop,
      p.constraint_type AS ck,
      c.NULLABLE AS nrqd,
      c.DATA_TYPE AS dt,
      c.DATA_LENGTH,
      c.DATA_PRECISION,
      c.DEFAULT_LENGTH,
      c.DATA_DEFAULT AS cdf,
      c.character_set_name as csn,
      c.CHAR_LENGTH AS clen,
      -- c.DEFAULT_ON_NULL,
      c.LOW_VALUE,
      c.HIGH_VALUE,
      c.DATA_SCALE AS ns,
      p.constraint_name AS pk_constraint_name,
      p.POSITION AS p_con_ordinal_position
    FROM
      SYS.ALL_TAB_COLS c
    LEFT JOIN(
        SELECT
          a.table_name,
          a.column_name,
          a.constraint_name,
          c.constraint_type,
          a.position,
          c_pk.table_name r_table_name,
          c_pk.constraint_name r_pk,
          cc_pk.column_name r_column_name
        FROM
          all_cons_columns a
        JOIN all_constraints c ON
          (
            a.owner = c.owner
            AND a.constraint_name = c.constraint_name
          )
        LEFT JOIN all_constraints c_pk ON
          (
            c.r_owner = c_pk.owner
            AND c.r_constraint_name = c_pk.constraint_name
          )
        LEFT JOIN all_cons_columns cc_pk ON
          (
            cc_pk.owner = c_pk.owner
            AND cc_pk.constraint_name = c_pk.constraint_name
          )
        WHERE
          a.owner = '${args.databaseName}'
          AND c.constraint_type = 'P'
      ) p ON
      c.table_name = p.table_name
      AND c.column_name = p.column_name
    LEFT OUTER JOIN(
        SELECT
          t.table_name,
          d.referenced_name AS sequence_name,
          d.REFERENCED_OWNER AS OWNER,
          c.COLUMN_NAME
        FROM
          user_trigger_cols t,
          user_dependencies d,
          user_tab_cols c
        WHERE
          d.name = t.trigger_name
          AND t.TABLE_NAME = c.TABLE_NAME
          AND t.COLUMN_NAME = c.COLUMN_NAME
          AND d.referenced_type = 'SEQUENCE'
          AND d.type = 'TRIGGER'
      ) seq ON
      c.table_name = seq.table_name
      AND c.column_name = seq.column_name
    WHERE
      c.owner = '${args.databaseName}' AND  c.table_name = '${args.tn}'
    ORDER BY
      c.table_name,
      c.column_id,
      c.column_name`);

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.np = el.data_precision;
        el.pk = el.ck === 'P';
        el.nrqd = el.nrqd === 'Y';
        el.not_nullable = el.nrqd === 'N';
        el.ai = el.ai === 1;

        el.cno = el.cn;
        el.dtxp = el.clen || el.np;
        // ||
        //   el.dp;;
        el.dtxs = el.ns;

        el.au = false;

        response[i] = el;
      }

      result.data.list = response;
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
   */
  async indexList(args: any = {}) {
    const _func = this.indexList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `select ind_col.COLUMN_POSITION AS postion, ind.index_name as key_name,
        ind_col.column_name as cn,
        ind.index_type,
        ind.uniqueness,
        ind.table_owner as schema_name,
        ind.table_name as tn,
        ind.table_type as table_type
        from sys.all_indexes ind
        inner join sys.all_ind_columns ind_col on ind.owner = ind_col.index_owner
        and ind.index_name = ind_col.index_name
        where ind.owner = '${args.databaseName}'  AND ind.table_name  = '${args.tn}'
        order by ind.table_owner, ind.table_name, ind.index_name, ind_col.column_position`,
      );

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.table = el.tn;
        el.non_unique = el.uniqueness === 'NONUNIQUE' ? 1 : 0;
        el.non_unique_original = el.uniqueness === 'NONUNIQUE' ? 1 : 0;
        el.seq_in_index = el.postion;
        response[i] = el;
      }

      result.data.list = response;
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
   * @property {String} - indexes[].cstn -
   * @property {String} - indexes[].cn -
   * @property {String} - indexes[].op -
   * @property {String} - indexes[].puc -
   * @property {String} - indexes[].cst -
   */
  async constraintList(args: any = {}) {
    const _func = this.constraintList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `SELECT cols.table_name as tn, cols.column_name as cn, cols.position, cons.*
        FROM all_constraints cons, all_cons_columns cols
        WHERE cols.table_name = '${args.tn}' AND cols.owner = '${args.databaseName}'
        AND cons.constraint_type in ('P','R','U') AND cons.constraint_name = cols.constraint_name
        AND cons.owner = cols.owner ORDER BY cons.constraint_name, cols.position`,
      );

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.table = el.tn;
        if (el.cst === 'P') el.cst = 'Primary Key';
        if (el.cst === 'U') el.cst = 'Unique';
        if (el.cst === 'R') el.cst = 'Foreign Key';

        el.op = el.position;
        response[i] = el;
      }

      result.data.list = response;
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
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(`SELECT
        a.table_name as tn,
        a.column_name as cn,
        a.constraint_name cstn,
        c.constraint_type cst,
        a.position,
        c_pk.table_name r_table_name,
        c_pk.constraint_name r_pk,
        cc_pk.column_name r_column_name,
        c.delete_rule dr
      FROM
        all_cons_columns a
      JOIN all_constraints c ON
        (	a.owner = c.owner
          AND a.constraint_name = c.constraint_name )
      LEFT JOIN all_constraints c_pk ON
        (	c.r_owner = c_pk.owner
          AND c.r_constraint_name = c_pk.constraint_name )
      LEFT JOIN all_cons_columns cc_pk ON
        (	cc_pk.owner = c_pk.owner
          AND cc_pk.constraint_name = c_pk.constraint_name )
      WHERE  a.owner = '${args.databaseName}'
        AND c.constraint_type = 'R'

      `);

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.rtn = el.r_table_name;
        el.rcn = el.r_column_name;
        el.non_unique = el.uniqueness === 'NONUNIQUE';
        el.puc = el.position;
        response[i] = el;
      }
      result.data.list = response;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async relationListAll(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(`SELECT
        a.table_name as tn,
        a.column_name as cn,
        a.constraint_name cstn,
        c.constraint_type cst,
        a.position puc,
        c_pk.table_name r_table_name,
        c_pk.constraint_name r_pk,
        cc_pk.column_name r_column_name,
        c.delete_rule dr
      FROM
        all_cons_columns a
      JOIN all_constraints c ON
        (	a.owner = c.owner
          AND a.constraint_name = c.constraint_name )
      LEFT JOIN all_constraints c_pk ON
        (	c.r_owner = c_pk.owner
          AND c.r_constraint_name = c_pk.constraint_name )
      LEFT JOIN all_cons_columns cc_pk ON
        (	cc_pk.owner = c_pk.owner
          AND cc_pk.constraint_name = c_pk.constraint_name )
      WHERE  a.owner = '${args.databaseName}'
        AND c.constraint_type = 'R'

      `);

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.rtn = el.r_table_name;
        el.rcn = el.r_column_name;
        el.non_unique = el.uniqueness === 'NONUNIQUE';
        // el.puc = el.puc;
        response[i] = el;
      }
      result.data.list = response;
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
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.sqlClient
        .raw(`select owner as trigger_schema_name, trigger_name, trigger_type,
      triggering_event, table_owner as schema_name, table_name as object_name, base_object_type as object_type,
      status, trigger_body as script     from sys.all_triggers
      -- excluding some Oracle maintained schemas
      where owner = '${args.databaseName}' order by trigger_name, table_owner, table_name, base_object_type`);

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.trigger = el.trigger_name;
        el.table = el.object_name;
        el.event = el.triggering_event;
        el.timing = el.trigger_type;
        el.statement = el.script;
        response[i] = el;
      }

      result.data.list = response;
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
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `SELECT *  FROM ALL_OBJECTS WHERE owner = '${args.databaseName}' and OBJECT_TYPE IN ('FUNCTION','PROCEDURE','PACKAGE')`,
      );

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.function_name = el.object_name;
        el.type = el.object_type;
        response[i] = el;
      }

      result.data.list = response;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  /**
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
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `SELECT *  FROM ALL_OBJECTS WHERE owner = '${args.databaseName}' and OBJECT_TYPE IN ('FUNCTION','PROCEDURE','PACKAGE')`,
      );

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.procedure_name = el.object_name;
        el.type = el.object_type;
        response[i] = el;
      }

      result.data.list = response;
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
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `SELECT * FROM all_views WHERE owner='${args.databaseName}'`,
      );

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.view_name = el.object_name;
        response[i] = el;
      }

      result.data.list = response;
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
   * @property {String} - sql_mode
   * @property {String} - create_function
   * @property {String} - database collation
   * @property {String} - collation_connection
   * @property {String} - character_set_client
   */
  async functionRead(args: any = {}) {
    const _func = this.functionRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `SELECT * FROM all_source  WHERE TYPE = 'FUNCTION' AND OWNER = '${args.databaseName}' AND NAME = '${args.function_name}' ORDER BY line`,
      );
      const rows = [];
      if (response.length > 0) {
        let script = '';
        for (let i = 0; i < response.length; i++) {
          let el = response[i];
          el = mapKeys(el, (_v, k) => k.toLowerCase());
          el.function_name = el.name;
          response[i] = el;
          script += el.text;
        }
        response[0].create_function = script;
        rows.push(response[0]);
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
   * @param {Object} - args.procedure_name -
   * @returns {Object[]} - functions
   * @property {String} - sql_mode
   * @property {String} - create_function
   * @property {String} - database collation
   * @property {String} - collation_connection
   * @property {String} - character_set_client
   */
  async procedureRead(args: any = {}) {
    const _func = this.procedureRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `SELECT * FROM all_source  WHERE TYPE = 'PROCEDURE' AND OWNER = '${args.databaseName}' AND NAME = '${args.procedure_name}' ORDER BY line`,
      );
      const rows = [];
      if (response.length > 0) {
        let script = '';
        for (let i = 0; i < response.length; i++) {
          let el = response[i];
          el = mapKeys(el, (_v, k) => k.toLowerCase());
          el.procedure_name = el.name;
          response[i] = el;
          script += el.text;
        }
        response[0].create_procedure = script;
        rows.push(response[0]);
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
   * @param {Object} - args.view_name -
   * @returns {Object[]} - views
   * @property {String} - views[].tn
   */
  async viewRead(args: any = {}) {
    const _func = this.viewRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.raw(
        `SELECT * FROM all_views WHERE owner='${args.databaseName}' and view_name='${args.view_name}'`,
      );

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.view_name = el.object_name;
        el.view_definition = el.text;
        response[i] = el;
      }
      result.data.list = response;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async triggerRead(args: any = {}) {
    const _func = this.triggerRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.user;

      const response = await this.sqlClient
        .raw(`select owner as trigger_schema_name, trigger_name, trigger_type,
      triggering_event, table_owner as schema_name, table_name as object_name,
      base_object_type as object_type, status, trigger_body as script from sys.all_triggers
      -- excluding some Oracle maintained schemas
      where owner = '${args.databaseName}' and trigger_name = '${args.trigger_name}' order by trigger_name, table_owner, table_name, base_object_type`);
      if (!response[0]) return [];

      for (let i = 0; i < response.length; i++) {
        let el = response[i];
        el = mapKeys(el, (_v, k) => k.toLowerCase());
        el.trigger = el.trigger_name;
        el.table = el.object_name;
        el.event = el.triggering_event;
        el.timing = el.trigger_type;
        el.trigger_definition = el.script;
        response[i] = el;
      }

      result.data.list = response;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async schemaCreate(args: any = {}) {
    const _func = this.schemaCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.raw(`create database ${args.database_name}`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async schemaDelete(args: any = {}) {
    const _func = this.schemaDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.raw(`drop database ${args.database_name}`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async triggerDelete(args: any = {}) {
    const _func = this.triggerDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      await this.raw(`DROP TRIGGER IF EXISTS ${args.trigger_name}`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async functionDelete(args: any = {}) {
    const _func = this.functionDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      await this.raw(`DROP FUNCTION IF EXISTS ${args.function_name}`);
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async procedureDelete(args: any = {}) {
    const _func = this.procedureDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      await this.raw(`DROP PROCEDURE IF EXISTS ${args.procedure_name}`);
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
   * @param {String} - args.tn
   * @param {String} - args.function_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async functionCreate(args: any = {}) {
    const func = this.functionCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER \`${args.function_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`,
      );
      result.data.list = rows;
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.function_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async functionUpdate(args: any = {}) {
    const func = this.functionUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`DROP TRIGGER ${args.function_name}`);
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER \`${args.function_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`,
      );
      result.data.list = rows;
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.procedure_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async procedureCreate(args: any = {}) {
    const func = this.procedureCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER \`${args.procedure_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`,
      );
      result.data.list = rows;
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.procedure_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async procedureUpdate(args: any = {}) {
    const func = this.procedureUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`DROP TRIGGER ${args.procedure_name}`);
      const rows = await this.sqlClient.raw(
        `CREATE TRIGGER \`${args.procedure_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`,
      );
      result.data.list = rows;
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.trigger_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @returns {Object[]} - result rows
   */
  async triggerCreate(args: any = {}) {
    const func = this.triggerCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query = `CREATE TRIGGER \`${args.trigger_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: query,
        downStatement: `DROP TRIGGER ${args.trigger_name}`,
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.tn
   * @param {String} - args.trigger_name
   * @param {String} - args.event
   * @param {String} - args.timing
   * @param {String} - args.oldStatement
   * @returns {Object[]} - result rows
   */
  async triggerUpdate(args: any = {}) {
    const func = this.triggerUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(`DROP TRIGGER ${args.trigger_name}`);
      await this.sqlClient.raw(
        `CREATE TRIGGER \`${args.trigger_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`,
      );

      result.data.object = {
        upStatement: `DROP TRIGGER ${args.trigger_name};\nCREATE TRIGGER \`${args.trigger_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.statement}`,
        downStatement: `CREATE TRIGGER \`${args.trigger_name}\` \n${args.timing} ${args.event}\nON ${args.tn} FOR EACH ROW\n${args.oldStatement}`,
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.view_name
   * @param {String} - args.view_definition
   * @returns {Object} - up and down statements
   */
  async viewCreate(args: any = {}) {
    const func = this.viewCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query = `CREATE VIEW ${args.view_name} AS \n${args.view_definition}`;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: query,
        downStatement: `DROP VIEW ${args.view_name}`,
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.view_name
   * @param {String} - args.view_definition
   * @param {String} - args.oldViewDefination
   * @returns {Object} - up and down statements
   */
  async viewUpdate(args: any = {}) {
    const func = this.viewUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query = `CREATE OR REPLACE VIEW ${args.view_name} AS \n${args.view_definition}`;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: query,
        downStatement: `CREATE VIEW ${args.view_name} AS \n${args.oldViewDefination}`,
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args - Input arguments
   * @param {String} - args.view_name
   * @param {String} - args.view_definition
   * @param {String} - args.oldViewDefination
   * @returns {Object} - up and down statements
   */
  async viewDelete(args: any = {}) {
    const func = this.viewDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    // `DROP TRIGGER ${args.view_name}`
    try {
      const query = `DROP VIEW ${args.view_name}`;

      await this.sqlClient.raw(query);

      result.data.object = {
        upStatement: query,
        downStatement: `CREATE VIEW ${args.view_name} AS \n${args.oldViewDefination}`,
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  /**
   *
   * @param {Object} - args
   * @param {String} - args.tn
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
   * @param {String} - args.columns[].dtx
   *                     - value will be 'specificType' for all cols except ai
   *                     - for ai it will be integer, bigInteger
   *                     - tiny, small and medium Int auto increement is not supported
   * @param {String} - args.columns[].dtxp - to use in UI
   * @param {String} - args.columns[].dtxs - to use in UI
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async tableCreate(args) {
    const _func = this.tableCreate.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      args.table = args.tn;
      args.sqlClient = this.sqlClient;

      /**************** create table ****************/
      const upQuery = createTable(args.tn, args);
      await this.sqlClient.raw(upQuery);

      const downStatement = this.sqlClient.schema.dropTable(args.table).toSQL();

      this.emit(`Success : ${upQuery}`);

      /**************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement,
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
      args.table = args.tn;
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
          upQuery += alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            // upQuery
          );
          downQuery += alterTableAddColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 2 || args.columns[i].altered & 8) {
          // col edit
          upQuery += alterTableChangeColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += alterTableChangeColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery,
          );
        } else if (args.columns[i].altered & 1) {
          // col addition
          upQuery += alterTableAddColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery,
          );
          downQuery += alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            // downQuery
          );
        }
      }

      //upQuery += alterTablePK(args.columns, args.originalColumns, upQuery);
      //downQuery += alterTablePK(args.originalColumns, args.columns, downQuery);

      if (upQuery) {
        //upQuery = `ALTER TABLE ${args.columns[0].tn} ${upQuery};`;
        //downQuery = `ALTER TABLE ${args.columns[0].tn} ${downQuery};`;
      }

      await this.sqlClient.raw(upQuery);

      // console.log(upQuery);

      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
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
      const upStatement = this.sqlClient.schema.dropTable(args.tn).toSQL();
      const downQuery = createTable(args.tn, args);

      this.emit(`Success : ${upStatement}`);

      /** ************** drop tn *************** */
      await this.sqlClient.schema.dropTable(args.tn);

      /** ************** return files *************** */
      result.data.object = {
        upStatement,
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableCreateStatement(args) {
    const _func = this.tableCreateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = ';';
      const response = await this.sqlClient.raw(
        `show create table ${args.tn};`,
      );
      if (response.length === 2) {
        result.data = response[0][0]['Create Table'];
      }
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableInsertStatement(args) {
    const _func = this.tableCreateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      let values = ' VALUES (';
      result.data = `INSERT INTO \`${args.tn}\` (`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `\n\`${response.data.list[i].cn}\`\n\t`;
            values += `\n<${response.data.list[i].cn}>\n\t`;
          } else {
            result.data += `, \`${response.data.list[i].cn}\`\n\t`;
            values += `, <${response.data.list[i].cn}>\n\t`;
          }
        }
      }

      result.data += `)`;
      values += `);`;
      result.data += values;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableUpdateStatement(args) {
    const _func = this.tableUpdateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data = `UPDATE \`${args.tn}\` \nSET\n`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `\`${response.data.list[i].cn}\` = <\`${response.data.list[i].cn}\`>\n\t`;
          } else {
            result.data += `,\`${response.data.list[i].cn}\` = <\`${response.data.list[i].cn}\`>\n\t`;
          }
        }
      }

      result.data += ';';
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableDeleteStatement(args) {
    const _func = this.tableDeleteStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `DELETE FROM ${args.tn};`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableTruncateStatement(args) {
    const _func = this.tableTruncateStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result.data = `TRUNCATE TABLE ${args.tn};`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param args
   * @param args.tn
   * @returns {Object} Result
   * @returns {String} result.data
   */
  async tableSelectStatement(args) {
    const _func = this.tableSelectStatement.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data = `SELECT `;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `${response.data.list[i].cn}\n\t`;
          } else {
            result.data += `, ${response.data.list[i].cn}\n\t`;
          }
        }
      }

      result.data += ` FROM ${args.tn};`;
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  /**
   *
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   */
  async totalRecords(_args: any = {}): Promise<Result> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const func = this.totalRecords.name;
    throw new Error('Function not supported for oracle yet');
  }
}

function alterTablePK(n, o, _existingQuery, createTable = false) {
  const numOfPksInOriginal = [];
  const numOfPksInNew = [];
  let pksChanged = 0;

  for (let i = 0; i < n.length; ++i) {
    if (n[i].pk) {
      if (n[i].altered !== 4) numOfPksInNew.push(n[i].cn);
    }
  }

  for (let i = 0; i < o.length; ++i) {
    if (o[i].pk) {
      numOfPksInOriginal.push(o[i].cn);
    }
  }

  if (numOfPksInNew.length === numOfPksInOriginal.length) {
    for (let i = 0; i < numOfPksInNew.length; ++i) {
      if (numOfPksInOriginal[i] !== numOfPksInNew[i]) {
        pksChanged = 1;
        break;
      }
    }
  } else {
    pksChanged = numOfPksInNew.length - numOfPksInOriginal.length;
  }

  let query = '';
  if (!numOfPksInNew.length && !numOfPksInOriginal.length) {
    // do nothing
  } else if (pksChanged) {
    query += numOfPksInOriginal.length ? ',DROP PRIMARY KEY' : '';

    if (numOfPksInNew.length) {
      if (createTable) {
        query += `, PRIMARY KEY(${numOfPksInNew.join(',')})`;
      } else {
        query += `, ADD PRIMARY KEY(${numOfPksInNew.join(',')})`;
      }
    }
  }

  return query;
}

function alterTableRemoveColumn(n, _o, existingQuery) {
  let query = existingQuery ? ',' : '';
  query += ` DROP COLUMN \`${n.cn}\``;
  return query;
}

function createTableColumn(t, n, o, existingQuery) {
  return alterTableColumn(t, n, o, existingQuery, 0);
}

function alterTableAddColumn(t, n, o, existingQuery) {
  return alterTableColumn(t, n, o, existingQuery, 1);
}

function alterTableChangeColumn(t, n, o, existingQuery) {
  return alterTableColumn(t, n, o, existingQuery, 2);
}

function createTable(table, args) {
  let query = '';

  for (let i = 0; i < args.columns.length; ++i) {
    query += createTableColumn(table, args.columns[i], null, query);
  }

  query += alterTablePK(args.columns, [], query, true);

  query = `CREATE TABLE ${args.tn} (` + query + ')';

  return query;
}

function alterTableColumn(t, n, o, existingQuery, change = 2) {
  // CREATE TABLE test1 ( id integer NOT NULL, title varchar NULL);

  //   CREATE TABLE CHINOOK.NEWTABLE_1 (
  //     ID INTEGER NOT NULL,
  //     TITLE VARCHAR(100),
  //     CONSTRAINT NEWTABLE_1_PK PRIMARY KEY (ID)
  // );

  const scale = parseInt(n.dtxs) ? parseInt(n.dtxs) : null;

  let query = existingQuery ? ',' : '';

  const defaultValue = getDefaultValue(n);

  if (change === 0) {
    if (n.ai) {
      switch (n.dt) {
        case 'int4':
        default:
          query += ` ${n.cn} serial`;
          break;
      }
    } else {
      query += ` ${n.cn} ${n.dt}`;
    }

    query += n.dtxp && n.dtxp !== ' ' ? `(${n.dtxp}` : '';
    query += scale ? `,${scale}` : '';
    query += n.dtxp && n.dtxp !== ' ' ? ')' : '';

    query += n.rqd ? ' NOT NULL' : ' NULL';
    query += defaultValue ? ` DEFAULT ${defaultValue}` : '';
  } else if (change === 1) {
    query += ` ADD  ${n.cn} ${n.dt}`;
    query += n.rqd ? ' NOT NULL' : ' NULL';
    query += defaultValue ? ` DEFAULT ${defaultValue}` : ' ';
    query = `ALTER TABLE ${t} ${query};`;
  } else {
    if (n.cn !== o.cno) {
      query += `\nALTER TABLE ${t} RENAME COLUMN ${n.cno} TO ${n.cn};\n`;
    }

    if (n.dt !== o.dt) {
      query += `\nALTER TABLE ${t} ALTER COLUMN ${n.cn} TYPE ${n.dt};\n`;
    }

    if (n.rqd !== o.rqd) {
      query += `\nALTER TABLE ${t} ALTER COLUMN ${n.cn} `;
      query += n.rqd ? ` SET NOT NULL;\n` : ` DROP NOT NULL;\n`;
    }

    if (n.cdf !== o.cdf) {
      query += `\nALTER TABLE ${t} ALTER COLUMN ${n.cn} `;
      query += n.cdf ? ` SET DEFAULT ${n.cdf};\n` : ` DROP DEFAULT;\n`;
    }
  }

  return query;
}

function getDefaultValue(n) {
  if (n.cdf === undefined || n.cdf === null) return n.cdf;
  switch (n.dt) {
    case 'bfile':
      return n.cdf;
      break;
    case 'binary rowid':
      return n.cdf;
      break;
    case 'binary double':
      return n.cdf;
      break;
    case 'binary_float':
      return n.cdf;
      break;
    case 'blob':
      return n.cdf;
      break;
    case 'canoical':
      return n.cdf;
      break;
    case 'cfile':
      return n.cdf;
      break;
    case 'char':
      return n.cdf;
      break;
    case 'clob':
      return n.cdf;
      break;
    case 'content pointer':
      return n.cdf;
      break;
    case 'contigous array':
      return n.cdf;
      break;
    case 'date':
      return n.cdf;
      break;
    case 'decimal':
      return n.cdf;
      break;
    case 'double precision':
      return n.cdf;
      break;
    case 'float':
      return n.cdf;
      break;
    case 'integer':
      return n.cdf;
      break;
    case 'interval day to second':
      return n.cdf;
      break;
    case 'interval year to month':
      return n.cdf;
      break;
    case 'lob pointer':
      return n.cdf;
      break;
    case 'long':
      return n.cdf;
      break;
    case 'long raw':
      return n.cdf;
      break;
    case 'named collection':
      return n.cdf;
      break;
    case 'named object':
      return n.cdf;
      break;
    case 'nchar':
      return n.cdf;
      break;
    case 'nclob':
      return n.cdf;
      break;
    case 'number':
      return n.cdf;
      break;
    case 'nvarchar2':
      return n.cdf;
      break;
    case 'octet':
      return n.cdf;
      break;
    case 'oid':
      return n.cdf;
      break;
    case 'pointer':
      return n.cdf;
      break;
    case 'raw':
      return n.cdf;
      break;
    case 'real':
      return n.cdf;
      break;
    case 'ref':
      return n.cdf;
      break;
    case 'ref cursor':
      return n.cdf;
      break;
    case 'rowid':
      return n.cdf;
      break;
    case 'signed binary integer':
      return n.cdf;
      break;
    case 'smallint':
      return n.cdf;
      break;
    case 'table':
      return n.cdf;
      break;
    case 'time':
      return n.cdf;
      break;
    case 'time with tz':
      return n.cdf;
      break;
    case 'timestamp':
      return n.cdf;
      break;
    case 'timestamp with local time zone':
      return n.cdf;
      break;
    case 'timestamp with local tz':
      return n.cdf;
      break;
    case 'timestamp with timezone':
      return n.cdf;
      break;
    case 'timestamp with tz':
      return n.cdf;
      break;
    case 'unsigned binary integer':
      return n.cdf;
      break;
    case 'urowid':
      return n.cdf;
      break;
    case 'varchar':
      return n.cdf;
      break;
    case 'varchar2':
      return n.cdf;
      break;
    case 'varray':
      return n.cdf;
      break;
    case 'varying array':
      return n.cdf;
      break;
  }
}

export default OracleClient;
