import PGClient from '~/db/sql-client/lib/pg/PgClient';
import Result from '~/db/util/Result';
import Debug from '~/db/util/Debug';

const log = new Debug('YBClient');

class YBClient extends PGClient {
  constructor(connectionConfig) {
    super(connectionConfig);
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
        `select tablename as tn, * from pg_catalog.pg_tables where schemaname != 'information_schema' and schemaname != 'pg_catalog'`,
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

      const response = await this.raw(
        `
      select c.relname as tn, a.attname as cn, pg_catalog.format_type(a.atttypid, a.atttypmod) as "dt",a.attnotnull as "not_nullable",
      pg_catalog.pg_get_expr(ad.adbin, ad.adrelid, true) as cdf, dsc.description as comment,a.attnum as cop,
      coalesce(i.indisprimary,false) as pk,
      a.*,ad.oid as attr_id
      FROM pg_catalog.pg_attribute a
      INNER JOIN pg_catalog.pg_class c ON (a.attrelid=c.oid)
      LEFT OUTER JOIN pg_catalog.pg_attrdef ad ON (a.attrelid=ad.adrelid AND a.attnum = ad.adnum)
      LEFT OUTER JOIN pg_catalog.pg_description dsc ON (c.oid=dsc.objoid AND a.attnum = dsc.objsubid)
      LEFT JOIN pg_index i ON (a.attnum = any(i.indkey) and a.attrelid = i.indrelid and i.indrelid = :table::regclass AND i.indisprimary)
      WHERE NOT a.attisdropped AND c.relname = :table and a.attnum > 0 ORDER BY a.attnum`,
        {
          table: args.tn,
        },
      );

      const columns = [];

      for (let i = 0; i < response.rows.length; ++i) {
        const column: any = {};

        column.tn = args.tn;
        column.cn = response.rows[i].cn;
        column.dt = response.rows[i].dt;
        column.np = response.rows[i].np;
        column.ns = response.rows[i].ns;
        column.clen = response.rows[i].clen;
        column.dp = response.rows[i].dp;
        column.cop = response.rows[i].cop;

        // todo : there are lot of types in pg - handle them
        column.dtx = this.getKnexDataType(column.dt);
        column.pk = response.rows[i].pk_constraint_name !== null;

        column.not_nullable = response.rows[i].not_nullable;
        column.nrqd = !column.not_nullable;

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
          ? response.rows[i].cdf
              .replace(/::[\w (),]+$/, '')
              .replace(/^'|'$/g, '')
          : response.rows[i].cdf;

        // todo : need to find column comment
        column.cc = response.rows[i].comment;

        column.csn = response.rows[i].csn;

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
}

export default YBClient;
