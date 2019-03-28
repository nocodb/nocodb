"use strict";

const mysql = require("mysql");
const dataHelp = require("./util/data.helper.js");
const whereHelp = require("./util/whereClause.helper.js");
const assert = require("assert");

//define class§
class Xsql {
  constructor(sqlConfig, pool) {
    //define this variables
    this.sqlConfig = {};
    this.pool = {};
    this.metaDb = {};
    this.metaDb.tables = {};

    this.sqlConfig = sqlConfig;
    this.pool = pool;
  }

  /**************** START : Cache functions ****************/
  init(cbk) {
    this.dbCacheInitAsync((err, results) => {
      cbk(err, results);
    });
  }

  dbCacheInitAsync(cbk) {
    let self = this;

    self.pool.query(
      dataHelp.getSchemaQuery(),
      [this.sqlConfig.database],
      (err, results) => {
        if (err) {
          console.log("Cache init failed during database reading");
          console.log(err, results);
          cbk(err, results);
        } else {
          for (var i = 0; i < results.length; ++i) {
            let keys = Object.keys(results[i]);

            for (var j = 0; j < keys.length; ++j) {
              let value = results[i][keys[j]];

              results[i][keys[j].toLowerCase()] = value;

              //console.log(value);
            }
          }

          self.iterateToCacheTables(results);
          self.iterateToCacheTablePks(results);
          self.iterateToCacheTableColumns(results);
          self.iterateToCacheTableFks(results);

          // osx mysql server has limitations related to open_tables
          self.pool.query("FLUSH TABLES", [], (err, results) => {
            cbk(null, null);
          });
        }
      }
    );
  }

  iterateToCacheTables(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      let schemaRow = schemaResults[i];

      let tableName = schemaRow["table_name"];

      if (!(tableName in this.metaDb.tables)) {
        this.metaDb.tables[tableName] = {};
        this.metaDb.tables[tableName]["primaryKeys"] = [];
        this.metaDb.tables[tableName]["foreignKeys"] = [];
        this.metaDb.tables[tableName]["columns"] = [];
        this.metaDb.tables[tableName]["indicies"] = [];
        this.metaDb.tables[tableName]["isView"] = schemaRow["isView"];
      }
    }
  }

  iterateToCacheTableColumns(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      let schemaRow = schemaResults[i];
      let tableName = schemaRow["table_name"];
      let col = {};
      col["column_name"] = schemaRow["column_name"];
      col["ordinal_position"] = schemaRow["ordinal_position"];
      col["column_key"] = schemaRow["column_key"];
      col["data_type"] = schemaRow["data_type"];
      col["column_type"] = schemaRow["column_type"];

      dataHelp.findOrInsertObjectArrayByKey(
        col,
        "column_name",
        this.metaDb.tables[tableName]["columns"]
      );
    }
  }

  iterateToCacheTablePks(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      let schemaRow = schemaResults[i];
      let tableName = schemaRow["table_name"];

      if (schemaRow["column_key"] === "PRI") {
        let pk = {};
        pk["column_name"] = schemaRow["column_name"];
        pk["ordinal_position"] = schemaRow["ordinal_position"];
        pk["column_key"] = schemaRow["column_key"];
        pk["data_type"] = schemaRow["data_type"];
        pk["column_type"] = schemaRow["column_type"];

        dataHelp.findOrInsertObjectArrayByKey(
          pk,
          "column_name",
          this.metaDb.tables[tableName]["primaryKeys"]
        );
      }
    }
  }

  iterateToCacheTableFks(schemaResults) {
    for (let i = 0; i < schemaResults.length; ++i) {
      let schemaRow = schemaResults[i];
      let tableName = schemaRow["table_name"];

      if (schemaRow["referenced_table_name"]) {
        let fk = {};

        fk["column_name"] = schemaRow["column_name"];
        fk["table_name"] = schemaRow["table_name"];
        fk["referenced_table_name"] = schemaRow["referenced_table_name"];
        fk["referenced_column_name"] = schemaRow["referenced_column_name"];
        fk["data_type"] = schemaRow["data_type"];
        fk["column_type"] = schemaRow["column_type"];

        dataHelp.findOrInsertObjectArrayByKey(
          fk,
          "column_name",
          this.metaDb.tables[tableName]["foreignKeys"]
        );

        //console.log(fk['referenced_table_name'],fk['referenced_column_name'],tableName, schemaRow['column_name'], this.metaDb.tables[tableName]['foreignKeys'].length)
      }
    }
  }

  /**************** END : Cache functions ****************/

  exec(query, params) {
    let _this = this;
    return new Promise(function(resolve, reject) {
      //console.log('mysql>', query, params);
      _this.pool.query(query, params, function(error, rows, _fields) {
        if (error) {
          console.log("mysql> ", error);
          return reject(error);
        }
        return resolve(rows);
      });
    });
  }

  typeOfColumn(Type) {
    //TODO: Im sure there are more types to handle here
    const strTypes = [
      "varchar",
      "text",
      "char",
      "tinytext",
      "mediumtext",
      "longtext",
      "blob",
      "mediumblob",
      "longblob"
    ];
    const intTypes = [
      "int",
      "long",
      "smallint",
      "mediumint",
      "bigint",
      "tinyint"
    ];
    const flatTypes = ["float", "double", "decimal"];
    const dateTypes = ["date", "datetime", "timestamp", "time", "year"];

    if (dataHelp.getType(Type, strTypes)) {
      return "string";
    } else if (dataHelp.getType(Type, intTypes)) {
      return "int";
    } else if (dataHelp.getType(Type, flatTypes)) {
      return "float";
    } else if (dataHelp.getType(Type, dateTypes)) {
      return "date";
    } else {
      return "unknown";
    }
  }

  isTypeOfColumnNumber(Type) {
    //console.log(Type, this.typeOfColumn(Type));
    return (
      "int" === this.typeOfColumn(Type) || "float" === this.typeOfColumn(Type)
    );
  }

  getLimitClause(reqParams) {
    //defaults
    reqParams._index = 0;
    reqParams._len = 20;

    if ("_size" in reqParams) {
      if (parseInt(reqParams._size) > 0 && parseInt(reqParams._size) <= 100) {
        reqParams._len = parseInt(reqParams._size);
      } else if (parseInt(reqParams._size) > 100) {
        reqParams._len = 100;
      }
    }

    if ("_p" in reqParams && parseInt(reqParams._p) > 0) {
      reqParams._index = parseInt(reqParams._p) * reqParams._len;
    }

    //console.log(reqParams._index, reqParams._len);

    return [reqParams._index, reqParams._len];
  }

  prepareBulkInsert(tableName, objectArray, queryParamsObj) {
    if (tableName in this.metaDb.tables && objectArray) {
      let insObj = objectArray[0];

      // goal => insert into ?? (?,?..?) values ? [tablName, col1,col2...coln,[[ObjValues_1],[ObjValues_2],...[ObjValues_N]]
      queryParamsObj.query = " INSERT INTO ?? ( ";
      queryParamsObj.params.push(tableName);

      let cols = [];
      let colPresent = false;

      /**************** START : prepare column names to be inserted ****************/
      // iterate over all column in table and have only ones existing in objects to be inserted
      for (
        var i = 0;
        i < this.metaDb.tables[tableName]["columns"].length;
        ++i
      ) {
        let colName = this.metaDb.tables[tableName]["columns"][i][
          "column_name"
        ];

        if (colName in insObj) {
          if (colPresent) {
            queryParamsObj.query += ",";
          }

          queryParamsObj.query += colName;

          colPresent = true;
        }

        cols.push(colName);

        //console.log('> > ', queryParamsObj.query);
      }

      queryParamsObj.query += " ) values ?";
      /**************** END : prepare column names to be inserted ****************/

      /**************** START : prepare value object in prepared statement ****************/
      // iterate over sent object array
      let arrOfArr = [];
      for (var i = 0; i < objectArray.length; ++i) {
        let arrValues = [];
        for (var j = 0; j < cols.length; ++j) {
          if (cols[j] in objectArray[i])
            arrValues.push(objectArray[i][cols[j]]);
        }
        arrOfArr.push(arrValues);
      }
      queryParamsObj.params.push(arrOfArr);
      /**************** END : prepare value object in prepared statement ****************/
    }
  }

  getGroupByClause(_groupby, tableName, queryParamsObj) {
    if (_groupby) {
      queryParamsObj.query += " group by " + _groupby + " ";
      return _groupby;
    }
  }

  getHavingClause(_having, tableName, queryParamsObj) {
    if (_having) {
      let whereClauseObj = whereHelp.getConditionClause(_having, "having");

      if (whereClauseObj.err === 0) {
        queryParamsObj.query =
          queryParamsObj.query + " having " + whereClauseObj.query;
        queryParamsObj.params = queryParamsObj.params.concat(
          whereClauseObj.params
        );
      }

      //console.log('> > > after where clause filling up:', queryParamsObj.query, queryParamsObj.params);
    }
  }

  getWhereClause(queryparams, tableName, queryParamsObj, appendToWhere) {
    if (queryparams) {
      let whereClauseObj = whereHelp.getConditionClause(queryparams);

      if (whereClauseObj.err === 0) {
        queryParamsObj.query =
          queryParamsObj.query + appendToWhere + whereClauseObj.query;
        queryParamsObj.params = queryParamsObj.params.concat(
          whereClauseObj.params
        );
      }
    }
  }

  getOrderByClause(queryparams, tableName, queryParamsObj) {
    if (queryparams._sort) {
      queryParamsObj.query += " ORDER BY ";

      let orderByCols = queryparams._sort.split(",");

      for (let i = 0; i < orderByCols.length; ++i) {
        if (i) {
          queryParamsObj.query += ", ";
        }
        if (orderByCols[i][0] === "-") {
          let len = orderByCols[i].length;
          queryParamsObj.query += " ?? DESC";
          queryParamsObj.params.push(orderByCols[i].substring(1, len));
        } else {
          queryParamsObj.query += " ?? ASC";
          queryParamsObj.params.push(orderByCols[i]);
        }
      }
    }
  }

  getColumnsForSelectStmtWithGrpBy(reqQueryParams, tableName, queryParamsObj) {
    let grpByCols = reqQueryParams._groupby.split(",");

    for (var i = 0; i < grpByCols.length; ++i) {
      if (i) {
        queryParamsObj.query += ",";
      }
      queryParamsObj.query += " ??";
      queryParamsObj.params.push(grpByCols[i]);
    }

    queryParamsObj.query += ",count(1) as _count ";
  }

  getColumnsForSelectStmt(tableName, reqQueryParams, queryParamsObj) {
    let table = this.metaDb.tables[tableName];
    let cols = [];
    let _fieldsInQuery = [];
    let removeFieldsObj = {};

    // populate _fields array from query params
    if ("_fields" in reqQueryParams) {
      _fieldsInQuery = reqQueryParams["_fields"].split(",");
    } else {
      queryParamsObj.query += " * ";
      return " * ";
    }

    // get column name in _fields and mark column name which start with '-'
    for (let i = 0; i < _fieldsInQuery.length; ++i) {
      if (_fieldsInQuery[i][0] === "-") {
        removeFieldsObj[
          _fieldsInQuery[i].substring(1, _fieldsInQuery[i].length)
        ] = 1;
      } else {
        cols.push(_fieldsInQuery[i]);
      }
    }

    if (!cols.length) {
      // for each column in table - add only which are not in removeFieldsObj
      for (let i = 0; i < table["columns"].length; ++i) {
        if (!(table["columns"][i]["column_name"] in removeFieldsObj)) {
          cols.push(table["columns"][i]["column_name"]);
        }
      }
    } else {
      cols = this.removeUnknownColumns(cols, tableName);
    }

    for (var i = 0; i < cols.length; ++i) {
      if (i) {
        queryParamsObj.query += ",";
      }
      queryParamsObj.query += "??";
      queryParamsObj.params.push(cols[i]);
    }

    return cols.join(",");
  }

  removeUnknownColumns(inputColumns, tableName) {
    let cols = inputColumns;
    let unknown_cols_in_input = [];
    let shadowCols = [];
    let tableColumns = this.metaDb.tables[tableName]["columns"];

    // find unknown fields if any
    for (var j = 0; j < cols.length; ++j) {
      let found = 0;

      for (var i = 0; i < tableColumns.length; ++i) {
        if (tableColumns[i]["column_name"] === cols[j]) {
          found = 1;
          break;
        }
      }

      if (!found) {
        unknown_cols_in_input.push(j);
      }
    }

    // if there are unknown fields - remove and ignore 'em
    if (unknown_cols_in_input.length) {
      for (var i = 0; i < cols.length; ++i) {
        if (unknown_cols_in_input.indexOf(i) === -1) {
          shadowCols.push(cols[i]);
        }
      }

      cols = [];
      cols = shadowCols;
    }

    return cols;
  }

  getPrimaryKeyName(tableName) {
    let pk = null;
    if (tableName in this.metaDb.tables) {
      pk = this.metaDb.tables[tableName].primaryKeys[0]["column_name"];
    }
    return pk;
  }

  getPrimaryKeyWhereClause(tableName, pksValues) {
    let whereClause = "";
    let whereCol = "";
    let whereValue = "";
    let pks = [];

    if (tableName in this.metaDb.tables) {
      pks = this.metaDb.tables[tableName].primaryKeys;
    } else {
      return null;
    }

    // number of primary keys in table and one sent should be same
    if (pksValues.length !== pks.length) {
      return null;
    }

    // get a where clause out of the above columnNames and their values
    for (let i = 0; i < pks.length; ++i) {
      let type = dataHelp.getColumnType(pks[i]);

      whereCol = pks[i]["column_name"];

      if (type === "string") {
        whereValue = mysql.escape(pksValues[i]);
      } else if (type === "int") {
        whereValue = parseInt(pksValues[i]);
      } else if (type === "float") {
        whereValue = parseFloat(pksValues[i]);
      } else if (type === "date") {
        whereValue = Date(pksValues[i]);
      } else {
        console.error(pks[i]);
        assert(false, "Unhandled type of primary key");
      }

      if (i) {
        whereClause += " and ";
      }

      whereClause += whereCol + " = " + whereValue;
    }

    return whereClause;
  }

  getForeignKeyWhereClause(parentTable, parentId, childTable) {
    let whereValue = "";

    //get all foreign keys of child table
    let fks = this.metaDb.tables[childTable].foreignKeys;
    let fk = dataHelp.findObjectInArrayByKey(
      "referenced_table_name",
      parentTable,
      fks
    );
    let whereCol = fk["column_name"];
    let colType = dataHelp.getColumnType(fk);

    if (colType === "string") {
      whereValue = mysql.escape(parentId);
    } else if (colType === "int") {
      whereValue = mysql.escape(parseInt(parentId));
    } else if (colType === "float") {
      whereValue = mysql.escape(parseFloat(parentId));
    } else if (colType === "date") {
      whereValue = mysql.escape(Date(parentId));
    } else {
      console.error(pks[i]);
      assert(false, "Unhandled column type in foreign key handling");
    }

    return whereCol + " = " + whereValue;
  }

  prepareRoute(internal, httpType, apiPrefix, urlRoute, routeType) {
    let route = {};
    route["httpType"] = httpType;
    route["routeUrl"] = apiPrefix + urlRoute;
    if (internal) {
      route["routeType"] = routeType;
    }
    return route;
  }

  getSchemaRoutes(internal, apiPrefix) {
    let schemaRoutes = [];

    for (var tableName in this.metaDb.tables) {
      if (tableName in this.sqlConfig.ignoreTables) {
        //console.log('ignore table', tableName);
      } else {
        let routes = [];
        let tableObj = {};
        let table = this.metaDb.tables[tableName];
        let isView = this.metaDb.tables[tableName]["isView"];

        tableObj["resource"] = tableName;

        // order of routes is important for express routing - DO NOT CHANGE ORDER
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/describe",
            "describe"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/count",
            "count"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/groupby",
            "groupby"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/distinct",
            "distinct"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/ugroupby",
            "ugroupby"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/chart",
            "chart"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/aggregate",
            "aggregate"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/findOne",
            "findOne"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/autoChart",
            "autoChart"
          )
        );

        if (!isView && !this.sqlConfig.readOnly) {
          routes.push(
            this.prepareRoute(internal, "post", apiPrefix, tableName, "create")
          );
        }
        routes.push(
          this.prepareRoute(internal, "get", apiPrefix, tableName, "list")
        );

        if (!isView && !this.sqlConfig.readOnly) {
          routes.push(
            this.prepareRoute(
              internal,
              "post",
              apiPrefix,
              tableName + "/bulk",
              "bulkInsert"
            )
          );
          routes.push(
            this.prepareRoute(
              internal,
              "delete",
              apiPrefix,
              tableName + "/bulk",
              "bulkDelete"
            )
          );
        }
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/bulk",
            "bulkRead"
          )
        );

        if (!isView && !this.sqlConfig.readOnly) {
          routes.push(
            this.prepareRoute(internal, "put", apiPrefix, tableName, "update")
          );
          routes.push(
            this.prepareRoute(
              internal,
              "patch",
              apiPrefix,
              tableName + "/:id",
              "patch"
            )
          );
          routes.push(
            this.prepareRoute(
              internal,
              "delete",
              apiPrefix,
              tableName + "/:id",
              "delete"
            )
          );
        }

        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/:id",
            "read"
          )
        );
        routes.push(
          this.prepareRoute(
            internal,
            "get",
            apiPrefix,
            tableName + "/:id/exists",
            "exists"
          )
        );

        for (var j = 0; j < table["foreignKeys"].length; ++j) {
          let fk = table["foreignKeys"][j];

          if (fk["referenced_table_name"] in this.sqlConfig.ignoreTables) {
            //console.log('ignore table',fk['referenced_table_name']);
          } else {
            routes.push(
              this.prepareRoute(
                internal,
                "get",
                apiPrefix,
                fk["referenced_table_name"] + "/:id/" + fk["table_name"],
                "relational"
              )
            );
          }
        }

        tableObj["routes"] = routes;

        schemaRoutes.push(tableObj);
      }
    }

    return schemaRoutes;
  }

  getJoinType(joinInQueryParams) {
    //console.log('joinInQueryParams',joinInQueryParams);

    switch (joinInQueryParams) {
      case "_lj":
        return " left join ";
        break;

      case "_rj":
        return " right join ";
        break;

      // case '_fj':
      //   return ' full join '
      //   break;

      case "_ij":
        return " inner join ";
        break;

      case "_j":
        return " join ";
        break;
    }

    return " join ";
  }

  globalRoutesPrint(apiPrefix) {
    let r = [];

    r.push(apiPrefix + "tables");
    r.push(apiPrefix + "xjoin");

    if (this.sqlConfig.dynamic) {
      r.push(apiPrefix + "dynamic");
      r.push("/upload");
      r.push("/uploads");
      r.push("/download");
    }

    return r;
  }

  getChartQueryAndParamsFromStepPair(
    tableName,
    columnName,
    stepArray,
    isRange = false
  ) {
    let obj = {};

    obj.query = "";
    obj.params = [];

    //console.log('getChartQueryAndParamsFromStepArray',isRange);

    //select ? as ??, count(*) as _count from ?? where ?? between ? and ?

    if (
      stepArray.length &&
      stepArray.length >= 2 &&
      stepArray.length % 2 === 0
    ) {
      for (
        let i = 0;
        i < stepArray.length && stepArray.length >= 2;
        i = i + 2
      ) {
        obj.query = obj.query + dataHelp.getChartQuery();

        if (i + 2 < stepArray.length) {
          obj.query = obj.query + " union ";
        }

        obj.params.push(stepArray[i] + " to " + stepArray[i + 1]);
        obj.params.push(columnName);
        obj.params.push(tableName);
        obj.params.push(columnName);
        obj.params.push(stepArray[i]);
        obj.params.push(stepArray[i + 1]);
      }
    }

    //console.log('step spread query', obj);

    return obj;
  }

  getChartQueryAndParamsFromStepArray(
    tableName,
    columnName,
    stepArray,
    isRange = false
  ) {
    let obj = {};

    obj.query = "";
    obj.params = [];

    //console.log('getChartQueryAndParamsFromStepArray',isRange);

    if (stepArray.length && stepArray.length >= 2) {
      for (let i = 0; i < stepArray.length - 1; i = i + 1) {
        obj.query = obj.query + dataHelp.getChartQuery();
        if (i + 2 < stepArray.length) {
          obj.query = obj.query + " union ";
        }

        if (i && isRange === false) {
          stepArray[i] = stepArray[i] + 1;
        }

        if (isRange === false) {
          obj.params.push(stepArray[i] + " to " + stepArray[i + 1]);
        } else {
          obj.params.push(stepArray[0] + " to " + stepArray[i + 1]);
        }

        obj.params.push(columnName);
        obj.params.push(tableName);
        obj.params.push(columnName);

        if (isRange === false) {
          obj.params.push(stepArray[i]);
          obj.params.push(stepArray[i + 1]);
        } else {
          obj.params.push(stepArray[0]);
          obj.params.push(stepArray[i + 1]);
        }
      }
    }

    //console.log('step spread query', obj);

    return obj;
  }

  getChartQueryAndParamsFromMinMaxStddev(
    tableName,
    columnName,
    min,
    max,
    stddev,
    isRange = false
  ) {
    let stepArray = dataHelp.getStepArray(min, max, stddev);

    //console.log('steparray', stepArray);

    let obj = this.getChartQueryAndParamsFromStepArray(
      tableName,
      columnName,
      stepArray,
      isRange
    );

    //console.log('steparray', obj);

    return obj;
  }

  getChartQueryAndParamsFromMinMaxStep(
    tableName,
    columnName,
    min,
    max,
    step,
    isRange = false
  ) {
    let stepArray = dataHelp.getStepArraySimple(min, max, step);

    //console.log('steparray', stepArray);

    let obj = this.getChartQueryAndParamsFromStepArray(
      tableName,
      columnName,
      stepArray,
      isRange
    );

    //console.log('steparray', obj);

    return obj;
  }

  _getGrpByHavingOrderBy(req, tableName, queryParamsObj, listType) {
    /**************** add group by ****************/
    this.getGroupByClause(
      req.query._groupby,
      req.app.locals._tableName,
      queryParamsObj
    );

    /**************** add having ****************/
    this.getHavingClause(
      req.query._having,
      req.app.locals._tableName,
      queryParamsObj
    );

    /**************** add order clause ****************/
    this.getOrderByClause(req.query, req.app.locals._tableName, queryParamsObj);

    /**************** add limit clause ****************/
    if (listType === 2) {
      //nested
      queryParamsObj.query += " limit 1 ";
    } else {
      queryParamsObj.query += " limit ?,? ";
      queryParamsObj.params = queryParamsObj.params.concat(
        this.getLimitClause(req.query)
      );
    }
  }

  /**
   *
   * @param req
   * @param res
   * @param queryParamsObj : {query, params}
   * @param listType : 0:list, 1:nested, 2:findOne, 3:bulkRead, 4:distinct, 5:xjoin
   *
   * Updates query, params for query of type listType
   */
  prepareListQuery(req, res, queryParamsObj, listType = 0) {
    queryParamsObj.query = "select ";
    queryParamsObj.params = [];

    if (listType === 4) {
      //list type distinct
      queryParamsObj.query += " distinct ";
    }

    /**************** select columns ****************/
    if (req.query._groupby) {
      this.getColumnsForSelectStmtWithGrpBy(
        req.query,
        req.app.locals._tableName,
        queryParamsObj
      );
    } else {
      this.getColumnsForSelectStmt(
        req.app.locals._tableName,
        req.query,
        queryParamsObj
      );
    }

    /**************** add tableName ****************/
    queryParamsObj.query += " from ?? ";

    if (listType === 1) {
      //nested list

      req.app.locals._tableName = req.app.locals._childTable;

      queryParamsObj.params.push(req.app.locals._childTable);

      queryParamsObj.query += " where ";

      /**************** add where foreign key ****************/
      let whereClause = this.getForeignKeyWhereClause(
        req.app.locals._parentTable,
        req.params.id,
        req.app.locals._childTable
      );

      if (!whereClause) {
        return res.status(400).send({
          error:
            "Table is made of composite primary keys - all keys were not in input"
        });
      }
      queryParamsObj.query += whereClause;

      this.getWhereClause(
        req.query._where,
        req.app.locals._tableName,
        queryParamsObj,
        " and "
      );
    } else if (listType === 3) {
      //bulkRead

      // select * from table where pk in (ids) and whereConditions
      queryParamsObj.params.push(req.app.locals._tableName);
      queryParamsObj.query += " where ?? in ";
      queryParamsObj.params.push(
        this.getPrimaryKeyName(req.app.locals._tableName)
      );

      queryParamsObj.query += "(";

      if (req.query && req.query._ids) {
        let ids = req.query._ids.split(",");
        for (var i = 0; i < ids.length; ++i) {
          if (i) {
            queryParamsObj.query += ",";
          }
          queryParamsObj.query += "?";
          queryParamsObj.params.push(ids[i]);
        }
      }
      queryParamsObj.query += ") ";
      this.getWhereClause(
        req.query._where,
        req.app.locals._tableName,
        queryParamsObj,
        " and "
      );
    } else {
      queryParamsObj.params.push(req.app.locals._tableName);

      /**************** add where clause ****************/
      this.getWhereClause(
        req.query._where,
        req.app.locals._tableName,
        queryParamsObj,
        " where "
      );
    }

    this._getGrpByHavingOrderBy(req, req.app.locals._tableName, queryParamsObj);

    //console.log(queryParamsObj.query, queryParamsObj.params);
  }

  _joinTableNames(isSecondJoin, joinTables, index, queryParamsObj) {
    if (isSecondJoin) {
      /**
       * in second join - there will be ONE table and an ON condition
       *   if clause deals with this
       *
       */

      // add : join / left join / right join / full join / inner join
      queryParamsObj.query += this.getJoinType(joinTables[index]);
      queryParamsObj.query += " ?? as ?? ";

      // eg: tbl.tableName
      let tableNameAndAs = joinTables[index + 1].split(".");

      if (
        tableNameAndAs.length === 2 &&
        !(tableNameAndAs[1] in this.sqlConfig.ignoreTables)
      ) {
        queryParamsObj.params.push(tableNameAndAs[1]);
        queryParamsObj.params.push(tableNameAndAs[0]);
      } else {
        queryParamsObj.grammarErr = 1;
        console.log("there was no dot for tableName ", joinTables[index + 1]);
      }
    } else {
      /**
       * in first join - there will be TWO tables and an ON condition
       *    else clause deals with this
       */

      // first table
      queryParamsObj.query += " ?? as ?? ";
      // add : join / left join / right join / full join / inner join
      queryParamsObj.query += this.getJoinType(joinTables[index + 1]);
      // second table
      queryParamsObj.query += " ?? as ?? ";

      let tableNameAndAs = joinTables[index].split(".");
      if (
        tableNameAndAs.length === 2 &&
        !(tableNameAndAs[1] in this.sqlConfig.ignoreTables)
      ) {
        queryParamsObj.params.push(tableNameAndAs[1]);
        queryParamsObj.params.push(tableNameAndAs[0]);
      } else {
        queryParamsObj.grammarErr = 1;
        console.log("there was no dot for tableName ", joinTables[index]);
      }

      tableNameAndAs = [];
      tableNameAndAs = joinTables[index + 2].split(".");
      if (
        tableNameAndAs.length === 2 &&
        !(tableNameAndAs[1] in this.sqlConfig.ignoreTables)
      ) {
        queryParamsObj.params.push(tableNameAndAs[1]);
        queryParamsObj.params.push(tableNameAndAs[0]);
      } else {
        queryParamsObj.grammarErr = 1;
        console.log("there was no dot for tableName ", joinTables[index]);
      }
    }
  }

  prepareJoinQuery(req, res, queryParamsObj) {
    queryParamsObj.query = "SELECT ";
    queryParamsObj.grammarErr = 0;

    while (1) {
      /**************** START : get fields ****************/
      if (req.query._fields) {
        let fields = req.query._fields.split(",");

        // from _fields to - ??, ??, ?? [col1,col2,col3]
        for (var i = 0; i < fields.length && !queryParamsObj.grammarErr; ++i) {
          if (i) {
            queryParamsObj.query += ",";
          }
          queryParamsObj.query += " ?? ";
          queryParamsObj.params.push(fields[i]);
          let aliases = fields[i].split(".");
          if (aliases.length === 2) {
            queryParamsObj.query += "as " + aliases[0] + "_" + aliases[1];
            //console.log(queryParamsObj.query);
          } else {
            queryParamsObj.grammarErr = 1;
          }
        }
      } else {
        queryParamsObj.grammarErr = 1;
      }

      queryParamsObj.query += " from ";

      if (queryParamsObj.grammarErr) {
        break;
      }

      /**************** END : get fields ****************/

      /**************** START : get join + on ****************/
      let joinTables = req.query._join.split(",");
      if (joinTables.length < 3) {
        //console.log('grammar error ', joinTables.length);
        queryParamsObj.grammarErr = 1;
        break;
      }

      //console.log('jointables.length', joinTables);

      let onCondnCount = 0;

      for (
        let i = 0;
        i < joinTables.length - 1 && queryParamsObj.grammarErr === 0;
        i = i + 2
      ) {
        onCondnCount++;

        this._joinTableNames(i, joinTables, i, queryParamsObj);

        if (queryParamsObj.grammarErr) {
          console.log("failed at _joinTableNames", queryParamsObj);
          break;
        }

        //console.log('after join tables', queryParamsObj);

        let onCondn = "_on" + onCondnCount;
        let onCondnObj = {};
        if (onCondn in req.query) {
          //console.log(onCondn, req.query[onCondn]);
          onCondnObj = whereHelp.getConditionClause(req.query[onCondn], " on ");
          //console.log('onCondnObj', onCondnObj);
          queryParamsObj.query += " on " + onCondnObj.query;
          queryParamsObj.params = queryParamsObj.params.concat(
            onCondnObj.params
          );
        } else {
          queryParamsObj.grammarErr = 1;
          //console.log('No on condition: ', onCondn);
          break;
        }

        if (i === 0) {
          i = i + 1;
        }
      }
      /**************** END : get join + on ****************/

      if (queryParamsObj.grammarErr) {
        break;
      } else {
        this.getWhereClause(
          req.query._where,
          " ignore ",
          queryParamsObj,
          " where "
        );
        this._getGrpByHavingOrderBy(req, "ignore", queryParamsObj, 5);
        //console.log('after where',queryParamsObj);
      }

      break;
    }

    if (queryParamsObj.grammarErr) {
      queryParamsObj.query = "";
      queryParamsObj.params = [];
    }

    return queryParamsObj;
  }
}

//expose class
module.exports = Xsql;
