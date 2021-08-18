import {expect} from 'chai';
import 'mocha';
import {NcConfigFactory} from "../../lib";


describe('Config Factory Tests', () => {


  before(function (done) {
    done();
  });


  after((done) => {
    done();
  })

  it('Generate config from string', function (done) {
    const config = NcConfigFactory.metaUrlToDbConfig(`pg://localhost:5432?u=postgres&p=xgene&d=abcde`);
    expect(config.client).to.be.eq('pg')
    expect(config.connection).to.be.a('object')
    expect(config.connection.user).to.be.eq('postgres')
    expect(config.connection.port).to.be.eq(5432)
    expect(config.connection.password).to.be.eq('xgene')
    expect(config.connection.database).to.be.eq('abcde')
    done();
  });
  it('Connection string with nested property', function (done) {
    const config = NcConfigFactory.metaUrlToDbConfig(`pg://localhost:5432?u=postgres&p=xgene&d=abcde&pool.min=1&pool.max=2&ssl.rejectUnauthorized=false`);
    expect(config.client).to.be.eq('pg')
    expect(config.connection).to.be.a('object')
    expect(config.connection.user).to.be.eq('postgres')
    expect(config.connection.port).to.be.eq(5432)
    expect(config.connection.password).to.be.eq('xgene')
    expect(config.connection.database).to.be.eq('abcde')
    expect(config.pool).to.be.a('object')
    expect(config.pool.min).to.be.eq(1)
    expect(config.pool.max).to.be.eq(2)
    expect(config.ssl).to.be.a('object')
    expect(config.ssl.rejectUnauthorized).to.be.eq(false)
    done();
  });
});
