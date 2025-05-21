const fs = require('fs')
const path = require('path')

const packageJsonPath = path.join(__dirname, '..', 'packages', 'nc-secret-mgr', 'package.json')

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

if (!process.env.targetVersion) {
  console.error('Error: targetVersion environment variable is not defined.');
  process.exit(1);
}

packageJson.version = process.env.targetVersion
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
