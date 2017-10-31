'use strict';

var bodyParser = require('body-parser')
var express = require('express')
var mysql = require('mysql')
var Xapi = require('../lib/xapi.js')
var should = require('should');

var request = require('supertest')

var args = {}
var app = {}
var agent = {}
var api = {}
var mysqlPool = {}


args['host'] = 'localhost'
args['user'] = 'root'
args['password'] = 'madurga'
args['database'] = 'classicmodels'


//desribe group of tests done
describe('xmysql : tests', function () {

  before(function (done) {

    mysqlPool = mysql.createPool(args)

    app = express()
    //app.use(morgan('tiny'))
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({
      extended: true
    }))

    agent = request.agent(app);

    api = new Xapi(args, mysqlPool, app)
    api.init(function (err, results) {
      if (err) {
        process.exit(1)
      }
      app.listen(3000)
      done();
    })
  });

  after(function (done) {

    mysqlPool.end(function (err) {
      done();
    })

  });

  beforeEach(function (done) {
    //init common variables for each test
    done();
  });

  afterEach(function (done) {
    //term common variables for each test
    done();
  });

  it('GET /api/tables should PASS', function (done) {

    //http get an url
    agent.get('/api/tables')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(8);

        return done();

      });

  });



  it('GET /api/payments/count should PASS', function (done) {

    //http get an url
    agent.get('/api/payments/count')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body[0]['no_of_rows'].should.be.equal(273);

        return done();

      });

  });


  it('GET /api/customers/describe should PASS', function (done) {

    //http get an url
    agent.get('/api/customers/describe')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.equal(13);

        return done();

      });

  });


  it('GET /api/payments/103___JM555205 should PASS', function (done) {

    //http get an url
    agent.get('/api/payments/103___JM555205')// api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {

        // Handle /api/tables error
        if (err) {
          return done(err);
        }

        //validate response - max value here is 14571.44
        res.body.length.should.be.equal(1);
        res.body[0]['amount'].should.be.greaterThan(14570);

        return done();

      });

  });


  it('GET /api/customers should PASS', function (done) {
    //testcase

    //http get an url
    agent.get('/api/customers') // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/customers error
        if (err) {
          return done(err);
        }

        res.body.should.be.instanceOf(Array)
        res.body.length.should.be.greaterThan(0);

        //validate response
        return done();
      });


  });

  it('GET /api/customers/103 should PASS', function (done) {

    //http get an url
    agent.get('/api/customers/103')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/customers/103 error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.should.be.instanceOf(Object)
        res.body[0]['customerNumber'].should.be.equal(103)

        return done();

      });

  });

  it('GET /api/payments?_p=2 should PASS', function (done) {

    //http get an url
    agent.get('/api/payments?_p=2')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)
        res.body.length.should.be.equal(20)


        return done();

      });

  });


  it('GET /api/payments?_p=2&_size=10 should PASS', function (done) {

    //http get an url
    agent.get('/api/payments?_p=2&_size=10')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)
        res.body.length.should.be.equal(10)


        return done();

      });

  });

  it('GET /api/offices?_sort=city should PASS', function (done) {

    //http get an url
    agent.get('/api/offices?_sort=city')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)
        res.body[0]['city'].should.be.equal('Boston')


        return done();

      });

  });


  it('GET /api/offices?_fields=officeCode,city should PASS', function (done) {

    //http get an url
    agent.get('/api/offices?_fields=officeCode,city')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)
        Object.keys(res.body[0]).length.should.be.equal(2)


        return done();

      });

  });

  it('GET /api/offices?_fields=officeCode,ity should PASS', function (done) {

    //http get an url
    agent.get('/api/offices?_fields=officeCode,ity')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)

        // ity in _fields is an in valid column and it should be ignored
        Object.keys(res.body[0]).length.should.be.equal(1)


        return done();

      });

  });

  it('GET /api/offices?_fields=-territory,-addressLine2,-state should PASS', function (done) {

    //http get an url
    agent.get('/api/offices?_fields=-territory,-addressLine2,-state')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)
        Object.keys(res.body[0]).length.should.be.equal(6)


        return done();

      });

  });

  it('GET /api/offices?_fields=-territory,-addressLine2,-state,-tate should PASS', function (done) {

    //http get an url
    agent.get('/api/offices?_fields=-territory,-addressLine2,-state')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)

        // tate is an invalid column but still it should query right number of columns
        Object.keys(res.body[0]).length.should.be.equal(6)


        return done();

      });

  });

  it('GET /api/offices?_sort=-city should PASS', function (done) {

    //http get an url
    agent.get('/api/offices?_sort=-city')      // api url
      .expect(200) // 2xx for success and 4xx for failure
      .end(function (err, res) {
        // Handle /api/offices/1/employees error
        if (err) {
          return done(err);
        }

        //validate resonse
        res.body.should.be.instanceOf(Array)
        res.body[0]['city'].should.be.equal('Tokyo')

        return done();
      });

  });

  // it('GET /api/offices?_sort=-city,ity,-ity should PASS', function (done) {
  //
  //   //http get an url
  //   agent.get('/api/offices?_sort=-city,ity,-ity')      // api url
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


  it('POST /api/productlines should PASS', function (done) {

    var obj = {};

    obj['productLine'] = 'Hyperloop'
    obj['textDescription'] = 'Hyperloop is essentially a train system that Musk calls \"a cross between ' +
      'a Concorde, a railgun, and an air hockey table\". ' +
      'It\'s based on the very high-speed transit (VHST) system proposed in 1972,' +
      'which combines a magnetic levitation train and a low pressure transit tube.' +
      'It evolves some of the original ideas of VHST, but it still uses tunnels' +
      'and pods or capsules to move from place to place.'

    //post to an url with data
    agent.post('/api/productlines')     //enter url
      .send(obj)         //postdata
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response

        res.body['affectedRows'].should.be.equals(1)

        return done();

      });


  });

  it('PUT /api/customers/:id should PASS', function (done) {

    var obj = {};

    obj['textDescription'] = 'Hyperloop is essentially a train system that Elon Musk (https://twitter.com/elonmusk) calls \"a cross between ' +
      'a Concorde, a railgun, and an air hockey table\". ' +
      'It\'s based on the very high-speed transit (VHST) system proposed in 1972,' +
      'which combines a magnetic levitation train and a low pressure transit tube.' +
      'It evolves some of the original ideas of VHST, but it still uses tunnels' +
      'and pods or capsules to move from place to place.'

    //post to an url with data
    agent.put('/api/productlines/Hyperloop')     //enter url
      .send(obj)         //postdata
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body['affectedRows'].should.be.equals(1)

        return done();

      });


  });

  it('DELETE /api/customers/:id should PASS', function (done) {

    var obj = {};

    //post to an url with data
    agent.del('/api/productlines/Hyperloop')     //enter url
      .send(obj)         //postdata
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body['affectedRows'].should.be.equals(1)

        return done();

      });
  });

  it('GET /api/offices/1/employees should PASS', function (done) {

    //post to an url with data
    agent.get('/api/offices/1/employees')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });

  it('GET /api/employees/1002/employees should PASS', function (done) {

    //post to an url with data
    agent.get('/api/employees/1002/employees')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });


  it('GET /api/productlines/trains/products should PASS', function (done) {

    //post to an url with data
    agent.get('/api/productlines/trains/products')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });


  it('GET /api/productlines/trains/products should PASS', function (done) {

    //post to an url with data
    agent.get('/api/productlines/trains/products')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });

  it('GET /api/employees/1165/customers should PASS', function (done) {

    //post to an url with data
    agent.get('/api/employees/1165/customers')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });

  it('GET /api/customers/103/orders should PASS', function (done) {

    //post to an url with data
    agent.get('/api/customers/103/orders')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });

  it('GET /api/products/S10_1678/orderdetails should PASS', function (done) {

    //post to an url with data
    agent.get('/api/products/S10_1678/orderdetails')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });

  it('GET /api/customers/103/payments should PASS', function (done) {

    //post to an url with data
    agent.get('/api/customers/103/payments')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body.length.should.be.above(1)

        return done();

      });
  });

  it('GET /api/customers/groupby?_fields=city&_sort=city should PASS', function (done) {

    //post to an url with data
    agent.get('/api/customers/groupby?_fields=city&_sort=city')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body[0]['city'].should.be.equals("NYC")
        res.body.length.should.be.equals(95)

        return done();

      });
  });

  it('GET /api/offices/groupby?_fields=country should PASS', function (done) {

    //post to an url with data
    agent.get('/api/offices/groupby?_fields=country')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body[0]['country'].should.be.equals("USA")
        res.body.length.should.be.equals(5)

        return done();

      });
  });


  it('GET /api/offices/groupby?_fields=country,city&sort=city,-country should PASS', function (done) {

    //post to an url with data
    agent.get('/api/offices/groupby?_fields=country,city&sort=city,-country')     //enter url
      .expect(200)//200 for success 4xx for failure
      .end(function (err, res) {
        // Handle /api/v error
        if (err) {
          return done(err);
        }

        //validate response
        res.body[0]['country'].should.be.equals("Australia")
        res.body[0]['city'].should.be.equals("Sydney")
        res.body.length.should.be.equals(7)

        return done();

      });
  });


});
