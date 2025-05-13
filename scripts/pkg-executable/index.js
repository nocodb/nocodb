process.env.NC_BINARY_BUILD = 'true';

const args = process.argv.slice(2);

const knownFlags = ['-h', '--help'];
const unknownFlags = args.filter(arg => arg.startsWith('-') && !knownFlags.includes(arg));
const helpText = `
Usage:
  nocodb [options]

Options:
  -h, --help     Show this help message and exit

Description:
  NocoDB turns your database into a smart spreadsheet.

For more information, visit: https://github.com/nocodb/nocodb
  `

if (unknownFlags.length > 0) {
  console.log(`Unknown option(s): ${unknownFlags.join(', ')}`);
  console.log(helpText);
  process.exit(1);
}

if (args.includes('-h') || args.includes('--help')) {
  console.log(helpText);
  process.exit(0);
}

(async () => {
  try {
    const app = require('express')();
    const {Noco} = require("nocodb");
    const port = process.env.PORT || 8080;
    const httpServer = app.listen(port);
    app.use(await Noco.init({}, httpServer, app));
    console.log(`Visit : localhost:${port}/dashboard`)
  } catch(e) {
    console.log(e)
  }
})()
