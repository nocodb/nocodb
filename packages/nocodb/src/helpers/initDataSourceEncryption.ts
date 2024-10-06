import process from 'process';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
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
      .knex(MetaTable.BASES)
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
        source.id,
        MetaTable.BASES,
        {
          config: encryptPropIfRequired({
            data: source,
            secret,
          }),
          is_encrypted: true,
        },
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
        integration.fk_workspace_id,
        integration.id,
        MetaTable.INTEGRATIONS,
        {
          config: encryptPropIfRequired({
            data: integration,
            secret,
          }),
          is_encrypted: true,
        },
      );
    }

    await ncMeta.commit();
  } catch (e) {
    await ncMeta.rollback();
    console.error('Failed to encrypt data sources', e);
    process.exit(1);
  }
}
