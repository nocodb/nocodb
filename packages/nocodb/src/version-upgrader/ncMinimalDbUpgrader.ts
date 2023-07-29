import CryptoJS from 'crypto-js';
import Noco from '../Noco';
import { Base } from '../models';
import { MetaTable } from '../utils/globals';
import type { NcUpgraderCtx } from './NcUpgrader';

// In first implementation of NC_MINIMAL_DBS (pg) we were using separate connection for each base.
// but in the latest implementation we are reusing same connection.
// So we need to update the project base config for corresponding bases to store new format.
// { schema: ${schema_name} }
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const actions = [];

  // Get all the project bases
  const bases: Base[] = await ncMeta.metaList2(null, null, MetaTable.BASES);

  for (const base of bases) {
    // Skip if the base is not minimal db
    if (!base.is_local) continue;

    let config;

    try {
      // Decrypt the base config
      config = JSON.parse(
        CryptoJS.AES.decrypt(
          base.config,
          Noco.getConfig()?.auth?.jwt?.secret,
        ).toString(CryptoJS.enc.Utf8),
      );

      if (!config.searchPath) continue;
      if (base.type !== 'pg') continue;

      // Update the base config with new format
      actions.push(
        Base.updateBase(
          base.id,
          {
            id: base.id,
            projectId: base.project_id,
            config: {
              schema: config.searchPath?.[0],
            },
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
