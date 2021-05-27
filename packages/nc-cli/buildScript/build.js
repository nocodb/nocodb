const fs = require('fs');
const path = require('path');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'), 'utf8'));

const version = packageJson.version.replace(/\.(\d+)$/, (_, v) => {
  return `.${++v}`
});

packageJson.version = version;

fs.writeFileSync(path.join(__dirname,'..','package.json'), JSON.stringify(packageJson, null, 2));
