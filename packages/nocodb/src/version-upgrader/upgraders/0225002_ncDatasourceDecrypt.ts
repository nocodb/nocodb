import process from 'process';
import CryptoJS from 'crypto-js';
import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

const logger = {
  log: (message: string) => {
    console.log(`[0225002_ncDatasourceDecrypt ${Date.now()}] ` + message);
  },
  error: (message: string) => {
    console.error(`[0225002_ncDatasourceDecrypt ${Date.now()}] ` + message);
  },
};

const decryptConfig = async (encryptedConfig: string, secret: string) => {
  return CryptoJS.AES.decrypt(encryptedConfig, secret).toString(
    CryptoJS.enc.Utf8,
  );
};

// decrypt datasource details in source table and integration table
export default async function ({ ncMeta }: NcUpgraderCtx) {
  let encryptionKey = process.env.NC_AUTH_JWT_SECRET;

  if (!encryptionKey) {
    encryptionKey = (
      await ncMeta.metaGet(RootScopes.ROOT, RootScopes.ROOT, MetaTable.STORE, {
        key: 'nc_auth_jwt_secret',
      })
    )?.value;
  }

  // if encryption key is same as previous, return
  if (
    process.env.NC_KEY_CREDENTIAL_ENCRYPT &&
    process.env.NC_KEY_CREDENTIAL_ENCRYPT === encryptionKey
  ) {
    return;
  }

  // if encryption key is not present, return
  if (!encryptionKey) {
    return;
  }

  // get all external sources
  const sources = await ncMeta.knexConnection(MetaTable.SOURCES);

  const passed = [];

  // iterate, decrypt and update
  for (const source of sources) {
    if (source?.config) {
      try {
        const decrypted = await decryptConfig(source.config, encryptionKey);
        await ncMeta
          .knexConnection(MetaTable.SOURCES)
          .update({
            config: decrypted,
          })
          .where('id', source.id);
        passed.push(true);
      } catch (e) {
        logger.error(`Failed to decrypt source ${source.id}`);
        passed.push(false);
      }
    }
  }

  // get all integrations
  const integrations = await ncMeta.knexConnection(MetaTable.INTEGRATIONS);

  // iterate, decrypt and update
  for (const integration of integrations) {
    if (integration?.config) {
      try {
        const decrypted = await decryptConfig(
          integration.config,
          encryptionKey,
        );
        await ncMeta
          .knexConnection(MetaTable.INTEGRATIONS)
          .update({
            config: decrypted,
          })
          .where('id', integration.id);
        passed.push(true);
      } catch (e) {
        logger.error(`Failed to decrypt integration ${integration.id}`);
        passed.push(false);
      }
    }
  }

  // if all failed, log and exit
  if (passed.length > 0 && passed.every((v) => !v)) {
    logger.error(
      `Failed to decrypt all source or integration. Please configure correct encryption key. `,
    );
    return;
  }

  logger.log(`Decrypted ${passed.length} sources and integrations`);
}
