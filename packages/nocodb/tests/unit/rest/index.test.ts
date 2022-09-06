import 'mocha';
import authTests from './tests/auth.test';
import projectTests from './tests/project.test';
import tableTests from './tests/table.test';
import tableRowTests from './tests/tableRow.test';
import viewRowTests from './tests/viewRow.test';

process.env.NODE_ENV = 'test';
process.env.TEST = 'test';
process.env.NC_DISABLE_CACHE = 'true';

authTests();
projectTests();
tableTests();
tableRowTests();
viewRowTests();