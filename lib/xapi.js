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

      this.app.use(this.urlMiddleware)
      this.setupRoutes()
      this.app.use(this.errorMiddleware)
      cbk(err, results)

    })

  }


  urlMiddleware(req, res, next) {

    // get only request url from originalUrl
    let justUrl = req.originalUrl.split('?')[0]
    let pathSplit = justUrl.split('/')

    if (pathSplit.length >= 2 && pathSplit[1] === 'api') {
      if (pathSplit.length >= 5) {
        // handle for relational routes
        req.app.locals._parentTable = pathSplit[2]
        req.app.locals._childTable = pathSplit[4]
      } else {
        // handles rest of routes
        req.app.locals._tableName = pathSplit[2]
      }
    }

    next();
  }

  errorMiddleware(err, req, res, next) {

    if (err && err.code)
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

    let routes = [];
    routes = this.mysql.getSchemaRoutes(false, req.protocol + '://' + req.get('host') + '/api/');
    routes = routes.concat(this.mysql.globalRoutesPrint(req.protocol + '://' + req.get('host') + '/api/'))
    res.json(routes)

  }

  setupRoutes() {

    // show routes for database schema
    this.app.get('/', this.asyncMiddleware(this.root.bind(this)))

    // show all resouces
    this.app.route('/api/tables')
      .get(this.asyncMiddleware(this.tables.bind(this)));


    /**************** START : setup routes for each table ****************/

    let resources = [];
    resources = this.mysql.getSchemaRoutes(true, '/api/');

    // iterate over each resource
    for (var j = 0; j < resources.length; ++j) {

      let routes = resources[j]['routes'];

      // iterate over rach routes in resource and map function
      for (var i = 0; i < routes.length; ++i) {

        switch (routes[i]['routeType']) {

          case 'list':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.list.bind(this)));
            break;

          case 'create':
            this.app.route(routes[i]['routeUrl'])
              .post(this.asyncMiddleware(this.create.bind(this)));
            break;

          case 'read':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.read.bind(this)));
            break;

          case 'update':
            this.app.route(routes[i]['routeUrl'])
              .put(this.asyncMiddleware(this.update.bind(this)));
            break;

          case 'delete':
            this.app.route(routes[i]['routeUrl'])
              .delete(this.asyncMiddleware(this.delete.bind(this)));
            break;

          case 'exists':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.exists.bind(this)));
            break;

          case 'count':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.count.bind(this)));
            break;

          case 'describe':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.tableDescribe.bind(this)));
            break;

          case 'relational':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.nestedList.bind(this)));
            break;

          case 'groupby':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.groupBy.bind(this)));
            break;

        }
      }
    }
    /**************** END : setup routes for each table ****************/


    if (this.sqlConfig.dynamic === 1) {
      this.app.route('/dynamic*')
        .post(this.asyncMiddleware(this.runQuery.bind(this)));
    }

  }

  async create(req, res) {

    let query = 'INSERT INTO ?? SET ?';
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(req.body);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async list(req, res) {

    let cols = this.mysql.getColumnsForSelectStmt(req.app.locals._tableName, req.query);
    let query = 'select ' + cols + ' from ?? ';
    let params = [];
    params.push(req.app.locals._tableName);

    query = query + this.mysql.getOrderByClause(req.query, req.app.locals._tableName);

    query = query + ' limit ?,? '
    params = params.concat(this.mysql.getLimitClause(req.query));

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async nestedList(req, res) {

    let cols = this.mysql.getColumnsForSelectStmt(req.app.locals._childTable, req.query);
    let query = 'select ' + cols + ' from ?? where ';
    let params = [];

    params.push(req.app.locals._childTable);

    let whereClause = this.mysql.getForeignKeyWhereClause(req.app.locals._parentTable,
      req.params.id,
      req.app.locals._childTable);

    if (!whereClause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }

    query += whereClause;

    query = query + this.mysql.getOrderByClause(req.query, req.app.locals._parentTable);

    query = query + ' limit ?,? '
    params = params.concat(this.mysql.getLimitClause(req.query));

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async read(req, res) {

    let query = 'select * from ?? where ';
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
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

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
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
    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
      req.params.id.split('___'));

    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }

    query += clause;

    // params
    let params = [];
    params.push(req.app.locals._tableName);
    params = params.concat(Object.values(req.body));

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async delete(req, res) {

    let query = 'DELETE FROM ?? WHERE ';
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
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

    params.push(req.app.locals._tableName);

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
    let params = [req.app.locals._tableName];

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async groupBy(req, res) {

    let query = 'select ' + req.query._fields + ',count(*) as count from ?? group by ' + req.query._fields;
    let params = [];
    let tableName = req.app.locals._tableName;

    params.push(tableName);

    if (!req.query.sort) {
      req.query._sort = {}
      req.query._sort = '-count'
    }

    query = query + this.mysql.getOrderByClause(req.query, tableName);

    var results = await this.mysql.exec(query, params);

    res.status(200).json(results);

  }

}


//expose class
module.exports = Xapi;

