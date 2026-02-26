import 'mocha';
import dotenv from 'dotenv';
import modelTests from './model/index.test';
import metaApiV3Tests from './rest/tests/metaApiV3/index.test';
import TestDbMngr from './TestDbMngr';

process.env.NODE_ENV = 'test';
process.env.TEST = 'true';
process.env.NC_DISABLE_TELE = 'true';

dotenv.config({
  path: __dirname + '/.env',
});

(async function () {
  await TestDbMngr.init();

  modelTests();
  metaApiV3Tests();

  run();
})();
