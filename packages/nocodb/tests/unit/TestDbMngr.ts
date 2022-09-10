import { DbConfig } from "../../src/interface/config";
import { NcConfigFactory } from "../../src/lib";
import SqlMgrv2 from "../../src/lib/db/sql-mgr/v2/SqlMgrv2";
import fs from 'fs';

export default class TestDbMngr {
  public static readonly dbName = 'test_meta';
  public static readonly sakilaDbName = 'test_sakila';

  public static dbConfig: DbConfig;
  
  static switchToSqlite() {
    process.env[`DATABASE_URL`] = `sqlite:///${TestDbMngr.dbName}.sqlite`;
    TestDbMngr.dbConfig = NcConfigFactory.urlToDbConfig(
      NcConfigFactory.extractXcUrlFromJdbc(process.env[`DATABASE_URL`])
    );
  }

  static async testConnection() {
    try {
      return await SqlMgrv2.testConnection(TestDbMngr.dbConfig);
    } catch (e) {
      console.log(e);
      return { code: -1, message: 'Connection invalid' };
    }
  }

  static async init({
    user = 'root',
    password = 'password',
    host = 'localhost',
    port = 3306,
    client = 'mysql2',
  } = {}) {
    if(!process.env[`DATABASE_URL`]){
      process.env[`DATABASE_URL`] = `${client}://${user}:${password}@${host}:${port}/${TestDbMngr.dbName}`;
    }

    TestDbMngr.dbConfig = NcConfigFactory.urlToDbConfig(
      NcConfigFactory.extractXcUrlFromJdbc(process.env[`DATABASE_URL`])
    );
    this.dbConfig.meta = {
      tn: 'nc_evolutions',
      dbAlias: 'db',
      api: {
        type: 'rest',
        prefix: '',
        graphqlDepthLimit: 10,
      },
      inflection: {
        tn: 'camelize',
        cn: 'camelize',
      },
    }

    const result = await TestDbMngr.testConnection()
    if(result.code === -1){
      TestDbMngr.switchToSqlite();
    }
  }

  static getMetaDbConfig() {
    return TestDbMngr.dbConfig;
  }

  static getSakilaDbConfig() {
    const sakilaDbConfig = { ...TestDbMngr.dbConfig };
    sakilaDbConfig.connection.database = TestDbMngr.sakilaDbName;
    sakilaDbConfig.connection.multipleStatements = true

    return sakilaDbConfig;
  }

  static async seedSakila(sakilaKnexClient) {     
    const testsDir = __dirname.replace('tests/unit', 'tests');
    const schemaFile = fs.readFileSync(`${testsDir}/mysql-sakila-db/03-test-sakila-schema.sql`).toString();
    const dataFile = fs.readFileSync(`${testsDir}/mysql-sakila-db/04-test-sakila-data.sql`).toString();

    await sakilaKnexClient.raw(schemaFile);
    await sakilaKnexClient.raw(dataFile);
  }

}