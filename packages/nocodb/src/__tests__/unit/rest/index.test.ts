import 'mocha';
import authTests from './tests/auth.test';
import projectTests from './tests/project.test';

process.env.NODE_ENV = 'test';
process.env.TEST = 'test';
process.env.NC_DISABLE_CACHE = 'true';

authTests();
projectTests();
