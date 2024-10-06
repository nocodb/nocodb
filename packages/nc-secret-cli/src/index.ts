import figlet from "figlet";
import { Command } from 'commander';
import { getNocoConfig } from "./core";
import { SecretManager } from "./core";
import { NcError } from "./core";
import { logger } from "./core";

console.log(figlet.textSync("NocoDB Secret CLI"));

const program = new Command();

program
  .version('1.0.0')
  .description('NocoDB Secret CLI')
  .arguments('<prevSecret> <newSecret>')
  .option('--nc-db <char>', 'NocoDB  connection database url, equivalent to NC_DB env variable')
  .option('--nc-db-json <char>', 'NocoDB connection database json, equivalent to NC_DB_JSON env variable')
  .option('--nc-db-json-file <char>', 'NocoDB connection database json file path, equivalent to NC_DB_JSON_FILE env variable')
  .option('--database-url <char>', 'JDBC database url, equivalent to DATABASE_URL env variable')
  .option('--database-url-file <char>', 'JDBC database url file path, equivalent to DATABASE_URL_FILE env variable')
  .option('-p, --prev <char>', 'old secret string to decrypt sources and integrations')
  .option('-n, --new <char>', 'new secret string to encrypt sources and integrations')
  .action(async (prevVal, newVal) => {

    try {
      // extract options
      const options = program.opts();
      const config = await getNocoConfig(options);
      const { prevSecret = prevVal, newSecret = newVal } = program.opts();

      if (!prevSecret || !newSecret) {
        console.error('Error: Both prevSecret and newSecret are required.');
        program.help();
      } else {
        const secretManager = new SecretManager(prevSecret, newSecret, config);

        // validate meta db config which is resolved from env variables
        await secretManager.validateConfig();

        // validate old secret
        const { sourcesToUpdate, integrationsToUpdate } = await secretManager.validateAndExtract();


        // update sources and integrations
        await secretManager.updateSecret(sourcesToUpdate, integrationsToUpdate);

      }
    } catch (e) {
      if (e instanceof NcError) {
        // print error message in a better way
        logger.error(e.message);
        process.exit(1);
      }
      console.error(e);
      process.exit(1);
    }
  });



// Add error handling
program.exitOverride((err) => {
  console.error(err.message);
  process.exit(1);
});

program.parse(process.argv);





