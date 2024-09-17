import process from 'process';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { encryptPropIfRequired } from '~/utils';

export default async function initDataSourceEncryption(_ncMeta = Noco.ncMeta) {
  // return if env is not set
  if (!process.env.NC_KEY_CREDENTIAL_ENCRYPT) {
    return;
  }

  const secret = process.env.NC_KEY_CREDENTIAL_ENCRYPT;

  const ncMeta = await _ncMeta.startTransaction();

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
      });

    for (const source of sources) {
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
    }

    const integrations = await ncMeta
      .knex(MetaTable.INTEGRATIONS)
      .where((qb) => {
        qb.where('is_encrypted', false).orWhereNull('is_encrypted');
      });

    for (const integration of integrations) {
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
    }
    await ncMeta.commit();
  } catch (e) {
    await ncMeta.rollback();
    console.error('Failed to encrypt data sources', e);
    process.exit(1);
  }
}
