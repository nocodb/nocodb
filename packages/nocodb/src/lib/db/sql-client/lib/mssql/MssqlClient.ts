import { ColumnType } from 'nocodb-sdk';

import knex from 'knex';
import KnexClient from '../KnexClient';
import Debug from '../../../util/Debug';
import Result from '../../../util/Result';
import lodash from 'lodash';

const log = new Debug('MssqlClient');

class MssqlClient extends KnexClient {
  constructor(connectionConfig: any) {
    super(connectionConfig);
  }

  /**
   *
   * @param {Object} - args
   * @param args.sequence_name
   * @returns {Promise<{upStatement, downStatement}>}
   */
  async sequenceDelete(args: { sequence_name: string }) {
    const _func = this.sequenceDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const query =
        this.querySeparator() + `DROP SEQUENCE ${args.sequence_name}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql:
              this.querySeparator() + `CREATE SEQUENCE ${args.sequence_name}`,
          },
        ],
      };
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
   * @returns {Object[]} - sequences
   * @property {String} - sequences[].sequence_name
   * @property {String} - sequences[].type
   * @property {String} - sequences[].definer
   * @property {String} - sequences[].modified
   * @property {String} - sequences[].created
   * @property {String} - sequences[].security_type
   * @property {String} - sequences[].comment
   * @property {String} - sequences[].character_set_client
   * @property {String} - sequences[].collation_connection
   * @property {String} - sequences[].database collation
   */
  async sequenceList(args: { databaseName: string }) {
    const _func = this.sequenceList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;
      const rows = await this.sqlClient.raw(`SELECT * FROM sys.SEQUENCES;`);

      result.data.list = rows.map((seq) => {
        return {
          ...seq,
          sequence_name: seq.name,
          original_sequence_name: seq.name,
        };
      });
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
   * @param {String} - args.sequence_name
   * @param {String} - args.start_value
   * @param {String} - args.min_value
   * @param {String} - args.max_value
   * @param {String} - args.increment_by
   * @returns {Object} - result
   */
  async sequenceCreate(args: {
    sequence_name: string;
    start_value: number;
    min_value: number;
    max_value: number;
    increment_by: number;
  }) {
    const func = this.sequenceCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query =
        this.querySeparator() + `CREATE SEQUENCE ${args.sequence_name}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql: this.querySeparator() + `DROP SEQUENCE ${args.sequence_name}`,
          },
        ],
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
   * @param {String} - args.sequence_name
   * @param {String} - args.start_value
   * @param {String} - args.min_value
   * @param {String} - args.max_value
   * @param {String} - args.increment_by
   * @returns {Object} - result
   */
  async sequenceUpdate(args: {
    original_sequence_name: string;
    sequence_name: string;
    start_value: number;
    min_value: number;
    max_value: number;
    increment_by: number;
  }) {
    const func = this.sequenceUpdate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const upQuery =
        this.querySeparator() +
        `ALTER SEQUENCE ${args.original_sequence_name} RENAME TO ${args.sequence_name};`;
      const downQuery =
        this.querySeparator() +
        `ALTER SEQUENCE ${args.sequence_name} RENAME TO ${args.original_sequence_name};`;

      await this.sqlClient.raw(upQuery);
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
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
      await this.sqlClient.raw('SELECT 1+1 as data');
    } catch (e) {
      log.ppe(e);
      result.code = -1;
      result.message = e.message;
    } finally {
      log.api(`${_func}:result:`, result);
    }

    return result;
  }

  getKnexDataTypes() {
    const result = new Result();

    result.data.list = [
      'bigint',
      'binary',
      'bit',
      'char',
      'date',
      'datetime',
      'datetime2',
      'datetimeoffset',
      'decimal',
      'float',
      'geography',
      'geometry',
      'heirarchyid',
      'image',
      'int',
      'money',
      'nchar',
      'ntext',
      'numeric',
      'nvarchar',
      'real',
      'json',
      'smalldatetime',
      'smallint',
      'smallmoney',
      'sql_variant',
      'sysname',
      'text',
      'time',
      'timestamp',
      'tinyint',
      'uniqueidentifier',
      'varbinary',
      'xml',
      'varchar',
    ];

    return result;
  }

  async version(args: any = {}) {
    const _func = this.version.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const rows = await this.sqlClient.raw(
        `SELECT SERVERPROPERTY('productversion') as version, SERVERPROPERTY ('productlevel') as level, SERVERPROPERTY ('edition') as edition, @@version as versionD`
      );
      result.data.object = {};

      const versionDetails = rows[0];
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
  async createDatabaseIfNotExists(args: { database: string }) {
    const _func = this.createDatabaseIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const connectionParamsWithoutDb = JSON.parse(
        JSON.stringify(this.connectionConfig)
      );
      delete connectionParamsWithoutDb.connection.database;
      const tempSqlClient = knex(connectionParamsWithoutDb);

      const rows = await tempSqlClient.raw(
        `select name from sys.databases where name = '${args.database}'`
      );

      if (rows.length === 0) {
        await tempSqlClient.raw(`CREATE DATABASE  ${args.database}`);
      }

      this.sqlClient = knex(this.connectionConfig);
      await tempSqlClient.destroy();
      if (
        this.connectionConfig.searchPath &&
        this.connectionConfig.searchPath[0]
      ) {
        await this.sqlClient.raw(
          ` IF NOT EXISTS ( SELECT  *
                            FROM    sys.schemas
                            WHERE   name = ? )
                EXEC('CREATE SCHEMA ??')`,
          [
            this.connectionConfig.searchPath[0],
            this.connectionConfig.searchPath[0],
          ]
        );
      }
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  async dropDatabase(args: { database: string }) {
    const _func = this.dropDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const connectionParamsWithoutDb = JSON.parse(
        JSON.stringify(this.connectionConfig)
      );
      delete connectionParamsWithoutDb.connection.database;
      const tempSqlClient = knex(connectionParamsWithoutDb);
      await this.sqlClient.destroy();
      this.sqlClient = tempSqlClient;
      log.debug('dropping database:', args);
      await tempSqlClient.raw(
        `ALTER DATABASE ${args.database} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
         DROP DATABASE ${args.database};`
      );
    } catch (e) {
      log.ppe(e, _func);
      // throw e;
    }

    log.api(`${_func}: result`, result);
    return result;
  }

  /**
   *
   * @param args {tn}
   * @returns
   */
  async createTableIfNotExists(args: { tn: string }) {
    const _func = this.createTableIfNotExists.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      /** ************** START : create _evolution table if not exists *************** */
      const exists = await this.sqlClient.schema.hasTable(
        this.getTnPath(args.tn)
      );

      if (!exists) {
        await this.sqlClient.schema.createTable(
          this.getTnPath(args.tn),
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
          }
        );
        log.debug('Table created:', `${this.getTnPath(args.tn)}`);
      } else {
        log.debug(`${this.getTnPath(args.tn)} tables exists`);
      }
      /** ************** END : create _evolution table if not exists *************** */
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async hasTable(args: { tn: string }) {
    const _func = this.hasTable.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data.value = await this.sqlClient.schema.hasTable(
        this.getTnPath(args.tn)
      );
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async hasDatabase(args: { databaseName: string }) {
    const _func = this.hasDatabase.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      const rows = await this.sqlClient.raw(
        `select name from sys.databases where name = '${args.databaseName}'`
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
      result.data.list = await this.sqlClient.raw(
        `SELECT name as database_name, database_id, create_date from sys.databases order by name`
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
   * @param {Object} - args - for future reasons
   * @returns {Object[]} - tables
   * @property {String} - tables[].tn
   */
  async tableList(args: any = {}) {
    const _func = this.tableList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);

    try {
      result.data.list = await this.sqlClient.raw(
        `select schema_name(t.schema_id) as schema_name,
        t.name as tn, t.create_date, t.modify_date from sys.tables t WHERE schema_name(t.schema_id) = ? order by schema_name,tn `,
        [this.schema || 'dbo']
      );
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
      result.data.list = await this.sqlClient.raw(
        `SELECT name as schema_name FROM master.${this.schema}.sysdatabases where name not in ('master', 'tempdb', 'model', 'msdb');`
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
  async columnList(args: {
    tn: string;
    columns?: ColumnType[];
    databaseName?: string;
  }) {
    const _func = this.columnList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(`select
      c.table_name as tn,
       case WHEN trg1.trigger_name IS NULL THEN CAST(0 as BIT) ELSE CAST(1 as BIT) END as au,
       c.column_name as cn,
       c.ordinal_position as cop,
      pk.constraint_type as ck,
      case WHEN COLUMNPROPERTY(object_id(CONCAT('${this.schema}.', c.TABLE_NAME)), c.COLUMN_NAME, 'IsIdentity') = 1
      THEN
        1
      ELSE
        0
      END as ai,
      c.is_nullable as nrqd,
      c.data_type as dt,
      c.column_default as cdf,c.character_maximum_length as clen,
      c.character_octet_length,c.numeric_precision as np,c.numeric_scale as ns,c.datetime_precision as dp,c.character_set_name as csn,
      c.collation_name as clnn,
      pk.constraint_type as cst, pk.ordinal_position as op, pk.constraint_name as pk_constraint_name,
      fk.parent_table as rtn, fk.parent_column as rcn,
      v.table_name as is_view,
      df.default_constraint_name
  from information_schema.columns c
    left join
      ( select kc.constraint_name, kc.table_name,kc.column_name, kc.ordinal_position,tc.constraint_type
        from information_schema.key_column_usage kc
          inner join information_schema.table_constraints as tc
            on kc.constraint_name = tc.constraint_name and tc.constraint_type in ('primary key')
        where kc.table_catalog='${args.databaseName}' and kc.table_schema='${this.schema}'
        ) pk
      on
      pk.table_name = c.table_name and pk.column_name=c.column_name
    left join
          ( select
                ccu.table_name as child_table
                ,ccu.column_name as child_column
                ,kcu.table_name as parent_table
                ,kcu.column_name as parent_column
                ,ccu.constraint_name
            from information_schema.constraint_column_usage ccu
                inner join information_schema.referential_constraints rc
                    on ccu.constraint_name = rc.constraint_name
                inner join information_schema.key_column_usage kcu
                    on kcu.constraint_name = rc.unique_constraint_name  ) fk
      on
      fk.child_table = c.table_name and fk.child_column=c.column_name
    left join information_schema.views v
      on v.table_name=c.table_name
    left join (
              SELECT
                  default_constraints.name default_constraint_name, all_columns.name name
              FROM
                  sys.all_columns
                      INNER JOIN
                  sys.tables
                      ON all_columns.object_id = tables.object_id
                      INNER JOIN
                  sys.schemas
                      ON tables.schema_id = schemas.schema_id
                      INNER JOIN
                  sys.default_constraints
                      ON all_columns.default_object_id = default_constraints.object_id
              WHERE
        schemas.name = '${this.schema}'
    AND tables.name =  '${args.tn}') df on df.name = c.column_name

     left join (  select trg.name as trigger_name,
               tab.name as [table1]
          from sys.triggers trg
              left join sys.objects tab
                  on trg.parent_id = tab.object_id
          where tab.name =  '${args.tn}') trg1 on trg1.trigger_name = CONCAT('xc_trigger_${args.tn}_' , c.column_name)

    where c.table_catalog='${args.databaseName}' and c.table_schema='${this.schema}' and c.table_name = '${args.tn}'
    order by c.table_name, c.ordinal_position`);

      for (let i = 0; i < response.length; i++) {
        const el = response[i];
        el.pk = el.ck === 'PRIMARY KEY';
        el.not_nullable = el.nrqd === 'NO';
        el.rqd = el.nrqd === 'NO';
        el.ai = el.ai === 1;
        // el.unique =
        el.nrqd = el.nrqd === 'YES';
        el.cno = el.cn;
        el.dtxp = el.clen || el.np || el.dp;
        el.dtxs = el.ns;
        el.au = !!el.au;
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
   * @property {Boolean} - indexes[].pk -
   */
  async indexList(args: any = {}) {
    const _func = this.indexList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const response = await this.sqlClient.raw(
        `select  t.[name] as table_view,
        case when t.[type] = 'U' then 'Table'
            when t.[type] = 'V' then 'View'
            end as [object_type],
        i.index_id,
        case when i.is_primary_key = 1 then 'Primary key'
            when i.is_unique = 1 then 'Unique'
            else 'Not Unique' end as [type],
        i.[name] as index_name,
        substring(column_names, 1, len(column_names)-1) as [columns],
        case when i.[type] = 1 then 'Clustered index'
            when i.[type] = 2 then 'Nonclustered unique index'
            when i.[type] = 3 then 'XML index'
            when i.[type] = 4 then 'Spatial index'
            when i.[type] = 5 then 'Clustered columnstore index'
            when i.[type] = 6 then 'Nonclustered columnstore index'
            when i.[type] = 7 then 'Nonclustered hash index'
            end as index_type
    from sys.objects t
        inner join sys.indexes i
            on t.object_id = i.object_id
        cross apply (select col.[name] + ',' + CAST(ic.key_ordinal as varchar)  + ','
                        from sys.index_columns ic
                            inner join sys.columns col
                                on ic.object_id = col.object_id
                                and ic.column_id = col.column_id
                        where ic.object_id = t.object_id
                            and ic.index_id = i.index_id
                                order by col.column_id
                                for xml path ('') ) D (column_names)
    where t.is_ms_shipped <> 1
    and index_id > 0 and t.name = '${this.getTnPath(args.tn)}'
    order by schema_name(t.schema_id) + '.' + t.[name], i.index_id`
      );
      const rows = [];
      for (let i = 0, rowCount = 0; i < response.length; ++i, ++rowCount) {
        response[i].key_name = response[i].index_name;
        response[i].non_unique = response[i].type === 'Not Unique' ? 1 : 0;
        response[i].non_unique_original =
          response[i].type === 'Not Unique' ? 1 : 0;
        response[i].pk = response[i].type === 'Primary key';
        // split
        response[i].columns = response[i].columns.split(',');

        if (response[i].columns.length === 2) {
          rows[rowCount] = response[i];
          rows[rowCount].cn = response[i].columns[0];
          rows[rowCount].seq_in_index = 1;
        } else {
          const cols = response[i].columns.slice();
          for (let j = 0; j < cols.length; j += 2, ++rowCount) {
            rows[rowCount] = JSON.parse(JSON.stringify(response[i]));
            rows[rowCount].cn = cols[j].trim();
            rows[rowCount].seq_in_index = parseInt(cols[j + 1]);
          }
          rowCount--;
        }
      }

      // console.log(rows);

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
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `select  t.[name] as table_view,
        case when t.[type] = 'U' then 'Table'
            when t.[type] = 'V' then 'View'
            end as [object_type],
        i.index_id,
        case when i.is_primary_key = 1 then 'Primary key'
            when i.is_unique = 1 then 'Unique'
            else 'Not Unique' end as [type],
        i.[name] as index_name,
        substring(column_names, 1, len(column_names)-1) as [columns],
        case when i.[type] = 1 then 'Clustered index'
            when i.[type] = 2 then 'Nonclustered unique index'
            when i.[type] = 3 then 'XML index'
            when i.[type] = 4 then 'Spatial index'
            when i.[type] = 5 then 'Clustered columnstore index'
            when i.[type] = 6 then 'Nonclustered columnstore index'
            when i.[type] = 7 then 'Nonclustered hash index'
            end as index_type
    from sys.objects t
        inner join sys.indexes i
            on t.object_id = i.object_id
        cross apply (select col.[name] + ', ' + CAST(ic.key_ordinal as varchar)  + ', '
                        from sys.index_columns ic
                            inner join sys.columns col
                                on ic.object_id = col.object_id
                                and ic.column_id = col.column_id
                        where ic.object_id = t.object_id
                            and ic.index_id = i.index_id
                                order by col.column_id
                                for xml path ('') ) D (column_names)
    where t.is_ms_shipped <> 1
    and index_id > 0 and t.name = '${this.getTnPath(args.tn)}'
    order by schema_name(t.schema_id) + '.' + t.[name], i.index_id`
      );
      const rows = [];
      for (let i = 0, rowCount = 0; i < response.length; ++i, ++rowCount) {
        response[i].cstn = response[i].index_name;
        response[i].cst = response[i].type;
        response[i].columns = response[i].columns.split(',');

        if (response[i].columns.length === 2) {
          rows[rowCount] = response[i];
          rows[rowCount].cn = response[i].columns[0];
          rows[rowCount].op = 1;
        } else {
          const cols = response[i].columns.slice();
          for (let j = 0; j < cols.length; j += 2, ++rowCount) {
            rows[rowCount] = JSON.parse(JSON.stringify(response[i]));
            rows[rowCount].cn = cols[j];
            rows[rowCount].op = parseInt(cols[j + 1]);
          }
          rowCount--;
        }
      }

      // console.log(rows);

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
  async relationList(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const response = await this.sqlClient
        .raw(`select  fk_tab.name as tn, '>-' as rel, pk_tab.name as rtn,
        fk_cols.constraint_column_id as no, fk_col.name as cn, ' = ' as [join],
        pk_col.name as rcn, fk.name as cstn,
        fk.update_referential_action_desc as ur, fk.delete_referential_action_desc as dr
        from sys.foreign_keys fk
        inner join sys.tables fk_tab
            on fk_tab.object_id = fk.parent_object_id
        inner join sys.tables pk_tab
            on pk_tab.object_id = fk.referenced_object_id
        inner join sys.foreign_key_columns fk_cols
            on fk_cols.constraint_object_id = fk.object_id
        inner join sys.columns fk_col
            on fk_col.column_id = fk_cols.parent_column_id
            and fk_col.object_id = fk_tab.object_id
        inner join sys.columns pk_col
            on pk_col.column_id = fk_cols.referenced_column_id
            and pk_col.object_id = pk_tab.object_id
        where fk_tab.name = '${this.getTnPath(args.tn)}'
        order by  fk_tab.name, pk_tab.name, fk_cols.constraint_column_id`);

      const ruleMapping = {
        NO_ACTION: 'NO ACTION',
        CASCADE: 'CASCADE',
        RESTRICT: 'RESTRICT',
        SET_NULL: 'SET NULL',
        SET_DEFAULT: 'SET DEFAULT',
      };

      for (const row of response) {
        row.ur = ruleMapping[row.ur];
        row.dr = ruleMapping[row.dr];
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
  async relationListAll(args: any = {}) {
    const _func = this.relationList.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      const response = await this
        .raw(`select  fk_tab.name as tn, '>-' as rel, pk_tab.name as rtn,
        fk_cols.constraint_column_id as no, fk_col.name as cn, ' = ' as [join],
        pk_col.name as rcn, fk.name as cstn,
        fk.update_referential_action_desc as ur, fk.delete_referential_action_desc as dr
        from sys.foreign_keys fk
        inner join sys.tables fk_tab
            on fk_tab.object_id = fk.parent_object_id
        inner join sys.tables pk_tab
            on pk_tab.object_id = fk.referenced_object_id
        inner join sys.foreign_key_columns fk_cols
            on fk_cols.constraint_object_id = fk.object_id
        inner join sys.columns fk_col
            on fk_col.column_id = fk_cols.parent_column_id
            and fk_col.object_id = fk_tab.object_id
        inner join sys.columns pk_col
            on pk_col.column_id = fk_cols.referenced_column_id
            and pk_col.object_id = pk_tab.object_id
        order by  fk_tab.name, pk_tab.name, fk_cols.constraint_column_id`);

      const ruleMapping = {
        NO_ACTION: 'NO ACTION',
        CASCADE: 'CASCADE',
        RESTRICT: 'RESTRICT',
        SET_NULL: 'SET NULL',
        SET_DEFAULT: 'SET DEFAULT',
      };

      for (const row of response) {
        row.ur = ruleMapping[row.ur];
        row.dr = ruleMapping[row.dr];
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
      const query = `select trg.name as trigger_name,
               tab.name as [table],
              case when is_instead_of_trigger = 1 then 'Instead of'
                  else 'After' end as [activation],
              (case when objectproperty(trg.object_id, 'ExecIsUpdateTrigger') = 1
                          then 'Update' else '' end
              + case when objectproperty(trg.object_id, 'ExecIsDeleteTrigger') = 1
                          then 'Delete' else '' end
              + case when objectproperty(trg.object_id, 'ExecIsInsertTrigger') = 1
                          then 'Insert' else '' end
              ) as [event],
              case when trg.parent_class = 1 then 'Table trigger'
                  when trg.parent_class = 0 then 'Database trigger'
              end [class],
              case when trg.[type] = 'TA' then 'Assembly (CLR) trigger'
                  when trg.[type] = 'TR' then 'SQL trigger'
                  else '' end as [type],
              case when is_disabled = 1 then 'Disabled'
                  else 'Active' end as [status],
              object_definition(trg.object_id) as [definition]
          from sys.triggers trg
              left join sys.objects tab
                  on trg.parent_id = tab.object_id
          where tab.name =  '${this.getTnPath(args.tn)}'
          order by trg.name;`;

      const response = await this.sqlClient.raw(query);

      for (let i = 0; i < response.length; i++) {
        const el = response[i];
        // el.table = el.table;
        el.statement = el.definition;
        el.trigger = el.trigger_name;
        el.event = el.event.toUpperCase();
        el.timing = el.activation.toUpperCase();
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
      const response = await this.sqlClient.raw(
        `SELECT o.name as function_name,definition, o.create_date as created, o.modify_date as modified,o.*
        FROM sys.sql_modules AS m
        JOIN sys.objects AS o ON m.object_id = o.object_id
        AND type IN ('FN', 'IF', 'TF')`
      );
      for (let i = 0; i < response.length; i++) {
        const el = response[i];
        if (el.type === 'FN') el.type = 'FUNCTION';
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
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `select SPECIFIC_NAME as procedure_name, ROUTINE_TYPE as [type],LAST_ALTERED as modified, CREATED as created,ROUTINE_DEFINITION as definition ,pc.*
        from ${args.databaseName}.information_schema.routines as pc where routine_type = 'PROCEDURE'`
      );

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
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `SELECT v.name as view_name,v.*,m.* FROM sys.views v inner join sys.schemas s on s.schema_id = v.schema_id
        inner join sys.sql_modules as m on m.object_id = v.object_id`
      );

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
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `SELECT o.name as function_name,definition as create_function, o.create_date as created, o.modify_date as modified,o.*
        FROM sys.sql_modules AS m
        JOIN sys.objects AS o ON m.object_id = o.object_id
        AND type IN ('FN', 'IF', 'TF') and o.name = '${args.function_name}'`
      );

      for (let i = 0; i < response.length; i++) {
        const el = response[i];
        if (el.type === 'FN') el.type = 'FUNCTION';
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
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `select SPECIFIC_NAME as procedure_name, ROUTINE_TYPE as [type],LAST_ALTERED as modified, CREATED as created,ROUTINE_DEFINITION as create_procedure ,pc.*
        from ${args.databaseName}.information_schema.routines as pc where routine_type = 'PROCEDURE' and SPECIFIC_NAME='${args.procedure_name}'`
      );

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
   * @param {Object} - args.view_name -
   * @returns {Object[]} - views
   * @property {String} - views[].tn
   */
  async viewRead(args: any = {}) {
    const _func = this.viewRead.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `SELECT v.name as view_name,v.*,m.*, m.definition as view_definition FROM sys.views v inner join sys.schemas s on s.schema_id = v.schema_id
        inner join sys.sql_modules as m on m.object_id = v.object_id where v.name = '${args.view_name}'`
      );

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
      args.databaseName = this.connectionConfig.connection.database;

      const response = await this.sqlClient.raw(
        `SELECT [so].[name] AS [trigger_name], [so].[crdate] AS [created],
        USER_NAME([so].[uid]) AS [trigger_owner], USER_NAME([so2].[uid]) AS [ts],
        OBJECT_NAME([so].[parent_obj]) AS [tn],
        OBJECTPROPERTY( [so].[id], 'ExecIsUpdateTrigger') AS [isupdate],
        OBJECTPROPERTY( [so].[id], 'ExecIsDeleteTrigger') AS [isdelete],
        OBJECTPROPERTY( [so].[id], 'ExecIsInsertTrigger') AS [isinsert],
        OBJECTPROPERTY( [so].[id], 'ExecIsAfterTrigger') AS [isafter],
        OBJECTPROPERTY( [so].[id], 'ExecIsInsteadOfTrigger') AS [isinsteadof],
        OBJECTPROPERTY([so].[id], 'ExecIsTriggerDisabled') AS [disabled],df.definition
        FROM sysobjects AS [so]
        INNER JOIN sys.sql_modules AS df ON object_id = so.id
        INNER JOIN sysobjects AS so2 ON so.parent_obj = so2.Id
        WHERE [so].[type] = 'TR' and so2.name = '${this.getTnPath(
          args.tn
        )}' and [so].[name] = '${args.trigger_name}'`
      );

      for (let i = 0; i < response.length; i++) {
        const el = response[i];
        el.table = el.tn;
        el.statement = el.definition;
        el.trigger = el.trigger_name;
        el.event = [];
        el.timing = [];
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
      const rows = await this.sqlClient.raw(
        `select name from sys.databases where name = '${args.database_name}'`
      );

      if (rows.length === 0) {
        await this.sqlClient.raw(`CREATE DATABASE  ${args.database_name}`);
      }
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
      const connectionParamsWithoutDb = JSON.parse(
        JSON.stringify(this.connectionConfig)
      );

      if (
        connectionParamsWithoutDb.connection.database === args.database_name
      ) {
        delete connectionParamsWithoutDb.connection.database;
        const tempSqlClient = knex(connectionParamsWithoutDb);
        await this.sqlClient.destroy();
        this.sqlClient = tempSqlClient;
      }

      await this.sqlClient.raw(
        `ALTER DATABASE ${args.database_name} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
         DROP DATABASE ${args.database_name};`
      );
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async triggerDelete(args: any = {}) {
    const func = this.triggerDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    // `DROP TRIGGER ${args.trigger_name}`
    try {
      const query = `${this.querySeparator()}DROP TRIGGER IF EXISTS ${
        args.trigger_name
      }`;

      await this.sqlClient.raw(query);

      result.data.object = {
        upStatement: [{ sql: query }],
        downStatement: [
          {
            sql: `${this.querySeparator()}${args.oldStatement}`,
          },
        ],
      };
    } catch (e) {
      log.ppe(e, func);
      throw e;
    }

    log.api(`${func}: result`, result);
    return result;
  }

  async functionDelete(args: any = {}) {
    const _func = this.functionDelete.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    const upQuery =
      this.querySeparator() + `DROP FUNCTION IF EXISTS ${args.function_name}`;
    const downQuery = this.querySeparator() + args.create_function;
    try {
      await this.sqlClient.raw(upQuery);
      result.data.object = {
        upStatement: [{ sql: upQuery }],
        downStatement: [{ sql: downQuery }],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    log.api(`${_func}: result`, result);

    return result;
  }

  async procedureDelete(args: any = {}) {
    const func = this.procedureDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      await this.sqlClient.raw(
        `DROP PROCEDURE IF EXISTS ${args.procedure_name}`
      );
      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP PROCEDURE IF EXISTS ${args.procedure_name}`,
          },
        ],
        downStatement: [
          { sql: this.querySeparator() + `${args.create_procedure}` },
        ],
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
      await this.sqlClient.raw(`${args.create_function}`);
      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + `${args.create_function}` },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP FUNCTION IF EXISTS ${args.function_name}`,
          },
        ],
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
      await this.sqlClient.raw(`DROP FUNCTION IF EXISTS ${args.function_name}`);
      await this.sqlClient.raw(`${args.create_function}`);
      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP FUNCTION IF EXISTS ${
                args.function_name
              };${this.querySeparator()}\n${args.create_function}`,
          },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP FUNCTION IF EXISTS ${
                args.function_name
              };${this.querySeparator()} ${args.oldCreateFunction}`,
          },
        ],
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
      await this.sqlClient.raw(`${args.create_procedure}`);
      result.data.object = {
        upStatement: [
          { sql: this.querySeparator() + `${args.create_procedure}` },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() + `DROP PROCEDURE ${args.procedure_name}`,
          },
        ],
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
      await this.sqlClient.raw(
        `DROP PROCEDURE IF EXISTS ${args.procedure_name}`
      );
      await this.sqlClient.raw(`${args.create_procedure}`);
      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP PROCEDURE IF EXISTS ${
                args.procedure_name
              };${this.querySeparator()}\n${args.create_procedure}`,
          },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP PROCEDURE IF EXISTS ${
                args.procedure_name
              };${this.querySeparator()}${args.oldCreateProcedure}`,
          },
        ],
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
   * @returns {Object[]} - result rows
   */
  async triggerCreate(args: any = {}) {
    const func = this.triggerCreate.name;
    const result = new Result();
    log.api(`${func}:args:`, args);
    try {
      const query = `CREATE TRIGGER ${args.trigger_name} on ${this.getTnPath(
        args.tn
      )} \n${args.timing} ${args.event}\n as\n${args.statement}`;
      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [
          { sql: this.querySeparator() + `DROP TRIGGER ${args.trigger_name}` },
        ],
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
      // await this.sqlClient.raw(`DROP TRIGGER ${args.trigger_name}`);
      await this.sqlClient.raw(
        `ALTER TRIGGER ${args.trigger_name} ON ${this.getTnPath(args.tn)} \n${
          args.timing
        } ${args.event}\n AS\n${args.statement}`
      );

      result.data.object = {
        upStatement: [
          {
            sql:
              this.querySeparator() +
              `ALTER TRIGGER ${args.trigger_name} ON ${this.getTnPath(
                args.tn
              )} \n${args.timing} ${args.event}\n AS\n${args.statement}`,
          },
        ],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `ALTER TRIGGER ${args.trigger_name} ON ${this.getTnPath(
                args.tn
              )} \n${args.timing} ${args.event}\n AS\n${args.statement}`,
          },
        ],
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
      const query = args.view_definition;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [
          { sql: this.querySeparator() + `DROP VIEW ${args.view_name}` },
        ],
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
      const query = args.view_definition;

      await this.sqlClient.raw(query);
      result.data.object = {
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [
          {
            sql:
              this.querySeparator() +
              `DROP VIEW ${args.view_name} ; ${this.querySeparator()}${
                args.oldViewDefination
              };`,
          },
        ],
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
        upStatement: [{ sql: this.querySeparator() + query }],
        downStatement: [
          {
            sql: this.querySeparator() + args.oldViewDefination,
          },
        ],
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
      const upQuery = this.querySeparator() + this.createTable(args.tn, args);
      await this.sqlClient.raw(upQuery);

      const downStatement =
        this.querySeparator() +
        this.sqlClient.schema.dropTable(args.table).toString();

      this.emit(`Success : ${upQuery}`);

      const triggerStatements = await this.afterTableCreate(args);

      /**************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upQuery }, ...triggerStatements.upStatement],
        downStatement: [
          ...triggerStatements.downStatement,
          { sql: downStatement },
        ],
      };
    } catch (e) {
      log.ppe(e, _func);
      throw e;
    }

    return result;
  }

  async afterTableCreate(args) {
    const result = { upStatement: [], downStatement: [] };
    let upQuery = '';
    let downQuery = '';

    const pk = args.columns.find((c) => c.pk);
    if (!pk) return result;

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au) {
        const triggerName = `xc_trigger_${args.table_name}_${column.column_name}`;
        const triggerCreateQuery =
          this.querySeparator() +
          `CREATE TRIGGER ${this.schema}.${triggerName} ON ${this.schema}.${args.table_name} AFTER UPDATE
                  AS
                  BEGIN
                      SET NOCOUNT ON;
                      UPDATE ${this.schema}.${args.table_name} Set ${column.column_name} = GetDate() where ${pk.column_name} in (SELECT ${pk.column_name} FROM Inserted)
                  END;`;

        upQuery += triggerCreateQuery;

        await this.sqlClient.raw(triggerCreateQuery);

        downQuery +=
          this.querySeparator() +
          `DROP TRIGGER IF EXISTS ${this.schema}.${triggerName};`;
      }
    }
    result.upStatement[0] = { sql: upQuery };
    result.downStatement[0] = { sql: downQuery };
    return result;
  }

  async afterTableUpdate(args) {
    const result = { upStatement: [], downStatement: [] };
    let upQuery = '';
    let downQuery = '';

    const pk = args.columns.find((c) => c.pk);
    if (!pk) return result;

    for (let i = 0; i < args.columns.length; i++) {
      const column = args.columns[i];
      if (column.au && column.altered === 1) {
        const triggerName = `xc_trigger_${args.table_name}_${column.column_name}`;
        const triggerCreateQuery =
          this.querySeparator() +
          `CREATE TRIGGER ${this.schema}.${triggerName} ON  ${this.schema}.${args.table_name} AFTER UPDATE
                  AS
                  BEGIN
                      SET NOCOUNT ON;
                      UPDATE ${this.schema}.${args.table_name} Set ${column.column_name} = GetDate() where ${pk.column_name} in (SELECT ${pk.column_name} FROM Inserted)
                  END;`;

        upQuery += triggerCreateQuery;

        await this.sqlClient.raw(triggerCreateQuery);

        downQuery +=
          this.querySeparator() +
          `DROP TRIGGER IF EXISTS ${this.schema}.${triggerName};`;
      }
    }
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
      args.table = args.tn;
      const originalColumns = args.originalColumns;
      args.connectionConfig = this._connectionConfig;
      args.sqlClient = this.sqlClient;

      let upQuery = '';
      let downQuery = '';

      for (let i = 0; i < args.columns.length; ++i) {
        const oldColumn = lodash.find(originalColumns, {
          cn: args.columns[i].cno,
        });

        if (args.columns[i].altered & 4) {
          // col remove
          upQuery += this.alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery
          );
          downQuery += this.alterTableAddColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery
          );
        } else if (args.columns[i].altered & 2 || args.columns[i].altered & 8) {
          // col edit
          upQuery += this.alterTableChangeColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery
          );
          downQuery += this.alterTableChangeColumn(
            args.table,
            oldColumn,
            args.columns[i],
            downQuery
          );
        } else if (args.columns[i].altered & 1) {
          // col addition
          upQuery += this.alterTableAddColumn(
            args.table,
            args.columns[i],
            oldColumn,
            upQuery
          );
          downQuery += this.alterTableRemoveColumn(
            args.table,
            args.columns[i],
            oldColumn,
            downQuery
          );
        }
      }

      upQuery += this.alterTablePK(
        args.table,
        args.columns,
        args.originalColumns,
        upQuery
      );
      downQuery += this.alterTablePK(
        args.table,
        args.originalColumns,
        args.columns,
        downQuery
      );

      if (upQuery) {
        //upQuery = `ALTER TABLE ${args.columns[0].tn} ${upQuery};`;
        //downQuery = `ALTER TABLE ${args.columns[0].tn} ${downQuery};`;
      }

      await this.sqlClient.raw(upQuery);

      console.log(upQuery);

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
        this.sqlClient.schema.dropTable(this.getTnPath(args.tn)).toString();
      let downQuery = this.querySeparator() + this.createTable(args.tn, args);

      this.emit(`Success : ${upStatement}`);

      let relationsList: any = await this.relationList({
        tn: this.getTnPath(args.tn),
      });

      relationsList = relationsList.data.list;

      for (const relation of relationsList) {
        downQuery +=
          this.querySeparator() +
          (await this.sqlClient.schema
            .table(this.getTnPath(relation.tn), function (table) {
              table = table
                .foreign(relation.cn, null)
                .references(relation.rcn)
                .on(relation.rtn);

              if (relation.ur) {
                table = table.onUpdate(relation.ur);
              }
              if (relation.dr) {
                table = table.onDelete(relation.dr);
              }
            })
            .toQuery());
      }

      let indexList: any = await this.indexList(args);

      // Todo: filter foeign key in proper way
      indexList = indexList.data.list.filter(
        ({ type, key_name }) =>
          type !== 'Primary key' && key_name.indexOf('fk_') === -1
      );

      const indexesMap: { [key: string]: any } = {};

      for (const { key_name, non_unique, cn } of indexList) {
        if (!(key_name in indexesMap)) {
          indexesMap[key_name] = {
            tn: this.getTnPath(args.tn),
            indexName: key_name,
            non_unique,
            columns: [],
          };
        }
        indexesMap[key_name].columns.push(cn);
      }

      for (const { non_unique, tn, columns, key_name } of Object.values(
        indexesMap
      )) {
        downQuery +=
          this.querySeparator() +
          this.sqlClient.schema
            .table(tn, function (table) {
              if (non_unique) {
                table.index(columns, key_name);
              } else {
                table.unique(columns, key_name);
              }
            })
            .toQuery();
      }

      /** ************** drop tn *************** */
      await this.sqlClient.schema.dropTable(this.getTnPath(args.tn));

      /** ************** return files *************** */
      result.data.object = {
        upStatement: [{ sql: upStatement }],
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
    let result = new Result();
    log.api(`${_func}:args:`, args);
    try {
      result = await this.columnList(args);
      const upQuery = this.createTable(args.tn, {
        tn: args.tn,
        columns: result.data.list,
      });
      result.data = upQuery;
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
      result.data = `INSERT INTO \`${this.getTnPath(args.tn)}\` (`;
      let values = ' VALUES (';
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `\n${response.data.list[i].cn}\n\t`;
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
      result.data = `UPDATE ${this.getTnPath(args.tn)} \nSET\n`;
      const response = await this.columnList(args);
      if (response.data && response.data.list) {
        for (let i = 0; i < response.data.list.length; ++i) {
          if (!i) {
            result.data += `${response.data.list[i].cn} = <\`${response.data.list[i].cn}\`>\n\t`;
          } else {
            result.data += `,${response.data.list[i].cn} = <\`${response.data.list[i].cn}\`>\n\t`;
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
      result.data = `DELETE FROM ${this.getTnPath(args.tn)} where ;`;
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
      result.data = `TRUNCATE TABLE ${this.getTnPath(args.tn)};`;
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

  alterTablePK(t, n, o, _existingQuery, createTable = false) {
    const shouldSanitize = true;
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
      // todo: pk constraint delete
      query += numOfPksInOriginal.length ? ',DROP PRIMARY KEY' : '';

      if (numOfPksInNew.length) {
        if (createTable) {
          // query += `, PRIMARY KEY(${numOfPksInNew.join(',')})`;
          query += this.genQuery(
            `, PRIMARY KEY(??)`,
            [numOfPksInNew],
            shouldSanitize
          );
        } else {
          query += this.genQuery(
            `ALTER TABLE ?? ADD PRIMARY KEY(??)`,
            [this.getTnPath(t), numOfPksInNew],
            shouldSanitize
          );
        }
      }
    }

    return query;
  }

  getTnPath(t) {
    return this.schema ? `${this.schema}.${t}` : t;
  }

  alterTableRemoveColumn(t, n, _o, existingQuery) {
    const shouldSanitize = true;
    let query = existingQuery ? ';' : '';
    if (n.cdf) {
      query += this.genQuery(
        `\nALTER TABLE ?? DROP CONSTRAINT ??;`,
        [this.getTnPath(t), n.default_constraint_name || `DF_${t}_${n.cn}`],
        shouldSanitize
      );
    }
    query += this.genQuery(
      `\nALTER TABLE ?? DROP COLUMN ??`,
      [this.getTnPath(t), n.cn],
      shouldSanitize
    );
    return query;
  }

  createTableColumn(t, n, o, existingQuery) {
    return this.alterTableColumn(t, n, o, existingQuery, 0);
  }

  alterTableAddColumn(t, n, o, existingQuery) {
    return this.alterTableColumn(t, n, o, existingQuery, 1);
  }

  alterTableChangeColumn(t, n, o, existingQuery) {
    return this.alterTableColumn(t, n, o, existingQuery, 2);
  }

  createTable(table, args) {
    const shouldSanitize = true;
    let query = '';

    for (let i = 0; i < args.columns.length; ++i) {
      query += this.createTableColumn(table, args.columns[i], null, query);
    }
    query += this.alterTablePK(table, args.columns, [], query, true);
    query = this.genQuery(
      `CREATE TABLE ?? (${query});`,
      [this.getTnPath(args.tn)],
      shouldSanitize
    );
    return query;
  }

  alterTableColumn(t, n, o, existingQuery, change = 2) {
    let query = '';

    const defaultValue = getDefaultValue(n);
    const shouldSanitize = true;

    if (change === 0) {
      query = existingQuery ? ',' : '';
      query += this.genQuery(`?? ${n.dt}`, [n.cn], shouldSanitize);
      query += !getDefaultLengthIsDisabled(n.dt) && n.dtxp ? `(${n.dtxp})` : '';
      query += n.rqd ? ' NOT NULL' : ' NULL';
      query += n.ai ? ' IDENTITY(1,1)' : ' ';
      query += defaultValue
        ? this.genQuery(
            ` CONSTRAINT  ?? DEFAULT ${defaultValue}`,
            [`DF_${t}_${n.cn}`],
            shouldSanitize
          )
        : '';
      if (defaultValue) {
        n.default_constraint_name = `DF_${t}_${n.cn}`;
      }
    } else if (change === 1) {
      query += this.genQuery(` ADD ?? ${n.dt}`, [n.cn], shouldSanitize);
      query += !getDefaultLengthIsDisabled(n.dt) && n.dtxp ? `(${n.dtxp})` : '';
      query += n.rqd ? ' NOT NULL' : ' NULL';
      query += n.ai ? ' IDENTITY(1,1)' : ' ';
      query += defaultValue
        ? this.genQuery(
            ` CONSTRAINT ?? DEFAULT ${defaultValue}`,
            [`DF_${t}_${n.cn}`],
            shouldSanitize
          )
        : ' ';
      // shouldSanitize = false;
      query = this.genQuery(
        `ALTER TABLE ?? ${query};`,
        [this.getTnPath(t)],
        shouldSanitize
      );
      if (defaultValue) {
        n.default_constraint_name = `DF_${t}_${n.cn}`;
      }
    } else {
      //ALTER TABLE mssql_dev_1.${this.schema}.basictypes DROP CONSTRAINT DF__basictype__title__3D5E1FD2
      if (n.cn !== o.cn) {
        // query += `\nALTER TABLE ${t} RENAME COLUMN ${n.cno} TO ${n.cn}
        query += this.genQuery(
          `\nEXEC sp_rename ?, ?, 'COLUMN';\n`,
          [`${this.getTnPath(t)}.${n.cno}`, `${n.cn}`],
          shouldSanitize
        );
      }

      if (n.dtxp !== o.dtxp && !['text'].includes(n.dt)) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? ${n.dt}(${n.dtxp});\n`,
          [this.getTnPath(t), n.cn],
          shouldSanitize
        );
      } else if (n.dt !== o.dt) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ?? TYPE ${n.dt};\n`,
          [this.getTnPath(t), n.cn],
          shouldSanitize
        );
      }

      if (n.rqd !== o.rqd) {
        query += this.genQuery(
          `\nALTER TABLE ?? ALTER COLUMN ??  ${n.dt}`,
          [this.getTnPath(t), n.cn],
          shouldSanitize
        );
        if (
          ![
            'int',
            'bigint',
            'bit',
            'real',
            'float',
            'decimal',
            'money',
            'smallint',
            'tinyint',
            'geometry',
            'datetime',
            'text',
          ].includes(n.dt)
        )
          query += n.dtxp && n.dtxp != -1 ? `(${n.dtxp})` : '';
        query += n.rqd ? ` NOT NULL;\n` : ` NULL;\n`;
      }

      if (n.cdf !== o.cdf || n.cn !== o.cn) {
        if (o.default_constraint_name)
          query += this.genQuery(
            `\nALTER TABLE ?? DROP CONSTRAINT ??;`,
            [this.getTnPath(t), o.default_constraint_name],
            shouldSanitize
          );
        if (n.cdf) {
          query += this.genQuery(
            `\nALTER TABLE ??  ADD CONSTRAINT ?? DEFAULT ${n.cdf} FOR ??;`,
            [this.getTnPath(t), `DF_${n.tn}_${n.cn}`, n.cn],
            shouldSanitize
          );
          // todo: hack
          n.default_constraint_name = `DF_${n.tn}_${n.cn}`;
        }
      }
    }
    return query;
  }

  get schema() {
    return (
      (this.connectionConfig &&
        this.connectionConfig.searchPath &&
        this.connectionConfig.searchPath[0]) ||
      'dbo'
    );
  }

  /**
   *
   * @param {Object} args
   * @returns {Object} result
   * @returns {Number} code
   * @returns {String} message
   */
  async totalRecords(args: any = {}) {
    const func = this.totalRecords.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      const data = await this.sqlClient
        .raw(`SELECT SUM(RecordCount) AS TotalRecords FROM
      (SELECT (SCHEMA_NAME(A.schema_id) + '.' + A.Name) AS TableName, AVG(B.rows) AS RecordCount
        FROM sys.objects A
        INNER JOIN sys.partitions B ON A.object_id = B.object_id
        WHERE A.type = 'U'
        GROUP BY A.schema_id,A.Name) src`);
      result.data = data[0];
    } catch (e) {
      result.code = -1;
      result.message = e.message;
      result.object = e;
    } finally {
      log.api(`${func} :result: ${result}`);
    }
    return result;
  }
}

function getDefaultValue(n) {
  if (n.cdf === undefined || n.cdf === null) return n.cdf;
  switch (n.dt) {
    case 'boolean':
    case 'bool':
    case 'tinyint':
    case 'int':
    case 'samllint':
    case 'bigint':
    case 'integer':
    case 'smallint':
    case 'mediumint':
    case 'int2':
    case 'int4':
    case 'int8':
    case 'long':
    case 'serial':
    case 'bigserial':
    case 'smallserial':
    case 'number':
    case 'float':
    case 'double':
    case 'decimal':
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'money':
    case 'smallmoney':
    case 'dec':
      return n.cdf;
      break;

    case 'datetime':
    case 'timestamp':
    case 'date':
    case 'time':
      if (
        n.cdf.toLowerCase().indexOf('getdate') > -1 ||
        /\(([\d\w'", ]*)\)$/.test(n.cdf)
      ) {
        return n.cdf;
      }
      return JSON.stringify(n.cdf);
      break;
    case 'text':
    case 'ntext':
      return `'${n.cdf}'`;
      break;
    default:
      return JSON.stringify(n.cdf);
      break;
  }
}

function getDefaultLengthIsDisabled(type) {
  switch (type) {
    // case 'binary':
    // case 'char':
    // case 'sql_variant':
    // case 'nvarchar':
    // case 'nchar':
    // case 'ntext':
    // case 'varbinary':
    // case 'sysname':
    case 'bigint':
    case 'bit':
    case 'date':
    case 'datetime':
    case 'datetime2':
    case 'datetimeoffset':
    case 'decimal':
    case 'float':
    case 'geography':
    case 'geometry':
    case 'heirarchyid':
    case 'image':
    case 'int':
    case 'money':
    case 'numeric':
    case 'real':
    case 'json':
    case 'smalldatetime':
    case 'smallint':
    case 'smallmoney':
    case 'text':
    case 'time':
    case 'timestamp':
    case 'tinyint':
    case 'uniqueidentifier':
    case 'xml':
      return true;
      break;
    default:
    case 'varchar':
      return false;
      break;
  }
}

export default MssqlClient;
