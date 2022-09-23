import 'mocha';

import restTests from './rest/index.test';
import modelTests from './model/index.test';
import TestDbMngr from './TestDbMngr'

process.env.NODE_ENV = 'test';
process.env.TEST = 'test';
process.env.NC_DISABLE_CACHE = 'true';
process.env.NC_DISABLE_TELE = 'true';


(async function() {
  await TestDbMngr.init();

  modelTests();
  restTests();

  run();
})();