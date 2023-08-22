var should = require('chai').should();
var expect =require('chai').expect;
var knex = require('../build/main/lib/sql/CustomKnex').default({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'password',
    database: 'sakila'
  }
});


[
  {
    "query": "((city_id,eq,12)~or(city_id,eq,13)~and(city_id,eq,124))~or(city_id,eq,50)~or((city_id,eq,54)~and(city_id,le,54))~or(city,like,%aba%)~and(city,not,Sorocaba)",
    "valid": true,
    "sqlQuery": "select * from `city` where (`city_id` = '12' or `city_id` = '13' and `city_id` = '124') or `city_id` = '50' or (`city_id` = '54' and `city_id` <= '54') or `city` like '%aba%' and `city` != 'Sorocaba'",
    "message": ""
  },
  {
    "query": "((city_id,eq,12)~or((city_id,eq,13)~or(city_id,eq,13))~and(city_id,eq,124))~or(city_id,eq,50)~or((city_id,eq,54)~and(city_id,le,54))~or(city,like,%aba%)~and(city,not,Sorocaba)",
    "valid": true,
    "sqlQuery": "select * from `city` where (`city_id` = '12' or (`city_id` = '13' or `city_id` = '13') and `city_id` = '124') or `city_id` = '50' or (`city_id` = '54' and `city_id` <= '54') or `city` like '%aba%' and `city` != 'Sorocaba'",
    "message": ""
  },
  {
    "query": "((c,eq,1)~or((c,eq,1)~or(c,eq,1))~and(c,eq,1))~or(c,eq,1)~or((c,eq,1)~or(c,eq,1))~or(city,like,%1%)~and(city,eq,1)",
    "valid": true,
    "sqlQuery": "select * from `city` where (`c` = '1' or (`c` = '1' or `c` = '1') and `c` = '1') or `c` = '1' or (`c` = '1' or `c` = '1') or `city` like '%1%' and `city` = '1'",
    "message": ""
  },
  {
    "query": "~sdsds()",
    "valid": false,
    "sqlQuery": "",
    "message": "~sdsds() : not a valid syntax"
  },
  {
    "query": "(abc,eq,12)",
    "valid": true,
    "sqlQuery": "select * from `city` where `abc` = '12'",
    "message": ""
  },
  {
    "query": "(abc,abc,12)",
    "valid": false,
    "sqlQuery": "",
    "message": "abc : Invalid comparison operator"
  },
  {
    "query": "(abc,eq,12",
    "valid": false,
    "sqlQuery": "",
    "message": "(abc,eq,12 : not a valid syntax"
  },
  {
    "query": "~not((abc,eq,12)",
    "valid": false,
    "sqlQuery": "",
    "message": "~not( : Closing bracket not found"
  },
  {
    "query": "~jashaja(abc,eq,12)",
    "valid": false,
    "sqlQuery": "",
    "message": "jashaja Invalid operation."
  },
  {
    "query": "~not((abc,eq,12))",
    "valid": true,
    "sqlQuery": "select * from `city` where not (`abc` = '12')",
    "message": ""
  },
  {
    "query": "~ja?shaja((abc,eq,12)~or(abc,gt,2))",
    "valid": false,
    "sqlQuery": "",
    "message": "~ja?shaja : not a valid syntax"
  },
  {
    "query": "(abc,is,null)",
    "valid": true,
    "sqlQuery": "select * from `city` where `abc` is null",
    "message": ""
  },
  {
    "query": "(abc,isnot,null)",
    "valid": true,
    "sqlQuery": "select * from `city` where `abc` is not null",
    "message": ""
  },
  {
    "query": "(abc,is,value)",
    "valid": false,
    "sqlQuery": "",
    "message": "value : not a valid value since 'is' & 'isnot' only supports value null"
  },
  {
    "query": "(abc,isnot,123)",
    "valid": false,
    "sqlQuery": "",
    "message": "123 : not a valid value since 'is' & 'isnot' only supports value null"
  },
  {
    "query": "(abc,btw,1)",
    "valid": false,
    "sqlQuery": "",
    "message": "1 : not a valid value. Between requires 2 values"
  },
  {
    "query": "(abc,btw,1,2)",
    "valid": true,
    "sqlQuery": "select * from `city` where `abc` between '1' and '2'",
    "message": ""
  },
  {
    "query": "(abc,btw,1,2,3)",
    "valid": false,
    "sqlQuery": "",
    "message": "1,2,3 : not a valid value. Between accepts only 2 values"
  },
  {
    "query": "(abc,nbtw,1)",
    "valid": false,
    "sqlQuery": "",
    "message": "1 : not a valid value. Between requires 2 values"
  },
  {
    "query": "(abc,nbtw,1,2)",
    "valid": true,
    "sqlQuery": "select * from `city` where `abc` not between '1' and '2'",
    "message": ""
  },
  {
    "query": "(abc,nbtw,1,2,3)",
    "valid": false,
    "sqlQuery": "",
    "message": "1,2,3 : not a valid value. Between accepts only 2 values"
  }
]
.forEach(({query, valid,message,sqlQuery}, i) => {
  it(`Test case : ${i} - ${query}`, function (done) {
    let passed;
    try {
      let queryOutput = knex.table('city').xwhere(query).toQuery();
      passed = true;
      queryOutput.should.be.equal(sqlQuery)
    } catch (e) {
      passed = false;
      // expect(e).to.be.a(Error);
      // console.log(e.message)
      e.message.should.be.equal(message)
    }
    passed.should.be.equal(valid)
    done();
  });
})

