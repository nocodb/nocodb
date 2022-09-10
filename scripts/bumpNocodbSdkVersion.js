const fs = require('fs')
const path = require('path')

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packages', 'nocodb-sdk', 'package.json'), 'utf8'))

if (process.env.targetEnv === 'DEV') {
    // nightly build
    // e.g. 0.84.2-20220220-1250
    // pr build
    // e.g. 0.84.2-pr-1234-20220220-1250
    packageJson.version = `${packageJson.version}-${process.env.targetVersion}`
    packageJson.name += '-daily'
} else {
    packageJson.version = process.env.targetVersion
}
fs.writeFileSync(path.join(__dirname, '..', 'packages', 'nocodb-sdk', 'package.json'), JSON.stringify(packageJson, 0, 2))