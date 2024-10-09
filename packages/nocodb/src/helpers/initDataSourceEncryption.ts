import { Logger } from '@nestjs/common';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { encryptPropIfRequired } from '~/utils';

const logger = new Logger('initDataSourceEncryption');

export default async function initDataSourceEncryption(_ncMeta = Noco.ncMeta) {
  // return if env is not set
  if (!process.env.NC_CONNECTION_ENCRYPT_KEY) {
    return;
  }

  const secret = process.env.NC_CONNECTION_ENCRYPT_KEY;

  const ncMeta = await _ncMeta.startTransaction();

  const successStatus: boolean[] = [];

  try {
    // if configured, check for any non-encrypted data source by checking is_encrypted flag
    const sources = await ncMeta
      .knex(MetaTable.SOURCES)
      .where((qb) => {
        qb.where('is_encrypted', false).orWhereNull('is_encrypted');
      })
      .whereNotNull('config');

    for (const source of sources) {
      // skip if no config
      if (!source.config) {
        continue;
      }

      // check if valid json, if not warn and skip
      try {
        JSON.parse(source.config);
      } catch (e) {
        console.error('Invalid JSON in integration config', source.alias);
        successStatus.push(false);
        continue;
      }

      // encrypt the data source
      await ncMeta.metaUpdate(
        source.fk_workspace_id,
        source.base_id,
        MetaTable.SOURCES,
        {
          config: encryptPropIfRequired({
            data: source,
            secret,
          }),
          is_encrypted: true,
        },
        source.id,
      );
      successStatus.push(true);

      logger.log(`Encrypted source ${source.alias}`);
    }

    const integrations = await ncMeta
      .knex(MetaTable.INTEGRATIONS)
      .where((qb) => {
        qb.where('is_encrypted', false).orWhereNull('is_encrypted');
      })
      .whereNotNull('config');

    for (const integration of integrations) {
      // skip if no config
      if (!integration.config) {
        continue;
      }

      // check if valid json, if not warn and skip
      try {
        JSON.parse(integration.config);
      } catch (e) {
        logger.warn('Invalid JSON in integration config', integration.title);
        successStatus.push(false);
        continue;
      }

      // encrypt the data source
      await ncMeta.metaUpdate(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.INTEGRATIONS,
        {
          config: encryptPropIfRequired({
            data: integration,
            secret,
          }),
          is_encrypted: true,
        },
        integration.id,
      );
      successStatus.push(true);
      logger.log(`Encrypted integration config ${integration.title}`);
    }

    // if all failed, throw error
    if (successStatus.length && successStatus.every((status) => !status)) {
      // if all fails then rollback and exit
      throw new Error(
        'Failed to encrypt all data sources, please remove invalid data sources and try again.',
      );
    }

    await ncMeta.commit();
  } catch (e) {
    await ncMeta.rollback();
    console.error('Failed to encrypt data sources');
    throw e;
  }
}
