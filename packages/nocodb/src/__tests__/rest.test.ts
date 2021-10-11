import { expect } from 'chai';
import 'mocha';
import express from 'express';
import request from 'supertest';

import { Noco } from '../lib';
import NcConfigFactory from '../lib/utils/NcConfigFactory';
process.env.TEST = 'test';

let projectId;
let token;
const dbConfig = NcConfigFactory.urlToDbConfig(
  NcConfigFactory.extractXcUrlFromJdbc(process.env[`DATABASE_URL`])
);
const projectCreateReqBody = {
  api: 'projectCreateByWeb',
  query: { skipProjectHasDb: 1 },
  args: {
    project: { title: 'sebulba', folder: 'config.xc.json', type: 'pg' },
    projectJson: {
      title: 'sebulba',
      version: '0.6',
      envs: {
        _noco: {
          db: [
            dbConfig
            //   {
            //   "client": "mysql2",
            //   "connection": {
            //     "host": "localhost",
            //     "port": "3306",
            //     "user": "root",
            //     "password": "password",
            //     "database": "sakila",
            //     "multipleStatements": true
            //   },
            //   "meta": {
            //     "tn": "nc_evolutions",
            //     "dbAlias": "db",
            //     "api": {"type": "rest", "prefix": "", "graphqlDepthLimit": 10},
            //     "inflection": {"tn": "none", "cn": "none"}
            //   }
            // }
          ],
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
describe('{Auth, CRUD, HasMany, Belongs} Tests', () => {
  let app;

  // Called once before any of the tests in this block begin.
  before(function(done) {
    this.timeout(200000);

    (async () => {
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
    // process.exit();
  });

  /**************** START : Auth ****************/
  describe('Authentication', function() {
    this.timeout(10000);
    const EMAIL_ID = 'abc@g.com';
    const VALID_PASSWORD = '1234566778';

    it('Signup with valid email', function(done) {
      this.timeout(60000);
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
          done();
        });
    });

    it('Signup with invalid email', done => {
      request(app)
        .post('/auth/signup')
        .send({ email: 'test', password: VALID_PASSWORD })
        .expect(400, done);
    });

    it('Signin with valid credentials', function(done) {
      request(app)
        .post('/auth/signin')
        .send({ email: EMAIL_ID, password: VALID_PASSWORD })
        .expect(200, async function(err, res) {
          if (err) {
            return done(err);
          }
          token = res.body.token;
          expect(token).to.be.a('string');
          // todo: verify jwt token payload
          // const payload: any = await JWT.verifyToken(token, config.auth.jwt.secret, config.auth.jwt.options)
          // expect(payload.email).to.eq(EMAIL_ID)
          // expect(payload.roles).to.eq('owner,creator,editor')
          done();
        });
    });

    it('me', function(done) {
      request(app)
        .get('/user/me')
        .set('xc-auth', token)
        .expect(200, function(err, res) {
          if (err) {
            return done(err);
          }
          const email = res.body.email;
          expect(email).to.equal(EMAIL_ID);
          done();
        });
    });

    it('Change password', function(done) {
      request(app)
        .post('/user/password/change')
        .set('xc-auth', token)
        .send({ currentPassword: 'password', newPassword: 'password' })
        .expect(400, done);
    });

    it('Change password - after logout', function(done) {
      // todo:
      request(app)
        .post('/user/password/change')
        .send({ currentPassword: 'password', newPassword: 'password' })
        .expect(500, function(_err, _res) {
          done();
        });
    });

    it('Signin with invalid credentials', function(done) {
      request(app)
        .post('/auth/signin')
        .send({ email: 'abc@abc.com', password: VALID_PASSWORD })
        .expect(400, done);
    });

    it('Signin with invalid password', function(done) {
      request(app)
        .post('/auth/signin')
        .send({ email: EMAIL_ID, password: 'wrongPassword' })
        .expect(400, done);
    });

    it('Forgot password with a non-existing email id', function(done) {
      request(app)
        .post('/auth/password/forgot')
        .send({ email: 'abc@abc.com' })
        .expect(400, done);
    });

    it('Forgot password with an existing email id', function(done) {
      this.timeout(10000);
      request(app)
        .post('/auth/password/forgot')
        .send({ email: EMAIL_ID })
        .expect(200, done);
    });

    it('Email validate with an invalid token', function(done) {
      request(app)
        .post('/auth/email/validate/someRandomValue')
        .send({ email: EMAIL_ID })
        .expect(400, done);
    });

    it('Email validate with a valid token', function(done) {
      console.log('eeee');

      // todo :
      done();

      // request(app)
      //   .post('/auth/email/validate/someRandomValue')
      //   .send({email: EMAIL_ID})
      //   .expect(500, done);
    });

    it('Forgot password validate with an invalid token', function(done) {
      request(app)
        .post('/auth/token/validate/someRandomValue')
        .send({ email: EMAIL_ID })
        .expect(400, done);
    });

    it('Forgot password validate with a valid token', function(done) {
      // todo

      done();

      // request(app)
      //   .post('/auth/token/validate/someRandomValue')
      //   .send({email: EMAIL_ID})
      //   .expect(500, done);
    });

    it('Reset Password with an invalid token', function(done) {
      request(app)
        .post('/auth/password/reset/someRandomValue')
        .send({ password: 'anewpassword' })
        .expect(400, done);
    });

    it('Reset Password with an valid token', function(done) {
      //todo
      done();

      // request(app)
      //   .post('/auth/password/reset/someRandomValue')
      //   .send({password: 'anewpassword'})
      //   .expect(500, done);
    });
  });

  describe('Project', function() {
    const EMAIL_ID = 'abc@g.com';
    const VALID_PASSWORD = '1234566778';

    before(function(done) {
      this.timeout(120000);
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

    /**************** START : CRUD ****************/
    describe('CRUD', function() {
      let COUNTRY_ID_RET;
      const COUNTRY_ID = 9999;
      const COUNTRY_NAME = 'IN';
      this.timeout(5000);

      it('list + limit : GET - /api/v1/country?limit=6', function(done) {
        console.log(`/nc/${projectId}/api/v1/country?limit=6`);
        request(app)
          .get(`/nc/${projectId}/api/v1/country?limit=6`)
          .set('xc-auth', token)
          .expect(200, (err, res) => {
            if (err) done(err);
            expect(res.body.length).to.be.lessThan(7);
            done();
          });
      });

      it('list + where : GET - /api/v1/country?where=(country,like,b%)', function(done) {
        request(app)
          .get(`/nc/${projectId}/api/v1/country?where=(country,like,b%)`)
          .set('xc-auth', token)
          .expect(200, (err, res) => {
            if (err) done(err);
            expect(res.body).to.be.a('array');
            if (res.body.length)
              expect(res.body[0].country.toLowerCase())
                .to.be.a('string')
                .and.satisfy(msg => {
                  return msg.startsWith('b');
                }, 'Should start with "b"');
            done();
          });
      });

      it('list + sort : GET - /api/v1/country?sort=-country_id', function(done) {
        request(app)
          .get(`/nc/${projectId}/api/v1/country?sort=-country_id`)
          .set('xc-auth', token)
          .expect(200, (err, res) => {
            if (err) done(err);
            expect(res.body).to.be.a('array');
            expect(res.body).satisfy(array => {
              let i = array.length;
              while (--i) {
                if (array[i].country_id > array[i - 1].country_id) return false;
              }
              return true;
            }, 'Should be in descending order');
            done();
          });
      });

      it('list + fields : GET - /api/v1/country?fields=country,country_id', function(done) {
        request(app)
          .get(`/nc/${projectId}/api/v1/country?fields=country,country_id`)
          .set('xc-auth', token)
          .expect(200, (err, res) => {
            if (err) done(err);
            expect(res.body).to.be.a('array');
            expect(Object.keys(res.body[0]).length).to.be.equal(3);
            expect(res.body[0]).to.have.all.keys(
              'country_id',
              'country',
              'cityList'
            );
            done();
          });
      });

      it('list + offset : GET - /api/v1/country?offset=0', function(done) {
        request(app)
          .get(`/nc/${projectId}/api/v1/country?offset=0&limit=6`)
          .set('xc-auth', token)
          .expect(200, (err, res1) => {
            if (err) done(err);
            request(app)
              .get(`/nc/${projectId}/api/v1/country?offset=1&limit=5`)
              .set('xc-auth', token)
              .expect(200, (err, res2) => {
                if (err) done(err);
                expect(res2.body).satisfy(
                  arr =>
                    arr.every(
                      ({ country, country_id }, i) =>
                        country === res1.body[i + 1].country &&
                        country_id === res1.body[i + 1].country_id
                    ),
                  'Both data should need to be equal where offset vary with 1'
                );
                done();
              });
          });
      });

      describe('CRUD', function() {
        it('create - POST - /api/v1/country', function(done) {
          request(app)
            .delete(`/nc/${projectId}/api/v1/country/` + COUNTRY_ID)
            .set('xc-auth', token)
            .set('xc-auth', token)
            .expect(200, (_err, _res) => {
              request(app)
                .post(`/nc/${projectId}/api/v1/country`)
                .set('xc-auth', token)
                .set('xc-auth', token)
                .send({
                  country: COUNTRY_NAME,
                  ...(dbConfig.client === 'mssql'
                    ? {}
                    : { country_id: COUNTRY_ID })
                })
                .expect(200, (err, res) => {
                  if (err) done(err);
                  COUNTRY_ID_RET = res.body.country_id;
                  expect(res.body).to.be.a('object');
                  expect(res.body.country).to.be.equal(COUNTRY_NAME);
                  done();
                });
            });
        });

        it('read - GET - /api/v1/country/:id', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/1`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              // expect(res.body).to.be.a('array');
              expect(res.body).to.be.a('object');
              expect(res.body.country).to.be.equal('Afghanistan');
              done();
            });
        });

        it('update - PUT - /api/v1/country/:id', function(done) {
          request(app)
            .put(
              `/nc/${projectId}/api/v1/country/` +
                (dbConfig.client === 'mssql' ? COUNTRY_ID_RET : COUNTRY_ID)
            )
            .set('xc-auth', token)
            .set('xc-auth', token)
            .send({ country: COUNTRY_NAME + 'a' })
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('object');
              request(app)
                .get(
                  `/nc/${projectId}/api/v1/country/` +
                    (dbConfig.client === 'mssql' ? COUNTRY_ID_RET : COUNTRY_ID)
                )
                .set('xc-auth', token)
                .expect(200, (err, res) => {
                  if (err) done(err);
                  expect(res.body).to.be.a('object');
                  expect(res.body.country).to.be.equal(COUNTRY_NAME + 'a');
                  done();
                });
            });
        });

        it('exists - GET - /api/v1/country/:id/exists', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/1/exists`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.true;
              done();
            });
        });

        it('findOne - GET - /api/v1/country/findOne', function(done) {
          request(app)
            .get(
              `/nc/${projectId}/api/v1/country/findOne?where=(country,eq,${COUNTRY_NAME +
                'a'})`
            )
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('object');
              expect(res.body.country).to.be.equal(COUNTRY_NAME + 'a');
              done();
            });
        });

        it('delete - DELETE - /api/v1/country/:id', function(done) {
          request(app)
            .delete(
              `/nc/${projectId}/api/v1/country/` +
                (dbConfig.client === 'mssql' ? COUNTRY_ID_RET : COUNTRY_ID)
            )
            .set('xc-auth', token)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.equal(1);
              request(app)
                .get(
                  `/nc/${projectId}/api/v1/country/` +
                    (dbConfig.client === 'mssql' ? COUNTRY_ID_RET : COUNTRY_ID)
                )
                .set('xc-auth', token)
                .expect(200, (err, res) => {
                  if (err) done(err);
                  expect(res.body).to.be.a('object');
                  expect(Object.keys(res.body)).to.have.length(0);
                  done();
                });
            });
        });
      });

      if (dbConfig.client !== 'mssql') {
        it('groupBy - GET - /api/v1/country/groupby/:cn', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/groupby/country?limit=5`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              if (res.body.length) {
                expect(res.body.length).to.be.most(5);
                expect(+res.body[0].count).to.be.greaterThan(0);
                expect(res.body[0].country).to.be.a('string');
                expect(Object.keys(res.body[0]).length).to.be.equal(2);
              }
              done();
            });
        });

        it('groupBy multiple - GET - /api/v1/country/groupby/:cn', function(done) {
          request(app)
            .get(
              `/nc/${projectId}/api/v1/country/groupby/country?fields=country_id&limit=5`
            )
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              expect(res.body.length).to.be.most(5);
              if (res.body.length) {
                expect(+res.body[0].count).to.be.greaterThan(0);
                expect(res.body[0].country).to.be.a('string');
                expect(+res.body[0].country_id).to.be.a('number');
                expect(Object.keys(res.body[0]).length).to.be.equal(3);
              }
              done();
            });
        });

        // todo: change distribute => distribution
        it('distribution - GET - /api/v1/country/distribute', function(done) {
          request(app)
            .get(
              `/nc/${projectId}/api/v1/country/distribute?column_name=country_id&steps=1,34,50`
            )
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              expect(+res.body[0].count).to.be.a('number');
              expect(+res.body[0].count).satisfies(
                num => num === parseInt(num) && num >= 0,
                'should be a positive integer'
              );
              expect(res.body[0].range).to.be.a('string');
              expect(res.body[0].range).to.be.match(
                /^\d+-\d+$/,
                'should match {num start}-{num end} format'
              );
              done();
            });
        });

        it('distinct - GET - /api/v1/country/distinct', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/distinct?cn=country&limit=5`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              if (res.body.length) {
                expect(res.body[0].country).to.be.a('string');
                expect(Object.keys(res.body[0]).length).to.be.equal(1);
              }
              expect(res.body.length).to.be.most(5);
              done();
            });
        });

        it('distinct multiple - GET - /api/v1/country/distinct/:cn', function(done) {
          request(app)
            .get(
              `/nc/${projectId}/api/v1/country/distinct?cn=country&fields=country_id&limit=5`
            )
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              if (res.body.length) {
                expect(res.body[0].country).to.be.a('string');
                expect(Object.keys(res.body[0]).length).to.be.equal(2);
              }
              expect(res.body.length).to.be.most(5);
              done();
            });
        });

        it('aggregate - GET - /api/v1/country/aggregate', function(done) {
          request(app)
            .get(
              `/nc/${projectId}/api/v1/country/aggregate?column_name=country_id&func=sum,avg,min,max,count`
            )
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              if (res.body.length) {
                expect(+res.body[0].min).to.be.a('number');
                expect(+res.body[0].max).to.be.a('number');
                expect(+res.body[0].avg).to.be.satisfy(
                  num => !isNaN(parseInt(num)),
                  'count should be an number'
                );
                expect(+res.body[0].sum).to.be.satisfy(
                  num => !isNaN(parseInt(num)),
                  'count should be an number'
                );
                expect(+res.body[0].count)
                  .to.be.a('number')
                  .and.satisfy(
                    num => num === parseInt(num),
                    'count should be an integer'
                  );
                // expect(Object.keys(res.body[0]).length).to.be.equal(7);
              }
              expect(res.body.length).to.be.most(20);
              done();
            });
        });

        it('count - GET - /api/v1/country/count', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/count`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('object');
              expect(+res.body.count)
                .to.be.a('number')
                .and.satisfy(
                  num => num === parseInt(num),
                  'count should be an integer'
                );
              done();
            });
        });

        if (dbConfig.client !== 'sqlite3') {
          it('bulk insert - POST - /api/v1/country/bulk', function(done) {
            request(app)
              .post(`/nc/${projectId}/api/v1/country/bulk`)
              .set('xc-auth', token)
              .send([
                { country: 'a' },
                { country: 'b' },
                { country: 'c' },
                { country: 'd' },
                { country: 'e' }
              ])
              .expect(200, (err, res) => {
                if (err) done(err);
                expect(res.body).to.be.a('array');
                expect(res.body[0]).to.be.a('number');
                request(app)
                  .get(`/nc/${projectId}/api/v1/country/${res.body.pop()}`)
                  .set('xc-auth', token)
                  .expect(200, (err, res) => {
                    if (err) done(err);
                    // expect(res.body).to.be.a('array');
                    expect(res.body).to.be.a('object');
                    // in mysql it will be a and in pg : e
                    expect(
                      ['a', 'e'].indexOf(res.body.country)
                    ).to.be.greaterThan(-1);
                    done();
                  });
              });
          });

          it('bulk update - PUT - /api/v1/country/bulk', function(done) {
            // get last inserted 5 entry by sorting db data in reverse order based on id
            request(app)
              .get(`/nc/${projectId}/api/v1/country?sort=-country_id&limit=5`)
              .set('xc-auth', token)
              .expect(200, (err, res) => {
                if (err) done(err);

                expect(res.body).to.be.a('array');
                expect(res.body[0]).to.be.a('object');
                expect(res.body[0].country).to.be.a('string');

                request(app)
                  .put(`/nc/${projectId}/api/v1/country/bulk`)
                  .set('xc-auth', token)
                  .send(
                    res.body.map(({ country, country_id }) => ({
                      country_id,
                      country: country + 1
                    }))
                  )
                  .expect(200, (err, res) => {
                    if (err) done(err);
                    expect(res.body).to.be.a('array');
                    expect(res.body[0]).to.be.a('number');
                    expect(res.body[0]).to.be.equal(1);
                    expect(res.body.length).to.be.equal(5);
                    done();
                  });
              });
          });
          it('bulk delete - DELETE - /api/v1/country/bulk', function(done) {
            // get last inserted 5 entry by sorting db data in reverse order based on id
            request(app)
              .get(`/nc/${projectId}/api/v1/country?sort=-country_id&limit=5`)
              .set('xc-auth', token)
              .expect(200, (err, res) => {
                if (err) done(err);
                expect(res.body).to.be.a('array');
                expect(res.body[0]).to.be.a('object');
                expect(res.body[0].country).to.be.a('string');

                request(app)
                  .delete(`/nc/${projectId}/api/v1/country/bulk`)
                  .set('xc-auth', token)
                  .send(res.body.map(({ country_id }) => ({ country_id })))
                  .expect(200, (err, res) => {
                    if (err) done(err);
                    expect(res.body).to.be.a('array');
                    expect(res.body[0]).to.be.a('number');
                    expect(res.body[0]).to.be.equal(1);
                    expect(res.body.length).to.be.equal(5);
                    done();
                  });
              });
          });
        }
      }
    });

    /**************** END : CRUD ****************/

    if (dbConfig.client !== 'mssql' && dbConfig.client !== 'sqlite3') {
      /**************** START : hasMany ****************/
      describe('Country HasMany City Api', function() {
        const CITY_NAME = 'testCity',
          CITY_ID = '9999';

        it('has city - GET - /api/v1/country/has/city(:childs)?', function(done) {
          // get last inserted 5 entry by sorting db data in reverse order based on id
          request(app)
            .get(`/nc/${projectId}/api/v1/country/has/city`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              expect(res.body[0]).to.be.a('object');
              expect(res.body[0].country).to.be.a('string');
              expect(res.body[0].cityList).to.be.a('array');
              expect(res.body[0].cityList[0]).to.be.a('object');
              expect(res.body[0].cityList[0].city).to.be.a('string');
              done();
            });
        });

        it('cities under a single parent - GET - /api/v1/country/:parentId/city', function(done) {
          // get last inserted 5 entry by sorting db data in reverse order based on id
          request(app)
            .get(`/nc/${projectId}/api/v1/country/1/city?limit=5`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              expect(res.body[0]).to.be.a('object');
              expect(res.body[0].city).to.be.a('string');
              expect(res.body.length).to.be.most(5);
              done();
            });
        });

        it('create - POST - /api/v1/country/:parentId/city/:id', function(done) {
          request(app)
            .delete(`/nc/${projectId}/api/v1/country/1/city/${CITY_ID}`)
            .set('xc-auth', token)
            .set('xc-auth', token)
            .expect(200, (_err, _res) => {
              request(app)
                .post(`/nc/${projectId}/api/v1/country/1/city`)
                .set('xc-auth', token)
                .send({ city: CITY_NAME, city_id: CITY_ID })
                .expect(200, (err, res) => {
                  if (err) done(err);
                  expect(res.body).to.be.a('object');
                  expect(res.body.city).to.be.equal(CITY_NAME);
                  expect(res.body.country_id + '').to.be.equal('1');
                  done();
                });
            });
        });

        it('get city by id - GET - /api/v1/country/:parentId/city/:id', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/1/city/${CITY_ID}`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              expect(res.body[0].city).to.be.equal(CITY_NAME);
              expect(res.body[0].country_id).to.be.equal(1);
              done();
            });
        });

        it('get count - GET - /api/v1/country/:parentId/city/count', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/1/city/count`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('object');
              expect(+res.body.count).to.be.a('number');
              done();
            });
        });

        it('update - PUT - /api/v1/country/:parentId/city/:id', function(done) {
          request(app)
            .put(`/nc/${projectId}/api/v1/country/1/city/${CITY_ID}`)
            .set('xc-auth', token)
            .send({ city: CITY_NAME + 'a' })
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.equal(1);
              request(app)
                .get(`/nc/${projectId}/api/v1/country/1/city/${CITY_ID}`)
                .set('xc-auth', token)
                .expect(200, (err, res) => {
                  if (err) done(err);
                  expect(res.body).to.be.a('array');
                  expect(res.body[0].city).to.be.equal(CITY_NAME + 'a');
                  expect(res.body[0].country_id).to.be.equal(1);
                  done();
                });
            });
        });

        it('findOne city - GET - /api/v1/country/:parentId/city/findOne', function(done) {
          request(app)
            .get(
              `/nc/${projectId}/api/v1/country/1/city/findOne?where=(city,eq,${CITY_NAME +
                'a'})`
            )
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('object');
              expect(res.body.city).to.be.equal(CITY_NAME + 'a');
              expect(res.body.country_id + '').to.be.equal('1');
              done();
            });
        });

        it('exists city - GET - /api/v1/country/1/city/${CITY_ID}/exists', function(done) {
          request(app)
            .get(`/nc/${projectId}/api/v1/country/1/city/${CITY_ID}/exists`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.true;
              done();
            });
        });

        it('delete - DELETE - /api/v1/country/:parentId/city', function(done) {
          this.timeout(10000);
          request(app)
            .delete(`/nc/${projectId}/api/v1/country/1/city/${CITY_ID}`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.equal(1);
              done();
            });
        });
      });
      /**************** END : hasMany ****************/

      /**************** START : belongsTo ****************/
      describe('City BelngsTo Country Api', function() {
        it('city belongs to country - GET - /api/v1/city/belongs/country', function(done) {
          // get last inserted 5 entry by sorting db data in reverse order based on id
          request(app)
            .get(`/nc/${projectId}/api/v1/city/belongs/country?limit=10`)
            .set('xc-auth', token)
            .expect(200, (err, res) => {
              if (err) done(err);
              expect(res.body).to.be.a('array');
              expect(res.body[0]).to.be.a('object');
              expect(res.body[0].city).to.be.a('string');
              expect(res.body[0].countryRead).to.be.a('object');
              expect(res.body.length).to.be.most(10);
              done();
            });
        });
      });
      /**************** END : belongsTo ****************/
    }
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
