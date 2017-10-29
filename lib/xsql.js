'use strict';

const mysql = require('mysql');
const dataHelp = require('./util/data.helper.js');
const assert = require('assert')

//define class
class Xsql {

  constructor(sqlConfig, pool) {

    //define this variables
    this.sqlConfig = {}
    this.pool = {}
    this.metaDb = {};
    this.metaDb.tables = {};

    this.sqlConfig = sqlConfig;
    this.pool = pool;

  }

  init(cbk) {
    this.dbCacheInitAsync((err, results) => {
      cbk(err, results)
    })
  }


  dbCacheInitAsync(cbk) {

    let self = this;

    self.pool.query(dataHelp.getSchemaQuery(), [this.sqlConfig.database], (err, results) => {

      if (err) {
        console.log('Cache init failed during database reading')
        console.log(err, results)
        cbk(err, results)
      } else {

        self.iterateToCacheTables(results)
        self.iterateToCacheTablePks(results)
        self.iterateToCacheTableColumns(results)
        self.iterateToCacheTableFks(results)

        // osx mysql server has limitations related to open_tables
        self.pool.query('FLUSH TABLES', [], (err, results) => {
          cbk(null, null)
        })
      }
    })

  }


  iterateToCacheTables(schemaResults) {

    for (let i = 0; i < schemaResults.length; ++i) {

      let schemaRow = schemaResults[i];

      let tableName = schemaRow['table_name'];

      if (!(tableName in this.metaDb.tables)) {
        this.metaDb.tables[tableName] = {}
        this.metaDb.tables[tableName]['primaryKeys'] = []
        this.metaDb.tables[tableName]['foreignKeys'] = []
        this.metaDb.tables[tableName]['columns'] = []
        this.metaDb.tables[tableName]['indicies'] = []
      }
    }
  }

  iterateToCacheTableColumns(schemaResults) {

    for (let i = 0; i < schemaResults.length; ++i) {
      let schemaRow = schemaResults[i];
      let tableName = schemaRow['table_name'];
      let col = {};
      col['column_name'] = schemaRow['column_name']
      col['ordinal_position'] = schemaRow['ordinal_position']
      col['column_key'] = schemaRow['column_key']
      col['data_type'] = schemaRow['data_type']
      col['column_type'] = schemaRow['column_type']

      dataHelp.findOrInsertObjectArrayByKey(col, 'column_name', this.metaDb.tables[tableName]['columns'])

    }
  }

  iterateToCacheTablePks(schemaResults) {

    for (let i = 0; i < schemaResults.length; ++i) {
      let schemaRow = schemaResults[i];
      let tableName = schemaRow['table_name'];

      if (schemaRow['column_key'] === 'PRI') {

        let pk = {};
        pk['column_name'] = schemaRow['column_name']
        pk['ordinal_position'] = schemaRow['ordinal_position']
        pk['column_key'] = schemaRow['column_key']
        pk['data_type'] = schemaRow['data_type']
        pk['column_type'] = schemaRow['column_type']

        dataHelp.findOrInsertObjectArrayByKey(pk, 'column_name', this.metaDb.tables[tableName]['primaryKeys'])

      }
    }
  }

  iterateToCacheTableFks(schemaResults) {

    for (let i = 0; i < schemaResults.length; ++i) {

      let schemaRow = schemaResults[i];
      let tableName = schemaRow['table_name'];

      if (schemaRow['referenced_table_name']) {

        let fk = {};

        fk['column_name'] = schemaRow['column_name']
        fk['table_name'] = schemaRow['table_name']
        fk['referenced_table_name'] = schemaRow['referenced_table_name']
        fk['referenced_column_name'] = schemaRow['referenced_column_name']
        fk['data_type'] = schemaRow['data_type']
        fk['column_type'] = schemaRow['column_type']

        dataHelp.findOrInsertObjectArrayByKey(fk, 'column_name', this.metaDb.tables[tableName]['foreignKeys'])

        //console.log(fk['referenced_table_name'],fk['referenced_column_name'],tableName, schemaRow['column_name'], this.metaDb.tables[tableName]['foreignKeys'].length)
      }
    }
  }

  exec(query, params) {

    let _this = this;
    return new Promise(function (resolve, reject) {
      //console.log('mysql>', query, params);
      _this.pool.query(query, params, function (error, rows, _fields) {
        if (error) {
          console.log('mysql> ', error);
          return reject(error);
        }
        return resolve(rows);
      });
    });

  }

  getLimitClause(reqParams) {

    //defaults
    reqParams._index = 0;
    reqParams._len = 20;

    if ('_size' in reqParams && parseInt(reqParams._size) < 100) {
      reqParams._len = parseInt(reqParams._size)
    }

    if ('_p' in reqParams && parseInt(reqParams._p) > 0) {
      reqParams._index = (parseInt(reqParams._p)-1) * reqParams._len + 1;
    }

    //console.log(reqParams._index, reqParams._len);

    return [reqParams._index, reqParams._len]

  }

  getOrderByClause(queryparams, tableName) {

    //defaults
    let orderBy = '';

    if (queryparams._sort) {

      orderBy += ' ORDER BY '

      let orderByCols = queryparams._sort.split(',')

      for (let i = 0; i < orderByCols.length; ++i) {
        if (i) {
          orderBy = orderBy + ', '
        }
        if (orderByCols[i][0] === '-') {
          let len = orderByCols[i].length;
          orderBy = orderBy + orderByCols[i].substring(1, len) + ' DESC'
        } else {
          orderBy = orderBy + orderByCols[i] + ' ASC'
        }

      }

    }

    return orderBy
  }

  getColumnsForSelectStmt(tableName, reqQueryParams) {

    let table = this.metaDb.tables[tableName];
    let cols = [];
    let _fieldsInQuery = [];
    let removeFieldsObj = {};

    // populate _fields array from query params
    if ('_fields' in reqQueryParams) {
      _fieldsInQuery = reqQueryParams['_fields'].split(',')
    } else {
      return " * ";
    }


    // get column name in _fields and mark column name which start with '-'
    for (let i = 0; i < _fieldsInQuery.length; ++i) {
      if (_fieldsInQuery[i][0] == '-') {
        removeFieldsObj[_fieldsInQuery[i].substring(1, _fieldsInQuery[i].length)] = 1;
      } else {
        cols.push(_fieldsInQuery[i])
      }
    }

    if (!cols.length) {
      // for each column in table - add only which are not in removeFieldsObj
      for (let i = 0; i < table['columns'].length; ++i) {
        if (!(table['columns'][i]['column_name'] in removeFieldsObj)) {
          cols.push(table['columns'][i]['column_name'])
        }
      }
    } else {

      cols = this.removeUnknownColumns(cols, tableName)

    }

    return cols.join(',')

  }


  removeUnknownColumns(inputColumns, tableName) {

    let cols = inputColumns;
    let unknown_cols_in_input = []
    let shadowCols = [];
    let tableColumns = this.metaDb.tables[tableName]['columns']

    // find unknown fields if any
    for (var j = 0; j < cols.length; ++j) {

      let found = 0;

      for (var i = 0; i < tableColumns.length; ++i) {
        if (tableColumns[i]['column_name'] === cols[j]) {
          found = 1;
          break;
        }
      }

      if (!found) {
        unknown_cols_in_input.push(j)
      }

    }

    // if there are unknown fields - remove and ignore 'em
    if (unknown_cols_in_input.length) {

      for (var i = 0; i < cols.length; ++i) {
        if (unknown_cols_in_input.indexOf(i) === -1) {
          shadowCols.push(cols[i])
        }
      }

      cols = [];
      cols = shadowCols;

    }

    return cols;

  }

  getPrimaryKeyWhereClause(tableName, pksValues) {

    let whereClause = '';
    let whereCol = '';
    let whereValue = '';
    let pks = []

    if (tableName in this.metaDb.tables) {
      pks = this.metaDb.tables[tableName].primaryKeys;
    } else {
      return null
    }

    // number of primary keys in table and one sent should be same
    if (pksValues.length !== pks.length) {
      return null
    }

    // get a where clause out of the above columnNames and their values
    for (let i = 0; i < pks.length; ++i) {

      let type = getColumnType(pks[i]);

      whereCol = pks[i]['column_name']

      if (type === 'string') {
        whereValue = mysql.escape(pksValues[i])
      } else if (type === 'int') {
        whereValue = parseInt(pksValues[i])
      } else if (type === 'float') {
        whereValue = parseFloat(pksValues[i])
      } else if (type === 'date') {
        whereValue = Date(pksValues[i])
      } else {
        console.error(pks[i])
        assert(false, 'Unhandled type of primary key')
      }

      if (i) {
        whereClause += ' and '
      }

      whereClause += whereCol + ' = ' + whereValue;

    }

    return whereClause;

  }

  getForeignKeyWhereClause(parentTable, parentId, childTable) {

    let whereValue = '';

    //get all foreign keys of child table
    let fks = this.metaDb.tables[childTable].foreignKeys;
    let fk = dataHelp.findObjectInArrayByKey('referenced_table_name', parentTable, fks);
    let whereCol = fk['column_name']
    let colType = getColumnType(fk);

    if (colType === 'string') {
      whereValue = mysql.escape(parentId)
    } else if (colType === 'int') {
      whereValue = mysql.escape(parseInt(parentId))
    } else if (colType === 'float') {
      whereValue = mysql.escape(parseFloat(parentId))
    } else if (colType === 'date') {
      whereValue = mysql.escape(Date(parentId))
    } else {
      console.error(pks[i])
      assert(false, 'Unhandled column type in foreign key handling')
    }

    return whereCol + ' = ' + whereValue;

  }

  prepareRoute(httpType, apiPrefix, urlRoute) {

    let route = {};
    route['httpType'] = httpType;
    route['routeUrl'] = apiPrefix + urlRoute;
    return route;

  }


  getSchemaRoutes(apiPrefix) {

    let schemaRoutes = [];

    for (var tableName in this.metaDb.tables) {

      let routes = []
      let tableObj = {}

      let table = this.metaDb.tables[tableName];

      tableObj['resource'] = tableName;

      routes.push(this.prepareRoute('get', apiPrefix, tableName))
      routes.push(this.prepareRoute('post', apiPrefix, tableName))
      routes.push(this.prepareRoute('get', apiPrefix, tableName + '/:id'))
      routes.push(this.prepareRoute('put', apiPrefix, tableName + '/:id'))
      routes.push(this.prepareRoute('delete', apiPrefix, tableName + '/:id'))
      routes.push(this.prepareRoute('get', apiPrefix, tableName + '/count'))
      routes.push(this.prepareRoute('get', apiPrefix, tableName + '/:id/exists'))

      for (var j = 0; j < table['foreignKeys'].length; ++j) {
        let fk = table['foreignKeys'][j]
        routes.push(this.prepareRoute('get', apiPrefix, fk['referenced_table_name'] + '/:id/' + fk['table_name']))
      }

      tableObj['routes'] = routes;

      schemaRoutes.push(tableObj);

    }

    return schemaRoutes;

  }

  globalRoutesPrint(apiPrefix) {

    let r = []

    r.push(apiPrefix + "tables")
    r.push(apiPrefix + ":tableName/describe")

    if (this.sqlConfig.dynamic)
      r.push(apiPrefix + "dynamic")

    return r;

  }

}


//expose class
module.exports = Xsql;


function getDataType(colType, typesArr) {
  // console.log(colType,typesArr);
  for (let i = 0; i < typesArr.length; ++i) {
    if (colType.indexOf(typesArr[i]) !== -1) {
      return 1;
    }
  }
  return 0;
}

function getColumnType(column) {

  let strTypes = ['varchar', 'text', 'char', 'tinytext', 'mediumtext', 'longtext', 'blob', 'mediumblob', 'longblob', 'tinyblob', 'binary', 'varbinary'];
  let intTypes = ['int', 'long', 'smallint', 'mediumint', 'bigint', 'tinyint'];
  let flatTypes = ['float', 'double', 'decimal'];
  let dateTypes = ['date', 'datetime', 'timestamp', 'time', 'year'];

  //console.log(column);
  if (getDataType(column['data_type'], strTypes)) {
    return "string"
  } else if (getDataType(column['data_type'], intTypes)) {
    return "int"
  } else if (getDataType(column['data_type'], flatTypes)) {
    return "float"
  } else if (getDataType(column['data_type'], dateTypes)) {
    return "date"
  } else {
    return "string"
  }

}

