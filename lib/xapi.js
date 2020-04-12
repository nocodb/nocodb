"use strict";

var Xsql = require("./xsql.js");
var Xctrl = require("./xctrl.js");
var multer = require("multer");
const path = require("path");


const v8 = require("v8");
const os = require("os");

const jwt = require('jsonwebtoken');
// import passport and passport-jwt modules
const passport = require('passport');
const passportJWT = require('passport-jwt');

// # security
const bcrypt = require('bcrypt');
const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

let DEBUG = false;
let DEBUG_AUTH = false;

//define class
class Xapi {
  constructor(args, mysqlPool, app) {
    this.config = args;
    this.mysql = new Xsql(args, mysqlPool);
    this.app = app;
    this.ctrls = [];
    DEBUG = this.config.DEV;

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

  /**
   * these methods are default --DEV
   * override these methods in initPassportMiddleware()
   */
  authenticateToken_callback = (req, res, next)=>{ 
    if (!DEBUG) return res.status(401).json({ msg: 'Unauthorized. only available with arg --DEV' });

    if (!!req.query) {               // GET
      let {username, password} = req.query;
      req.body = Object.assign({username, password} , req.body);
    }

    if (req.query.oid==="*") {
      this.mysql.setOwner(null);  // owner access wildcard for DEBUG=true only
      req.query.oid = null;
    } else {
      this.mysql.setOwner(req.query.oid || 'unauthorized');
    }
    next();
  };

  respond_with_Token_callback = (options, res)=>{
    let {oid, username, schema} = options;
    if (!DEBUG) return res.status(401).json({ msg: 'Unauthorized. only available with arg --DEV' });

    return res.status(200).json({
      msg: "ok",
      token: "JWT authorization is disabled",
      expires: new Date( Date.now() + 3600*1000 ),  // 1h
      username,
    });
  }
  /**
   * end override section
   */




  init(cbk) {
    DEBUG_AUTH = process.env.DEBUG_JWT==='true'; // force init of initPassportMiddleware()

    this.mysql.init((err, results) => {
      this.app.set('etag', false);
      this.app.use(this.noCache.bind(this));
      this.app.use(this.urlMiddleware.bind(this));

      if (DEBUG && !DEBUG_AUTH){
        /**
         * for debugging /login in --DEV mode
         * @param {} req 
         * @param {*} åres 
         */
        const login_route_pass_authorization_callback = async (req, res)=>{

          // console.log("authenticateToken_callback DEV", req.body)

          let resourceCtrl = new Xctrl(this.app, this.mysql, DEBUG);
          let {oid, username, error} = await resourceCtrl.getUser(req, res);
          if (error) {
            console.log("getUser()", error)
            return res.status(401).send(error);
          }
          return res.status(200).json({
            msg: "ok",
            token: "JWT authorization is disabled",
            expires: new Date( Date.now() + 3600*1000 ),  // 1h
            username,
          });
        }

        this.app
        .route(this.config.apiPrefix + "login")
        .get(
          this.authenticateToken_callback,
          this.asyncMiddleware(login_route_pass_authorization_callback))
        .post(
          this.authenticateToken_callback,
          this.asyncMiddleware(login_route_pass_authorization_callback));

      }
      else { // PRODUCTION
        // init passport, require JWT authorization token, setup `/login` route
        console.log("initializing JWT authorization".green.bold)
        this.initPassportMiddleware();
      } 
      
      let stat = this.setupRoutes();
      this.app.use(this.errorMiddleware.bind(this));

      cbk(err, stat);
    });
  }

  /**
   * support bcrypt password hashing
    
   * 
   * @param {*} req 
   * @param {*} res 
   * @param {*} next 
   */
  hashPwdMiddleware(req, res, next) {
    if (DEBUG && !!req.query) {               // GET
      let {username, password, old_password} = req.query;
      req.body = Object.assign({username, password, old_password} , req.body);
    }

    if (!req.body['password']) 
      return next();

    bcrypt.hash( req.body['password'], saltRounds, (err, hash)=>{
      if (err){
        next(err);
      }
      req.body['password_hash'] = hash;
      // console.log("1>>> hashPwdMiddleware, body=", req.body);
      next();
    });
  }

  /**
   * change_password to new password hashing schema
   * @param {*} req 
   * @param {*} res 
   */
  change_password_callback = async (req, res, next) => {
    let resourceCtrl = new Xctrl(this.app, this.mysql, DEBUG);
    let {oid, username, error} = await resourceCtrl.changePassword(req, res);

    if (error) {
      console.log("changePassword()", error)
      return res.status(401).send(error);
    }
    try {
      this.respond_with_Token_callback({oid, username}, res);
    } catch (err) {
      return res.status(500).send("unknown error changing password");
    }
  }


  login_callback = async (req, res) => {
    // console.log(">>> initPassportMiddleware(): query=", req.query)
    let resourceCtrl = new Xctrl(this.app, this.mysql, DEBUG);
    let {oid, username, schema, error} = await resourceCtrl.getUser(req, res);

    if (error) {
      console.log("getUser()", error)
      return res.status(401).send(error);
    }
    try {
      this.respond_with_Token_callback({oid, username, schema}, res);
    } catch (err) {
      return res.status(500).send("unknown error on login");
    }
  }


  // from: https://medium.com/devc-kano/basics-of-authentication-using-passport-and-jwt-with-sequelize-and-mysql-database-748e09d01bab
  initPassportMiddleware() {
    // ExtractJwt to help extract the token
    let ExtractJwt = passportJWT.ExtractJwt;
    // JwtStrategy which is the strategy for the authentication
    let JwtStrategy = passportJWT.Strategy;
    let jwtOptions = {};
    jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    jwtOptions.secretOrKey = 'its-crazy-out-there-so-be-safe';

    // lets create our strategy for web token
    let strategy = new JwtStrategy(jwtOptions, (jwt_payload, next) => {
      // console.log('payload received’', jwt_payload);
      let oid = jwt_payload.id;
      this.mysql.setOwner(oid)
      next(null, oid)
    });
    // use the strategy
    passport.use(strategy);
    this.app.use(passport.initialize());

    /**
     * override callback, with additional access to jwt closure
     */
    this.respond_with_Token_callback = (options, res)=>{
      let {oid, username, schema} = options;
      if (oid && username) {
        this.mysql.setOwner(oid);
        // from now on we'll identify the user by the id and the id is
        // the only personalized value that goes into our token
        let payload = { id: oid };
        let token = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: this.config.expires });
        let expires = jwt.decode(token).exp;
        return res.status(200).send({ msg: 'ok', token , expires: new Date(expires*1000), schema });
      }
      throw new Error("oid or username is missing");
    };

    this.authenticateToken_callback = passport.authenticate('jwt', { session: false });
    /**
     * end override callbacks
     */
    return;
  }

  noCache(req, res, next) {
    // do not cache REST API responses
    //delete all headers related to cache
    req.headers['if-none-match'] = '';
    req.headers['if-modified-since'] = '';
    next();
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
    let resourceCtrl = new Xctrl(this.app, this.mysql, DEBUG);

    // console.log('this.config while setting up routes', this.config);

    // show routes for database schema
    this.app.get("/", this.asyncMiddleware(this.root.bind(this)));


    // login
    this.app
    .route(this.config.apiPrefix + "login")
    .post(
      this.hashPwdMiddleware,
      this.asyncMiddleware( this.login_callback.bind(this) ));

    if (DEBUG && DEBUG_AUTH){
      // enable /login for GET requests
      this.app
      .route(this.config.apiPrefix + "login")
      .get(
        this.hashPwdMiddleware,
        this.asyncMiddleware( this.login_callback.bind(this) ));
    }    

    // change_password
    this.app
    .route(this.config.apiPrefix + "change_password")
    .post(
      this.hashPwdMiddleware,
      this.asyncMiddleware( this.change_password_callback.bind(this) ));

    if (DEBUG){
      // enable /login for GET requests
      this.app
      .route(this.config.apiPrefix + "change_password")
      .get(
        this.hashPwdMiddleware,
        this.asyncMiddleware( this.change_password_callback.bind(this) ));
    }


    // show all resouces
    this.app
      .route(this.config.apiPrefix + "tables")
      .get(
        this.authenticateToken_callback,
        this.asyncMiddleware(this.tables.bind(this)
      ));

    this.app
      .route(this.config.apiPrefix + "xjoin")
      .get(
        this.authenticateToken_callback, 
        this.asyncMiddleware(this.xjoin.bind(this)));
        
    stat.apis += 4;        

    
    this.ctrls.push(resourceCtrl);
    this.app
      .route(this.config.apiPrefix + "usercounts")
      .get(
        this.authenticateToken_callback, 
        this.asyncMiddleware( resourceCtrl.userCounts.bind(resourceCtrl)) );

    stat.apis += 1;

    /**************** START : setup routes for each table ****************/
    let resources = [];
    resources = this.mysql.getSchemaRoutes(true, this.config.apiPrefix);

    stat.tables += resources.length;

    // iterate over each resource
    for (var j = 0; j < resources.length; ++j) {
      let resourceCtrl = new Xctrl(this.app, this.mysql, DEBUG);
      this.ctrls.push(resourceCtrl);

      let routes = resources[j]["routes"];

      stat.apis += resources[j]["routes"].length;

      // iterate over each routes in resource and map function
      for (var i = 0; i < routes.length; ++i) {
        switch (routes[i]["routeType"]) {
          case "list":
            this.app
              .route(routes[i]["routeUrl"])
              .get( 
                this.authenticateToken_callback, 
                this.asyncMiddleware(resourceCtrl.list.bind(resourceCtrl)) );
            break;

          case "findOne":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback, 
                this.asyncMiddleware( resourceCtrl.findOne.bind(resourceCtrl))
              );
            break;

          case "create":
            if (!this.config.readOnly)
              this.app
                .route(routes[i]["routeUrl"])
                .post(
                  this.authenticateToken_callback, 
                  this.asyncMiddleware(resourceCtrl.create.bind(resourceCtrl))
                );
            break;

          case "read":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback,
                this.asyncMiddleware(resourceCtrl.read.bind(resourceCtrl)));
            break;

          case "bulkInsert":
            if (!this.config.readOnly) {
              this.app
                .route(routes[i]["routeUrl"])
                .post(
                  this.asyncMiddleware(
                    this.authenticateToken_callback,
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
                  this.authenticateToken_callback, 
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
                    this.authenticateToken_callback,
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
                  this.authenticateToken_callback,
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
                  this.authenticateToken_callback,
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
                  this.authenticateToken_callback,
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
                this.authenticateToken_callback, 
                this.asyncMiddleware(resourceCtrl.exists.bind(resourceCtrl))
              );
            break;

          case "count":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback, 
                this.asyncMiddleware(resourceCtrl.count.bind(resourceCtrl)));
            break;

          case "distinct":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback, 
                this.asyncMiddleware(resourceCtrl.distinct.bind(resourceCtrl))
              );
            break;

          case "describe":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.asyncMiddleware(this.tableDescribe.bind(this)));
            break;

          case "relational":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback, 
                this.asyncMiddleware(resourceCtrl.nestedList.bind(resourceCtrl))
              );
            break;

          case "groupby":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback,
                this.asyncMiddleware(resourceCtrl.groupBy.bind(resourceCtrl))
              );
            break;

          case "ugroupby":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback,
                this.asyncMiddleware(resourceCtrl.ugroupby.bind(resourceCtrl))
              );
            break;

          case "chart":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback,
                this.asyncMiddleware(resourceCtrl.chart.bind(resourceCtrl)));
            break;

          case "autoChart":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback,
                this.asyncMiddleware(resourceCtrl.autoChart.bind(resourceCtrl))
              );
            break;

          case "aggregate":
            this.app
              .route(routes[i]["routeUrl"])
              .get(
                this.authenticateToken_callback,
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
        .post(
          this.authenticateToken_callback,
          this.asyncMiddleware(this.runQuery.bind(this)));

      /**************** START : multer routes ****************/
      this.app.post(
        "/upload",
        this.upload.single("file"),
        this.uploadFile.bind(this)
      );
      this.app.post(
        "/uploads",
        this.upload.array("files", 10),
        this.authenticateToken_callback,
        this.uploadFiles.bind(this)
      );
      this.app.get("/download", 
        this.authenticateToken_callback,
        this.downloadFile.bind(this));
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
      "          REST APIs Generated   :    %s".green.bold,
      stat.apis
    );
    console.log("                                                            ");

    return stat;
  }

  async xjoin(req, res) {
    let obj = {};

    obj.query = "";
    obj.params = [];

    let oid = DEBUG ? req.query.oid : null;
    this.mysql.prepareJoinQuery(req, res, obj, oid);

    //console.log(obj);
    if (obj.query.length) {
      let results = await this.mysql.exec(obj.query, obj.params);
      res.status(200).json(results);
    } else {
      res.status(400).json({ err: "Invalid Xjoin request" });
    }

    // console.log(`\nxxjoin >>> ${req.route.path}`, obj);
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
