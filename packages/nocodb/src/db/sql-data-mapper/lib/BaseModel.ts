/* eslint-disable @typescript-eslint/ban-types,prefer-const */
import groupBy from 'lodash/groupBy';
import type { Knex } from 'knex';
import type Filter from '~/models/Filter';
import type Sort from '~/models/Sort';

const autoBind = require('auto-bind');
const Validator = require('validator');

// interface BaseModel {
//   beforeInsert(data): Promise<void>;
//
//   afterInsert(response): Promise<void>;
//
//   errorInsert(err, data): Promise<void>;
//
//   beforeUpdate(data): Promise<void>;
//
//   afterUpdate(response): Promise<void>;
//
//   errorUpdate(err, data): Promise<void>;
//
//   beforeDelete(data): Promise<void>;
//
//   afterDelete(response): Promise<void>;
//
//   errorDelete(err, data): Promise<void>;
//
//
//   beforeInsertb(data): Promise<void>;
//
//   afterInsertb(response): Promise<void>;
//
//   errorInsertb(err, data): Promise<void>;
//
//   beforeUpdateb(data): Promise<void>;
//
//   afterUpdateb(response): Promise<void>;
//
//   errorUpdateb(err, data): Promise<void>;
//
//   beforeDeleteb(data): Promise<void>;
//
//   afterDeleteb(response): Promise<void>;
//
//   errorDeleteb(err, data): Promise<void>;
//
//
// }

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 *
 */
abstract class BaseModel {
  protected dbDriver: Knex;
  protected columns: any[];
  protected pks: any[];
  protected hasManyRelations: any;
  protected belongsToRelations: any;
  protected manyToManyRelations: any;
  protected virtualColumns: any;
  protected config: any;
  protected clientType: string;
  public readonly type: string;
  public readonly tn: string;

  /**
   *
   * @param {Object} args
   * @param {Object} args.knex - Knex instance
   * @param {String} args.tn - table name
   * @param {Object[]} args.columns - columns
   * @param {Object[]} args.pks - primary keys
   * @param {Object[]} args.hasMany - has many relations
   * @param {Object[]} args.belongsTo - belongs to relations
   * @param {Object} args.hooks - afterInsert, beforeInsert, errorInsert, afterUpdate, beforeUpdate, errorUpdate, afterDelete, beforeDelete, errorDelete
   * @returns {BaseModelSql} Returns {@link BaseModelSql} reference.
   *
   */
  constructor({
    dbDriver,
    tn,
    columns,
    hasMany = [],
    belongsTo = [],
    type = 'table',
  }) {
    this.dbDriver = dbDriver;
    this.tn = tn;
    this.columns = columns;

    this.pks = columns.filter((c) => c.pk === true);
    this.hasManyRelations = hasMany;
    this.belongsToRelations = belongsTo;
    this.type = type;
    this.config = {
      limitMax: 500,
      limitMin: 5,
      limitDefault: 10,
      log: true,
      explain: false,
      hasManyMax: 5,
      bulkLengthMax: 1000,
      chunkSize: 50,
      stepMin: 1,
      stepsMax: 100,
      record: true,
      timeout: 25000,
    };

    this.clientType = this.dbDriver.client;

    autoBind(this);
  }

  /**
   * Validates column values against validation functions
   *
   * @param {Object[]} columns - columns with values
   * @memberof BaseModel
   * @returns Promise<Boolean>
   * @throws {Error}
   */
  async validate(columns) {
    // let cols = Object.keys(this.columns);
    for (let i = 0; i < this.columns.length; ++i) {
      const {
        validate: { func, msg },
        cn,
      } = this.columns[i];
      for (let j = 0; j < func.length; ++j) {
        const fn = typeof func[j] === 'string' ? Validator[func[j]] : func[j];
        const arg =
          typeof func[j] === 'string' ? columns[cn] + '' : columns[cn];
        if (
          cn in columns &&
          !(fn.constructor.name === 'AsyncFunction' ? await fn(arg) : fn(arg))
        )
          throw new Error(msg[j]);
      }
    }
    return true;
  }

  /**
   *
   * @returns {Object} knex instance attached to a table
   */
  get $db() {
    return this.dbDriver(this.tn);
  }

  /**
   * _wherePk
   *
   * @param {String} id - pk separated by ___
   * @returns {Object} - primary key where condition
   * @private
   */
  _wherePk(id) {
    const ids = (id + '').split('___');
    const where = {};
    for (let i = 0; i < this.pks.length; ++i) {
      where[this.pks?.[i]?.cn] = ids[i];
    }
    return where;
  }

  /**
   * _whereFk
   *
   * @param {Object} args
   * @param {String} args.tnp - parent table name
   * @param {String} args.parentId - foreign key
   * @returns {Object} - foreign key where condition
   * @private
   */
  _whereFk({ tnp, parentId }) {
    const { rcn } = this.belongsToRelations.find(({ rtn }) => rtn === tnp);
    const where = { [rcn]: parentId };
    return where;
  }

  /**
   *
   * @param obj
   * @returns {{}}
   * @private
   */
  _extractPks(obj) {
    const objCopy = JSON.parse(JSON.stringify(obj));
    for (const key in obj) {
      if (this.pks.filter((pk) => pk.cn === key).length === 0) {
        delete objCopy[key];
      }
    }
    return objCopy;
  }

  /**
   * Creates row in table
   *
   * @param {Object} data - row data
   * @returns {Promise<*>}
   */
  // @ts-ignore
  async insert(data, trx?: any, cookie?: any) {
    try {
      if ('beforeInsert' in this) {
        await this.beforeInsert(data, trx, cookie);
      }

      let response;

      await this.validate(data);

      const query = this.$db.insert(data);

      if (this.dbDriver.client === 'pg' || this.dbDriver.client === 'mssql') {
        query.returning('*');
        response = await this._run(query);
      } else {
        response = data;
        const res = await this._run(query);
        const ai = this.columns.find((c) => c.ai);
        if (ai) {
          response[ai.cn] = res[0];
        }
      }
      await this.afterInsert(response, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorInsert(e, data, trx, cookie);
      throw e;
    }
  }

  /**
   * Creates row in this table under a certain parent
   *
   * @param {Object} args
   * @param {Object} args.data - row data
   * @param {String} args.parentId - parent table id
   * @param {String} args.tnp - parent table name
   * @returns {Promise<*>}
   * @todo should return inserted record
   */
  // @ts-ignore
  async insertByFk({ parentId, tnp, data }, trx?: any, cookie?: any) {
    try {
      await this.beforeInsert(data, trx, cookie);

      let response;

      await this.validate(data);
      Object.assign(data, this._whereFk({ parentId, tnp }));

      const query = this.$db.insert(data);

      if (this.dbDriver.client === 'pg' || this.dbDriver.client === 'mssql') {
        query.returning('*');
        response = await this._run(query);
      } else {
        response = data;
        const res = await this._run(query);
        const ai = this.columns.find((c) => c.ai);
        if (ai) {
          response[ai.cn] = res[0];
        }
      }

      await this.afterInsert(data, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorInsert(e, data, trx, cookie);
      throw e;
    }
  }

  /**
   * Creates multiple rows in table
   *
   * @param {Object[]} data - row data
   * @returns {Promise<*>}
   */
  async insertb(data) {
    try {
      await this.beforeInsertb(data);

      for (const d of data) {
        await this.validate(d);
      }

      const response =
        this.dbDriver.client === 'pg' || this.dbDriver.client === 'mssql'
          ? this.dbDriver
              .batchInsert(this.tn, data, 50)
              .returning(this.pks?.[0]?.cn || '*')
          : this.dbDriver.batchInsert(this.tn, data, 50);

      await this.afterInsertb(data);

      return response;
    } catch (e) {
      await this.errorInsertb(e, data);
      throw e;
    }
  }

  // @ts-ignore
  /**
   * Reads table row data
   *
   * @param {String} id - primary key separated by ___
   * @returns {Object} Table row data
   */
  // @ts-ignore
  async readByPk(id) {
    try {
      return await this._run(
        this.$db.select().where(this._wherePk(id)).first(),
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Reads table row data under a certain parent
   *
   * @param {Object} args
   * @param {Object} args.id - primary key separated by ___
   * @param {String} args.parentId - parent table id
   * @param {String} args.tnp - parent table name
   * @returns {Promise<Object>} returns row
   */
  async readByFk({ id, parentId, tnp }) {
    try {
      return await this._run(
        this.$db
          .select()
          .where(this._wherePk(id))
          .andWhere(
            this._whereFk({
              tnp,
              parentId,
            }),
          )
          .limit(1),
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the list of rows in table
   *
   * @param {object} args
   * @param {String} [args.fields=*] - commas separated column names of this table
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<object[]>} rows
   * @memberof BaseModel
   * @throws {Error}
   */
  async list(args) {
    try {
      const { fields, where, limit, offset, sort, condition } =
        this._getListArgs(args);

      const query = this.$db
        .select(...fields.split(','))
        .xwhere(where)
        .condition(condition);

      this._paginateAndSort(query, { limit, offset, sort });

      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the first row from the select query
   *
   * @param {object} args
   * @param {String} [args.fields=*] - commas separated column names of this table
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {object} row
   * @memberof BaseModel
   * @throws {Error}
   */
  async findOne(args) {
    try {
      const { fields, where, condition } = this._getListArgs(args);
      const query = this.$db
        .select(fields)
        .xwhere(where)
        .condition(condition)
        .first();
      this._paginateAndSort(query, args);
      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the first row from the select query
   *
   * @param {object} args
   * @param {String} [args.fields=*] - commas separated column names of this table
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @param {String} args.parentId - parent table id
   * @param {String} args.tnp - parent table name
   * @returns {object} row
   * @memberof BaseModel
   * @throws {Error}
   */
  async findOneByFk({ parentId, tnp, ...args }) {
    try {
      const { fields, where, condition } = this._getListArgs(args);
      const query = this.$db
        .select(fields)
        .where(this._whereFk({ parentId, tnp }))
        .xwhere(where)
        .condition(condition)
        .first();
      this._paginateAndSort(query, args);
      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the count of rows based on the where
   *
   * @param {object} args
   * @param {String} [args.where]  - where clause with conditions within ()
   * @returns {Promise<Object>}
   * @memberof BaseModel
   * @throws {Error}
   */
  async countByPk({ where, condition }) {
    try {
      return await this._run(
        this.$db
          .count(`${(this.pks?.[0] || this.columns[0]).cn} as count`)
          .xwhere(where)
          .condition(condition)
          .first(),
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the count of rows based on the where
   *
   * @param {object} args
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} args.parentId - parent table id
   * @param {String} args.tnp - parent table name
   * @returns {Promise<Object>}
   * @memberof BaseModel
   * @throws {Error}
   */
  async countByFk({ where, parentId, tnp, condition }) {
    try {
      return await this._run(
        this.$db
          .where(
            this._whereFk({
              parentId,
              tnp,
            }),
          )
          .count(`${(this.pks?.[0] || this.columns[0]).cn} as count`)
          .xwhere(where)
          .condition(condition)
          .first(),
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Update table row data by primary key
   *
   * @param {String} id - primary key separated by ___
   * @param {Object} data - table row data
   * @returns {Number} 1 for success, 0 for failure
   */
  // @ts-ignore
  async updateByPk(id, data, trx?: any, cookie?: any) {
    try {
      await this.beforeUpdate(data, trx, cookie);

      await this.validate(data);
      let response;

      // this.validate(data);
      response = await this._run(
        this.$db.update(data).where(this._wherePk(id)),
      );
      await this.afterUpdate(data, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  /**
   * Update table row data by primary key and foreign key
   *
   * @param {Object} args
   * @param {String} args.id - primary key separated by ___
   * @param {String} args.parentId - parent table id
   * @param {String} args.tnp - parent table name
   * @param {Object} args.data - table row data
   * @returns {Number} 1 for success, 0 for failure
   */
  // @ts-ignore
  async updateByFk({ id, parentId, tnp, data }, trx?: any, cookie?: any) {
    try {
      await this.beforeUpdate({ id, parentId, tnp, data }, trx, cookie);

      await this.validate(data);
      let response;

      // this.validate(data);
      response = await this._run(
        this.$db.update(data).where(this._wherePk(id)).andWhere(
          this._whereFk({
            tnp,
            parentId,
          }),
        ),
      );
      await this.afterUpdate(response, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  /**
   * Delete table row data by primary key
   *
   * @param {String} id - primary key separated by ___
   * @returns {Number} 1 for success, 0 for failure
   */
  // @ts-ignore
  async delByPk(id, trx?: any, cookie?: any) {
    try {
      await this.beforeDelete(id, trx, cookie);

      let response;

      response = await this._run(this.$db.del().where(this._wherePk(id)));
      await this.afterDelete(response, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorDelete(e, id, trx, cookie);
      throw e;
    }
  }

  /**
   * Delete table row data by primary key and foreign key
   *
   * @param {Object} args
   * @param {String} args.id - primary key separated by ___
   * @param {String} args.parentId - parent table id
   * @param {String} args.tnp - parent table name
   * @returns {Number} 1 for success, 0 for failure
   */
  // @ts-ignore
  async delByFk({ id, parentId, tnp }, trx?: any, cookie?: any) {
    try {
      await this.beforeDelete({ id, parentId, tnp }, trx, cookie);

      let response;

      response = await this._run(
        this.$db.del().where(this._wherePk(id)).andWhere(
          this._whereFk({
            tnp,
            parentId,
          }),
        ),
      );
      await this.afterDelete(response, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorDelete(e, { id, parentId, tnp }, trx, cookie);
      throw e;
    }
  }

  /**
   * Update bulk - happens within a transaction
   *
   * @param {Object[]} data - table rows to be updated
   * @returns {Promise<Number[]>} - 1 for success, 0 for failure
   */
  async updateb(data) {
    let trx;
    try {
      await this.beforeUpdateb(data);

      trx = await this.dbDriver.transaction();

      const res = [];
      for (const d of data) {
        // this.validate(d);
        const response = await this._run(
          trx(this.tn).update(d).where(this._extractPks(d)),
        );
        res.push(response);
      }

      trx.commit();
      await this.afterUpdateb(res);

      return res;
    } catch (e) {
      if (trx) trx.rollback();
      console.log(e);
      await this.errorUpdateb(e, data);
      throw e;
    }
  }

  /**
   * Bulk delete happens within a transaction
   *
   * @param {Object[]} ids - rows to be deleted
   * @returns {Promise<Number[]>} - 1 for success, 0 for failure
   */
  async delb(ids) {
    let trx;
    try {
      await this.beforeDeleteb(ids);
      trx = await this.dbDriver.transaction();

      const res = [];
      for (const d of ids) {
        const response = await this._run(
          trx(this.tn).del().where(this._extractPks(d)),
        );
        res.push(response);
      }
      trx.commit();

      await this.afterDeleteb(res);

      return res;
    } catch (e) {
      if (trx) trx.rollback();
      console.log(e);
      await this.errorDeleteb(e, ids);
      throw e;
    }
  }

  /**
   * Table row exists
   *
   * @param {String} id - ___ separated primary key string
   * @returns {Promise<boolean>} - true for exits and false for none
   */
  async exists(id, _) {
    try {
      return Object.keys(await this.readByPk(id)).length !== 0;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Table row exists
   *
   * @param {String} id - ___ separated primary key string
   * @returns {Promise<boolean>} - true for exits and false for none
   */
  async existsByFk({ id, parentId, tnp }) {
    try {
      return (await this.readByFk({ id, parentId, tnp })).length !== 0;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the rows by group by
   *
   * @param {object} args
   * @param {String} args.cn - column name of this table()
   * @param {String} [args.fields] - commas separated column names of this table
   * @param {String} [args.having]  - having clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<object[]>} rows
   * @memberof BaseModel
   * @throws {Error}
   */
  async groupBy({ having, fields = '', column_name, limit, offset, sort }) {
    try {
      const columns = [
        ...(column_name ? [column_name] : []),
        ...fields.split(',').filter(Boolean),
      ];
      const query = this.$db
        .groupBy(columns)
        .count(`${(this.pks?.[0] || this.columns[0]).cn} as count`)
        .select(columns)
        .xhaving(having);

      this._paginateAndSort(query, { limit, offset, sort });

      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the rows by aggregation by an aggregation function(s)
   *
   * @param {object} args
   * @param {String} args.func - comma separated aggregation functions
   * @param {String} args.cn - column name of this table()
   * @param {String} [args.fields] - commas separated column names of this table
   * @param {String} [args.having]  - having clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<object[]>} rows - aggregated rows by function names
   * @memberof BaseModel
   * @throws {Error}
   */
  async aggregate({
    having,
    fields = '',
    func,
    column_name,
    limit,
    offset,
    sort,
  }) {
    try {
      const query = this.$db.select(...fields.split(',')).xhaving(having);

      if (fields) {
        query.groupBy(...fields.split(','));
      }
      if (func && column_name) {
        func.split(',').forEach((fn) => query[fn](`${column_name} as ${fn}`));
      }

      this._paginateAndSort(query, { limit, offset, sort });

      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Distribution of column values in the table
   *
   * @param {object} args
   * @param {String} [args.func=count] - comma separated aggregation functions
   * @param {String} args.cn - column name of this table()
   * @param {String} [args.steps]  - comma separated ascending numbers
   * @param {String} [args.min] - minimum value
   * @param {String} [args.max] - maximum value
   * @param {String} [args.step] - step value
   * @returns {Promise<object[]>} Distributions of column values in table
   * @run
   * table.distribution({
   *   cn : 'price',
   *   steps: '0,100,200,300,400',
   *   func: 'sum,avg'
   * })
   * @run
   * table.distribution({
   *   cn : 'price',
   *   min: '0',
   *   max: '400',
   *   step: '100',
   *   func: 'sum,avg'
   * })
   * @memberof BaseModel
   * @throws {Error}
   */
  async distribution({ column_name, steps, func = 'count', min, max, step }) {
    try {
      const ranges = [];

      // @ts-ignore
      const generateWindows = (ranges, min, max, step) => {
        max = +max;
        step = +step;

        for (let i = 0; i < max / step; i++) {
          ranges.push([i * step + (i && 1), Math.min((i + 1) * step, max)]);
        }
      };

      if (!isNaN(+min) && !isNaN(+max) && !isNaN(+step)) {
        generateWindows(ranges, min, max, step);
      } else if (steps) {
        const splitArr = steps.split(',');
        for (let i = 0; i < splitArr.length - 1; i++) {
          ranges.push([+splitArr[i] + (i ? 1 : 0), splitArr[i + 1]]);
        }
      } else {
        const { min, max, step } = await this.$db
          .min(`${column_name} as min`)
          .max(`${column_name} as max`)
          .avg(`${column_name} as step`)
          .first();
        generateWindows(ranges, min, max, Math.round(step));
      }

      return (
        await this.dbDriver.unionAll(
          ranges.map(([start, end]) => {
            const query = this.$db.xwhere(
              `(${column_name},ge,${start})~and(${column_name},le,${end})`,
            );
            if (func) {
              func
                .split(',')
                .forEach((fn) => query[fn](`${column_name} as ${fn}`));
            }
            return this.isSqlite() ? this.dbDriver.select().from(query) : query;
          }),
          !this.isSqlite(),
        )
      ).map((row, i) => {
        row.range = ranges[i].join('-');
        return row;
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get the list of distinct rows
   *
   * @param {object} args
   * @param {String} args.cn - column name of this table()
   * @param {String} [args.fields] - commas separated column names of this table
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<object[]>} rows
   * @memberof BaseModel
   * @throws {Error}
   */
  async distinct({
    column_name,
    fields = '',
    where,
    limit,
    offset,
    sort,
    condition,
  }) {
    try {
      const query = this.$db;
      query.distinct(column_name, ...fields.split(',').filter(Boolean));
      query.xwhere(where).condition(condition);
      this._paginateAndSort(query, { limit, offset, sort });
      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Runs raw query on database
   *
   * @param {String} queryString - query string
   * @param {Object[]} params - paramaterised values in an array for query
   * @returns {Promise<*>} - return raw data from database driver
   */
  async raw(queryString, params = []) {
    try {
      const query = this.dbDriver.raw(queryString, params);
      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get child list and map to input parent
   *
   * @param {Object[]} parent - parent list array
   * @param {String} child - child table name
   * @param {Object} rest - index suffixed fields, limit, offset, where and sort
   * @param index - child table index
   * @returns {Promise<void>}
   * @private
   */
  async _getChildListInParent({ parent, child }, rest = {}, index) {
    let { fields, where, limit, offset, sort, condition } =
      this._getChildListArgs(rest, index);
    const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};

    if (fields !== '*' && fields.split(',').indexOf(cn) === -1) {
      fields += ',' + cn;
    }

    const childs = await this._run(
      this.dbDriver.union(
        parent.map((p) => {
          const query = this.dbDriver(child)
            .where({ [cn]: p[this.pks?.[0]?.cn] })
            .xwhere(where)
            .condition(condition)
            .select(...fields.split(','));

          this._paginateAndSort(query, { sort, limit, offset });
          return this.isSqlite() ? this.dbDriver.select().from(query) : query;
        }),
        !this.isSqlite(),
      ),
    );

    const gs = groupBy(childs, cn);
    parent.forEach((row) => {
      row[child] = gs[row[this.pks?.[0]?.cn]] || [];
    });
  }

  /**
   * Gets child rows for a parent row in this table
   *
   * @param {Object} args
   * @param {String} args.child - child table name
   * @param {String} args.parentId - pk
   * @param {String} [args.fields=*] - commas separated column names of this table
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<Object[]>} return child rows
   */
  async hasManyChildren({ child, parentId, ...args }) {
    try {
      const { fields, where, limit, offset, sort, condition } =
        this._getListArgs(args);
      const { rcn } =
        this.hasManyRelations.find(({ tn }) => tn === child) || {};

      const query = this.dbDriver(child)
        .select(...fields.split(','))
        .where(rcn, parentId)
        .xwhere(where)
        .condition(condition);

      this._paginateAndSort(query, { limit, offset, sort });
      return await this._run(query);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Gets parent list along with children list
   *
   * @param {Object} args
   * @param {String} args.childs - comma separated child table names
   * @param {String} [args.fields=*] - commas separated column names of this table
   * @param {String} [args.fields*=*] - commas separated column names of child table(* is a natural number 'i' where i is index of child table in comma separated list)
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.where*] - where clause with conditions within ()(* is a natural number 'i' where i is index of child table in comma separated list)
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.limit*] -  number of rows to be limited  of child table(* is a natural number 'i' where i is index of child table in comma separated list)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.offset*] - offset from which to get the number of rows of child table(* is a natural number 'i' where i is index of child table in comma separated list)
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @param {String} [args.sort*] - comma separated column names where each column name is cn ascending and -cn is cn descending(* is a natural number 'i' where i is index of child table in comma separated list)
   * @returns {Promise<Object[]>}
   */
  async hasManyList({ childs, where, fields, f, ...rest }) {
    fields = fields || f || '*';
    try {
      if (
        fields !== '*' &&
        fields.split(',').indexOf(this.pks?.[0]?.cn) === -1
      ) {
        fields += ',' + this.pks?.[0]?.cn;
      }

      const parent = await this.list({ childs, where, fields, ...rest });
      if (parent && parent.length)
        await Promise.all(
          [...new Set(childs.split('.'))].map((child, index) =>
            this._getChildListInParent(
              {
                parent,
                child,
              },
              rest,
              index,
            ),
          ),
        );
      return parent;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Gets child list along with its parent
   *
   * @param {Object} args
   * @param {String} args.parents - comma separated parent table names
   * @param {String} [args.fields=*] - commas separated column names of this table
   * @param {String} [args.fields*=*] - commas separated column names of parent table(* is a natural number 'i' where i is index of child table in comma separated list)
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<Object[]>}
   */
  async belongsTo({ parents, where, fields, f, ...rest }) {
    fields = fields || f || '*';
    try {
      for (const parent of parents.split('~')) {
        const { cn } =
          this.belongsToRelations.find(({ rtn }) => rtn === parent) || {};
        if (fields !== '*' && fields.split(',').indexOf(cn) === -1) {
          fields += ',' + cn;
        }
      }

      const childs = await this.list({ where, fields, ...rest });

      await Promise.all(
        parents.split('~').map((parent, index) => {
          const { cn, rcn } =
            this.belongsToRelations.find(({ rtn }) => rtn === parent) || {};
          const parentIds = [...new Set(childs.map((c) => c[cn]))];
          return this._belongsTo(
            { parent, rcn, parentIds, childs, cn, ...rest },
            index,
          );
        }),
      );

      return childs;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Get parent and map to input child
   *
   * @param {String} parent - parent table name
   * @param {Object} childs - children list
   * @param {Object} rest - index suffixed fields, limit, offset, where and sort
   * @param index - child table index
   * @param {String} [args.fields*=*] - commas separated column names of parent table(* is a natural number 'i' where i is index of child table in comma separated list)
   * @returns {Promise<void>}
   * @private
   */
  async _belongsTo({ parent, rcn, parentIds, childs, cn, ...rest }, index) {
    let { fields } = this._getChildListArgs(rest, index);
    if (fields !== '*' && fields.split(',').indexOf(rcn) === -1) {
      fields += ',' + rcn;
    }

    const parents = await this._run(
      this.dbDriver(parent)
        .select(...fields.split(','))
        .whereIn(rcn, parentIds),
    );

    const gs = groupBy(parents, rcn);

    childs.forEach((row) => {
      row[parent] = gs[row[cn]] && gs[row[cn]][0];
    });
  }

  /**
   * Returns key value paired grouped children list
   *
   * @param {Object} args
   * @param {String} args.child - child table name
   * @param {String[]} ids  - array of parent primary keys
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<Object.<string, Object[]>>}  key will be parent pk and value will be child list
   */
  async hasManyListGQL({ child, ids, ...rest }) {
    try {
      let { fields, where, limit, offset, sort, condition } =
        this._getChildListArgs(rest);

      const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};

      if (fields !== '*' && fields.split(',').indexOf(cn) === -1) {
        fields += ',' + cn;
      }

      const childs = await this._run(
        this.dbDriver.union(
          ids.map((p) => {
            const query = this.dbDriver(child)
              .where({ [cn]: p })
              .xwhere(where)
              .condition(condition)
              .select(...fields.split(','));

            this._paginateAndSort(query, { sort, limit, offset });
            return this.isSqlite() ? this.dbDriver.select().from(query) : query;
          }),
          !this.isSqlite(),
        ),
      );

      return groupBy(childs, cn);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  isSqlite(): boolean {
    return this.clientType === 'sqlite3';
  }

  /**
   * Returns key value paired grouped children list
   *
   * @param {Object} args
   * @param {String} args.child - child table name
   * @param {String[]} ids  - array of parent primary keys
   * @param {String} [args.where]  - where clause with conditions within ()
   * @param {String} [args.limit]  - number of rows to be limited (has default,min,max values in config)
   * @param {String} [args.offset] - offset from which to get the number of rows
   * @param {String} [args.sort]   - comma separated column names where each column name is cn ascending and -cn is cn descending
   * @returns {Promise<Object.<string, Object[]>>}  key will be parent pk and value will be child list
   */
  async hasManyListCount({ child, ids, ...rest }) {
    try {
      const { where, condition } = this._getChildListArgs(rest);

      const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};

      const childs = await this._run(
        this.dbDriver.unionAll(
          ids.map((p) => {
            const query = this.dbDriver(child)
              .where({ [cn]: p })
              .xwhere(where)
              .condition(condition)
              .count(`${cn} as count`)
              .first();
            return this.isSqlite() ? this.dbDriver.select().from(query) : query;
          }),
          !this.isSqlite(),
        ),
      );

      return childs.map(({ count }) => count);
      // return groupBy(childs, cn);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Adds default params to limit, ofgste and sort params
   *
   * @param {Object} query - knex query builder
   * @param {Object} args
   * @param {string} args.limit - limit
   * @param {string} args.offset - offset
   * @param {string} args.sort - sort
   * @returns {Object} query appended with paginate and sort params
   * @private
   */
  _paginateAndSort(
    query,
    {
      limit = 20,
      offset = 0,
      sort = '',
    }: { limit?: number | string; offset?: number | string; sort?: string },
  ) {
    query.offset(offset).limit(limit);

    if (sort) {
      sort.split(',').forEach((o) => {
        if (o[0] === '-') {
          query.orderBy(o.slice(1), 'desc');
        } else {
          query.orderBy(o, 'asc');
        }
      });
    }
    return query;
  }

  /**
   * Runs a query built by knex, measure and logs time
   *
   * @param query
   * @returns {Promise<*>}
   * @private
   */
  async _run(query) {
    try {
      // if (this.config.log) {
      //   const q = query.toQuery();
      //   console.time(q);
      //   const data = await query;
      //   console.timeEnd(q);
      //   return data;
      // } else {
      return await query;
      // }
    } catch (e) {
      throw e;
    }
  }

  /**
   * Gets the default list of args for querying a table
   *
   * @param {Object} args - fields,where,limit,offset,sort indexed
   * @returns {Object} consisting of fields,where,limit,offset,sort
   * @private
   */
  _getListArgs(args) {
    const obj: XcFilter = {};
    obj.where = args.where || args.w || '';
    obj.limit = Math.max(
      Math.min(
        args.limit || args.l || this.config.limitDefault,
        this.config.limitMax,
      ),
      this.config.limitMin,
    );
    obj.offset = args.offset || args.o || 0;
    obj.fields = args.fields || args.f || '*';
    obj.sort = args.sort || args.s;
    return obj;
  }

  /**
   * Gets the default args for child list
   *
   * @param {Object} args - fields,where,limit,offset,sort indexed
   * @param {Number} index
   * @returns {Object} consisting of fields*,where*,limit*,offset*,sort*
   * @private
   */
  _getChildListArgs(args: any, index?: number) {
    index++;
    const obj: XcFilter = {};
    obj.where = args[`where${index}`] || args[`w${index}`] || '';
    obj.limit = Math.max(
      Math.min(
        args[`limit${index}`] || args[`l${index}`] || this.config.limitDefault,
        this.config.limitMax,
      ),
      this.config.limitMin,
    );
    obj.offset = args[`offset${index}`] || args[`o${index}`] || 0;
    obj.fields = args[`fields${index}`] || args[`f${index}`] || '*';
    obj.sort = args[`sort${index}`] || args[`s${index}`];
    return obj;
  }

  /**
   * Before Insert is a hook which can be override in subclass
   * @abstract
   * @param {Object} data - insert data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeInsert(data, trx?: any, cookie?: {}) {}

  /**
   * After Insert is a hook which can be override in subclass
   * @abstract
   * @param {Object} response - inserted data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterInsert(response, trx?: any, cookie?: {}) {}

  /**
   * After Insert is a hook which can be override in subclass
   * @abstract
   * @param {Error} err - Exception reference
   * @param {Object} data - insert data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async errorInsert(err, data, trx?: any, cookie?: {}) {}

  /**
   * Before Update is a hook which can be override in subclass
   * @abstract
   * @param {Object} data - update data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeUpdate(data, trx?: any, cookie?: {}) {}

  /**
   * After Update is a hook which can be override in subclass
   * @abstract
   * @param {Object} response - updated data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterUpdate(response, trx?: any, cookie?: {}) {}

  /**
   * Error update is a hook which can be override in subclass
   * @abstract
   * @param {Error} err - Exception reference
   * @param {Object} data - update data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async errorUpdate(err, data, trx?: any, cookie?: {}) {}

  /**
   * Before delete is a hook which can be override in subclass
   * @abstract
   * @param {Object} data - delete data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeDelete(data, trx?: any, cookie?: {}) {}

  /**
   * After Delete is a hook which can be override in subclass
   * @abstract
   * @param {Object} response - Deleted data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterDelete(response, trx?: any, cookie?: {}) {}

  /**
   * Error delete is a hook which can be override in subclass
   * @abstract
   * @param {Error} err - Exception reference
   * @param {Object} data - delete data
   * @param {Object} trx? - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async errorDelete(err, data, trx?: any, cookie?: {}) {}

  /**
   * Before insert bulk  is a hook which can be override in subclass
   * @abstract
   * @param {Object[]} data - insert data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeInsertb(data, trx?: any) {}

  /**
   * After insert bulk  is a hook which can be override in subclass
   * @abstract
   * @param {Object[]} response - inserted data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterInsertb(response, trx?: any) {}

  /**
   * Error insert bulk is a hook which can be override in subclass
   * @abstract
   * @param {Error} err - Exception reference
   * @param {Object} data - delete data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async errorInsertb(err, data, trx?: any) {}

  /**
   * Before update bulk  is a hook which can be override in subclass
   * @abstract
   * @param {Object[]} data - update data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeUpdateb(data, trx?: any) {}

  /**
   * After update bulk  is a hook which can be override in subclass
   * @abstract
   * @param {Object[]} response - updated data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterUpdateb(response, trx?: any) {}

  /**
   * Error update bulk is a hook which can be override in subclass
   * @abstract
   * @param {Error} err - Exception reference
   * @param {Object[]} data - delete data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async errorUpdateb(err, data, trx?: any) {}

  /**
   * Before delete bulk  is a hook which can be override in subclass
   * @abstract
   * @param {Object[]} data - delete data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async beforeDeleteb(data, trx?: any) {}

  /**
   * After delete bulk  is a hook which can be override in subclass
   * @abstract
   * @param {Object[]} response - deleted data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async afterDeleteb(response, trx?: any) {}

  /**
   * Error delete bulk is a hook which can be override in subclass
   * @abstract
   * @param {Error} err - Exception reference
   * @param {Object[]} data - delete data
   * @param {Object} trx - knex transaction reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async errorDeleteb(err, data, trx?: any) {}
}

export interface XcAggregation {
  field: string;
  type: string;
}

export interface XcFilter {
  where?: string;
  filter?: string;
  having?: string;
  condition?: any;
  conditionGraph?: any;
  limit?: string | number;
  shuffle?: string | number;
  offset?: string | number;
  sort?: string;
  fields?: string;
  filterArr?: Filter[];
  sortArr?: Sort[];
  pks?: string;
  aggregation?: XcAggregation[];
  column_name?: string;
  page?: string | number;
  nestedLimit?: string | number;
}

export interface XcFilterWithAlias extends XcFilter {
  w?: string;
  h?: string;
  c?: any;
  l?: string | number;
  r?: string | number;
  o?: string | number;
  s?: string;
  f?: string;
  p?: string | number;
}

export default BaseModel;
