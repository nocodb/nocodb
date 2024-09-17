const fs = require('fs')
const path = require('path')

const packageJsonPath =path.join(__dirname, '..', 'packages', 'nc-secret-cli', 'package.json')

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
packageJson.version = process.env.targetVersion
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, 0, 2))
