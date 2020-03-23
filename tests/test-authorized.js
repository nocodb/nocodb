"use strict";

var bodyParser = require("body-parser");
var express = require("express");
var mysql = require("mysql");
var Xapi = require("../lib/xapi.js");
var whereClause = require("../lib/util/whereClause.helper.js");
var should = require("should");
var request = require("supertest");
const cmdargs = require("../lib/util/cmd.helper.js");
const { version } = require("../package.json");

var args = {};
var app = {};
var agent = {};
var api = {};
var apiPrefix = "/api/";
var mysqlPool = {};

//desribe group of tests done
describe("xmysql : tests", function() {
  before(function(done) {
    args["host"] = process.env.DATABASE_HOST || "localhost";
    args["user"] = process.env.DATABASE_USER || "test";
    args["password"] = process.env.DATABASE_PASSWORD || "test_passwd";
    args["database"] = process.env.DATABASE_NAME || "classicmodels";
    args["apiPrefix"] = apiPrefix;
    args["DEV"] = false;

    cmdargs.handle(args);

    mysqlPool = mysql.createPool(args);

    app = express();
    app.set("version", version);
    app.use(bodyParser.json());
    app.use(
      bodyParser.urlencoded({
        extended: true
      })
    );

    agent = request.agent(app);

    api = new Xapi(args, mysqlPool, app);
    api.init(function(err, results) {
      if (err) {
        process.exit(1);
      }

      // setup "userSchema" for authorization
      api.mysql.userSchema = {
        tableName: 'offices',
        alias: 'u',
        key: 'officeCode',
        username: 'postalCode',
        password: 'country',
      }    
      api.mysql.belongsToSchema = {
        alias: 'fk',
        foreign_key: 'officeCode',
      }

      app.listen(3000);
      done();
    });
  });

  after(function(done) {
    mysqlPool.end(function(err) {
      done();
    });
  });

  beforeEach(function(done) {
    //init common variables for each test
    done();
  });

  afterEach(function(done) {
    //term common variables for each test
    done();
  });


  it("GET " + apiPrefix + "payments/count should FAIL without token", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "payments/count") // api url
      .expect(401) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        JSON.stringify(res.body).should.be.equal(JSON.stringify({}));

        return done();
      });
  });


  it("POST /api/login should PASS", function(done) {
    var obj = {};

    obj["username"] = "94080";    // username (San Francisco)
    obj["password"] = "USA";         // password

    //post to an url with data
    agent
      .post(apiPrefix + "login") //enter url
      .send(obj) //postdata
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body["msg"].should.be.equals("ok");
        // typeof(res.body["token"]).should.be.equals("string")

        // save token for authorized GETs
        args['token'] = res.body["token"]
        console.log(`>>> token=${args['token']}`.green.bold);
        return done();
      });
  });
  

  it("GET " + apiPrefix + "payments/count should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "payments/count") // api url
      .set('Authorization', `Bearer ${args['token']}`)
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body[0]["no_of_rows"].should.be.equal(273);

        return done();
      });
  });


  it("GET " + apiPrefix + "payments/count should FAIL with invalid token", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "payments/count") // api url
      .set('Authorization', `Bearer invalid-token`)
      .expect(401) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        JSON.stringify(res.body).should.be.equal(JSON.stringify({}));

        return done();
      });
  });



  it(
    "GET " + apiPrefix + "offices/distinct?_fields=country should PASS",
    function(done) {
      //http get an url
      agent
        .get(apiPrefix + "offices/distinct?_fields=country") // api url
        .set('Authorization', `Bearer ${args['token']}`)
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/tables error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equal(1);

          return done();
        });
    }
  );



  it("GET " + apiPrefix + "payments/103___JM555205 should PASS", function(
    done
  ) {
    //http get an url
    agent
      .get(apiPrefix + "payments/103___JM555205") // api url
      .set('Authorization', `Bearer ${args['token']}`)
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response - max value here is 14571.44
        res.body.length.should.be.equal(1);
        res.body[0]["amount"].should.be.greaterThan(14570);

        return done();
      });
  });


  it("GET " + apiPrefix + "customers/103 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "customers/103") // api url
      .set('Authorization', `Bearer ${args['token']}`)
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/customers/103 error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.should.be.instanceOf(Object);
        res.body[0]["customerNumber"].should.be.equal(103);

        return done();
      });
  });


  it("GET " + apiPrefix + "payments?_p=2&_size=10 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "payments?_p=2&_size=10") // api url
      .set('Authorization', `Bearer ${args['token']}`)
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array);
        res.body.length.should.be.equal(10);

        return done();
      });
  });

  it("GET " + apiPrefix + "offices?_sort=city should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "offices?_sort=city") // api url
      .set('Authorization', `Bearer ${args['token']}`)
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array);
        res.body[0]["city"].should.be.equal("San Francisco");

        return done();
      });
  });

  it(
    "GET " + apiPrefix + "offices?_fields=officeCode,city should PASS",
    function(done) {
      //http get an url
      agent
        .get(apiPrefix + "offices?_fields=officeCode,city") // api url
        .set('Authorization', `Bearer ${args['token']}`)
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/offices/1/employees error
          if (err) {
            return done(err);
          }

          //validate resonse
          res.body.should.be.instanceOf(Array);
          Object.keys(res.body[0]).length.should.be.equal(2);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices?_fields=-territory,-addressLine2,-state should PASS",
    function(done) {
      //http get an url
      agent
        .get(apiPrefix + "offices?_fields=-territory,-addressLine2,-state") // api url
        .set('Authorization', `Bearer ${args['token']}`)
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/offices/1/employees error
          if (err) {
            return done(err);
          }

          //validate resonse
          res.body.should.be.instanceOf(Array);
          Object.keys(res.body[0]).length.should.be.equal(6);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices?_where=(((officeCode,in,1,2))~and(city,eq,boston)) should FAIL",
    function(done) {
      //http get an url
      agent
        .get(
          apiPrefix +
            "offices?_where=(((officeCode,in,1,2))~and(city,eq,boston))"
        ) // api url
        .set('Authorization', `Bearer ${args['token']}`)
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/offices/1/employees error
          if (err) {
            return done(err);
          }

          // oid=1 limits results to 'San Francisco' only 
          res.body.length.should.be.equal(0);

          return done();
        });
    }
  );


  it(
    "GET " +
      apiPrefix +
      "offices?_where=(((officeCode,in,1,2))~and(city,eq,san%20francisco)) should PASS",
    function(done) {
      //http get an url
      agent
        .get(
          apiPrefix +
            "offices?_where=(((officeCode,in,1,2))~and(city,eq,san francisco))"
        ) // api url
        .set('Authorization', `Bearer ${args['token']}`)
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/offices/1/employees error
          if (err) {
            return done(err);
          }

          // oid=1 limits results to 'San Francisco' only 
          res.body.length.should.be.equal(1);
          res.body[0]["city"].should.be.equal("San Francisco");

          return done();
        });
    }
  );

  // http://localhost:3000/api/offices/1/employees?oid=*
  // http://localhost:3000/api/employees/1165/customers/?oid=*
  // http://localhost:3000/api/customers/129/orders
  it("GET " + apiPrefix + "customers/129/orders/ should PASS", function(done) {
    // "salesRepEmployeeNumber"=1504 
    //post to an url with data
    agent
      .get(apiPrefix + "offices/1/employees") //enter url
      .set('Authorization', `Bearer ${args['token']}`)
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1);

        return done();
      });
  });

});
