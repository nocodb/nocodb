import { expect } from 'chai';
import 'mocha';
import express from 'express';
import request from 'supertest';

import { Noco } from '../lib';
import NcConfigFactory from '../lib/utils/NcConfigFactory';
import UITypes from '../lib/sqlUi/UITypes';

const knex = require('knex');

process.env.NODE_ENV = 'test';
process.env.TEST = 'test';
const dbName = `test_meta`;
process.env[`DATABASE_URL`] = `mysql2://root:password@localhost:3306/${dbName}`;
// process.env[`DATABASE_URL`] = `pg://postgres:password@localhost:5432/${dbName}`;
// process.env[
//   `DATABASE_URL`
// ] = `mssql://sa:Password123.@localhost:1433/${dbName}`;

let projectId;
let token;
const dbConfig = NcConfigFactory.urlToDbConfig(
  NcConfigFactory.extractXcUrlFromJdbc(
    // 'sqlite:////Users/pranavc/xgene/nc/packages/nocodb/tests/sqlite-dump/sakila.db')
    process.env[`DATABASE_URL`]
  )
);
dbConfig.connection.database = 'sakila';
dbConfig.meta = {
  tn: 'nc_evolutions',
  dbAlias: 'db',
  api: {
    type: 'rest',
    prefix: '',
    graphqlDepthLimit: 10
  },
  inflection: {
    tn: 'camelize',
    column_name: 'camelize'
  }
} as any;

const projectCreateReqBody = {
  api: 'projectCreateByWeb',
  query: { skipProjectHasDb: 1 },
  args: {
    project: { title: 'restv2', folder: 'config.xc.json', type: 'pg' },
    projectJson: {
      title: 'restv2',
      version: '0.6',
      envs: {
        _noco: {
          db: [dbConfig],
          apiClient: { data: [] }
        }
      },
      workingEnv: '_noco',
      meta: {
        version: '0.6',
        seedsFolder: 'seeds',
        queriesFolder: 'queries',
        apisFolder: 'apis',
        projectType: 'rest',
        type: 'mvc',
        language: 'ts',
        db: { client: 'sqlite3', connection: { filename: 'noco.db' } }
      },
      seedsFolder: 'seeds',
      queriesFolder: 'queries',
      apisFolder: 'apis',
      projectType: 'rest',
      type: 'docker',
      language: 'ts',
      apiClient: { data: [] },
      auth: {
        jwt: { secret: 'b8ed266d-4475-4028-8c3d-590f58bee867', dbAlias: 'db' }
      }
    }
  }
};

// console.log(JSON.stringify(dbConfig, null, 2));
// process.exit();
describe('Noco v2 Tests', () => {
  let app;

  // Called once before any of the tests in this block begin.
  before(function(done) {
    this.timeout(200000);

    (async () => {
      try {
        await knex(dbConfig).raw(`DROP DATABASE ${dbName}`);
      } catch {}

      const server = express();

      server.use(await Noco.init());
      app = server;
      // await knex(config.envs[process.env.NODE_ENV || 'dev'].db[0])('xc_users').del();
    })()
      .then(done)
      .catch(e => {
        done(e);
      });
  });

  after(done => {
    done();
    process.exit();
  });

  describe('API Tests', function() {
    this.timeout(10000);
    const EMAIL_ID = 'abc@g.com';
    const VALID_PASSWORD = '1234566778';

    before(function(done) {
      this.timeout(120000);
      request(app)
        .post('/auth/signup')
        .send({ email: EMAIL_ID, password: VALID_PASSWORD })
        .expect(200, (err, res) => {
          if (err) {
            expect(res.status).to.equal(400);
          } else {
            const token = res.body.token;
            expect(token).to.be.a('string');
          }
          request(app)
            .post('/auth/signin')
            .send({ email: EMAIL_ID, password: VALID_PASSWORD })
            .expect(200, async function(_err, res) {
              token = res.body.token;
              request(app)
                .post('/dashboard')
                .set('xc-auth', token)
                .send(projectCreateReqBody)
                .expect(200, (err, res) => {
                  if (err) {
                    return done(err);
                  }
                  projectId = res.body.id;
                  done();
                });
            });
        });
    });

    it('Simple country list', function(done) {
      console.log(`/nc/${projectId}/api/v2/country`);
      request(app)
        .get(`/nc/${projectId}/api/v2/country`)
        .set('xc-auth', token)
        .expect(200, (err, res) => {
          if (err) done(err);

          expect(res.body?.CountryList).to.be.an('Array');
          expect(res.body?.CountryList[0]).to.have.property('Country');
          expect(res.body?.CountryList[0]).to.have.property('CountryId');
          expect(res.body?.CountryList[0]).to.have.property('CityList');
          expect(res.body?.CountryList[0]['CityList']).to.be.an('Array');
          expect(res.body?.CountryList[0]['CityList'][0]).to.have.property(
            'City'
          );
          expect(res.body?.CountryList[0]['CityList'][0]).to.have.property(
            'CityId'
          );

          done();
        });
    });

    it('Add Rollup column(hm)', function(done) {
      const payload = {
        table: 'country',
        type: UITypes.Rollup,
        alias: 'cityCount',
        rollupColumn: 'CityId',
        relationColumn: 'CityList',
        rollupFunction: 'count'
      };
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              expect(res.body?.CountryList[0]).to.have.property('Country');
              expect(res.body?.CountryList[0]).to.have.property('CountryId');
              expect(+res.body?.CountryList[0]['cityCount']).to.be.an('Number');
              done();
            });
        });
    });

    it('Add Rollup column(mm)', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'actor',
          type: UITypes.Rollup,
          alias: 'filmCount',
          rollupColumn: 'FilmId',
          relationColumn: 'FilmMMList',
          rollupFunction: 'count'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/actor/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.ActorRead).to.be.an('Object');
              expect(+res.body?.ActorRead.filmCount).to.be.an('Number');
              expect(+res.body?.ActorRead.filmCount).to.be.eq(19);
              done();
            });
        });
    });

    it('Add simple Lookup column(hm)', function(done) {
      const payload = {
        table: 'country',
        type: UITypes.Lookup,
        alias: 'cityNames',
        lookupColumn: 'City',
        relationColumn: 'CityList'
      };
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList?.[0]?.['cityNames']).to.be.an(
                'Array'
              );
              expect(res.body?.CountryList?.[0]?.['cityNames']?.[0]).to.be.an(
                'String'
              );

              done();
            });
        });
    });

    it('Add simple Lookup column(bt)', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'address',
          type: UITypes.Lookup,
          alias: 'cityName',
          lookupColumn: 'City',
          relationColumn: 'CityRead'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/address`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.AddressList?.[0]?.['cityName']).to.be.a(
                'String'
              );

              done();
            });
        });
    });

    it('Add nested Lookup column(hm) - Country => City => Address => Address', function(done) {
      const payload = [
        {
          table: 'city',
          type: UITypes.Lookup,
          alias: 'NestedAddress1',
          lookupColumn: 'Address',
          relationColumn: 'AddressList'
        },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'NestedAddress2',
          lookupColumn: 'NestedAddress1',
          relationColumn: 'CityList'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList?.[0]?.['NestedAddress2']).to.be.an(
                'Array'
              );
              expect(
                res.body?.CountryList?.[0]?.['NestedAddress2'][0]
              ).to.be.an('String');

              done();
            });
        });
    });

    it('Add nested Lookup column(bt) - Address => City => Country => Country', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'city',
          type: UITypes.Lookup,
          alias: 'CountryName',
          lookupColumn: 'Country',
          relationColumn: 'CountryRead'
        },
        {
          table: 'address',
          type: UITypes.Lookup,
          alias: 'CountryName',
          lookupColumn: 'CountryName',
          relationColumn: 'CityRead'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/address/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.AddressRead?.['CountryName']).to.be.an('String');
              expect(res.body?.AddressRead?.['CountryName']).to.be.eq('Canada');
              done();
            });
        });
    });

    it('Add nested Lookup with Rollup - Country => City => AddressCount', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'city',
          type: UITypes.Rollup,
          alias: 'addressCount',
          rollupColumn: 'AddressId',
          rollupFunction: 'count',
          relationColumn: 'AddressList'
        },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'AddressCount',
          lookupColumn: 'addressCount',
          relationColumn: 'CityList'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryRead?.['AddressCount']).to.be.an('Array');
              expect(+res.body?.CountryRead?.['AddressCount'][0]).to.be.eq(1);
              done();
            });
        });
    });

    it('Add simple nested Lookup column(mm) - Actor <=> Film <=> Title', function(done) {
      const payload = {
        table: 'actor',
        type: UITypes.Lookup,
        alias: 'filmNames',
        lookupColumn: 'Title',
        relationColumn: 'FilmMMList'
      };
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/actor/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.ActorRead?.['filmNames']).to.be.an('Array');
              expect(res.body?.ActorRead?.['filmNames'][0]).to.be.eq(
                'ACADEMY DINOSAUR'
              );
              done();
            });
        });
    });

    it('Add simple formula column - LEN(Country)', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula1',
          formula: 'LEN(Country)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryRead?.['formula1']).to.be.a('Number');
              expect(res.body?.CountryRead?.['formula1']).to.be.eq(
                res.body?.CountryRead?.['Country']?.length
              );
              done();
            });
        });
    });

    it('Add formula column with rollup - ADD(cityCount, 10)', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'country',
          type: UITypes.Rollup,
          alias: 'cityCount',
          rollupColumn: 'CityId',
          relationColumn: 'CityList',
          rollupFunction: 'count'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula2',
          formula: 'ADD(cityCount, 10)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(+res.body?.CountryRead?.['cityCount']).to.be.a('Number');
              expect(+res.body?.CountryRead?.['formula2']).to.be.a('Number');
              expect(+res.body?.CountryRead?.['formula2']).to.be.eq(
                +res.body?.CountryRead?.['cityCount'] + 10
              );
              done();
            });
        });
    });

    it("Add formula column with bt column - address - CONCAT('City name is : ',CityRead)", function(done) {
      const payload = [
        {
          table: 'address',
          type: UITypes.Formula,
          alias: 'formula3',
          formula: "CONCAT('City name is : ',CityRead)"
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/address/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.AddressRead?.['formula3']).to.be.a('String');
              expect(res.body?.AddressRead?.['formula3']).to.be.eq(
                'City name is : ' + res.body?.AddressRead?.CityRead?.City
              );
              done();
            });
        });
    });

    it("Add formula column with nested lookup(bt only) column - address - CONCAT('City name is : ',CountryName)", function(done) {
      const payload = [
        {
          table: 'city',
          type: UITypes.Lookup,
          alias: 'FormulaNestedCountry1',
          lookupColumn: 'Country',
          relationColumn: 'CountryRead'
        },
        {
          table: 'address',
          type: UITypes.Lookup,
          alias: 'FormulaNestedCountry2',
          lookupColumn: 'FormulaNestedCountry1',
          relationColumn: 'CityRead'
        },
        {
          table: 'address',
          type: UITypes.Formula,
          alias: 'formula4',
          formula: "CONCAT('Country name is : ',FormulaNestedCountry2)"
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/address/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.AddressRead?.['formula4']).to.be.a('String');
              expect(res.body?.AddressRead?.['formula4']).to.be.eq(
                'Country name is : Canada'
              );
              done();
            });
        });
    });

    it('Add formula column with another formula column - ADD(LEN(Country),2)', function(done) {
      const payload = [
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula5',
          formula: 'LEN(Country)'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula6',
          formula: 'ADD(formula5,2)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryRead?.['formula5']).to.be.a('Number');
              expect(res.body?.CountryRead?.['formula6']).to.be.a('Number');
              expect(res.body?.CountryRead?.['formula6']).to.be.eq(
                res.body?.CountryRead?.['formula5'] + 2
              );
              done();
            });
        });
    });

    it('Lookup with nested formula - Country => City => LEN(City)', function(done) {
      const payload = [
        {
          table: 'city',
          type: UITypes.Formula,
          alias: 'formula7',
          formula: 'LEN(City)'
        },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'CityNameLength',
          relationColumn: 'CityList',
          lookupColumn: 'formula7'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryRead?.['CityNameLength']).to.be.a(
                'Array'
              );
              expect(res.body?.CountryRead?.['CityNameLength'][0]).to.be.eq(
                res.body?.CountryRead?.['CityList']?.[0]?.['City'].length
              );
              done();
            });
        });
    });

    it('Simple sort - Country - desc', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllSort' },
        {
          table: 'country',
          type: 'Sort',
          column: 'Country',
          direction: 'desc'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              expect(res.body?.CountryList[0].Country).to.be.eq('Zambia');
              done();
            });
        });
    });

    it('Sort by formula column - sort by country name length(LEN(Country)) - desc', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllSort' },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula9',
          formula: 'LEN(Country)'
        },
        {
          table: 'country',
          type: 'Sort',
          column: 'formula9',
          direction: 'desc'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              expect(
                res.body?.CountryList[0].Country.length >
                  res.body?.CountryList[res.body?.CountryList.length - 1]
                    .Country.length
              ).to.be.eq(true);
              done();
            });
        });
    });

    it('Sort by Rollup column - sort by cityCount - desc', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllSort' },
        {
          table: 'country',
          type: UITypes.Rollup,
          alias: 'sortCityCount',
          rollupColumn: 'CityId',
          relationColumn: 'CityList',
          rollupFunction: 'count'
        },
        {
          table: 'country',
          type: 'Sort',
          column: 'sortCityCount',
          direction: 'desc'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              expect(+res.body?.CountryList[0]?.sortCityCount).to.be.an(
                'Number'
              );
              expect(
                +res.body?.CountryList[0].sortCityCount >
                  +res.body?.CountryList[res.body?.CountryList.length - 1]
                    .sortCityCount
              ).to.be.eq(true);
              done();
            });
        });
    });

    it('Sort by LinkToAnotherRecord(bt) column - address by city - desc', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllSort' },
        {
          table: 'address',
          type: 'Sort',
          column: 'CityRead',
          direction: 'desc'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/address`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.AddressList).to.be.an('Array');
              expect(res.body?.AddressList[0]?.CityRead.City).to.be.eq(
                'Ziguinchor'
              );
              done();
            });
        });
    });

    it('Sort by Lookup(bt) column - address by country - desc', function(done) {
      const payload = [
        { table: 'address', type: 'DeleteAllSort' },
        {
          table: 'city',
          type: UITypes.Lookup,
          alias: 'SortCountry1',
          lookupColumn: 'Country',
          relationColumn: 'CountryRead'
        },
        {
          table: 'address',
          type: UITypes.Lookup,
          alias: 'SortCountry2',
          lookupColumn: 'SortCountry1',
          relationColumn: 'CityRead'
        },
        {
          table: 'address',
          type: 'Sort',
          column: 'SortCountry2',
          direction: 'desc'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/address`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.AddressList).to.be.an('Array');
              expect(res.body?.AddressList[0]?.SortCountry2).to.be.eq('Zambia');
              done();
            });
        });
    });

    it("Simple filter -  filter countries starts with 'in'", function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllFilter' },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            column: 'Country',
            comparison_op: 'like',
            value: 'in%'
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              expect(res.body?.CountryList[0]?.Country).to.be.matches(/^in/gi);
              done();
            });
        });
    });

    it("Filter with OR -  filter countries starts with 'in' or 'za'", function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllFilter' },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            logical_op: 'OR',
            children: [
              {
                column: 'Country',
                comparison_op: 'like',
                value: 'in%'
              },
              {
                column: 'Country',
                comparison_op: 'like',
                value: 'za%'
              }
            ]
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              expect(res.body?.CountryList.length).to.be.eq(3);
              for (const c of res.body?.CountryList)
                expect(c?.Country).to.match(/^(?:in|za)/gi);
              done();
            });
        });
    });
    it('Filter with Rollup -  filter country by city count', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllFilter' },
        {
          table: 'country',
          type: UITypes.Rollup,
          alias: 'filterCityCount',
          rollupColumn: 'CityId',
          relationColumn: 'CityList',
          rollupFunction: 'count'
        },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            column: 'filterCityCount',
            comparison_op: 'eq',
            value: '4'
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              for (const c of res.body?.CountryList)
                expect(c?.CityList).to.have.lengthOf(4);
              done();
            });
        });
    });

    it('Filter with Lookup -  filter country by city name', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllFilter' },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'filterCityNames',
          lookupColumn: 'City',
          relationColumn: 'CityList'
        },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            column: 'filterCityNames',
            comparison_op: 'like',
            value: 'ban%'
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              for (const c of res.body?.CountryList)
                expect(c.filterCityNames.some(c => /^ban/i.test(c))).to.be.true;
              done();
            });
        });
    });

    it('Filter with LinkToAnotherRecord -  filter country by cityList', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllFilter' },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            column: 'CityList',
            comparison_op: 'like',
            value: 'ban%'
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              for (const c of res.body?.CountryList)
                expect(c.CityList.some(c => /^ban/i.test(c.City))).to.be.true;
              done();
            });
        });
    });

    it('Filter with Formula -  filter country by Country name length', function(done) {
      const payload = [
        { table: 'country', type: 'DeleteAllFilter' },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'filterFormula',
          formula: 'LEN(Country)'
        },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            column: 'filterFormula',
            comparison_op: 'eq',
            value: 10
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              for (const c of res.body?.CountryList)
                expect(c.Country).to.be.lengthOf(10);
              done();
            });
        });
    });

    it('Filter with nested Lookup -  filter address by country name', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'city',
          type: UITypes.Lookup,
          alias: 'CountryName',
          lookupColumn: 'Country',
          relationColumn: 'CountryRead'
        },
        {
          table: 'address',
          type: UITypes.Lookup,
          alias: 'CountryName',
          lookupColumn: 'CountryName',
          relationColumn: 'CityRead'
        },
        {
          table: 'address',
          type: 'Filter',
          filter: {
            column: 'CountryName',
            comparison_op: 'eq',
            value: 'India'
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/address`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.AddressList).to.be.an('Array');
              for (const a of res.body?.AddressList)
                expect(a.CountryName).to.be.eq('India');
              done();
            });
        });
    });

    it('Filter with nested Lookup(rollup)', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'city',
          type: UITypes.Rollup,
          alias: 'addressCount',
          rollupColumn: 'AddressId',
          relationColumn: 'AddressList',
          rollupFunction: 'count'
        },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'addressCount',
          lookupColumn: 'addressCount',
          relationColumn: 'CityList'
        },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            column: 'addressCount',
            comparison_op: 'eq',
            value: '2'
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              for (const a of res.body?.CountryList)
                expect(a.addressCount.some(v => +v === 2)).to.be.true;
              done();
            });
        });
    });

    it('Filter with nested Lookup(link to another record)', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'addressList',
          lookupColumn: 'AddressList',
          relationColumn: 'CityList'
        },
        {
          table: 'country',
          type: 'Filter',
          filter: {
            column: 'addressList',
            comparison_op: 'like',
            value: '%11%'
          }
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              for (const c of res.body?.CountryList)
                expect(c.addressList.some(a => a.Address.includes('11'))).to.be
                  .true;
              done();
            });
        });
    });

    it('Add formula column with hm column - citykist', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula',
          formula: "CONCAT('City name is : ', CityList)"
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryRead).to.be.an('Object');
              expect(res.body?.CountryRead?.['formula']).to.be.eq(
                'City name is : ' +
                  res.body?.CountryRead?.CityList.map(c => c.City).join(',')
              );
              done();
            });
        });
    });

    it('Add formula column with hm - Addition', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'max',
          formula: "MAX(CityList,'Bcd')"
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'min',
          formula: "MIN(CityList,'Bcd')"
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.a('Array');
              res.body?.CountryList.forEach(c => {
                const cities = [
                  ...c.CityList.map(c1 => c1.City),
                  'Bcd'
                ].sort((a, b) =>
                  a.toLowerCase().localeCompare(b.toLowerCase())
                );
                expect(c.min).to.be.eq(cities[0]);
                expect(c.max).to.be.eq(cities[cities.length - 1]);
              });
              done();
            });
        });
    });

    it('Add formula column with hm lookup - sum, avg, min, max', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'cityIds',
          lookupColumn: 'CityId',
          relationColumn: 'CityList'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'sum',
          formula: 'ADD(cityIds, 100)'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'avg',
          formula: 'AVG(cityIds, 100)'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'min',
          formula: 'MIN(cityIds, 100)'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'max',
          formula: 'MAX(cityIds, 100)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              res.body?.CountryList.forEach(country => {
                expect(+country.min).to.be.eq(
                  Math.min(...country.cityIds, 100)
                );
                expect(+country.max).to.be.eq(
                  Math.max(...country.cityIds, 100)
                );
                expect(+country.sum).to.be.eq(
                  [...country.cityIds, 100].reduce((s, v) => s + v)
                );
                expect(+country.avg).to.be.eq(
                  [...country.cityIds, 100].reduce((s, v) => s + v) / 2
                );
              });

              done();
            });
        });
    });

    it('Add formula column with mm lookup - sum, avg, min, max', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'actor',
          type: UITypes.Lookup,
          alias: 'filmIds',
          lookupColumn: 'FilmId',
          relationColumn: 'FilmMMList'
        },
        {
          table: 'actor',
          type: UITypes.Formula,
          alias: 'sum',
          formula: 'ADD(filmIds, 100)'
        },
        {
          table: 'actor',
          type: UITypes.Formula,
          alias: 'min',
          formula: 'MIN(filmIds, 100)'
        },
        {
          table: 'actor',
          type: UITypes.Formula,
          alias: 'max',
          formula: 'MAX(filmIds, 100)'
        },
        {
          table: 'actor',
          type: UITypes.Formula,
          alias: 'avg',
          formula: 'AVG(filmIds, 100)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/actor`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.ActorList).to.be.an('Array');
              res.body?.ActorList.forEach(film => {
                expect(+film.min).to.be.eq(Math.min(...film.filmIds, 100));
                expect(+film.max).to.be.eq(Math.max(...film.filmIds, 100));
                expect(+film.sum).to.be.eq(
                  [...film.filmIds, 100].reduce((s, v) => s + v)
                );
                expect(+film.avg).to.be.eq(
                  [...film.filmIds, 100].reduce((s, v) => s + v) / 2
                );
              });

              done();
            });
        });
    });

    it('Add formula column with - mm lookup & Rollup', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'film',
          type: UITypes.Rollup,
          alias: 'actorsCount',
          rollupColumn: 'ActorId',
          relationColumn: 'ActorMMList',
          rollupFunction: 'count'
        },
        {
          table: 'actor',
          type: UITypes.Lookup,
          alias: 'actorsCountList',
          lookupColumn: 'actorsCount',
          relationColumn: 'FilmMMList'
        },
        {
          table: 'actor',
          type: UITypes.Formula,
          alias: 'formula',
          formula: 'ADD(actorsCountList, 100)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/actor`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.ActorList).to.be.an('Array');
              res.body?.ActorList.forEach(film => {
                expect(+film.formula).to.be.eq(
                  [...film.actorsCountList, 100].reduce((s, v) => +s + +v)
                );
              });

              done();
            });
        });
    });

    it('Add formula column with - hm lookup & Rollup', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'city',
          type: UITypes.Rollup,
          alias: 'addressCount1',
          rollupColumn: 'AddressId',
          relationColumn: 'AddressList',
          rollupFunction: 'count'
        },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'addressCount',
          lookupColumn: 'addressCount1',
          relationColumn: 'CityList'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula',
          formula: 'ADD(addressCount, 100)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              res.body?.CountryList.forEach(country => {
                expect(+country.formula).to.be.eq(
                  [...country.addressCount, 100].reduce(
                    (s, v) => s + (+v || 0),
                    0
                  )
                );
              });

              done();
            });
        });
    });

    it('Add formula column with - hm lookup & Formula', function(done) {
      const payload = [
        { type: 'DeleteAllMetas' },
        {
          table: 'city',
          type: UITypes.Formula,
          alias: 'cityFormula',
          formula: 'ADD(CityId,100)'
        },
        {
          table: 'country',
          type: UITypes.Lookup,
          alias: 'cityFormulaList',
          lookupColumn: 'cityFormula',
          relationColumn: 'CityList'
        },
        {
          table: 'country',
          type: UITypes.Formula,
          alias: 'formula',
          formula: 'ADD(cityFormulaList, 100)'
        }
      ];
      request(app)
        .post(`/nc/${projectId}/generate`)
        .send(payload)
        .set('xc-auth', token)
        .expect(200, err => {
          if (err) done(err);
          request(app)
            .get(`/nc/${projectId}/api/v2/country`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body?.CountryList).to.be.an('Array');
              res.body?.CountryList.forEach(country => {
                expect(+country.formula).to.be.eq(
                  country.CityList.reduce((s, c) => s + +c.CityId + 100, 100)
                );
              });

              done();
            });
        });
    });

    // End
  });
});
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
