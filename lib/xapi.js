'use strict';

var Xsql = require('./xsql.js');

//define class
class Xapi {

  constructor(args, mysqlPool, app) {

    this.sqlConfig = args;
    this.mysql = new Xsql(args, mysqlPool)
    this.app = app;

  }


  init(cbk) {

    this.mysql.init((err, results) => {

      this.setupRoutes()
      this.app.use(this.errorMiddleware)
      cbk(err, results)

    })

  }

  errorMiddleware(err, req, res, next) {

    if(err && err.code)
      res.status(400).json({error: err});
    else
      res.status(500).json({error: 'Internal server error : ' + err.message});

    next(err);
  }

  asyncMiddleware(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next))
        .catch((err) => {
          next(err);
        });
    }
  }

  root(req, res) {

    //res.sendFile(path + "index.html")
    let v = [];

    v = this.mysql.getSchemaRoutes(req.protocol + '://' + req.get('host') + '/api/');
    v = v.concat(this.mysql.globalRoutesPrint(req.protocol + '://' + req.get('host') + '/api/'))

    res.json(v)

  }

  setupRoutes() {

    this.app.get('/', this.asyncMiddleware(this.root.bind(this)))

    /**************** START : tables apis ****************/
    this.app.route('/api/tables')
      .get(this.asyncMiddleware(this.tables.bind(this)));

    this.app.route('/api/:tableName/describe')
      .get(this.asyncMiddleware(this.tableDescribe.bind(this)));
    /**************** END : tables apis ****************/


    /**************** START : basic apis ****************/
    this.app.route('/api/:tableName/count')
      .get(this.asyncMiddleware(this.count.bind(this)));

    this.app.route('/api/:tableName')
      .get(this.asyncMiddleware(this.list.bind(this)))
      .post(this.asyncMiddleware(this.create.bind(this)));

    this.app.route('/api/:tableName/:id')
      .get(this.asyncMiddleware(this.read.bind(this)))
      .put(this.asyncMiddleware(this.update.bind(this)))
      .delete(this.asyncMiddleware(this.delete.bind(this)));

    this.app.route('/api/:tableName/:id/exists')
      .get(this.asyncMiddleware(this.exists.bind(this)));

    this.app.route('/api/:parentTable/:id/:childTable')
      .get(this.asyncMiddleware(this.nestedList.bind(this)));
    /**************** END : basic apis ****************/

    if (this.sqlConfig.dynamic === 1) {

      this.app.route('/dynamic*')
        .post(this.asyncMiddleware(this.runQuery.bind(this)));

    }

  }

  async create(req, res) {

    let query = 'INSERT INTO ?? SET ?';
    let params = [];

    params.push(req.params.tableName);
    params.push(req.body);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async list(req, res) {

    let cols = this.mysql.getColumnsForSelectStmt(req.params.tableName, req.query);
    let query = 'select ' + cols + ' from ?? ';
    let params = [];
    params.push(req.params.tableName);

    query = query + this.mysql.getOrderByClause(req.query, req.params.tableName);

    query = query + ' limit ?,? '
    params = params.concat(this.mysql.getLimitClause(req.query));

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async nestedList(req, res) {

    let cols = this.mysql.getColumnsForSelectStmt(req.params.childTable, req.query);
    let query = 'select ' + cols + ' from ?? where ';
    let params = [];

    params.push(req.params.childTable);

    let whereClause = this.mysql.getForeignKeyWhereClause(req.params.parentTable,
      req.params.id,
      req.params.childTable);

    if (!whereClause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }

    query += whereClause;

    query = query + this.mysql.getOrderByClause(req.query, req.params.parentTable);

    query = query + ' limit ?,? '
    params = params.concat(this.mysql.getLimitClause(req.query));

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async read(req, res) {

    let query = 'select * from ?? where ';
    let params = [];

    params.push(req.params.tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.params.tableName,
      req.params.id.split('___'));


    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      });
    }

    query += clause;
    query += ' LIMIT 1'

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async exists(req, res) {

    let query = 'select * from ?? where ';
    let params = [];

    params.push(req.params.tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.params.tableName,
      req.params.id.split('___'));

    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }

    query += clause;
    query += ' LIMIT 1'

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async update(req, res) {

    let query = 'UPDATE ?? SET ';
    let keys = Object.keys(req.body);

    // SET clause
    let updateKeys = '';
    for (let i = 0; i < keys.length; ++i) {
      updateKeys += keys[i] + ' = ? '
      if (i !== keys.length - 1)
        updateKeys += ', '
    }

    // where clause
    query += updateKeys + ' where '
    let clause = this.mysql.getPrimaryKeyWhereClause(req.params.tableName,
      req.params.id.split('___'));

    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }

    query += clause;

    // params
    let params = [];
    params.push(req.params.tableName);
    params = params.concat(Object.values(req.body));

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async delete(req, res) {

    let query = 'DELETE FROM ?? WHERE ';
    let params = [];

    params.push(req.params.tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.params.tableName,
      req.params.id.split('___'));

    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      });
    }

    query += clause;

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async count(req, res) {

    let query = 'select count(1) as no_of_rows from ??';
    let params = [];

    params.push(req.params.tableName);

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async tables(req, res) {

    let query = 'show tables';
    let params = [];

    let results = await this.mysql.exec(query, params)
    res.status(200).json(results)

  }

  async runQuery(req, res) {

    let query = req.body.query;
    let params = req.body.params;

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async tableDescribe(req, res) {

    let query = 'describe ??';
    let params = [req.params.tableName];

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

}


//expose class
module.exports = Xapi;

