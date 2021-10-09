const fs = require('fs')
const path = require('path')

const execSync = require('child_process').execSync;

// extract latest version from package.json
const ncLibPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packages', 'nc-lib-gui', 'package.json')))

// upgrade nc-lib-gui version in nocodb
execSync(`cd packages/nocodb && npm install --save --save-exact nc-lib-gui@${ncLibPackage.version}`, {});

const nocodbPackageFilePath = path.join(__dirname, '..', 'packages', 'nocodb', 'package.json')
const nocoLibPackage = JSON.parse(fs.readFileSync(nocodbPackageFilePath))
nocoLibPackage.version = process.env.VERSION;
fs.writeFileSync(nocodbPackageFilePath, JSON.stringify(nocoLibPackage, null, 2));
