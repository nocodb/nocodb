/* tslint:disable */
import {expect} from 'chai';
import 'mocha';
import {Noco} from "../lib";

import request from 'supertest';
import express from 'express';
import NcConfigFactory from "../lib/utils/NcConfigFactory";

process.env.TEST = 'test';

// import knex from 'knex';
// import {XcConfig} from "../interface/config";
// import JWT from "../lib/xgene/grpc/helpers/jwt";
// import JWT from "../lib/instant/grpc/helpers/jwt";

// const config: XcConfig = {
//   auth: {
//     jwt: {
//       secret: "shgdhsgdhgsgdgswyeyey28378732qgwhqg233232hjhasha",
//       dbAlias:'db'
//     }
//   },
//   envs: {
//     dev: {
//       db: [
//         {
//           "client": "mysql",
//           "connection": {
//             "host": "localhost",
//             "port": 3306,
//             "user": "root",
//             "password": "password",
//             database: "sakila"
//           },
//           meta: {
//             "dbAlias": "db",
//             api: {
//               type: "graphql",
//               prefix: ""
//             },
//             metaTables: "db"
//           }
//         },
//       ],
//     }, test: {
//       db: [
//         {
//           "client": "mysql",
//           "connection": {
//             "host": "localhost",
//             "port": 3306,
//             "user": "root",
//             "password": "",
//             database: "sakila"
//           },
//           meta: {
//             "dbAlias": "db",
//             api: {
//               type: "graphql",
//               prefix: ""
//             },
//             metaTables: "db"
//           }
//         },
//       ],
//     },
//   },
//   toolDir: process.cwd()
// };

// process.env[`DATABASE_URL`] = 'mysql://root:password@localhost:3306/sakila';

const dbConfig = NcConfigFactory.urlToDbConfig(NcConfigFactory.extractXcUrlFromJdbc(process.env[`DATABASE_URL`]), null, null, 'graphql');
// @ts-ignore
const projectCreateReqBody = {
  "api": "projectCreateByWeb",
  "query": {"skipProjectHasDb": 1},
  "args": {
    "project": {"title": "sebulba", "folder": "config.xc.json", "type": "pg"},
    "projectJson": {
      "title": "sebulba",
      "version": "0.6",
      "envs": {
        "dev": {
          "db": [
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
            //     "api": {"type": "graphql", "prefix": "", "graphqlDepthLimit": 10},
            //     "inflection": {"tn": "none", "cn": "none"}
            //   }
            // }
          ], "apiClient": {"data": []}
        }
      },
      "workingEnv": "dev",
      "meta": {
        "version": "0.6",
        "seedsFolder": "seeds",
        "queriesFolder": "queries",
        "apisFolder": "apis",
        "projectType": "graphql",
        "type": "mvc",
        "language": "ts",
        "db": {"client": "sqlite3", "connection": {"filename": "noco.db"}}
      },
      "seedsFolder": "seeds",
      "queriesFolder": "queries",
      "apisFolder": "apis",
      "projectType": "graphql",
      "type": "docker",
      "language": "ts",
      "apiClient": {"data": []},
      "auth": {"jwt": {"secret": "b8ed266d-4475-4028-8c3d-590f58bee867", "dbAlias": "db"}}
    }
  }
}


describe('{Auth, CRUD, HasMany, Belongs} Tests', () => {

  let app;
  let token;
  let projectId;


  // Called once before any of the tests in this block begin.
  before(function (done) {
    this.timeout(10000);
    (async () => {

      const server = express();

      server.use(await Noco.init({}));
      app = server;

    })().then(done).catch(done);
  });


  after((done) => {
    done();
    // process.exit();
  });
  //
  // /**** Authentication : START ****/
  // describe('Authentication', function () {
  //
  //   const EMAIL_ID = 'abc@g.com'
  //   const VALID_PASSWORD = '1234566778';
  //
  //   it('Signup with valid email', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ SignUp(data : { email: "${EMAIL_ID}", password: "${VALID_PASSWORD}"}){  token }}`
  //       })
  //       .expect(200)
  //       .end(async function (err, res) {
  //         if (err) return done(err);
  //         token = res.body.data?.SignUp?.token;
  //
  //         expect(token).to.be.a('string')
  //         // const payload: any = await JWT.verifyToken(token, config.auth.jwt.secret, config.auth.jwt.options)
  //         //
  //         // expect(payload.email).to.be.eq(EMAIL_ID)
  //
  //         done();
  //       });
  //   });
  //
  //   it('Signup with invalid email', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ SignUp(data : { email: "test", password: "${VALID_PASSWORD}"}){  token }}`
  //       })
  //       .expect(200)
  //       .end(function (err, res) {
  //         if (err) return done(err);
  //         const errorMsg = res.body.errors[0].message;
  //         expect(errorMsg).to.be.a('string')
  //         done();
  //       });
  //
  //   });
  //
  //   it('Signin with valid email', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ SignIn(data : { email: "${EMAIL_ID}", password: "${VALID_PASSWORD}"}){  token }}`
  //       })
  //       .expect(200)
  //       .end(async function (err, res) {
  //         if (err) return done(err);
  //         const data = res.body.data;
  //         expect(data.SignIn).to.be.a('object')
  //         token = res.body.data?.SignIn?.token;
  //         // const payload: any = await JWT.verifyToken(token, config.auth.jwt.secret, config.auth.jwt.options)
  //         expect(token).to.be.a('string')
  //         // expect(payload.email).to.be.equal(EMAIL_ID)
  //         done();
  //       });
  //
  //   });
  //
  //   it('me', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .set({'xc-auth': token})
  //       .send({
  //         query: `{ Me{  email  id }}`
  //       })
  //       .expect(200)
  //       .end(function (err, res) {
  //         if (err) done(err);
  //         const data = res.body.data;
  //         expect(data.Me).to.be.a('object')
  //         expect(data.Me.email).to.be.equal(EMAIL_ID)
  //         done();
  //       });
  //
  //   });
  //
  //
  //   it('Signin with invalid email', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ SignIn(data : { email: "abc@abcc.com", password: "randomPassord"}){  token }}`
  //       })
  //       .expect(200)
  //       .end(function (err, res) {
  //         if (err) done(err);
  //         const errorMsg = res.body.errors[0].message;
  //         expect(errorMsg.indexOf('not registered')).to.be.greaterThan(-1)
  //         done();
  //       });
  //
  //   });
  //
  //   it('Forgot password with a non-existing email id', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ PasswordForgot(email: "abc@abcc.com")}`
  //       })
  //       .expect(200, function (err, res) {
  //         if (err) done(err);
  //
  //         const errorMsg = res.body.errors[0].message;
  //         expect(errorMsg).to.be.equal("This email is not registered with us.")
  //         done();
  //       })
  //   });
  //
  //   it('Forgot password with an existing email id', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ PasswordForgot(email: "${EMAIL_ID}")}`
  //       })
  //       .expect(200)
  //       .end(function (err, res) {
  //         if (err) done(err);
  //         expect(res.body.data.PasswordForgot).to.be.true
  //         done();
  //       })
  //   });
  //
  //   it('Email validate with an invalid token', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ EmailValidate(tokenId: "invalid-token-id")}`
  //       })
  //       .expect(200, function (err, res) {
  //         if (err) done(err);
  //         const errorMsg = res.body.errors[0].message;
  //         expect(errorMsg).to.be.equal("Invalid verification url")
  //         done()
  //       })
  //   });
  //
  //   it('Reset Password with an invalid token', function (done) {
  //     request(app)
  //       .post('/v1/graphql')
  //       .send({
  //         query: `mutation{ PasswordReset(password:"somePassword",tokenId: "invalid-token-id")}`
  //       })
  //       .expect(200, function (err, res) {
  //         if (err) done(err);
  //         const errorMsg = res.body.errors[0].message;
  //         expect(errorMsg).to.be.equal("Invalid token")
  //         done()
  //       })
  //   });
  // });
  //
  // /**** Authentication : END ****/

  /**************** START : Auth ****************/
  describe('Authentication', function () {
    this.timeout(10000);
    const EMAIL_ID = 'abc@g.com'
    const VALID_PASSWORD = '1234566778';

    it('Signup with valid email', function (done) {
      this.timeout(20000)
      request(app)
        .post('/auth/signup')
        .send({email: EMAIL_ID, password: VALID_PASSWORD})
        .expect(200, (err, res) => {
          if (err) {
            expect(res.status).to.equal(400)
          } else {
            const token = res.body.token;
            expect(token).to.be.a("string")
          }
          done();
        });
    });

    it('Signup with invalid email', (done) => {
      request(app)
        .post('/auth/signup')
        .send({email: 'test', password: VALID_PASSWORD})
        .expect(400, done);
    });

    it('Signin with valid credentials', function (done) {
      request(app)
        .post('/auth/signin')
        .send({email: EMAIL_ID, password: VALID_PASSWORD})
        .expect(200, async function (err, res) {
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

    it('me', function (done) {
      request(app)
        .get('/user/me')
        .set('xc-auth', token)
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          const email = res.body.email;
          expect(email).to.equal(EMAIL_ID);
          done();
        });
    });


    it('Change password', function (done) {
      request(app)
        .post('/user/password/change')
        .set('xc-auth', token)
        .send({currentPassword: 'password', newPassword: 'password'})
        .expect(400, done);
    });


    it('Change password - after logout', function (done) {
      // todo:
      request(app)
        .post('/user/password/change')
        .send({currentPassword: 'password', newPassword: 'password'})
        .expect(500, function (_err, _res) {
          done()
        });
    });


    it('Signin with invalid credentials', function (done) {
      request(app)
        .post('/auth/signin')
        .send({email: 'abc@abc.com', password: VALID_PASSWORD})
        .expect(400, done);
    });

    it('Signin with invalid password', function (done) {
      request(app)
        .post('/auth/signin')
        .send({email: EMAIL_ID, password: 'wrongPassword'})
        .expect(400, done);
    });


    it('Forgot password with a non-existing email id', function (done) {
      request(app)
        .post('/auth/password/forgot')
        .send({email: 'abc@abc.com'})
        .expect(400, done);
    });

    it('Forgot password with an existing email id', function (done) {
      this.timeout(10000)
      request(app)
        .post('/auth/password/forgot')
        .send({email: EMAIL_ID})
        .expect(200, done);
    });

    it('Email validate with an invalid token', function (done) {
      request(app)
        .post('/auth/email/validate/someRandomValue')
        .send({email: EMAIL_ID})
        .expect(400, done);
    });

    it('Email validate with a valid token', function (done) {

      console.log('eeee')


      // todo :
      done();

      // request(app)
      //   .post('/auth/email/validate/someRandomValue')
      //   .send({email: EMAIL_ID})
      //   .expect(500, done);
    });


    it('Forgot password validate with an invalid token', function (done) {
      request(app)
        .post('/auth/token/validate/someRandomValue')
        .send({email: EMAIL_ID})
        .expect(400, done);
    });

    it('Forgot password validate with a valid token', function (done) {
      // todo

      done()

      // request(app)
      //   .post('/auth/token/validate/someRandomValue')
      //   .send({email: EMAIL_ID})
      //   .expect(500, done);
    });


    it('Reset Password with an invalid token', function (done) {
      request(app)
        .post('/auth/password/reset/someRandomValue')
        .send({password: 'anewpassword'})
        .expect(400, done);
    });

    it('Reset Password with an valid token', function (done) {
      //todo
      done()

      // request(app)
      //   .post('/auth/password/reset/someRandomValue')
      //   .send({password: 'anewpassword'})
      //   .expect(500, done);
    });


  });

  describe('Project', function () {
    const EMAIL_ID = 'abc@g.com'
    const VALID_PASSWORD = '1234566778';


    before(function (done) {
      this.timeout(120000)
      request(app)
        .post('/auth/signin')
        .send({email: EMAIL_ID, password: VALID_PASSWORD})
        .expect(200, async function (_err, res) {
          token = res.body.token;
          request(app)
            .post('/dashboard')
            .set('xc-auth', token)
            .send(projectCreateReqBody)
            .expect(200, (err, res) => {
              if (err) {
                return done(err)
              }
              projectId = res.body.id;
              done();
            })
        });
    })
    /**** Country : START ****/
    describe('Country', function () {

      /**** Query : START ****/
      it('CountryList', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)
          .set('xc-auth', token)
          .send({
            query: `{ CountryList(limit:5){ country_id country } }`
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const list = res.body.data.CountryList;
            expect(list).length.to.be.most(5)
            expect(list[0]).to.have.all.keys(['country_id', 'country'])
            done()
          })
      });

      it('CountryList - with sort', function (done) {
        // todo: order -> sort

        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryList(sort:"-country_id"){ country_id country } }`
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const list = res.body.data.CountryList;
            expect(list[0]).to.have.all.keys(['country_id', 'country'])

            expect(list).satisfy(array => {
              let i = array.length;
              while (--i) {
                if (array[i].country_id > array[i - 1].country_id) return false;
              }
              return true
            }, 'Should be in descending order')

            done()
          })
      });

      it('CountryList - with limit', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryList(limit:6){ country_id country } }`
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const list = res.body.data.CountryList;
            expect(list[0]).to.have.all.keys(['country_id', 'country'])
            expect(list).to.have.length.most(6)
            done()
          })
      });

      it('CountryList - with offset', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryList(offset:0,limit:6){ country_id country } }`
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const list1 = res.body.data.CountryList;
            expect(list1[0]).to.have.all.keys(['country_id', 'country'])
            request(app)
              .post(`/nc/${projectId}/v1/graphql`)

              .set('xc-auth', token)
              .send({
                query: `{ CountryList(offset:1,limit:5){ country_id country } }`
              })
              .expect(200, function (err, res1) {
                if (err) done(err);
                const list2 = res1.body.data.CountryList;
                expect(list2[0]).to.have.all.keys(['country_id', 'country'])
                expect(list2).satisfy(arr => arr.every(({country, country_id}, i) =>
                  country === list1[i + 1].country && country_id === list1[i + 1].country_id
                ), 'Both data should need to be equal where offset vary with 1')

                done()
              });
          })
      });

      it('CountryList - nested count', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryList{ country_id country CityCount} }`
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const list = res.body.data.CountryList;
            expect(list[0]).to.have.all.keys(['country_id', 'country', 'CityCount'])
            expect(list[0].CityCount).to.be.a('number')
            expect(list[0].CityCount % 1).to.be.equal(0);
            done()
          })
      });

      it('CountryList - nested CityList', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryList{ country_id country CityList { city country_id }} }`
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const list = res.body.data.CountryList;
            expect(list[0]).to.have.all.keys(['country_id', 'country', 'CityList'])
            expect(list[0].CityList).to.be.a('Array')
            if (dbConfig.client !== 'mssql') {
              expect(list[0].CityList[0]).to.be.a('object');
              expect(list[0].CityList[0]).to.have.all.keys(['country_id', 'city'])
              expect(Object.keys(list[0].CityList[0])).to.have.length(2)
              expect(list[0].CityList[0].country_id).to.be.equal(list[0].country_id)
            }
            done()
          })
      });

      it('CountryRead', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryRead(id: "1"){ country_id country } } `
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const data = res.body.data.CountryRead;
            expect(data).to.be.a('object')
            expect(data).to.have.all.keys(['country_id', 'country'])

            done()
          })
      });

      it('CountryExists', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryExists(id: "1") } `
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const data = res.body.data.CountryExists;
            expect(data).to.be.a('boolean')
            expect(data).to.be.equal(true)
            done()
          })
      });

      it('CountryExists - with non-existing id', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryExists(id: "30000") } `
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const data = res.body.data.CountryExists;
            expect(data).to.be.a('boolean')
            expect(data).to.be.equal(false)
            done()
          })
      });

      it('CountryFindOne', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryFindOne (where: "(country_id,eq,1)"){ country country_id } } `
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const data = res.body.data.CountryFindOne;
            expect(data).to.be.a('object')
            expect(data).to.have.all.keys(['country', 'country_id'])
            expect(data.country_id).to.be.equal(1);
            done()
          })
      });

      it('CountryCount - filter by id', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryCount (where: "(country_id,eq,1)") } `
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const data = res.body.data.CountryCount;
            expect(data).to.be.a('number')
            expect(data).to.be.equal(1);
            done()
          })
      });

      it('CountryDistinct', function (done) {
        request(app)
          .post(`/nc/${projectId}/v1/graphql`)

          .set('xc-auth', token)
          .send({
            query: `{ CountryDistinct(column_name: "last_update") { last_update } } `
          })
          .expect(200, function (err, res) {
            if (err) done(err);
            const data = res.body.data.CountryDistinct;
            expect(data).to.be.a('array')
            expect(data[0]).to.be.a('object')
            expect(data[0]).to.have.all.keys(['last_update'])
            expect(data[0].last_update).to.be.match(/\d+/);
            done()
          })
      });

      if (dbConfig.client !== 'mssql') {
        it('CountryGroupBy', function (done) {
          request(app)
            .post(`/nc/${projectId}/v1/graphql`)

            .set('xc-auth', token)
            .send({
              query: `{ CountryGroupBy(fields: "last_update",limit:5) { last_update count  } } `
            })
            .expect(200, function (err, res) {
              if (err) done(err);
              const data = res.body.data.CountryGroupBy;
              expect(data.length).to.be.most(5);
              expect(data[0].count).to.be.greaterThan(0);
              expect(data[0].last_update).to.be.a('string');
              expect(Object.keys(data[0]).length).to.be.equal(2);
              done()
            })
        });

        it('CountryGroupBy - Multiple', function (done) {
          request(app)
            .post(`/nc/${projectId}/v1/graphql`)

            .set('xc-auth', token)
            .send({
              query: `{ CountryGroupBy(fields: "last_update,country",limit:5) { last_update country count  } } `
            })
            .expect(200, function (err, res) {
              if (err) done(err);
              const data = res.body.data.CountryGroupBy;
              expect(data.length).to.be.most(5);
              expect(data[0].count).to.be.greaterThan(0);
              expect(data[0].last_update).to.be.a('string');
              expect(data[0].country).to.be.a('string');
              expect(Object.keys(data[0]).length).to.be.equal(3);
              done()
            })
        });

        it('CountryAggregate', function (done) {
          request(app)
            .post(`/nc/${projectId}/v1/graphql`)

            .set('xc-auth', token)
            .send({
              query: `{ CountryAggregate(func: "sum,avg,min,max,count", column_name : "country_id") { sum avg min max count  } } `
            })
            .expect(200, function (err, res) {
              if (err) done(err);
              const data = res.body.data.CountryAggregate;
              expect(data).to.be.a('array');
              if (data.length) {
                expect(data[0].min).to.be.a('number');
                expect(data[0].max).to.be.a('number');
                expect(data[0].avg).to.be.a('number');
                expect(data[0].sum).to.be.a('number');
                expect(data[0].count).to.be.a('number').and.satisfy(num => num === parseInt(num), 'count should be an integer');
                expect(Object.keys(data[0]).length).to.be.equal(5);
              }
              done();
            })
        });

        it('CountryDistribution', function (done) {
          request(app)
            .post(`/nc/${projectId}/v1/graphql`)

            .set('xc-auth', token)
            .send({
              query: `{ CountryDistribution(column_name : "country_id") { range count  } } `
            })
            .expect(200, function (err, res) {
              if (err) done(err);
              const data = res.body.data.CountryDistribution;
              expect(data).to.be.a('array');
              expect(data[0].count).to.be.a('number');
              expect(data[0].count).satisfies(num => num === parseInt(num) && num >= 0, 'should be a positive integer');
              expect(data[0].range).to.be.a('string');
              expect(data[0].range).to.be.match(/^\d+-\d+$/, 'should match {num start}-{num end} format')
              done();
            })
        });
      }
      /**** Query : END ****/

      /**** Mutation : START ****/
      describe('Mutation', function () {

        const COUNTRY_ID = 9999;
        // const COUNTRY_CREATE_ID = 9998;
        // const COUNTRY_NAME = 'test-name';


        before(function (done) {
          // create table entry for update and delete
          // let db = knex(config.envs.dev.db[0])('country');
          // db.insert({
          //   country_id: COUNTRY_ID,
          //   country: COUNTRY_NAME
          // }).finally(() => done())
          done()
        })

        after(function (done) {

          // delete table entries which is created for the test
          // let db = knex(config.envs.dev.db[0])('country');
          // db.whereIn('country_id', [COUNTRY_ID, COUNTRY_CREATE_ID])
          //   .del()
          //   .finally(() => done())
          done()
        })

        it('CountryCreate', function (done) {
          request(app)
            .post(`/nc/${projectId}/v1/graphql`)
            .set('xc-auth', token)
            .send({
              query: `mutation{ CountryCreate( data : { country: "abcd" ${dbConfig.client === 'sqlite3' ? ' country_id : 999 ' : ''} }) { country_id country } } `
            })
            .expect(200, function (err, res) {
              if (err) done(err);
              const data = res.body.data.CountryCreate;
              expect(data).to.be.a('object');
              expect(data.country_id).to.be.a('number');
              expect(data.country).to.be.equal('abcd');
              done();
            })
        });


        it('CountryUpdate', function (done) {
          request(app)
            .post(`/nc/${projectId}/v1/graphql`)

            .set('xc-auth', token)
            .send({
              query: `mutation{ CountryUpdate( id : "${COUNTRY_ID}", data : { country: "abcd" })  } `
            })
            .expect(200, function (err, res) {
              if (err) done(err);
              const data = res.body.data.CountryUpdate;
              expect(data).to.be.a('number');
              // todo:
              done();
            })
        });

        it('CountryDelete', function (done) {
          request(app)
            .post(`/nc/${projectId}/v1/graphql`)

            .set('xc-auth', token)
            .send({
              query: `mutation{ CountryDelete( id : "${COUNTRY_ID}") }  `
            })
            .expect(200, function (err, res) {
              if (err) done(err);
              const data = res.body.data.CountryDelete;
              expect(data).to.be.a('number')
              // todo:
              done();
            })
        });
      })


      /**** Mutation : END ****/
      // 		CountryCreateBulk(data: [CountryInput]): [Int]
      // 		CountryUpdateBulk(data: [CountryInput]): [Int]
      // 		CountryDeleteBulk(data: [CountryInput]): [Int]
      // 	},
    });
    /**** Country : END ****/
  });
});/**
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
