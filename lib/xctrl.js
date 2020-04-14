const md5 = require("./util/md5.helper.js");
const bcrypt = require('bcrypt');


let DEBUG = false;

//define class
class xctrl {
  constructor(app, mysql, debug=false) {
    this.app = app;
    this.mysql = mysql;
    DEBUG = debug
  }
  

  async changePassword(req) {
    const user = Object.assign({},this.mysql.userSchema);
    const update_passwd_query = `UPDATE ${user.tableName} SET ${user.password_https}=? WHERE ${user.key}=? AND ${user.username}=?`;

    let {username, old_password, password_hash} = req.body;
    let retval = {};
    if (!(username && old_password && password_hash)) {
      retval['error'] = "username, old password or password is missing";
      return retval;
    }

    return this.getUser({body:{
      username,
      password: old_password      // authenticate with `old_password` before continuing
    }})
    .then( retval=>{
      return retval.oid;
    })
    .then( (oid)=>{
      // update password to new password hashing schema
      req.body['key'] = oid;
      let updateParams = [
        password_hash,    // new password
        oid,              // member_id
        username          // username
      ];
      // console.log("\n>>> member_id".bold.red, oid)
      // console.log(`>>> update old_password=${old_password}, new password=${password_hash}`.bold.red);
      return this.mysql.exec(update_passwd_query, updateParams)
    })
    .then( results=>{
      let resp = results && results.changedRows
      if (!resp) {
        retval['error'] = "error saving new password";
        return retval;
      }
      retval['oid'] = req.body['key'];
      retval['username'] = username;
      return retval;
    })      
    .catch( (err)=>{
      retval['error'] = err;
      return retval;
    });
  }

  async getUser(req) {
    // check password schema, md5 or bcrypt/argon2
    const user = Object.assign({},this.mysql.userSchema);
    const md5_password_query = `SELECT ${user.key}, ${user.username} FROM ${user.tableName} WHERE ${user.password_https} IS NULL AND ${user.username}=? AND ${user.password}=? LIMIT 1`;
    const bcrypt_password_query = `SELECT ${user.key}, ${user.username}, ${user.password_https} FROM ${user.tableName} WHERE ${user.username}=? LIMIT 1`;

    let {username, password} = req.body;
    let retval = {};

    if (!(username && password)) {
      retval['error'] = "username or password is missing";
      return retval;
    }

    return Promise.resolve().then( ()=>{
      // first check md5, then bcrypt
      return this.mysql.exec(md5_password_query, [username, md5.md5(password)])
    })
    .then( results=>{
      let resp = results && results.pop();
      if (resp && resp[user.username]===username ) {
        retval['schema'] = "1.0";
        return resp[user.key];
      }
      // console.log( `md5 FAILED >>> password=${password}`.green, md5.md5(password),  resp );
      return Promise.reject("continue");
    })
    .catch( (err)=>{
      if (err != "continue") 
        return Promise.reject(err);
      // now check bcrypt
      return this.mysql.exec(bcrypt_password_query, [username])
      .then( results=>{
        let resp = results && results.pop();
        if (!resp || resp[user.username]!==username ) 
          return Promise.reject("username or password do not match");
        
        return new Promise( (resolve, reject)=>{
          // compare password clear with hashed password from db using bcrypt.compare()
          // console.log(`\n>>> bcrypt.compare( ${password}, ${resp.password}`.bold.red);
          bcrypt.compare( password, resp.password_https, (err, result)=>{
            if (err) return reject("Error: bcrypt.compare()");
            if (result===true) {
              retval['schema'] = "1.1";
              return resolve(resp[user.key]);
            }
            // console.log( `bcrypt FAILED >>> password=${password}`.red, resp );
            return reject("username or password do not match");
          });
        });
      });
    })
    .then( (oid)=>{
      retval['oid'] = oid;
      retval['username'] = username;
      return retval;
    })        
    .catch( (err)=>{
      retval['error'] = err;
      return retval;
    });
  }

  scrubPasswords( data, field="password" ) {
    // console.log( "data=", data)
    let dirty = (data.hasOwnProperty('data')) ? data['data'] : data;
    let clean = dirty.map( o=>{ 
      delete o[field];
      return o;
    });
    return (data.hasOwnProperty('data')) ? {data:clean, count:data.count} : clean;
  }

  async create(req, res) {
    let query = "INSERT INTO ?? SET ?";
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(req.body);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  /**
   * added support for counts, use qs=?name=value&with-counts
   *  
   * @param {*} req 
   * @param {*} res if &with-counts, results = {data:[],count:number}
   */
  async list(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    let oid = DEBUG ? req.query.oid : null;
    this.mysql.prepareListQuery(req, res, queryParamsObj, 0, oid);

    
    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    results = this.scrubPasswords(results);

    try {
      // add counts to request, results = {data:[],count:number}
      let withCounts = req.query.hasOwnProperty('with-counts') && req.query['with-counts']!=='0';
      if (withCounts) {
        let counts = await this.count(req, res, false);
        let count = counts[0]['no_of_rows'];
        let resp = {
          data: results,
          count,
        }
        // console.log(">>> ", resp);
        return res.status(200).json(resp);
      }
    } catch (err) {
      console.error("ERROR: problem getting counts, resp=", counts);
    }
    return res.status(200).json(results);
  }

  async nestedList(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    let oid = DEBUG ? req.query.oid : null;
    this.mysql.prepareListQuery(req, res, queryParamsObj, 1, oid);

    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    results = this.scrubPasswords(results);

    try {
      // add counts to request, results = {data:[],count:number}
      let withCounts = req.query.hasOwnProperty('with-counts') && req.query['with-counts']!=='0';
      if (withCounts) {
        let counts = await this.count(req, res, false);
        let count = counts[0]['no_of_rows'];
        let resp = {
          data: results,
          count,
        }
        console.log(">>> nestedList count=", resp.count);
        return res.status(200).json(resp);
      }
    } catch (err) {
      console.error("ERROR: problem getting counts, resp=", counts);
    }
    return res.status(200).json(results);    
  }

  async findOne(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];

    let oid = DEBUG ? req.query.oid : null;
    this.mysql.prepareListQuery(req, res, queryParamsObj, 2, oid);

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

    console.log(`\n>>> ${req.route.path}`, queryParams);
    // BUG: {"error":"Table is made of composite primary keys - all keys were not in input"}
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

    let oid = DEBUG ? req.query.oid : null;
    this.mysql.prepareListQuery(req, res, queryParamsObj, 3, oid);

    //console.log(queryParamsObj.query, queryParamsObj.params);

    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );
    res.status(200).json(results);
  }

  async count(req, res, sendResponse = true) {
    let queryParams = {};

    queryParams.query = "select count(1) as no_of_rows from ?? ";
    queryParams.params = [];

    queryParams.params.push(req.app.locals._tableName);

    let oid = DEBUG ? req.query.oid : null;
    this.mysql._ownerAccess_where(req, req.app.locals._tableName, queryParams, oid)

    this.mysql.getWhereClause(
      req.query._where,
      req.app.locals._tableName,
      queryParams,
    );

    let results = await this.mysql.exec(queryParams.query, queryParams.params);

    return sendResponse ? res.status(200).json(results) : results;

    // console.log(`\n>>> ${req.route.path}`, queryParams);
  }

  /**
   * special method to get all counts related to a user
   * @param {*} req 
   * @param {*} res 
   */
  async userCounts(req, res) {
    let queryParamsObj = {};

    let oid = DEBUG ? req.query.oid : null;
    this.mysql.prepareCountQuery(req, res, queryParamsObj, oid);

    // console.log(">>>> ", queryParamsObj);
    let results = await this.mysql.exec(
      queryParamsObj.query,
      queryParamsObj.params
    );

    res.status(200).json(results);
  }

  async distinct(req, res) {
    let queryParamsObj = {};
    queryParamsObj.query = "";
    queryParamsObj.params = [];


    let oid = DEBUG ? req.query.oid : null;
    this.mysql.prepareListQuery(req, res, queryParamsObj, 4, oid);

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
