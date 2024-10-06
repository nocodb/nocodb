import figlet from "figlet";
import { Command } from 'commander';
import { getNocoConfig } from "./core/NcConfig";
import { SecretManager } from "./core/SecretManager";
import { NcError } from "./core/NcError";
import { NcLogger } from "./core/NcLogger";

console.log(figlet.textSync("NocoDB Secret CLI"));

const program = new Command();

program
  .version('1.0.0')
  .description('NocoDB Secret CLI')
  .arguments('<oldSecret> <newSecret>')
  .option('--nc-db <nc-db>', 'NocoDB  connection database url, equivalent to NC_DB env variable')
  .option('--nc-db-json <nc-db-json>', 'NocoDB connection database json, equivalent to NC_DB_JSON env variable')
  .option('--nc-db-json-file <nc-db-json-file>', 'NocoDB connection database json file path, equivalent to NC_DB_JSON_FILE env variable')
  .option('--database-url <database-url>', 'JDBC database url, equivalent to DATABASE_URL env variable')
  .option('--database-url-file <database-url-file>', 'JDBC database url file path, equivalent to DATABASE_URL_FILE env variable')
  .option('-o, --old-secret <old-secret>', 'old secret string to decrypt sources and integrations')
  .option('-n, --new-secret <new-secret>', 'new secret string to encrypt sources and integrations')
  .action(async (key, value, ...rest) => {

    try {

      const config = await getNocoConfig();

      if (!key || !value) {
        console.error('Error: Both key and value are required.');
        program.help();
      } else {
        const secretManager = new SecretManager(key, value, config);

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
        NcLogger.error(e.message);

        process.exit(1);
      }
      console.error(e);
    }
  });



// Add error handling
program.exitOverride();

program.parse(process.argv);





