var should = require('chai').should();
var expect = require('chai').expect;
var {BaseModelSql} = require('../build/main/lib/sql/BaseModelSql')

var knex = require('../build/main/lib/sql/CustomKnex').default({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'password',
    database: 'sakila'
  }
});


const meta = {
  "tn": "city",
  "_tn": "City",
  "columns": [{
    "validate": {"func": [], "args": [], "msg": []},
    "cn": "city_id",
    "_cn": "cityId",
    "type": "integer",
    "dt": "smallint",
    "rqd": true,
    "un": true,
    "pk": true,
    "ai": true,
    "dtxp": 5
  }, {
    "validate": {"func": [], "args": [], "msg": []},
    "cn": "city",
    "_cn": "City",
    "type": "string",
    "dt": "varchar",
    "rqd": true,
    "dtxp": 50
  }, {
    "validate": {"func": [], "args": [], "msg": []},
    "cn": "country_id",
    "_cn": "CountryId",
    "type": "integer",
    "dt": "smallint",
    "rqd": true,
    "un": true,
    "dtxp": 5
  }, {
    "validate": {"func": [], "args": [], "msg": []},
    "cn": "last_update",
    "_cn": "lastUpdate",
    "type": "timestamp",
    "dt": "timestamp",
    "rqd": true,
    "default": "CURRENT_TIMESTAMP",
    "columnDefault": "CURRENT_TIMESTAMP"
  }, {
    "validate": {"func": [], "args": [], "msg": []},
    "cn": "title5",
    "_cn": "title5",
    "type": "integer",
    "dt": "int",
    "dtxp": "11"
  }],
  "pks": [],
  "hasMany": [{
    "cstn": "fk_address_city",
    "tn": "address",
    "cn": "city_id",
    "puc": 1,
    "rtn": "city",
    "rcn": "city_id",
    "mo": "NONE",
    "UR": "CASCADE",
    "dr": "RESTRICT",
    "ts": "sakila",
    "enabled": true,
    "cstn": "fk_address_city",
    "tn": "address",
    "cn": "city_id",
    "puc": 1,
    "rtn": "city",
    "rcn": "city_id",
    "mo": "NONE",
    "UR": "CASCADE",
    "dr": "RESTRICT",
    "ts": "sakila"
  }],
  "belongsTo": [{
    "cstn": "FK_08af2eeb576770524fa05e26f39",
    "tn": "city",
    "cn": "country_id",
    "puc": 1,
    "rtn": "country",
    "rcn": "country_id",
    "mo": "NONE",
    "UR": "CASCADE",
    "dr": "RESTRICT",
    "ts": "sakila",
    "enabled": true,
    "cstn": "FK_08af2eeb576770524fa05e26f39",
    "tn": "city",
    "cn": "country_id",
    "puc": 1,
    "rtn": "country",
    "rcn": "country_id",
    "mo": "NONE",
    "UR": "CASCADE",
    "dr": "RESTRICT",
    "ts": "sakila"
  }],
  "dbType": "mysql2",
  "type": "table"
}


const model = new BaseModelSql({
  ...meta,
  dbDriver: knex
});

[
  {
    "query": "(abc,nbtw,1,2,3)",
    "valid": false,
    "sqlQuery": "",
    "message": "1,2,3 : not a valid value. Between accepts only 2 values"
  }
]
  .forEach(({query, valid, message, sqlQuery}, i) => {
    it(`Test case : ${i} - ${query}`, async function (done) {
      let passed;
      try {


        console.log(await model.list({
          fields: 'CountryId',
          where: `(country_id,eq,2)`
        }));

        console.log(await model.insert({
          City: "test",
          CountryId: 9999
        }));
        console.log(await model.update({
          data: {
            City: "test",
            CountryId: 9999
          },
          where: `(CountryId,eq,9998)`
        }));
        console.log(await model.update({
          data: {
            City: "test",
            CountryId: 9999
          },
          where: `(CountryId,eq,9998)`
        }));


        //
        // let queryOutput = knex.table('city').select({
        //   country: 'CountryName',
        //   country_id: 'CountryId',
        // }).toQuery();
        // passed = true;
        //
        //
        // console.log(queryOutput)
        // console.log(await knex.table('country').select({
        //   CountryName: 'country',
        //   CountryId: 'country_id',
        // }))


        // queryOutput.should.be.equal(sqlQuery)
      } catch (e) {
        passed = false;
        // expect(e).to.be.a(Error);
        // console.log(e.message)
        e.message.should.be.equal(message)
      }
      // passed.should.be.equal(valid)
      done();
    });
  })
