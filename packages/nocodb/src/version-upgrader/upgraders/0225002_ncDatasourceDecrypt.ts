import CryptoJS from 'crypto-js';
import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import { MetaTable, RootScopes } from '~/utils/globals';

const logger = {
  log: (message: string) => {
    console.log(`[0225002_ncDatasourceDecrypt ${Date.now()}] ` + message);
  },
  error: (message: string) => {
    console.error(`[0225002_ncDatasourceDecrypt ${Date.now()}] ` + message);
  },
};

const decryptConfigWithFallbackKey = async ({
  encryptedConfig,
  secret,
  fallbackSecret,
  fallbackToNullIfFailed = false,
}: {
  encryptedConfig: string;
  secret: string;
  fallbackSecret?: string;
  fallbackToNullIfFailed?: boolean;
}) => {
  if (!encryptedConfig) return encryptedConfig;

  try {
    const decryptedVal = CryptoJS.AES.decrypt(encryptedConfig, secret).toString(
      CryptoJS.enc.Utf8,
    );

    let parsedVal;

    // validate by parsing JSON
    try {
      parsedVal = JSON.parse(decryptedVal);
    } catch (parseError) {
      throw new Error(`JSON parse failed: ${parseError.message}`);
    }
    // if parsed value is null, return null
    return parsedVal === null ? null : decryptedVal;
  } catch (e) {
    if (fallbackSecret) {
      logger.log('Retrying decryption with a fallback mechanism');
      return decryptConfigWithFallbackKey({
        encryptedConfig,
        secret: fallbackSecret,
      });
    }

    if (fallbackToNullIfFailed) {
      return null;
    }

    throw e;
  }
};

// decrypt datasource details in source table and integration table
export default async function ({ ncMeta }: NcUpgraderCtx) {
  logger.log('Starting decryption of sources and integrations');

  let encryptionKey = process.env.NC_AUTH_JWT_SECRET;
  let fallbackEncryptionKey: string | null = null;

  const encryptionKeyFromMeta = (
    await ncMeta.metaGet(RootScopes.ROOT, RootScopes.ROOT, MetaTable.STORE, {
      key: 'nc_auth_jwt_secret',
    })
  )?.value;

  if (!encryptionKey) {
    encryptionKey = encryptionKeyFromMeta;
  } else {
    fallbackEncryptionKey = encryptionKeyFromMeta;
  }

  // if encryption key is same as previous, just update is_encrypted flag and return
  if (
    process.env.NC_CONNECTION_ENCRYPT_KEY &&
    process.env.NC_CONNECTION_ENCRYPT_KEY === encryptionKey
  ) {
    logger.log('Encryption key is same as previous. Skipping decryption');
    await ncMeta.knexConnection(MetaTable.SOURCES).update({
      is_encrypted: true,
    });
    await ncMeta.knexConnection(MetaTable.INTEGRATIONS).update({
      is_encrypted: true,
    });
    return;
  }

  // if encryption key is not present, return
  if (!encryptionKey) {
    throw Error('Encryption key not found');
  }

  // get all sources
  const sources = await ncMeta.knexConnection(MetaTable.SOURCES);

  const passed = [];

  // iterate, decrypt and update
  for (const source of sources) {
    if (source?.config) {
      try {
        const decrypted = await decryptConfigWithFallbackKey({
          encryptedConfig: source.config,
          secret: encryptionKey,
          fallbackSecret: fallbackEncryptionKey,
          // if source is meta, fallback to null if decryption failed as it is not required and the actual value is JSON `null` string
          fallbackToNullIfFailed: source.is_meta,
        });
        await ncMeta
          .knexConnection(MetaTable.SOURCES)
          .update({
            config: decrypted,
          })
          .where('id', source.id);
        logger.log(`Decrypted source ${source.id}`);

        // skip pushing to passed if it is meta source
        if (!source.is_meta) {
          passed.push(true);
        }
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
        const decrypted = await decryptConfigWithFallbackKey({
          encryptedConfig: integration.config,
          secret: encryptionKey,
          fallbackSecret: fallbackEncryptionKey,
        });
        await ncMeta
          .knexConnection(MetaTable.INTEGRATIONS)
          .update({
            config: decrypted,
          })
          .where('id', integration.id);
        logger.log(`Decrypted integration ${integration.id}`);
        passed.push(true);
      } catch (e) {
        logger.error(`Failed to decrypt integration ${integration.id}`);
        passed.push(false);
      }
    }
  }

  // if all failed, log and exit
  if (passed.length > 0 && passed.every((v) => !v)) {
    throw new Error(
      `Failed to decrypt any source or integration. Please configure correct encryption key.`,
    );
  }

  logger.log(`Decrypted ${passed.length} sources and integrations`);
}
