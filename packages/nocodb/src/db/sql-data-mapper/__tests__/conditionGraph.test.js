var should = require('chai').should();
var expect = require('chai').expect;
var knex = require('../build/main/lib/sql/CustomKnex').default({
  "client": "mysql",
  "connection": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "password",
    "database": "sakila"
  }
});
// const knexMeta = require('../build/main/lib/sql/CustomKnex').default({
//   "client": "sqlite3",
//   "connection": {
//     "filename": 'xc.db'
//   }
// });

const meta = require('./meta');
[ {
  condition: {"city": {"relationType": "hm", "city_id": {"eq": "1"}}},
  expect: 'select * from `country` inner join `city` as `city1` on `city1`.`country_id` = `country`.`country_id` where `city1`.`city_id` = \'1\''
}, {
  condition: {"city": {"relationType": "hm", "address": {"relationType": "hm", "address_id": {"eq": "1"}}}},
  expect: 'select * from `country` inner join `city` as `city1` on `city1`.`country_id` = `country`.`country_id` inner join `address` as `address1` on `address1`.`city_id` = `city1`.`city_id` where `address1`.`address_id` = \'1\''
}, {
  condition: {"_and": [{"country": {"eq": "abc"}}, {"city": {"relationType": "hm", "city_id": {"eq": "1"}}}]},
  expect: 'select * from `country` inner join `city` as `city1` on `city1`.`country_id` = `country`.`country_id` where ((`country`.`country` = \'abc\') and (`city1`.`city_id` = \'1\'))'
}, {
  condition: {
    "_and": [{
      "city": {
        "relationType": "hm",
        "_and": [{"address": {"relationType": "hm", "address_id": {"eq": "1"}}}]
      }
    }]
  },
  expect: 'select * from `country` inner join `city` as `city1` on `city1`.`country_id` = `country`.`country_id` inner join `address` as `address1` on `address1`.`city_id` = `city1`.`city_id` where ((((`address1`.`address_id` = \'1\'))))'
}, {
  condition: {
    "_and": [{
      "city": {
        "relationType": "hm",
        "_and": [{
          "_not": {
            "address": {
              "relationType": "hm",
              "staff": {"relationType": "hm", "address": {"relationType": "bt", "district": {"eq": "aaa"}}}
            }
          }
        }]
      }
    }]
  },
  expect: 'select * from `country` inner join `city` as `city1` on `city1`.`country_id` = `country`.`country_id` inner join `address` as `address1` on `address1`.`city_id` = `city1`.`city_id` inner join `staff` as `staff1` on `staff1`.`address_id` = `address1`.`address_id` inner join `address` as `address2` on `staff1`.`address_id` = `address2`.`address_id` where ((((not (`address2`.`district` = \'aaa\')))))'
}, {
  condition: {"_and": [{"city": {"relationType": "hm", "city_id": {"eq": "1"}}}, {"country_id": {"gt": "1"}}]},
  expect: 'select * from `country` inner join `city` as `city1` on `city1`.`country_id` = `country`.`country_id` where ((`city1`.`city_id` = \'1\') and (`country`.`country_id` > \'1\'))'
}, {
  condition: {
    "city": {
      "relationType": "hm",
      "address": {"relationType": "hm", "city": {"relationType": "bt", "city_id": {"eq": "1"}}},
      "country_id": {"eq": "1"},
      "country": {
        "relationType": "bt",
        "city": {"relationType": "hm", "address": {"relationType": "hm", "address": {"eq": "nn"}}}
      }
    }
  },
  expect: 'select * from `country` inner join `city` as `city1` on `city1`.`country_id` = `country`.`country_id` where ((`city1`.`city_id` = \'1\') and (`country`.`country_id` > \'1\'))'
}, {
  expect: 'select'
  ,
  table: 'city',
  condition: {
    "_and": [{"city": {"eq": "abc"}}, {"address": {"relationType": "hm", "address_id": {"eq": "1"}}}],
    "city": {"eq": "abc1"}
  }
}]
  .forEach(({condition, expect: expectVal, table}, i) => {
    knex(table || 'country').conditionGraph({condition, models: meta}).then(res =>{
      console.log(JSON.stringify(condition,0,2));
    console.log(res)}).catch(e => {
      console.log( e)
    })
    // it(`Nested condition ` + i, function (done) {
    //
    //   const query = knex(table || 'country').conditionGraph({condition, models: meta}).toQuery();
    //   knex(table || 'country').conditionGraph({condition, models: meta}).then(res => console.log(res)).catch(e => {
    //   })
    //   query.should.be.equal(expectVal);
    //   done();
    // });
  });

