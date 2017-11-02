'use strict';

var Xsql = require('./xsql.js');
var multer = require('multer');
var path = require('path');

//define class
class Xapi {

  constructor(args, mysqlPool, app) {

    this.config = args;
    this.mysql = new Xsql(args, mysqlPool)
    this.app = app;

    /**************** START : multer ****************/
    this.storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, process.cwd())
      },
      filename: function (req, file, cb) {
        console.log(file);
        cb(null, Date.now() + '-' + file.originalname)
      }
    })

    this.upload = multer({storage: this.storage})
    /**************** END : multer ****************/


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
    else if (err && err.message)
      res.status(500).json({error: 'Internal server error : ' + err.message});
    else
      res.status(500).json({error: 'Internal server error : ' + err});

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

          case 'aggregate':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.aggregate.bind(this)));
            break;


        }
      }
    }
    /**************** END : setup routes for each table ****************/


    if (this.config.dynamic === 1) {

      this.app.route('/dynamic*')
        .post(this.asyncMiddleware(this.runQuery.bind(this)));

      /**************** START : multer routes ****************/
      this.app.post('/upload', this.upload.single('file'), this.uploadFile.bind(this));
      this.app.post('/uploads', this.upload.array('files', 10), this.uploadFiles.bind(this));
      this.app.get('/download', this.downloadFile.bind(this));
      /**************** END : multer routes ****************/

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

    let queryParamsObj = {}
    queryParamsObj.query = '';
    queryParamsObj.params = [];

    let cols = this.mysql.getColumnsForSelectStmt(req.app.locals._tableName, req.query);

    /**************** tableName ****************/
    queryParamsObj.query = 'select ' + cols + ' from ?? ';
    queryParamsObj.params.push(req.app.locals._tableName);

    /**************** where clause ****************/
    this.mysql.getWhereClause(req.query, req.app.locals._tableName, queryParamsObj,' where ');

    /**************** order clause ****************/
    queryParamsObj.query += this.mysql.getOrderByClause(req.query, req.app.locals._tableName);

    /**************** limit clause ****************/
    queryParamsObj.query += ' limit ?,? '
    queryParamsObj.params = queryParamsObj.params.concat(this.mysql.getLimitClause(req.query));

    //console.log(queryParamsObj.query, queryParamsObj.params);

    let results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
    res.status(200).json(results);

  }

  async nestedList(req, res) {

    let queryParamsObj = {}
    queryParamsObj.query = '';
    queryParamsObj.params = [];

    /**************** tableName ****************/
    let cols = this.mysql.getColumnsForSelectStmt(req.app.locals._childTable, req.query);
    queryParamsObj.query = 'select ' + cols + ' from ?? where ';
    queryParamsObj.params.push(req.app.locals._childTable);

    /**************** where foreign key ****************/
    let whereClause = this.mysql.getForeignKeyWhereClause(req.app.locals._parentTable,
      req.params.id,
      req.app.locals._childTable);

    if (!whereClause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }
    queryParamsObj.query += whereClause;

    /**************** where conditions in query ****************/
    this.mysql.getWhereClause(req.query, req.app.locals._tableName, queryParamsObj, ' and ');

    /**************** order clause ****************/
    queryParamsObj.query = queryParamsObj.query + this.mysql.getOrderByClause(req.query, req.app.locals._parentTable);

    /**************** limit clause ****************/
    queryParamsObj.query = queryParamsObj.query + ' limit ?,? '
    queryParamsObj.params = queryParamsObj.params.concat(this.mysql.getLimitClause(req.query));

    let results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
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

    if (req.query && req.query._fields) {
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
    } else {
      res.status(400).json({message: 'Missing _fields query params eg: /api/tableName/groupby?_fields=column1'})
    }


  }

  async aggregate(req, res) {


    if (req.query && req.query._fields) {
      let tableName = req.app.locals._tableName;
      let query = 'select '
      let params = []
      let fields = req.query._fields.split(',');

      for (var i = 0; i < fields.length; ++i) {
        if (i) {
          query = query + ','
        }
        query = query + ' min(??) as ?,max(??) as ?,avg(??) as ?,sum(??) as ?,stddev(??) as ?,variance(??) as ? '
        params.push(fields[i]);
        params.push('min_of_' + fields[i]);
        params.push(fields[i]);
        params.push('max_of_' + fields[i]);
        params.push(fields[i]);
        params.push('avg_of_' + fields[i]);
        params.push(fields[i]);
        params.push('sum_of_' + fields[i]);
        params.push(fields[i]);
        params.push('stddev_of_' + fields[i]);
        params.push(fields[i]);
        params.push('variance_of_' + fields[i]);
      }

      query = query + ' from ??'
      params.push(tableName)

      var results = await this.mysql.exec(query, params);

      res.status(200).json(results);
    } else {
      res.status(400).json({message: 'Missing _fields in query params eg: /api/tableName/groupby?_fields=numericColumn1'});
    }

  }


  /**************** START : files related ****************/
  downloadFile(req, res) {
    let file = path.join(process.cwd(), req.query.name);
    res.download(file);
  }

  uploadFile(req, res) {

    if (req.file) {
      console.log(req.file.path);
      res.end(req.file.path);
    } else {
      res.end('upload failed');
    }
  }

  uploadFiles(req, res) {

    if (!req.files || req.files.length === 0) {
      res.end('upload failed')
    } else {
      let files = [];
      for (let i = 0; i < req.files.length; ++i) {
        files.push(req.files[i].path);
      }

      res.end(files.toString());
    }

  }

  /**************** END : files related ****************/

}


//expose class
module.exports = Xapi;

