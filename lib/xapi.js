"use strict";

var Xsql = require("./xsql.js");
var Xctrl = require("./xctrl.js");
var multer = require("multer");
const path = require("path");

const v8 = require("v8"),
  os = require("os");

//define class
class Xapi {
  constructor(args, mysqlPool, app) {
    this.config = args;
    this.mysql = new Xsql(args, mysqlPool);
    this.app = app;
    this.ctrls = [];

    /**************** START : multer ****************/
    this.storage = multer.diskStorage({
      destination: function(req, file, cb) {
        cb(null, process.cwd());
      },
      filename: function(req, file, cb) {
        console.log(file);
        cb(null, Date.now() + "-" + file.originalname);
      }
    });

    this.upload = multer({ storage: this.storage });
    /**************** END : multer ****************/
  }

  init(cbk) {
    this.mysql.init((err, results) => {
      this.app.use(this.urlMiddleware.bind(this));
      let stat = this.setupRoutes();
      this.app.use(this.errorMiddleware.bind(this));
      cbk(err, stat);
    });
  }

  urlMiddleware(req, res, next) {
    // get only request url from originalUrl
    let justUrl = req.originalUrl.split("?")[0];
    let pathSplit = [];

    // split by apiPrefix
    let apiSuffix = justUrl.split(this.config.apiPrefix);

    if (apiSuffix.length === 2) {
      // split by /
      pathSplit = apiSuffix[1].split("/");
      if (pathSplit.length) {
        if (pathSplit.length >= 3) {
          // handle for relational routes
          req.app.locals._parentTable = pathSplit[0];
          req.app.locals._childTable = pathSplit[2];
        } else {
          // handles rest of routes
          req.app.locals._tableName = pathSplit[0];
        }
      }
    }

    next();
  }

  errorMiddleware(err, req, res, next) {
    if (err && err.code) res.status(400).json({ error: err });
    else if (err && err.message)
      res.status(500).json({ error: "Internal server error : " + err.message });
    else res.status(500).json({ error: "Internal server error : " + err });

    next(err);
  }

  asyncMiddleware(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(err => {
        next(err);
      });
    };
  }

  root(req, res) {
    let routes = [];
    routes = this.mysql.getSchemaRoutes(
      false,
      req.protocol + "://" + req.get("host") + this.config.apiPrefix
    );
    routes = routes.concat(
      this.mysql.globalRoutesPrint(
        req.protocol + "://" + req.get("host") + this.config.apiPrefix
      )
    );
    res.json(routes);
  }

  setupRoutes() {
    let stat = {};
    stat.tables = 0;
    stat.apis = 0;

    // console.log('this.config while setting up routes', this.config);

    // show routes for database schema
    this.app.get("/", this.asyncMiddleware(this.root.bind(this)));

    // show all resouces
    this.app
      .route(this.config.apiPrefix + "tables")
      .get(this.asyncMiddleware(this.tables.bind(this)));

    this.app
      .route(this.config.apiPrefix + "xjoin")
      .get(this.asyncMiddleware(this.xjoin.bind(this)));

    stat.apis += 3;

    /**************** START : setup routes for each table ****************/
    let resources = [];
    resources = this.mysql.getSchemaRoutes(true, this.config.apiPrefix);

    stat.tables += resources.length;

    // iterate over each resource
    for (var j = 0; j < resources.length; ++j) {
      let resourceCtrl = new Xctrl(this.app, this.mysql);
      this.ctrls.push(resourceCtrl);

      let routes = resources[j]["routes"];

      stat.apis += resources[j]["routes"].length;

      // iterate over each routes in resource and map function
      for (var i = 0; i < routes.length; ++i) {
        switch (routes[i]["routeType"]) {
          case "list":
            this.app
              .route(routes[i]["routeUrl"])
              .get(this.asyncMiddleware(resourceCtrl.list.bind(resourceCtrl)));
            break;

          case "findOne":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.findOne.bind(resourceCtrl))
              );
            break;

          case "create":
            if (!this.config.readOnly)
              this.app
                .route(routes[i]["routeUrl"])
                .post(
                  this.asyncMiddleware(resourceCtrl.create.bind(resourceCtrl))
                );
            break;

          case "read":
            this.app
              .route(routes[i]["routeUrl"])
              .get(this.asyncMiddleware(resourceCtrl.read.bind(resourceCtrl)));
            break;

          case "bulkInsert":
            if (!this.config.readOnly) {
              this.app
                .route(routes[i]["routeUrl"])
                .post(
                  this.asyncMiddleware(
                    resourceCtrl.bulkInsert.bind(resourceCtrl)
                  )
                );
            }
            break;

          case "bulkRead":
            if (!this.config.readOnly) {
              this.app
                .route(routes[i]["routeUrl"])
                .get(
                  this.asyncMiddleware(resourceCtrl.bulkRead.bind(resourceCtrl))
                );
            } else {
              stat.apis--;
            }
            break;

          case "bulkDelete":
            if (!this.config.readOnly) {
              this.app
                .route(routes[i]["routeUrl"])
                .delete(
                  this.asyncMiddleware(
                    resourceCtrl.bulkDelete.bind(resourceCtrl)
                  )
                );
            } else {
              stat.apis--;
            }
            break;

          case "patch":
            if (!this.config.readOnly) {
              this.app
                .route(routes[i]["routeUrl"])
                .patch(
                  this.asyncMiddleware(resourceCtrl.patch.bind(resourceCtrl))
                );
            } else {
              stat.apis--;
            }
            break;

          case "update":
            if (!this.config.readOnly) {
              this.app
                .route(routes[i]["routeUrl"])
                .put(
                  this.asyncMiddleware(resourceCtrl.update.bind(resourceCtrl))
                );
            } else {
              stat.apis--;
            }
            break;

          case "delete":
            if (!this.config.readOnly) {
              this.app
                .route(routes[i]["routeUrl"])
                .delete(
                  this.asyncMiddleware(resourceCtrl.delete.bind(resourceCtrl))
                );
            } else {
              stat.apis--;
            }
            break;

          case "exists":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.exists.bind(resourceCtrl))
              );
            break;

          case "count":
            this.app
              .route(routes[i]["routeUrl"])
              .get(this.asyncMiddleware(resourceCtrl.count.bind(resourceCtrl)));
            break;

          case "distinct":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.distinct.bind(resourceCtrl))
              );
            break;

          case "describe":
            this.app
              .route(routes[i]["routeUrl"])
              .get(this.asyncMiddleware(this.tableDescribe.bind(this)));
            break;

          case "relational":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.nestedList.bind(resourceCtrl))
              );
            break;

          case "groupby":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.groupBy.bind(resourceCtrl))
              );
            break;

          case "ugroupby":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.ugroupby.bind(resourceCtrl))
              );
            break;

          case "chart":
            this.app
              .route(routes[i]["routeUrl"])
              .get(this.asyncMiddleware(resourceCtrl.chart.bind(resourceCtrl)));
            break;

          case "autoChart":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.autoChart.bind(resourceCtrl))
              );
            break;

          case "aggregate":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(resourceCtrl.aggregate.bind(resourceCtrl))
              );
            break;
        }
      }
    }
    /**************** END : setup routes for each table ****************/

    if (this.config.dynamic === 1 && !this.config.readOnly) {
      this.app
        .route("/dynamic*")
        .post(this.asyncMiddleware(this.runQuery.bind(this)));

      /**************** START : multer routes ****************/
      this.app.post(
        "/upload",
        this.upload.single("file"),
        this.uploadFile.bind(this)
      );
      this.app.post(
        "/uploads",
        this.upload.array("files", 10),
        this.uploadFiles.bind(this)
      );
      this.app.get("/download", this.downloadFile.bind(this));
      /**************** END : multer routes ****************/

      stat.apis += 4;
    }

    /**************** START : health and version ****************/
    this.app.get("/_health", this.asyncMiddleware(this.health.bind(this)));
    this.app.get("/_version", this.asyncMiddleware(this.version.bind(this)));
    stat.apis += 2;
    /**************** END : health and version ****************/

    let statStr =
      "     Generated: " +
      stat.apis +
      " REST APIs for " +
      stat.tables +
      " tables ";

    console.log(
      " - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - "
    );
    console.log("                                                            ");
    console.log(
      "          Database              :    %s",
      this.config.database
    );
    console.log("          Number of Tables      :    %s", stat.tables);
    console.log("                                                            ");
    console.log(
      "          REST APIs Generated   :    %s",
      stat.apis
    );
    console.log("                                                            ");

    return stat;
  }

  async xjoin(req, res) {
    let obj = {};

    obj.query = "";
    obj.params = [];

    this.mysql.prepareJoinQuery(req, res, obj);

    //console.log(obj);
    if (obj.query.length) {
      let results = await this.mysql.exec(obj.query, obj.params);
      res.status(200).json(results);
    } else {
      res.status(400).json({ err: "Invalid Xjoin request" });
    }
  }

  async tableDescribe(req, res) {
    let query = "describe ??";
    let params = [req.app.locals._tableName];

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);
  }

  async tables(req, res) {
    let query =
      "SELECT table_name AS resource FROM information_schema.tables WHERE table_schema = ? ";
    let params = [this.config.database];

    if (Object.keys(this.config.ignoreTables).length > 0) {
      query += "and table_name not in (?)";
      params.push(Object.keys(this.config.ignoreTables));
    }

    let results = await this.mysql.exec(query, params);

    res.status(200).json(results);
  }

  async runQuery(req, res) {
    let query = req.body.query;
    let params = req.body.params;

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);
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
      res.end("upload failed");
    }
  }

  uploadFiles(req, res) {
    if (!req.files || req.files.length === 0) {
      res.end("upload failed");
    } else {
      let files = [];
      for (let i = 0; i < req.files.length; ++i) {
        files.push(req.files[i].path);
      }

      res.end(files.toString());
    }
  }

  /**************** END : files related ****************/

  /**************** START : health and version ****************/

  async getMysqlUptime() {
    let v = await this.mysql.exec("SHOW GLOBAL STATUS LIKE 'Uptime';", []);
    return v[0]["Value"];
  }

  async getMysqlHealth() {
    let v = await this.mysql.exec("select version() as version", []);
    return v[0]["version"];
  }

  async health(req, res) {
    let status = {};
    status["process_uptime"] = process.uptime();
    status["mysql_uptime"] = await this.getMysqlUptime();

    if (Object.keys(req.query).length) {
      status["process_memory_usage"] = process.memoryUsage();
      status["os_total_memory"] = os.totalmem();
      status["os_free_memory"] = os.freemem();
      status["os_load_average"] = os.loadavg();
      status["v8_heap_statistics"] = v8.getHeapStatistics();
    }

    res.json(status);
  }

  async version(req, res) {
    let version = {};

    version["Xmysql"] = this.app.get("version");
    version["mysql"] = await this.getMysqlHealth();
    version["node"] = process.versions.node;
    res.json(version);
  }

  /**************** END : health and version ****************/
}

//expose class
module.exports = Xapi;
