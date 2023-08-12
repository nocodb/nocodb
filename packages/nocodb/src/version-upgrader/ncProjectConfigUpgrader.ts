import CryptoJS from 'crypto-js';
import type { NcUpgraderCtx } from './NcUpgrader';
import { Base } from '~/models';
import { MetaTable } from '~/utils/globals';

const TEMP_KEY = 'temporary-key';

// In version 0.107.0 we were used a temporary fallback secret key for JWT token encryption and project base config encryption.
// So any project created in version 0.107.0 won't be able to decrypt the project base config.
// So we need to update the project base config with the new secret key.
// Get all the project bases and update the project config with the new secret key.
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const actions = [];

  // Get all the project bases
  const bases = await ncMeta.metaList2(null, null, MetaTable.BASES);

  // Update the base config with the new secret key if we could decrypt the base config with the fallback secret key
  for (const base of bases) {
    let config;

    // Try to decrypt the base config with the fallback secret key
    // if we could decrypt the base config with the fallback secret key then we will update the base config with the new secret key
    // otherwise we will skip the base config update since it is already encrypted with the new secret key
    try {
      config = JSON.parse(
        CryptoJS.AES.decrypt(base.config, TEMP_KEY).toString(CryptoJS.enc.Utf8),
      );

      // Update the base config with the new secret key
      actions.push(
        Base.updateBase(
          base.id,
          {
            id: base.id,
            projectId: base.project_id,
            config,
            skipReorder: true,
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
