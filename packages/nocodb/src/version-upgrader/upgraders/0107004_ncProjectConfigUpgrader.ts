import CryptoJS from 'crypto-js';
import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import { Source } from '~/models';
import { MetaTable } from '~/utils/globals';

const TEMP_KEY = 'temporary-key';

// In version 0.107.0 we were used a temporary fallback secret key for JWT token encryption and base base config encryption.
// So any base created in version 0.107.0 won't be able to decrypt the base source config.
// So we need to update the base base config with the new secret key.
// Get all the base sources and update the base config with the new secret key.
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const actions = [];

  // Get all the base sources
  const sources = await ncMeta.knexConnection(MetaTable.SOURCES);

  // Update the base config with the new secret key if we could decrypt the base config with the fallback secret key
  for (const source of sources) {
    let config;

    const context = {
      workspace_id: source.fk_workspace_id,
      base_id: source.id,
    };

    // Try to decrypt the base config with the fallback secret key
    // if we could decrypt the base config with the fallback secret key then we will update the base config with the new secret key
    // otherwise we will skip the base config update since it is already encrypted with the new secret key
    try {
      config = JSON.parse(
        CryptoJS.AES.decrypt(source.config, TEMP_KEY).toString(
          CryptoJS.enc.Utf8,
        ),
      );

      // Update the base config with the new secret key
      actions.push(
        Source.update(
          context,
          source.id,
          {
            id: source.id,
            config,
          },
          ncMeta,
        ),
      );
    } catch (e) {
      // ignore the error
    }
  }
  await Promise.all(actions);
}
