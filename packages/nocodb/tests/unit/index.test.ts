import 'mocha';
import dotenv from 'dotenv';
import restTests from './rest/index.test';
import modelTests from './model/index.test';
import TestDbMngr from './TestDbMngr';
import { dataApiV3Test } from './rest/tests/dataApiV3/index.test';

process.env.NODE_ENV = 'test';
process.env.TEST = 'true';
process.env.NC_DISABLE_CACHE = 'true';
process.env.NC_DISABLE_TELE = 'true';

// Load environment variables from .env file
dotenv.config({
  path: __dirname + '/.env',
});

(async function () {
  await TestDbMngr.init();

  modelTests();
  restTests();
  await dataApiV3Test();

  run();
})();
