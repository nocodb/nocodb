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
var apiPrefix = "/apj/v1/";
var mysqlPool = {};

//desribe group of tests done
describe("xmysql : tests", function() {
  before(function(done) {
    args["host"] = process.env.DATABASE_HOST || "localhost";
    args["user"] = process.env.DATABASE_USER || "root";
    args["password"] = process.env.DATABASE_PASSWORD || "";
    args["database"] = process.env.DATABASE_NAME || "classicmodels";
    args["apiPrefix"] = apiPrefix;

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

  it("GET " + apiPrefix + "tables should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "tables") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(8);

        return done();
      });
  });

  it("GET " + apiPrefix + "payments/count should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "payments/count") // api url
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

  it(
    "GET " + apiPrefix + "offices/distinct?_fields=country should PASS",
    function(done) {
      //http get an url
      agent
        .get(apiPrefix + "offices/distinct?_fields=country") // api url
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/tables error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equal(5);

          return done();
        });
    }
  );

  it("GET " + apiPrefix + "customers/describe should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "customers/describe") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(13);

        return done();
      });
  });

  it("GET " + apiPrefix + "payments/103___JM555205 should PASS", function(
    done
  ) {
    //http get an url
    agent
      .get(apiPrefix + "payments/103___JM555205") // api url
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

  it("GET " + apiPrefix + "customers should PASS", function(done) {
    //testcase

    //http get an url
    agent
      .get(apiPrefix + "customers") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/customers error
        if (err) {
          return done(err);
        }

        res.body.should.be.instanceOf(Array);
        res.body.length.should.be.greaterThan(0);

        //validate response
        return done();
      });
  });

  it("GET " + apiPrefix + "customers/103 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "customers/103") // api url
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

  it("GET " + apiPrefix + "payments?_p=2 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "payments?_p=2") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array);
        res.body.length.should.be.equal(20);

        return done();
      });
  });

  it("GET " + apiPrefix + "customers should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "customers") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(20);

        return done();
      });
  });

  it("GET " + apiPrefix + "customers?_size=100 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "customers?_size=100") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(100);

        return done();
      });
  });

  it("GET " + apiPrefix + "customers?_size=1000 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "customers?_size=1000") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(100);

        return done();
      });
  });

  it("GET " + apiPrefix + "customers?_size=-1 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "customers?_size=-1") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(20);

        return done();
      });
  });

  it("GET " + apiPrefix + "payments?_p=2&_size=10 should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "payments?_p=2&_size=10") // api url
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
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array);
        res.body[0]["city"].should.be.equal("Boston");

        return done();
      });
  });

  it(
    "GET " + apiPrefix + "offices?_fields=officeCode,city should PASS",
    function(done) {
      //http get an url
      agent
        .get(apiPrefix + "offices?_fields=officeCode,city") // api url
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
    "GET " + apiPrefix + "offices?_fields=officeCode,ity should PASS",
    function(done) {
      //http get an url
      agent
        .get(apiPrefix + "offices?_fields=officeCode,ity") // api url
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/offices/1/employees error
          if (err) {
            return done(err);
          }

          //validate resonse
          res.body.should.be.instanceOf(Array);

          // ity in _fields is an in valid column and it should be ignored
          Object.keys(res.body[0]).length.should.be.equal(1);

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
      "offices?_where=(((officeCode,in,1,2))~and(city,eq,boston)) should PASS",
    function(done) {
      //http get an url
      agent
        .get(
          apiPrefix +
            "offices?_where=(((officeCode,in,1,2))~and(city,eq,boston))"
        ) // api url
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/offices/1/employees error
          if (err) {
            return done(err);
          }

          // tate is an invalid column but still it should query right number of columns
          res.body.length.should.be.equal(1);
          res.body[0]["city"].should.be.equal("Boston");

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices?_fields=-territory,-addressLine2,-state,-tate should PASS",
    function(done) {
      //http get an url
      agent
        .get(apiPrefix + "offices?_fields=-territory,-addressLine2,-state") // api url
        .expect(200) // 2xx for success and 4xx for failure
        .end(function(err, res) {
          // Handle /api/offices/1/employees error
          if (err) {
            return done(err);
          }

          //validate resonse
          res.body.should.be.instanceOf(Array);

          // tate is an invalid column but still it should query right number of columns
          Object.keys(res.body[0]).length.should.be.equal(6);

          return done();
        });
    }
  );

  it("GET " + apiPrefix + "offices?_sort=-city should PASS", function(done) {
    //http get an url
    agent
      .get(apiPrefix + "offices?_sort=-city") // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function(err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array);
        res.body[0]["city"].should.be.equal("Tokyo");

        return done();
      });
  });

  // it('GET ' + apiPrefix + 'offices?_sort=-city,ity,-ity should PASS', function (done) {
  //
  //   //http get an url
  //   agent.get(apiPrefix + 'offices?_sort=-city,ity,-ity')      // api url
  //     .expect(200) // 2xx for success and 4xx for failure
  //     .end(function (err, res) {
  //       // Handle /api/offices/1/employees error
  //       if (err) {
  //         return done(err);
  //       }
  //
  //       //validate resonse
  //       res.body.should.be.instanceOf(Array)
  //
  //       // ity is an invalid sort element and should be ignored
  //       res.body[0]['city'].should.be.equal('Tokyo')
  //
  //       return done();
  //     });
  //
  // });

  it("POST /api/productlines should PASS", function(done) {
    var obj = {};

    obj["productLine"] = "Hyperloop";
    obj["textDescription"] =
      'Hyperloop is essentially a train system that Musk calls "a cross between ' +
      'a Concorde, a railgun, and an air hockey table". ' +
      "It's based on the very high-speed transit (VHST) system proposed in 1972," +
      "which combines a magnetic levitation train and a low pressure transit tube." +
      "It evolves some of the original ideas of VHST, but it still uses tunnels" +
      "and pods or capsules to move from place to place.";

    //post to an url with data
    agent
      .post(apiPrefix + "productlines") //enter url
      .send(obj) //postdata
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response

        res.body["affectedRows"].should.be.equals(1);

        return done();
      });
  });

  it("POST /api/productlines/bulk should PASS", function(done) {
    var objArray = [];

    var obj = {};
    obj["productLine"] = "Bulletrain";
    obj["textDescription"] = "Japan";

    var obj1 = {};
    obj1["productLine"] = "Bulletrain_1";
    obj1["textDescription"] = "China";

    objArray.push(obj);
    objArray.push(obj1);

    //post to an url with data
    agent
      .post(apiPrefix + "productlines/bulk") //enter url
      .send(objArray) //postdata
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response

        res.body["affectedRows"].should.be.equals(2);

        return done();
      });
  });

  it("POST /api/productlines/bulk should PASS", function(done) {
    var objArray = [];

    var obj = {};
    obj["productLine"] = "Bulletrain_2";

    var obj1 = {};
    obj1["productLine"] = "Bulletrain_3";

    objArray.push(obj);
    objArray.push(obj1);

    //post to an url with data
    agent
      .post(apiPrefix + "productlines/bulk") //enter url
      .send(objArray) //postdata
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response

        res.body["affectedRows"].should.be.equals(2);

        return done();
      });
  });

  it("GET " + apiPrefix + "productlines/bulk should PASS", function(done) {
    //post to an url with data
    agent
      .get(
        apiPrefix +
          "productlines/bulk?_ids=Bulletrain,Bulletrain_1,Bulletrain_2,Bulletrain_3"
      ) //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response

        res.body.length.should.be.equals(4);

        return done();
      });
  });

  it("DELETE /api/productlines/bulk should PASS", function(done) {
    //post to an url with data
    agent
      .del(
        apiPrefix +
          "productlines/bulk?_ids=Bulletrain,Bulletrain_1,Bulletrain_2,Bulletrain_3"
      ) //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response

        res.body["affectedRows"].should.be.equals(4);

        return done();
      });
  });

  it("PUT /api/productlines should PASS", function(done) {
    var obj = {};

    obj["productLine"] = "Hyperloop";
    obj["textDescription"] =
      'Hyperloop is essentially a train system that ElonMusk calls "a cross between ' +
      'a Concorde, a railgun, and an air hockey table". ' +
      "It's based on the very high-speed transit (VHST) system proposed in 1972," +
      "which combines a magnetic levitation train and a low pressure transit tube." +
      "It evolves some of the original ideas of VHST, but it still uses tunnels" +
      "and pods or capsules to move from place to place.";

    //post to an url with data
    agent
      .put(apiPrefix + "productlines") //enter url
      .send(obj) //postdata
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body["affectedRows"].should.be.equals(2);

        return done();
      });
  });

  if (args["host"] === "localhost") {
    it("POST /dynamic should PASS", function(done) {
      var obj = {};

      obj["query"] = "select * from ?? limit 0,5";
      obj["params"] = ["customers"];

      //post to an url with data
      agent
        .post("/dynamic") //enter url
        .send(obj) //postdata
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(5);

          return done();
        });
    });

    it("POST /dynamic/abc should PASS", function(done) {
      var obj = {};

      obj["query"] = "select * from ?? limit 0,5";
      obj["params"] = ["customers"];

      //post to an url with data
      agent
        .post("/dynamic") //enter url
        .send(obj) //postdata
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response

          res.body.length.should.be.equals(5);

          return done();
        });
    });

    it("POST /dynamic should PASS", function(done) {
      var obj = {};

      obj["query"] = "select * from customers limit 0,5";
      obj["params"] = [];

      //post to an url with data
      agent
        .post("/dynamic") //enter url
        .send(obj) //postdata
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response

          res.body.length.should.be.equals(5);

          return done();
        });
    });
  }

  it("PATCH /api/productlines/Hyperloop should PASS", function(done) {
    var obj = {};

    obj["textDescription"] =
      'Hyperloop is essentially a train system that Elon Musk (https://twitter.com/elonmusk) calls "a cross between ' +
      'a Concorde, a railgun, and an air hockey table". ' +
      "It's based on the very high-speed transit (VHST) system proposed in 1972," +
      "which combines a magnetic levitation train and a low pressure transit tube." +
      "It evolves some of the original ideas of VHST, but it still uses tunnels" +
      "and pods or capsules to move from place to place.";

    //post to an url with data
    agent
      .patch(apiPrefix + "productlines/Hyperloop") //enter url
      .send(obj) //postdata
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body["affectedRows"].should.be.equals(1);

        return done();
      });
  });

  it("DELETE /api/customers/:id should PASS", function(done) {
    var obj = {};

    //post to an url with data
    agent
      .del(apiPrefix + "productlines/Hyperloop") //enter url
      .send(obj) //postdata
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body["affectedRows"].should.be.equals(1);

        return done();
      });
  });

  it("GET " + apiPrefix + "offices/1/employees should PASS", function(done) {
    //post to an url with data
    agent
      .get(apiPrefix + "offices/1/employees") //enter url
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

  it(
    "GET " +
      apiPrefix +
      "offices/1/employees?_where=(jobTitle,eq,Sales%20Rep) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices/1/employees?_where=(jobTitle,eq,Sales%20Rep)") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(2);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments?_where=(amount,gte,1000)~and(customerNumber,lte,120) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments?_where=(amount,gte,1000)~and(customerNumber,lte,120)"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(13);

          return done();
        });
    }
  );

  // SOMETHING WEIRD HERE
  //        test in travis show 7 but on local machine result has 6 elements
  // it('GET ' + apiPrefix + 'productlines?_where=(htmlDescription,is,null) should PASS', function (done) {
  //
  //   //post to an url with data
  //   agent.get(apiPrefix + 'productlines?_where=(htmlDescription,is,null)')     //enter url
  //     .expect(200)//200 for success 4xx for failure
  //     .end(function (err, res) {
  //       // Handle /api/v error
  //       if (err) {
  //         return done(err);
  //       }
  //
  //       //validate response
  //       res.body.length.should.be.equals(6)
  //
  //       return done();
  //
  //     });
  // });

  it(
    "GET " + apiPrefix + "offices?_where=(city,like,~on~) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices?_where=(city,like,~on~)") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(2);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices?_where=(city,like,san~) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices?_where=(city,like,san~)") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(1);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices?_where=(country,nlike,us~) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices?_where=(country,nlike,us~)") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(4);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments?_where=(amount,gte,1000)&_sort=-amount should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "payments?_where=(amount,gte,1000)&_sort=-amount") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0].amount.should.be.equals(120166.58);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments?_where=(checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments?_where=(checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933)"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(2);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments?_where=((checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933)) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments?_where=((checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933))"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(2);

          return done();
        });
    }
  );

  it("GET " + apiPrefix + "employees/1002/employees should PASS", function(
    done
  ) {
    //post to an url with data
    agent
      .get(apiPrefix + "employees/1002/employees") //enter url
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

  it("GET " + apiPrefix + "productlines/trains/products should PASS", function(
    done
  ) {
    //post to an url with data
    agent
      .get(apiPrefix + "productlines/trains/products") //enter url
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

  it("GET " + apiPrefix + "productlines/trains/products should PASS", function(
    done
  ) {
    //post to an url with data
    agent
      .get(apiPrefix + "productlines/trains/products") //enter url
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

  it("GET " + apiPrefix + "employees/1165/customers should PASS", function(
    done
  ) {
    //post to an url with data
    agent
      .get(apiPrefix + "employees/1165/customers") //enter url
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

  it("GET " + apiPrefix + "customers/103/orders should PASS", function(done) {
    //post to an url with data
    agent
      .get(apiPrefix + "customers/103/orders") //enter url
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

  it(
    "GET " + apiPrefix + "products/S10_1678/orderdetails should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "products/S10_1678/orderdetails") //enter url
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
    }
  );

  it("GET " + apiPrefix + "customers/103/payments should PASS", function(done) {
    //post to an url with data
    agent
      .get(apiPrefix + "customers/103/payments") //enter url
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

  it(
    "GET " +
      apiPrefix +
      "customers/groupby?_fields=city&_sort=city should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "customers/groupby?_fields=city&_sort=city") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["city"].should.be.equals("Aachen");
          res.body.length.should.be.equals(95);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices/ugroupby?_fields=country should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices/ugroupby?_fields=country") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          Object.keys(res.body).length.should.be.equals(1);
          res.body["country"].length.should.be.equals(5);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices/ugroupby?_fields=country,city,state should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices/ugroupby?_fields=country,city,state") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          //res.body.length.should.be.equals(3)
          Object.keys(res.body).length.should.be.equals(3);
          res.body["country"].length.should.be.equals(5);
          res.body["city"].length.should.be.equals(7);
          res.body["state"].length.should.be.equals(5);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices/ugroupby?_fields=country,city should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices/ugroupby?_fields=country,city") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          Object.keys(res.body).length.should.be.equals(2);
          res.body["country"].length.should.be.equals(5);
          res.body["city"].length.should.be.equals(7);

          return done();
        });
    }
  );

  it("GET " + apiPrefix + "offices/ugroupby?_fields= should PASS", function(
    done
  ) {
    //post to an url with data
    agent
      .get(apiPrefix + "offices/ugroupby?_fields=") //enter url
      .expect(400) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        Object.keys(res.body).length.should.be.equals(1);

        return done();
      });
  });

  it("GET " + apiPrefix + "payments/chart?_fields=amount should PASS", function(
    done
  ) {
    //post to an url with data
    agent
      .get(apiPrefix + "payments/chart?_fields=amount") //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        res.body.length.should.be.equals(7);
        res.body[0]["_count"].should.be.equals(45);
        res.body[2]["_count"].should.be.equals(109);
        res.body[6]["_count"].should.be.equals(2);

        return done();
      });
  });

  it(
    "GET " +
      apiPrefix +
      "payments/chart?_fields=amount&min=0&max=131000&step=25000 should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments/chart?_fields=amount&min=0&max=131000&step=25000"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          res.body.length.should.be.equals(5);
          res.body[0]["_count"].should.be.equals(107);
          res.body[1]["_count"].should.be.equals(124);

          return done();
        });
    }
  );

  it("GET " + apiPrefix + "payments/autochart should PASS", function(done) {
    //post to an url with data
    agent
      .get(apiPrefix + "payments/autochart") //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        res.body[0]["chart"].length.should.be.equals(7);
        res.body[0]["chart"][0]["_count"].should.be.equals(45);
        res.body[0]["chart"][6]["_count"].should.be.equals(2);

        return done();
      });
  });

  it(
    "GET " + apiPrefix + "payments?_where=(amount,bw,1000,5000) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "payments?_where=(amount,bw,1000,5000)") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          res.body.length.should.be.equals(19);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments/chart?_fields=amount&min=0&max=131000&step=25000&range=1 should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments/chart?_fields=amount&min=0&max=131000&step=25000&range=1"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          res.body.length.should.be.equals(5);
          res.body[4]["_count"].should.be.equals(273);
          res.body[1]["_count"].should.be.equals(231);
          res.body[0]["_count"].should.be.equals(107);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments/chart?_fields=amount&steparray=0,50000,100000,140000 should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments/chart?_fields=amount&steparray=0,50000,100000,140000"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          res.body.length.should.be.equals(3);
          res.body[0]["_count"].should.be.equals(231);
          res.body[1]["_count"].should.be.equals(37);
          res.body[2]["_count"].should.be.equals(5);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments/chart?_fields=amount&steparray=0,50000,100000,140000&range=1 should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments/chart?_fields=amount&steparray=0,50000,100000,140000&range=1"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          res.body.length.should.be.equals(3);
          res.body[0]["_count"].should.be.equals(231);
          res.body[1]["_count"].should.be.equals(268);
          res.body[2]["_count"].should.be.equals(273);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "payments/chart?_fields=amount&range=1 should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "payments/chart?_fields=amount&range=1") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          res.body.length.should.be.equals(7);
          res.body[0]["_count"].should.be.equals(45);
          res.body[6]["_count"].should.be.equals(273);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices/1/employees?_groupby=jobTitle&_having=(_count,gt,1) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "offices/1/employees?_groupby=jobTitle&_having=(_count,gt,1)"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["_count"].should.be.equals(2);
          res.body.length.should.be.equals(1);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices/1/employees?_groupby=jobTitle should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices/1/employees?_groupby=jobTitle") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["jobTitle"].should.be.equals("President");
          res.body.length.should.be.equals(5);

          return done();
        });
    }
  );

  it("GET " + apiPrefix + "offices?_groupby=country should PASS", function(
    done
  ) {
    //post to an url with data
    agent
      .get(apiPrefix + "offices?_groupby=country") //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body[0]["country"].should.be.equals("Australia");
        res.body.length.should.be.equals(5);

        return done();
      });
  });

  it(
    "GET " + apiPrefix + "offices?_groupby=country&_sort=country should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices?_groupby=country&_sort=-country") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["country"].should.be.equals("USA");

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices?_groupby=country&_sort=_count should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices?_groupby=country&_sort=_count") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["_count"].should.be.equals(1);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices?_groupby=country&_sort=-_count should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices?_groupby=country&_sort=-_count") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["country"].should.be.equals("USA");

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices/groupby?_fields=country&_having=(_count,gt,1) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix + "offices/groupby?_fields=country&_having=(_count,gt,1)"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["country"].should.be.equals("USA");

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices?_groupby=country&_having=(_count,gt,1) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices?_groupby=country&_having=(_count,gt,1)") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["_count"].should.be.equals(3);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "offices/groupby?_fields=country should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "offices/groupby?_fields=country") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["country"].should.be.equals("USA");
          res.body.length.should.be.equals(5);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "offices/groupby?_fields=country,city&_sort=city,country should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix + "offices/groupby?_fields=country,city&_sort=city,country"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["country"].should.be.equals("USA");
          res.body[0]["city"].should.be.equals("Boston");
          res.body.length.should.be.equals(7);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "orders/aggregate?_fields=orderNumber,customerNumber should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "orders/aggregate?_fields=orderNumber,customerNumber") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["min_of_orderNumber"].should.be.equals(10100);
          res.body[0]["max_of_orderNumber"].should.be.equals(10425);
          res.body[0]["sum_of_orderNumber"].should.be.equals(3345575);
          Object.keys(res.body[0]).length.should.be.equals(12);

          return done();
        });
    }
  );

  it("GET " + apiPrefix + "orders/aggregate should FAIL", function(done) {
    //post to an url with data
    agent
      .get(apiPrefix + "orders/aggregate") //enter url
      .expect(400) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error

        done(err);
      });
  });

  it("GET " + apiPrefix + "orders/groupby should FAIL", function(done) {
    //post to an url with data
    agent
      .get(apiPrefix + "orders/groupby") //enter url
      .expect(400) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        done(err);
      });
  });

  it(
    "GET " +
      apiPrefix +
      "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)"
        ) //enter url
        .expect(400) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.productline,pr.productName should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.productline,pr.productName"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          Object.keys(res.body[0]).length.should.be.equals(2);
          res.body.length.should.be.equals(20);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl_productline,pr.productName should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl_productline,pr.productName"
        ) //enter url
        .expect(400) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.productline,pr.productName&_size=2 should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.productline,pr.productName&_size=2"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          Object.keys(res.body[0]).length.should.be.equals(2);
          res.body.length.should.be.equals(2);

          return done();
        });
    }
  );

  it(
    "GET " + apiPrefix + "payments/count?_where=(amount,gt,19000) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(apiPrefix + "payments/count?_where=(amount,gt,19000)") //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body[0]["no_of_rows"].should.be.equals(196);

          return done();
        });
    }
  );

  it(
    "GET " +
      apiPrefix +
      "payments/chart?_fields=amount&steppair=0,50000,40000,100000 should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "payments/chart?_fields=amount&steppair=0,50000,40000,100000"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(2);
          res.body[0]["_count"].should.be.equals(231);
          res.body[1]["_count"].should.be.equals(80);

          return done();
        });
    }
  );

  // it('GET ' + apiPrefix + 'xjoin?_join=pl.productlines,_j,pr.products,_j,ord.orderDetails&_on1=(pl.productline,eq,pr.productline)&_on2=(pr.productcode,eq,ord.productcode) should PASS', function (done) {
  //
  //   //post to an url with data
  //   agent.get(apiPrefix + 'xjoin?_join=pl.productlines,_j,pr.products,_j,ord.orderDetails&_on1=(pl.productline,eq,pr.productline)&_on2=(pr.productcode,eq,ord.productcode)')     //enter url
  //     .expect(200)//200 for success 4xx for failure
  //     .end(function (err, res) {
  //
  //       // Handle /api/v error
  //       if (err) {
  //         return done(err);
  //       }
  //
  //       //validate response
  //       Object.keys(res.body[0]).length.should.be.equals(16)
  //       res.body.length.should.be.equals(20)
  //
  //       return done();
  //
  //     });
  // });

  it(
    "GET " +
      apiPrefix +
      "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.productline,pr.productName&_size=2&_where=(productName,like,1972~) should PASS",
    function(done) {
      //post to an url with data
      agent
        .get(
          apiPrefix +
            "xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.productline,pr.productName&_size=2&_where=(productName,like,1972~)"
        ) //enter url
        .expect(200) //200 for success 4xx for failure
        .end(function(err, res) {
          // Handle /api/v error
          if (err) {
            return done(err);
          }

          //validate response
          res.body.length.should.be.equals(1);

          return done();
        });
    }
  );

  it("/_health should PASS", function(done) {
    //post to an url with data
    agent
      .get("/_health") //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        res.body["process_uptime"].should.be.greaterThanOrEqual(0);
        res.body["mysql_uptime"].should.be.greaterThanOrEqual(0);

        return done();
      });
  });

  it("/_health?details=1 should PASS", function(done) {
    //post to an url with data
    agent
      .get("/_health?details=1") //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        res.body["process_uptime"].should.be.greaterThanOrEqual(0);
        res.body["mysql_uptime"].should.be.greaterThanOrEqual(0);
        res.body["os_total_memory"].should.be.greaterThanOrEqual(0);

        return done();
      });
  });

  it("/_version should PASS", function(done) {
    //post to an url with data
    agent
      .get("/_version") //enter url
      .expect(200) //200 for success 4xx for failure
      .end(function(err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        res.body["Xmysql"].should.equals(version);
        res.body["mysql"].should.not.equals("");
        res.body["node"].should.not.equals("");

        return done();
      });
  });

  it("where clause unit ?_where=(abc,eq,1234) should PASS", function(done) {
    var err = whereClause.getConditionClause("(abc,eq,1234)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??=?)");
    err.params[0].should.be.equal("abc");
    err.params[1].should.be.equal("1234");

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,ne,1234) should PASS", function(done) {
    var err = whereClause.getConditionClause("(abc,ne,1234)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??!=?)");
    err.params[0].should.be.equal("abc");
    err.params[1].should.be.equal("1234");

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,lt,1234) should PASS", function(done) {
    var err = whereClause.getConditionClause("(abc,lt,1234)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??<?)");
    err.params[0].should.be.equal("abc");
    err.params[1].should.be.equal("1234");

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,lte,1234) should PASS", function(done) {
    var err = whereClause.getConditionClause("(abc,lte,1234)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??<=?)");
    err.params[0].should.be.equal("abc");
    err.params[1].should.be.equal("1234");

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,gt,1234) should PASS", function(done) {
    var err = whereClause.getConditionClause("(abc,gt,1234)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??>?)");
    err.params[0].should.be.equal("abc");
    err.params[1].should.be.equal("1234");

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,gte,1234) should PASS", function(done) {
    var err = whereClause.getConditionClause("(abc,gte,1234)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??>=?)");
    err.params[0].should.be.equal("abc");
    err.params[1].should.be.equal("1234");

    done();

    //console.log(query,params,err);
  });

  // it('where clause unit ?_where=(abc,like,1234) should PASS', function (done) {
  //
  //   var query = ''
  //   var params = []
  //   var err = whereClause.getConditionClause('(abc,like,1234)')
  //
  //   err.err.should.be.equal(0)
  //   err.query.should.be.equal('(?? like ?)')
  //   err.params[0].should.be.equal('abc')
  //   err.params[1].should.be.equal('1234')
  //
  //   done()
  //
  //   //console.log(query,params,err);
  //
  // });
  //
  //
  // it('where clause unit ?_where=(abc,nlike,1234) should PASS', function (done) {
  //
  //   var query = ''
  //   var params = []
  //   var err = whereClause.getConditionClause('(abc,nlike,1234)')
  //
  //   err.err.should.be.equal(0)
  //   err.query.should.be.equal('(?? not like ?)')
  //   err.params[0].should.be.equal('abc')
  //   err.params[1].should.be.equal('1234')
  //
  //   done()
  //
  //   //console.log(query,params,err);
  //
  // });

  it("where clause unit ?_where=abc,eq,1234) should FAIL", function(done) {
    var err = whereClause.getConditionClause("abc,eq,1234)");

    err.err.should.be.equal(1);
    err.query.should.be.equal("");
    err.params.length.should.be.equal(0);

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,eq,1234 should FAIL", function(done) {
    var err = whereClause.getConditionClause("(abc,eq,1234");

    err.err.should.be.equal(1);
    err.query.should.be.equal("");
    err.params.length.should.be.equal(0);

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,eq1234) should FAIL", function(done) {
    var err = whereClause.getConditionClause("(abc,eq1234)");

    err.err.should.be.equal(1);
    err.query.should.be.equal("");
    err.params.length.should.be.equal(0);

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abceq,1234) should FAIL", function(done) {
    var err = whereClause.getConditionClause("(abceq,1234)");

    err.err.should.be.equal(1);
    err.query.should.be.equal("");
    err.params.length.should.be.equal(0);

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(1,eq,1)(1,eq,2)~or should FAIL", function(done) {
    var err = whereClause.getConditionClause("(1,eq,1)(1,eq,2)~or");

    err.err.should.be.equal(1);
    err.query.should.be.equal("");
    err.params.length.should.be.equal(0);

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(1,eq,1)~or~or(1,eq,2)(1,eq,2) should FAIL", function(done) {
    var err = whereClause.getConditionClause("(1,eq,1)~or~or(1,eq,2)(1,eq,2)");

    err.err.should.be.equal(1);
    err.query.should.be.equal("");
    err.params.length.should.be.equal(0);

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=(abc,eq,1)~or(b,eq,2) should PASS", function(done) {
    var err = whereClause.getConditionClause("(abc,eq,1)~or(b,eq,2)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??=?)or(??=?)");
    err.params.length.should.be.equal(4);
    err.params[0].should.be.equal("abc");
    err.params[1].should.be.equal("1");
    err.params[2].should.be.equal("b");
    err.params[3].should.be.equal("2");

    // err.params[1].should.be.equal('1234')

    done();

    //console.log(query,params,err);
  });

  it("where clause unit ?_where=((a,eq,1)~and(b,eq,2))~or(c,eq,3) should PASS", function(done) {
    var err = whereClause.getConditionClause(
      "((abc,eq,1234)~and(b,eq,2))~or(cde,eq,3)"
    );

    err.err.should.be.equal(0);
    err.query.should.be.equal("((??=?)and(??=?))or(??=?)");
    err.params.length.should.be.equal(6);

    err.params[0].should.be.equal("abc");
    err.params[2].should.be.equal("b");
    err.params[4].should.be.equal("cde");

    err.params[1].should.be.equal("1234");
    err.params[3].should.be.equal("2");
    err.params[5].should.be.equal("3");

    done();
  });

  it("where clause unit ?_where=((a,eq,1)~and(b,eq,2))~xor(c,eq,3) should PASS", function(done) {
    var err = whereClause.getConditionClause(
      "((abc,eq,1234)~and(b,eq,2))~xor(cde,eq,3)"
    );

    err.err.should.be.equal(0);
    err.query.should.be.equal("((??=?)and(??=?))xor(??=?)");
    err.params.length.should.be.equal(6);

    err.params[0].should.be.equal("abc");
    err.params[2].should.be.equal("b");
    err.params[4].should.be.equal("cde");

    err.params[1].should.be.equal("1234");
    err.params[3].should.be.equal("2");
    err.params[5].should.be.equal("3");

    done();
  });

  it("where clause unit ?_where=(a,eq,1)~and((b,eq,2)~or(c,eq,3)) should PASS", function(done) {
    var err = whereClause.getConditionClause(
      "(a,eq,1)~and((b,eq,2)~or(c,eq,3))"
    );

    //console.log(query,params);

    err.err.should.be.equal(0);
    err.query.should.be.equal("(??=?)and((??=?)or(??=?))");
    err.params.length.should.be.equal(6);

    err.params[0].should.be.equal("a");
    err.params[2].should.be.equal("b");
    err.params[4].should.be.equal("c");

    err.params[1].should.be.equal("1");
    err.params[3].should.be.equal("2");
    err.params[5].should.be.equal("3");

    done();
  });

  it("where clause unit ?_where=(a,in,1,2,3) should PASS", function(done) {
    var err = whereClause.getConditionClause("(a,in,1,2,3)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(?? in (?,?,?))");

    done();
  });

  it("where clause unit ?_where=(a,like,~1234) should PASS", function(done) {
    var err = whereClause.getConditionClause("(a,like,~1234)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(?? like ?)");
    err.params[0].should.be.equal("a");
    err.params[1].should.be.equal("%1234");

    done();
  });

  it("where clause unit ?_where=(a,like,~1234~) should PASS", function(done) {
    var err = whereClause.getConditionClause("(a,like,~1234~)");

    err.err.should.be.equal(0);
    err.query.should.be.equal("(?? like ?)");
    err.params[0].should.be.equal("a");
    err.params[1].should.be.equal("%1234%");

    done();
  });

  it("where clause unit ?_where=(a,is,null)~and(b,is,true)~and(c,is,false) should PASS", function(done) {
    var err = whereClause.getConditionClause(
      "(a,is,null)~and(b,is,true)~and(c,is,false)"
    );

    err.err.should.be.equal(0);
    err.query.should.be.equal("(?? is ?)and(?? is ?)and(?? is ?)");
    //err.params[1].should.be.equal(null)
    err.params[3].should.be.equal(true);
    err.params[5].should.be.equal(false);

    done();
  });
});
