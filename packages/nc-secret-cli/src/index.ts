import figlet from "figlet";

console.log(figlet.textSync("Nocodb Secret CLI"));

import { Command } from 'commander';
import { getNocoConfig } from "./nc-config";
import { SecretManager } from "./core/SecretManager";

const program = new Command();

program
    .version('1.0.0')
    .description('NocoDB Secret CLI')
    .arguments('<oldSecret> <newSecret>')
    .action(async (key, value) => {

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
    });



// Add error handling
program.exitOverride();

program.parse(process.argv);
