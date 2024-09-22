import { Logger } from '@nestjs/common';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { encryptPropIfRequired } from '~/utils';

const logger = new Logger('initDataSourceEncryption');

export default async function initDataSourceEncryption(_ncMeta = Noco.ncMeta) {
  // return if env is not set
  if (!process.env.NC_KEY_CREDENTIAL_ENCRYPT) {
    return;
  }

  const secret = process.env.NC_KEY_CREDENTIAL_ENCRYPT;

  const ncMeta = await _ncMeta.startTransaction();

  const successStatus: boolean[] = [];

  try {
    // if configured, check for any non-encrypted data source by checking is_encrypted flag
    const sources = await ncMeta
      .knex(MetaTable.SOURCES)
      .where((qb) => {
        qb.where('is_encrypted', false).orWhereNull('is_encrypted');
      })
      .where((qb) => {
        qb.where('is_meta', false).orWhereNull('is_meta');
      })

      .where((qb) => {
        qb.where('is_local', false).orWhereNull('is_local');
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
    }

    const integrations = await ncMeta
      .knex(MetaTable.INTEGRATIONS)
      .where((qb) => {
        qb.where('is_encrypted', false).orWhereNull('is_encrypted');
      })
      .whereNotNull('config');

    for (const integration of integrations) {
      // skip if no config
      if (!integrations.config) {
        continue;
      }

      // check if valid json, if not warn and skip
      try {
        JSON.parse(integrations.config);
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
