const fs = require('fs')
const path = require('path')
console.log(path.join(__dirname, '..', 'packages', 'nocodb-sdk', 'package.json'))
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packages', 'nocodb-sdk', 'package.json'), 'utf8'))
const version = packageJson.version
  .replace(/\.(\d+)$/, (_, v) => {
    return `.${++v}`
  })

if (process.env.targetEnv === 'DEV') {
    // nightly build
    // e.g. 0.84.2-20220220-1250
    packageJson.version = `${packageJson.version}-${process.env.targetVersion}`
    packageJson.name += '-daily'
} else {
    packageJson.version = version
}
fs.writeFileSync(path.join(__dirname, '..', 'packages', 'nocodb-sdk', 'package.json'), JSON.stringify(packageJson, 0, 2))