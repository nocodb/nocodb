'use strict';

const mysql = require('mysql');
const dataHelp = require('./util/data.helper.js');
const whereHelp = require('./util/whereClause.helper.js');
const assert = require('assert')


//define class§
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
      reqParams._index = (parseInt(reqParams._p) - 1) * reqParams._len + 1;
    }

    //console.log(reqParams._index, reqParams._len);

    return [reqParams._index, reqParams._len]

  }

  getBulkInsertStatement(tableName, objectArray, queryParamsObj) {

    if (tableName in this.metaDb.tables && objectArray) {

      let insObj = objectArray[0];

      // goal => insert into ?? (?,?..?) values ? [tablName, col1,col2...coln,[[ObjValues_1],[ObjValues_2],...[ObjValues_N]]
      queryParamsObj.query = ' INSERT INTO ?? ( '
      queryParamsObj.params.push(tableName)

      let cols = [];
      let colPresent = false;

      /**************** START : prepare column names to be inserted ****************/
      // iterate over all column in table and have only ones existing in objects to be inserted
      for (var i = 0; i < this.metaDb.tables[tableName]['columns'].length; ++i) {

        let colName = this.metaDb.tables[tableName]['columns'][i]['column_name']


        if (colName in insObj) {

          if (colPresent) {
            queryParamsObj.query += ','
          }

          queryParamsObj.query += colName

          colPresent = true;

        }

        cols.push(colName)

        //console.log('> > ', queryParamsObj.query);

      }

      queryParamsObj.query += ' ) values ?'
      /**************** END : prepare column names to be inserted ****************/


      /**************** START : prepare value object in prepared statement ****************/
        // iterate over sent object array
      let arrOfArr = []
      for (var i = 0; i < objectArray.length; ++i) {
        let arrValues = []
        for (var j = 0; j < cols.length; ++j) {
          if (cols[j] in objectArray[i])
            arrValues.push(objectArray[i][cols[j]])
        }
        arrOfArr.push(arrValues);
      }
      queryParamsObj.params.push(arrOfArr)
      /**************** END : prepare value object in prepared statement ****************/
    }
  }


  getGroupByClause(_groupby, tableName, queryParamsObj) {

    if (_groupby) {
      queryParamsObj.query += ' group by ' + _groupby + ' '
      return _groupby
    }

  }

  getHavingClause(_having, tableName, queryParamsObj) {

    if (_having) {

      let whereClauseObj = whereHelp.getConditionClause(_having, 'having')

      if (whereClauseObj.err === 0) {
        queryParamsObj.query = queryParamsObj.query + ' having ' + whereClauseObj.query;
        queryParamsObj.params = queryParamsObj.params.concat(whereClauseObj.params)
      }

      //console.log('> > > after where clause filling up:', queryParamsObj.query, queryParamsObj.params);
    }

  }

  getWhereClause(queryparams, tableName, queryParamsObj, appendToWhere) {

    if (queryparams) {

      let whereClauseObj = whereHelp.getConditionClause(queryparams)

      if (whereClauseObj.err === 0) {
        queryParamsObj.query = queryParamsObj.query + appendToWhere + whereClauseObj.query;
        queryParamsObj.params = queryParamsObj.params.concat(whereClauseObj.params)
      }

      //console.log('> > > after where clause filling up:', queryParamsObj.query, queryParamsObj.params);
    }

  }


  getOrderByClause(queryparams, tableName, queryParamsObj) {

    if (queryparams._sort) {

      queryParamsObj.query += ' ORDER BY '

      let orderByCols = queryparams._sort.split(',')

      for (let i = 0; i < orderByCols.length; ++i) {
        if (i) {
          queryParamsObj.query += ', '
        }
        if (orderByCols[i][0] === '-') {
          let len = orderByCols[i].length;
          queryParamsObj.query += ' ?? DESC'
          queryParamsObj.params.push(orderByCols[i].substring(1, len))
        } else {
          queryParamsObj.query += ' ?? ASC'
          queryParamsObj.params.push(orderByCols[i])
        }
      }
    }

  }

  getColumnsForSelectStmtWithGrpBy(reqQueryParams, tableName, queryParamsObj) {

    let grpByCols = reqQueryParams._groupby.split(',');

    for (var i = 0; i < grpByCols.length; ++i) {
      if (i) {
        queryParamsObj.query += ','
      }
      queryParamsObj.query += ' ??'
      queryParamsObj.params.push(grpByCols[i])
    }

    queryParamsObj.query += ',count(1) as _count '

  }

  getColumnsForSelectStmt(tableName, reqQueryParams, queryParamsObj) {

    let table = this.metaDb.tables[tableName];
    let cols = [];
    let _fieldsInQuery = [];
    let removeFieldsObj = {};

    // populate _fields array from query params
    if ('_fields' in reqQueryParams) {
      _fieldsInQuery = reqQueryParams['_fields'].split(',')
    } else {
      queryParamsObj.query += ' * '
      return " * ";
    }


    // get column name in _fields and mark column name which start with '-'
    for (let i = 0; i < _fieldsInQuery.length; ++i) {
      if (_fieldsInQuery[i][0] === '-') {
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

    for (var i = 0; i < cols.length; ++i) {
      if (i) {
        queryParamsObj.query += ','
      }
      queryParamsObj.query += '??'
      queryParamsObj.params.push(cols[i])
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

  getPrimaryKeyName(tableName) {
    let pk = null
    if (tableName in this.metaDb.tables) {
      pk = this.metaDb.tables[tableName].primaryKeys[0]['column_name']
    }
    return pk
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

  prepareRoute(internal, httpType, apiPrefix, urlRoute, routeType) {

    let route = {};
    route['httpType'] = httpType;
    route['routeUrl'] = apiPrefix + urlRoute;
    if (internal) {
      route['routeType'] = routeType;
    }
    return route;

  }


  getSchemaRoutes(internal, apiPrefix) {

    let schemaRoutes = [];

    for (var tableName in this.metaDb.tables) {

      if (tableName in this.sqlConfig.ignoreTables) {
        //console.log('ignore table', tableName);
      } else {

        let routes = []
        let tableObj = {}
        let table = this.metaDb.tables[tableName];

        tableObj['resource'] = tableName;

        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/describe', 'describe'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/count', 'count'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/groupby', 'groupby'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/ugroupby', 'ugroupby'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/chart', 'chart'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/aggregate', 'aggregate'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/findOne', 'findOne'))
        routes.push(this.prepareRoute(internal, 'post', apiPrefix, tableName, 'create'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName, 'list'))
        routes.push(this.prepareRoute(internal, 'post', apiPrefix, tableName + '/bulk', 'bulkInsert'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/bulk', 'bulkRead'))
        routes.push(this.prepareRoute(internal, 'delete', apiPrefix, tableName + '/bulk', 'bulkDelete'))
        routes.push(this.prepareRoute(internal, 'put', apiPrefix, tableName, 'update'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/:id', 'read'))
        routes.push(this.prepareRoute(internal, 'patch', apiPrefix, tableName + '/:id', 'patch'))
        routes.push(this.prepareRoute(internal, 'delete', apiPrefix, tableName + '/:id', 'delete'))
        routes.push(this.prepareRoute(internal, 'get', apiPrefix, tableName + '/:id/exists', 'exists'))

        for (var j = 0; j < table['foreignKeys'].length; ++j) {
          let fk = table['foreignKeys'][j]

          if(fk['referenced_table_name'] in this.sqlConfig.ignoreTables){
            //console.log('ignore table',fk['referenced_table_name']);
          } else {
            routes.push(this.prepareRoute(internal, 'get', apiPrefix, fk['referenced_table_name'] + '/:id/' + fk['table_name'], 'relational'))
          }

        }

        tableObj['routes'] = routes;

        schemaRoutes.push(tableObj);

      }
    }

    return schemaRoutes;

  }

  globalRoutesPrint(apiPrefix) {

    let r = []

    r.push(apiPrefix + "tables")

    if (this.sqlConfig.dynamic) {
      r.push(apiPrefix + "dynamic")
      r.push("/upload")
      r.push("/uploads")
      r.push("/download")
    }


    return r;

  }

  getChartQueryAndParamsFromStepArray(tableName, columnName, stepArray) {

    let obj = {}

    obj.query = ''
    obj.params = []

    if (stepArray.length && stepArray.length >= 2) {

      let params = [tableName, columnName, stepArray[0], stepArray[1]]

      for (let i = 0; i < stepArray.length - 1; i = i + 1) {

        obj.query = obj.query + dataHelp.getChartQuery();
        if (i + 2 < stepArray.length) {
          obj.query = obj.query + ' union '
        }

        if (i) {
          stepArray[i] = stepArray[i] + 1
        }

        obj.params.push((stepArray[i]) + ' to ' + stepArray[i + 1])
        obj.params.push(columnName)
        obj.params.push(tableName)
        obj.params.push(columnName)
        obj.params.push(stepArray[i])
        obj.params.push(stepArray[i + 1])

      }

    }

    //console.log('step spread query', obj);

    return obj;

  }


  getChartQueryAndParamsFromMinMaxStddev(tableName, columnName, min, max, stddev) {

    let stepArray = dataHelp.getRange(min, max, stddev)

    //console.log('steparray', stepArray);

    let obj = this.getChartQueryAndParamsFromStepArray(tableName, columnName, stepArray)

    //console.log('steparray', obj);

    return obj

  }

  getChartQueryAndParamsFromMinMaxStep(tableName, columnName, min, max, step) {

    let stepArray = dataHelp.getRangeSimple(min, max, step)

    //console.log('steparray', stepArray);

    let obj = this.getChartQueryAndParamsFromStepArray(tableName, columnName, stepArray)

    //console.log('steparray', obj);

    return obj

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

