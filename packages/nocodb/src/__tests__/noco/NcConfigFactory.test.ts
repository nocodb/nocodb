import { expect } from 'chai';
import 'mocha';
import { NcConfigFactory } from '../../lib';

describe('Config Factory Tests', () => {
  const expectedObject = {
    client: 'pg',
    connection: {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'xgene',
      database: 'abcde'
    },
    pool: {
      min: 1,
      max: 2
    },
    ssl: {
      rejectUnauthorized: false
    },
    acquireConnectionTimeout: 600000
  };

  before(function(done) {
    done();
  });

  after(done => {
    done();
  });

  it('Generate config from string', function(done) {
    const config = NcConfigFactory.metaUrlToDbConfig(
      `pg://localhost:5432?u=postgres&p=xgene&d=abcde`
    );
    const { pool, ssl, ...rest } = expectedObject;
    expect(config).to.deep.equal(rest);
    done();
  });
  it('Connection string with nested property', function(done) {
    const config = NcConfigFactory.metaUrlToDbConfig(
      `pg://localhost:5432?u=postgres&p=xgene&d=abcde&pool.min=1&pool.max=2&ssl.rejectUnauthorized=false`
    );
    expect(config).to.deep.equal(expectedObject);
    done();
  });
  it('Allow creating config from JSON string', function(done) {
    try {
      process.env.NC_DB_JSON = JSON.stringify(expectedObject);

      const {
        meta: { db: config }
      } = NcConfigFactory.make();
      expect(config).to.deep.equal(expectedObject);
      done();
    } finally {
      delete process.env.NC_DB_JSON;
    }
  });
  it('Allow creating config from JSON file', function(done) {
    try {
      process.env.NC_DB_JSON_FILE = `${__dirname}/dbConfig.json`;

      const {
        meta: { db: config }
      } = NcConfigFactory.make();
      expect(config).to.deep.equal(expectedObject);
      done();
    } finally {
      delete process.env.NC_DB_JSON_FILE;
    }
  });
});
