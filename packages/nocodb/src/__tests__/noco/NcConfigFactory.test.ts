import { expect } from 'chai';
import 'mocha';
import { NcConfigFactory } from '../../lib';

describe('Config Factory Tests', () => {
  const storedDbConfig = {
    client: 'pg',
    connection: {
      database: 'abcde',
      user: 'postgres',
      password: 'xgene',
      host: 'localhost',
      port: 5432,
    },
    ssl: {
      rejectUnauthorized: false,
    },
    pool: {
      min: 1,
      max: 2,
    },
    acquireConnectionTimeout: 600000,
  };

  before(function (done) {
    done();
  });

  after((done) => {
    done();
  });

  it('Generate config from string', function (done) {
    const dbConfig = NcConfigFactory.metaUrlToDbConfig(
      `pg://localhost:5432?u=postgres&p=xgene&d=abcde`
    );
    const { pool, ssl, ...rest } = storedDbConfig;
    expect(dbConfig).to.deep.equal(rest);
    done();
  });

  it('Generate config from DATABASE_URL', function (done) {
    // postgres url
    const ncDbUrl = NcConfigFactory.extractXcUrlFromJdbc(
      'postgres://username:password@host:5432/db'
    );
    expect(ncDbUrl).to.be.equal('pg://host:5432?u=username&p=password&d=db&');

    // postgres url without port
    const ncDbUrl1 = NcConfigFactory.extractXcUrlFromJdbc(
      'postgres://username:password@host/db'
    );
    expect(ncDbUrl1).to.be.equal('pg://host:5432?u=username&p=password&d=db&');

    // mysql url
    const ncDbUrl2 = NcConfigFactory.extractXcUrlFromJdbc(
      'jdbc:mysql://localhost/sample_db'
    );
    expect(ncDbUrl2).to.be.equal('mysql2://localhost:3306?d=sample_db&');

    // mariadb url
    const ncDbUrl3 = NcConfigFactory.extractXcUrlFromJdbc(
      'jdbc:mariadb://localhost/sample_db'
    );
    expect(ncDbUrl3).to.be.equal('mysql2://localhost:3306?d=sample_db&');

    done();
  });

  it('Connection string with nested property', function (done) {
    const dbConfig = NcConfigFactory.metaUrlToDbConfig(
      `pg://localhost:5432?u=postgres&p=xgene&d=abcde&pool.min=1&pool.max=2&ssl.rejectUnauthorized=false`
    );
    expect(dbConfig).to.deep.equal(storedDbConfig);
    done();
  });

  it('Allow creating config from JSON string', function (done) {
    try {
      process.env.NC_DB_JSON = JSON.stringify(storedDbConfig);

      const {
        meta: { db: dbConfig },
      } = NcConfigFactory.make();

      expect(dbConfig).to.deep.equal(storedDbConfig);
      done();
    } finally {
      delete process.env.NC_DB_JSON;
    }
  });

  it('Allow creating config from JSON file', function (done) {
    try {
      process.env.NC_DB_JSON_FILE = `${__dirname}/dbConfig.json`;

      const {
        meta: { db: dbConfig },
      } = NcConfigFactory.make();

      expect(dbConfig).to.deep.equal(storedDbConfig);
      done();
    } finally {
      delete process.env.NC_DB_JSON_FILE;
    }
  });
});
