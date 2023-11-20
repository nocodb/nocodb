import { MetaService } from './meta/meta.service';
import { NcConfig } from './utils/nc-config';
import Noco from './Noco';

// run upgrader
import NcUpgrader from '~/version-upgrader/NcUpgrader';

export default async () => {
  const config = await NcConfig.createByEnv();
  Noco._ncMeta = new MetaService(config);
  await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });
};
