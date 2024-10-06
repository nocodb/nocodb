import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import CryptoJS from 'crypto-js';

const logger = {
  log: (message: string) => {
    console.log(
      `[ncXcdbCreatedAndUpdatedSystemFieldsUpgrader ${Date.now()}] ` + message,
    );
  },
  error: (message: string) => {
    console.error(
      `[ncXcdbCreatedAndUpdatedSystemFieldsUpgrader ${Date.now()}] ` + message,
    );
  },
};

const decyptConfig = async (encryptedConfig: string, secret: string) => {
  return CryptoJS.AES.decrypt(
    encryptedConfig,
    secret,
  ).toString(CryptoJS.enc.Utf8),
}

// decrypt datasource details in source table and integration table
export default async function ({ ncMeta }: NcUpgraderCtx) {
  let encryptionKey = process.env.NC_AUTH_JWT_SECRET;

  if (!encryptionKey) {
    encryptionKey = (
      await this._ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key: 'nc_auth_jwt_secret',
        },
      )
    )?.value;
  }

  // if encryption key is not present, return
  if (!encryptionKey) {
    return;
  }

  // get all external sources
  const sources = await ncMeta.knexConnection(MetaTable.BASES).condition({
    _not: {
      _or: [
        {
          is_meta: {
            eq: 1,
          },
        },
        ...(Noco.isEE()
          ? [
              {
                is_local: {
                  eq: 1,
                },
              },
            ]
          : []),
      ],
    },
  });

  // iterate, decrypt and update
  for (const source of sources) {
    if (source?.config) {
      try {
        const decrypted = await decyptConfig(source.config, encryptionKey);
        await ncMeta.knexConnection(MetaTable.BASES).update({
          config: decrypted,
        });
      } catch (e) {
        logger.error(`Failed to decrypt source ${source.id}`);
        throw e
      }
    }
  }

  // get all integrations
  const integrations = await ncMeta.knexConnection(MetaTable.INTEGRATIONS);

  // iterate, decrypt and update
  for (const integration of integrations) {
    if (integration?.config) {
      try {
        const decrypted = await decyptConfig(integration.config, encryptionKey);
        await ncMeta.knexConnection(MetaTable.INTEGRATIONS).update({
          config: decrypted,
        });
      } catch (e) {
        logger.error(`Failed to decrypt integration ${integration.id}`);
        throw e
      }
    }
  }
}
