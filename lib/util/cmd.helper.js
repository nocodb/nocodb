'use strict';
const program = require('commander');
const colors = require('colors');

program.on('--help', () => {
  console.log('')
  console.log('  Examples:'.blue)
  console.log('')
  console.log('    $ xmysql -u username -p password -d databaseSchema'.blue)
  console.log('')
})

program
  .version('0.2.1')
  .option('-h, --host <n>', 'hostname')
  .option('-d, --database <n>', 'database schema name')
  .option('-u, --user <n>', 'username of database / root by default')
  .option('-p, --password <n>', 'password of database / empty by default')
  .option('-n, --portNumber <n>', 'port number / 3000 by default')
  .option('-s, --storageFolder <n>', 'storage folder / current working dir by default / available only with local')
  .parse(process.argv)


function paintHelp(txt) {
  return colors.magenta(txt) //display the help text in a color
}

function processInvalidArguments(program) {

  let err = '';

  if (!program.password) {
    err += 'Error: password for database is missing\n';
  }

  if (!program.database) {
    err += 'Error: database name is missing\n';
  }

  if (err !== '') {
    program.outputHelp(paintHelp)
    console.log(err.red)
  }
}

exports.handle = program => {

  /**************** START : default values ****************/
  program.portNumber = program.portNumber || 3000;
  program.user = program.user || 'root';
  program.password = program.password || '';
  program.host = program.host || 'localhost';
  program.storageFolder = program.storageFolder || process.cwd()

  program.connectionLimit = 10;

  if (program.host === 'localhost' || program.host === '127.0.0.1' || program.host === '::1') {
    program.dynamic = 1
  }
  //console.log(program.rawArgs);
  /**************** END : default values ****************/


  if (program.database && program.host && program.user) {
    //console.log('Starting server at:', 'http://' + program.host + ':' + program.portNumber)
  } else {
    processInvalidArguments(program)
    process.exit(1)
  }

};
