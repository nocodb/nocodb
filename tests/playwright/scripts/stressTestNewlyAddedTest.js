// eslint-disable-next-line no-undef
const util = require('util');
// eslint-disable-next-line no-undef
const exec = util.promisify(require('child_process').exec);
// Get items from `git diff develop'

void (async () => {
  const { stdout: allFileNames } = await exec('git diff --name-only origin/develop');
  // return if no changed file ends with .js
  const testFilesInChangedFiles = allFileNames
    .split('\n')
    .filter(fileName => fileName.endsWith('.spec.ts'))
    .filter(fileName => fileName.startsWith('+')); // Only get newly added files
  if (testFilesInChangedFiles.length === 0) {
    console.log('No test file changed, skipping stress test');
    return;
  }

  const { stdout } = await exec(`git diff origin/develop -- **/*.spec.ts | grep test\\( | cat`);
  // eslint-disable-next-line no-undef
  const dbType = process.env.E2E_DB_TYPE;

  // get test names which is in the form of `+  test('test name', () => {'
  const testNames = stdout
    .match(/\+ {2}test\('(.*)',/g)
    // extract test name by removing `+  test('` and `',*`
    .map(testName => testName.replace("test('", '').trimEnd().slice(0, -2).slice(1, testName.length).trim());
  console.log({ dbType, testNames });

  // run all the tests by title using regex with exact match
  const { stdout: pwStdout } = await exec(
    `PLAYWRIGHT_HTML_REPORT=playwright-report-stress E2E_DB_TYPE=${dbType} pnpm exec playwright test --repeat-each=2 --workers=2 -g "${testNames.join(
      '|'
    )}"`
  );
  console.log('pwStdout:', pwStdout);
})();
