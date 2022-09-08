import { NcConfigFactory } from "../../src/lib";


const sakilaTableNames = [
  'actor',
  'address',
  'category',
  'city',
  'country',
  'customer',
  'film',
  'film_actor',
  'film_category',
  'film_text',
  'inventory',
  'language',
  'payment',
  'rental',
  'staff',
  'store',
  'actor_info',
  'customer_list',
  'film_list',
  'nicer_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

const dbName = 'test_meta';
const sakilaDbName = 'test_sakila';
const dbUser = 'root';
const dbPassword = 'password';

process.env[`DATABASE_URL`] = `mysql2://${dbUser}:${dbPassword}@localhost:3306/${dbName}`;

const dbConfig = NcConfigFactory.urlToDbConfig(
  NcConfigFactory.extractXcUrlFromJdbc(process.env[`DATABASE_URL`])
);
dbConfig.connection.database = dbName;
dbConfig.meta = {
  tn: 'nc_evolutions',
  dbAlias: 'db',
  api: {
    type: 'rest',
    prefix: '',
    graphqlDepthLimit: 10,
  },
  inflection: {
    tn: 'camelize',
    column_name: 'camelize',
  },
} as any;

export { dbConfig, dbName, sakilaTableNames, sakilaDbName, dbUser, dbPassword };
