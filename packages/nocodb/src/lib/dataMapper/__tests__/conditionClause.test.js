var should = require('chai').should();
var expect = require('chai').expect;
var knex = require('../build/main/lib/sql/CustomKnex').default({
  client: 'mysql2'
});
const cstomKnex = require('../build/main/lib/sql/CustomKnex').default;

[{
  condition: {a: {eq: "test"}, _and: [{test: {eq: 1}}]},
  expect: 'select * from `test` where `a` = \'test\' and ((`test` = 1))'
},
  {
    condition: {
      _not: {
        title: {
          eq: '123'
        }
      }
    },
    expect: 'select * from `test` where not (`title` = \'123\')'
  }
]
  .forEach(({condition, expect}, i) => {
    it(`Test case : ${i} - ${JSON.stringify(condition)}`, function (done) {
      const res = knex('test').condition(condition).toQuery();
      console.log(res)

      res.should.be.equal(expect)
      done();
    });
  })

it(`Test`, function (done) {
  const res = knex('test').conditionGraph({
    _not: {
      title: {
        eq: '123'
      }
    }
  }, {}).toQuery();

  res.should.be.equal('select * from `test` where not (`test`.`title` = \'123\')');

  const res1 = knex('test').conditionGraph({
    test1: {
      relationType: "hm",
      test3: {
        relationType: "bt",
        test3Col: {
          eq: "123"
        }
      }
    }
  }, {
    test: {
      hasMany: [{
        "tn": "test1",
        "cn": "test_ref_id",
        "rtn": "test",
        "rcn": "test_id"
      }]
    },
    test1: {
      belongsTo: [{
        "tn": "test1",
        "cn": "test_ref_id",
        "rtn": "test",
        "rcn": "test_id"
      }, {
        "tn": "test1",
        "cn": "test3_ref_id",
        "rtn": "test3",
        "rcn": "test3_id"
      }],
    }
  }).toQuery();

  res1.should.be.equal('select * from `test` inner join `test1` on `test1`.`test_ref_id` = `test`.`test_id` inner join `test3` on `test1`.`test3_ref_id` = `test3`.`test3_id` where `test3`.`test3Col` = \'123\'')
  done();
});


[{
  knex: cstomKnex({
    client: 'mysql2'
  }),
  expectedOp : 'select * from `test` inner join `test1` on `test1`.`test_ref_id` = `test`.`test_id` inner join `test3` on `test1`.`test3_ref_id` = `test3`.`test3_id` where `test3`.`test3Col` = \'123\''
},
{
  knex :cstomKnex({
    client: 'pg'
  }),
  expectedOp :'select * from "test" inner join "test1" on "test1"."test_ref_id" = "test"."test_id" inner join "test3" on "test1"."test3_ref_id" = "test3"."test3_id" where "test3"."test3Col" = \'123\''
},
{
  knex :cstomKnex({
    client: 'mssql'
  }),
  expectedOp: 'select * from [test] inner join [test1] on [test1].[test_ref_id] = [test].[test_id] inner join [test3] on [test1].[test3_ref_id] = [test3].[test3_id] where [test3].[test3Col] = \'123\''
},
{
  knex :cstomKnex({
    client: 'sqlite3'
  }),
  expectedOp: 'select * from `test` inner join `test1` on `test1`.`test_ref_id` = `test`.`test_id` inner join `test3` on `test1`.`test3_ref_id` = `test3`.`test3_id` where `test3`.`test3Col` = \'123\''
},
{
  knex :cstomKnex({
    client: 'oracledb'
  }),
  expectedOp: 'select * from "test" inner join "test1" on "test1"."test_ref_id" = "test"."test_id" inner join "test3" on "test1"."test3_ref_id" = "test3"."test3_id" where "test3"."test3Col" = \'123\''
}].forEach(({knex,expectedOp}) => {


  it(`Nested condition`, function (done) {
    const res = knex('test').conditionGraph({
      condition: {
        test1: {
          // relationType: "hm",
          // test3: {
          //   relationType: "bt",
          //   test3Col: {
          //     eq: "123"
          //   }
          // }
        }
      }
      , models: {
        test: {
          hasManyRelations: [{
            "tn": "test1",
            "cn": "test_ref_id",
            "rtn": "test",
            "rcn": "test_id"
          }]
        },
        test1: {
          belongsToRelations: [{
            "tn": "test1",
            "cn": "test_ref_id",
            "rtn": "test",
            "rcn": "test_id"
          }, {
            "tn": "test1",
            "cn": "test3_ref_id",
            "rtn": "test3",
            "rcn": "test3_id"
          }],
        }
      }
    }).toQuery();

    res.should.be.equal(expectedOp);
    done();
  });
});