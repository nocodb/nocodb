//define class
class xctrl {
  constructor(app, mysql) {
    this.app = app;
    this.mysql = mysql;
  }

  async create(req, res) {
    let query = "INSERT INTO ?? SET ?";
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(req.body);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  async list(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    this.mysql.prepareListQuery(req, res, queryParamsObj, 0);

    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    res.status(200).json(results);
  }

  async nestedList(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    this.mysql.prepareListQuery(req, res, queryParamsObj, 1);

    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    res.status(200).json(results);
  }

  async findOne(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    this.mysql.prepareListQuery(req, res, queryParamsObj, 2);

    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    res.status(200).json(results);
  }

  async read(req, res) {
    let query = "select * from ?? where ";
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(
      req.app.locals._tableName,
      req.params.id.split("___")
    );

    if (!clause) {
      return res.status(400).send({
        error:
          "Table is made of composite primary keys - all keys were not in input"
      });
    }

    query += clause;
    query += " LIMIT 1";

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  async exists(req, res) {
    let query = "select * from ?? where ";
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(
      req.app.locals._tableName,
      req.params.id.split("___")
    );

    if (!clause) {
      return res.status(400).send({
        error:
          "Table is made of composite primary keys - all keys were not in input"
      });
    }

    query += clause;
    query += " LIMIT 1";

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  async update(req, res) {
    let query = "REPLACE INTO ?? SET ?";
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(req.body);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  async patch(req, res) {
    let query = "UPDATE ?? SET ";
    let keys = Object.keys(req.body);

    // SET clause
    let updateKeys = "";
    for (let i = 0; i < keys.length; ++i) {
      updateKeys += keys[i] + " = ? ";
      if (i !== keys.length - 1) updateKeys += ", ";
    }

    // where clause
    query += updateKeys + " where ";
    let clause = this.mysql.getPrimaryKeyWhereClause(
      req.app.locals._tableName,
      req.params.id.split("___")
    );

    if (!clause) {
      return res.status(400).send({
        error:
          "Table is made of composite primary keys - all keys were not in input"
      });
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
    let query = "DELETE FROM ?? WHERE ";
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(
      req.app.locals._tableName,
      req.params.id.split("___")
    );

    if (!clause) {
      return res.status(400).send({
        error:
          "Table is made of composite primary keys - all keys were not in input"
      });
    }

    query += clause;

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  async bulkInsert(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];
    let results = [];

    //console.log(req.app.locals._tableName, req.body);

    this.mysql.prepareBulkInsert(
      req.app.locals._tableName,
      req.body,
      queryParamsObj
    );

    results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    res.status(200).json(results);
  }

  async bulkDelete(req, res) {
    let query = "delete from ?? where ?? in ";
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(this.mysql.getPrimaryKeyName(req.app.locals._tableName));

    query += "(";

    if (req.query && req.query._ids) {
      let ids = req.query._ids.split(",");
      for (var i = 0; i < ids.length; ++i) {
        if (i) {
          query += ",";
        }
        query += "?";
        params.push(ids[i]);
      }
    }

    query += ")";

    //console.log(query, params);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  async bulkRead(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    this.mysql.prepareListQuery(req, res, queryParamsObj, 3);

    //console.log(queryParamsObj.query, queryParamsObj.params);

    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    res.status(200).json(results);
  }

  async count(req, res) {
    let queryParams = {};

    queryParams.query = "select count(1) as no_of_rows from ?? ";
    queryParams.params = [];

    queryParams.params.push(req.app.locals._tableName);

    this.mysql.getWhereClause(
      req.query._where,
      req.app.locals._tableName,
      queryParams,
      " where "
    );

    let results = await this.mysql.exec(queryParams.query, queryParams.params);
    res.status(200).json(results);
  }

  async distinct(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    this.mysql.prepareListQuery(req, res, queryParamsObj, 4);

    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    res.status(200).json(results);
  }

  async groupBy(req, res) {
    if (req.query && req.query._fields) {
      let queryParamsObj = {};
      queryParamsObj.query = "select ";
      queryParamsObj.params = [];

      /**************** add columns and group by columns ****************/
      this.mysql.getColumnsForSelectStmt(
        req.app.locals._tableName,
        req.query,
        queryParamsObj
      );

      queryParamsObj.query += ",count(*) as _count from ?? group by ";
      let tableName = req.app.locals._tableName;
      queryParamsObj.params.push(tableName);

      this.mysql.getColumnsForSelectStmt(
        req.app.locals._tableName,
        req.query,
        queryParamsObj
      );

      if (!req.query._sort) {
        req.query._sort = {};
        req.query._sort = "-_count";
      }

      /**************** add having clause ****************/
      this.mysql.getHavingClause(
        req.query._having,
        req.app.locals._tableName,
        queryParamsObj,
        " having "
      );

      /**************** add orderby clause ****************/
      this.mysql.getOrderByClause(req.query, tableName, queryParamsObj);

      //console.log(queryParamsObj.query, queryParamsObj.params);
      var results = await this.mysql.exec(
        queryParamsObj.query,
        queryParamsObj.params
      );

      res.status(200).json(results);
    } else {
      res
        .status(400)
        .json({
          message:
            "Missing _fields query params eg: /api/tableName/groupby?_fields=column1"
        });
    }
  }

  async ugroupby(req, res) {
    if (req.query && req.query._fields) {
      let queryParamsObj = {};
      queryParamsObj.query = "";
      queryParamsObj.params = [];
      let uGrpByResults = {};

      /**************** add fields with count(*) *****************/
      let fields = req.query._fields.split(",");

      for (var i = 0; i < fields.length; ++i) {
        uGrpByResults[fields[i]] = [];

        if (i) {
          queryParamsObj.query += " UNION ";
        }
        queryParamsObj.query +=
          " SELECT IFNULL(CONCAT(?,?,??),?) as ugroupby, count(*) as _count from ?? GROUP BY ?? ";
        queryParamsObj.params.push(fields[i]);
        queryParamsObj.params.push("~");
        queryParamsObj.params.push(fields[i]);
        queryParamsObj.params.push(fields[i] + "~");
        queryParamsObj.params.push(req.app.locals._tableName);
        queryParamsObj.params.push(fields[i]);
      }

      //console.log(queryParamsObj.query, queryParamsObj.params);
      var results = await this.mysql.exec(
        queryParamsObj.query,
        queryParamsObj.params
      );

      for (var i = 0; i < results.length; ++i) {
        let grpByColName = results[i]["ugroupby"].split("~")[0];
        let grpByColValue = results[i]["ugroupby"].split("~")[1];

        let obj = {};
        obj[grpByColValue] = results[i]["_count"];

        uGrpByResults[grpByColName].push(obj);
      }

      res.status(200).json(uGrpByResults);
    } else {
      res
        .status(400)
        .json({
          message:
            "Missing _fields query params eg: /api/tableName/ugroupby?_fields=column1,column2"
        });
    }
  }

  async aggregate(req, res) {
    if (req.query && req.query._fields) {
      let tableName = req.app.locals._tableName;
      let query = "select ";
      let params = [];
      let fields = req.query._fields.split(",");

      for (var i = 0; i < fields.length; ++i) {
        if (i) {
          query = query + ",";
        }
        query =
          query +
          " min(??) as ?,max(??) as ?,avg(??) as ?,sum(??) as ?,stddev(??) as ?,variance(??) as ? ";
        params.push(fields[i]);
        params.push("min_of_" + fields[i]);
        params.push(fields[i]);
        params.push("max_of_" + fields[i]);
        params.push(fields[i]);
        params.push("avg_of_" + fields[i]);
        params.push(fields[i]);
        params.push("sum_of_" + fields[i]);
        params.push(fields[i]);
        params.push("stddev_of_" + fields[i]);
        params.push(fields[i]);
        params.push("variance_of_" + fields[i]);
      }

      query = query + " from ??";
      params.push(tableName);

      var results = await this.mysql.exec(query, params);

      res.status(200).json(results);
    } else {
      res
        .status(400)
        .json({
          message:
            "Missing _fields in query params eg: /api/tableName/aggregate?_fields=numericColumn1"
        });
    }
  }

  async chart(req, res) {
    let query = "";
    let params = [];
    let obj = {};

    if (req.query) {
      let isRange = false;
      if (req.query.range) {
        isRange = true;
      }

      if (req.query && req.query.min && req.query.max && req.query.step) {
        //console.log(req.params.min, req.params.max, req.params.step);

        obj = this.mysql.getChartQueryAndParamsFromMinMaxStep(
          req.app.locals._tableName,
          req.query._fields,
          parseInt(req.query.min),
          parseInt(req.query.max),
          parseInt(req.query.step),
          isRange
        );
      } else if (
        req.query &&
        req.query.steparray &&
        req.query.steparray.length > 1
      ) {
        obj = this.mysql.getChartQueryAndParamsFromStepArray(
          req.app.locals._tableName,
          req.query._fields,
          req.query.steparray.split(",").map(Number),
          isRange
        );
      } else if (
        req.query &&
        req.query.steppair &&
        req.query.steppair.length > 1
      ) {
        obj = this.mysql.getChartQueryAndParamsFromStepPair(
          req.app.locals._tableName,
          req.query._fields,
          req.query.steppair.split(",").map(Number),
          false
        );
      } else {
        query =
          "select min(??) as min,max(??) as max,stddev(??) as stddev,avg(??) as avg from ??";
        params = [];

        params.push(req.query._fields);
        params.push(req.query._fields);
        params.push(req.query._fields);
        params.push(req.query._fields);
        params.push(req.app.locals._tableName);

        let _this = this;

        let results = await _this.mysql.exec(query, params);

        //console.log(results, results['max'], req.params);

        obj = _this.mysql.getChartQueryAndParamsFromMinMaxStddev(
          req.app.locals._tableName,
          req.query._fields,
          results[0]["min"],
          results[0]["max"],
          results[0]["stddev"],
          isRange
        );
      }

      this.mysql.getWhereClause(
        req.query._where,
        req.app.locals._tableName,
        obj,
        " where "
      );

      let results = await this.mysql.exec(obj.query, obj.params);

      res.status(200).json(results);
    } else {
      res
        .status(400)
        .json({
          message:
            "Missing _fields in query params eg: /api/tableName/chart?_fields=numericColumn1"
        });
    }
  }

  async autoChart(req, res) {
    let query = "describe ??";
    let params = [req.app.locals._tableName];
    let obj = {};
    let results = [];

    let isRange = false;
    if (req.query.range) {
      isRange = true;
    }

    let describeResults = await this.mysql.exec(query, params);

    //console.log(describeResults);

    for (var i = 0; i < describeResults.length; ++i) {
      //console.log('is this numeric column', describeResults[i]['Type']);

      if (
        describeResults[i]["Key"] !== "PRI" &&
        this.mysql.isTypeOfColumnNumber(describeResults[i]["Type"])
      ) {
        query =
          "select min(??) as min,max(??) as max,stddev(??) as stddev,avg(??) as avg from ??";
        params = [];

        params.push(describeResults[i]["Field"]);
        params.push(describeResults[i]["Field"]);
        params.push(describeResults[i]["Field"]);
        params.push(describeResults[i]["Field"]);
        params.push(req.app.locals._tableName);

        let _this = this;

        let minMaxResults = await _this.mysql.exec(query, params);

        //console.log(minMaxResults, minMaxResults['max'], req.params);

        query = "";
        params = [];

        obj = _this.mysql.getChartQueryAndParamsFromMinMaxStddev(
          req.app.locals._tableName,
          describeResults[i]["Field"],
          minMaxResults[0]["min"],
          minMaxResults[0]["max"],
          minMaxResults[0]["stddev"],
          isRange
        );

        let r = await this.mysql.exec(obj.query, obj.params);

        let resultObj = {};
        resultObj["column"] = describeResults[i]["Field"];
        resultObj["chart"] = r;

        results.push(resultObj);
      }
    }

    res.status(200).json(results);
  }
}

//expose class
module.exports = xctrl;
