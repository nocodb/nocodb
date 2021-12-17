// import { expect } from 'chai';
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

describe('Operation Tests', () => {
  let app;

  /* setup for the tests */
  before(function(done) {
    this.timeout(200000);

    (async () => {
      const server = express();

      server.use(await Noco.init());
      app = server;
    })()
      .then(done)
      .catch(e => {
        done(e);
      });
  });

  after(done => {
    done();
  });

  describe('Rename tables', function() {
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

    /**************** START : create ****************/
    // it('Normal: file -> movies', function(done) {
    //     request(app)
    //       .post(`/dashboard/?q=sqlOp_ncTableAliasRename`)
    //       .set('xc-auth', token)
    //       .send({
    //         api: 'ncTableAliasRename',
    //         args: { tn: 'movies', tn_old: 'film' },
    //         dbAlias: 'dbundefined',
    //         env: '_noco',
    //         project_id: projectId
    //       })
    //       .expect(200, err => {
    //         if (err) done(err);
    //         else done();
    //       });
    //   });
    /**************** END : create ****************/

    /**************** START : rename ****************/
    it('Normal: film -> movies', function(done) {
      request(app)
        .post(`/dashboard/?q=sqlOp_ncTableAliasRename`)
        .set('xc-auth', token)
        .send({
          api: 'ncTableAliasRename',
          args: { tn: 'movies', tn_old: 'film' },
          dbAlias: 'dbundefined',
          env: '_noco',
          project_id: projectId
        })
        .expect(200, err => {
          if (err) done(err);
          else done();
        });
    });

    it('Uppercase: movies -> MOVIES', function(done) {
      request(app)
        .post(`/dashboard/?q=sqlOp_ncTableAliasRename`)
        .set('xc-auth', token)
        .send({
          api: 'ncTableAliasRename',
          args: { tn: 'MOVIES', tn_old: 'movies' },
          dbAlias: 'dbundefined',
          env: '_noco',
          project_id: projectId
        })
        .expect(200, err => {
          if (err) done(err);
          else done();
        });
    });

    it('Weird name: MOvies ->  mOVIes', function(done) {
      request(app)
        .post(`/dashboard/?q=sqlOp_ncTableAliasRename`)
        .set('xc-auth', token)
        .send({
          api: 'ncTableAliasRename',
          args: { tn: 'mOVIes', tn_old: 'MOVIES' },
          dbAlias: 'dbundefined',
          env: '_noco',
          project_id: projectId
        })
        .expect(200, err => {
          if (err) done(err);
          else done();
        });
    });

    it('Single letter: mOVIes -> m', function(done) {
      request(app)
        .post(`/dashboard/?q=sqlOp_ncTableAliasRename`)
        .set('xc-auth', token)
        .send({
          api: 'ncTableAliasRename',
          args: { tn: 'm', tn_old: 'mOVIes' },
          dbAlias: 'dbundefined',
          env: '_noco',
          project_id: projectId
        })
        .expect(200, err => {
          if (err) done(err);
          else done();
        });
    });

    it('Special char: m -> m_s', function(done) {
      request(app)
        .post(`/dashboard/?q=sqlOp_ncTableAliasRename`)
        .set('xc-auth', token)
        .send({
          api: 'ncTableAliasRename',
          args: { tn: 'm_s', tn_old: 'm' },
          dbAlias: 'dbundefined',
          env: '_noco',
          project_id: projectId
        })
        .expect(200, err => {
          if (err) done(err);
          else done();
        });
    });

    it('Back: m_s -> film ', function(done) {
      request(app)
        .post(`/dashboard/?q=sqlOp_ncTableAliasRename`)
        .set('xc-auth', token)
        .send({
          api: 'ncTableAliasRename',
          args: { tn: 'm_s', tn_old: 'film' },
          dbAlias: 'dbundefined',
          env: '_noco',
          project_id: projectId
        })
        .expect(200, err => {
          if (err) done(err);
          else done();
        });
    });
  });
  /**************** END : operations ****************/
});
