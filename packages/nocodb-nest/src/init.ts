import { Connection } from './connection/connection';
import { MetaService } from './meta/meta.service';
import Noco from './Noco';

// run upgrader
import NcUpgrader from './version-upgrader/NcUpgrader';

export default async () => {
  await Connection.init();
  Noco._ncMeta = new MetaService(new Connection());
  await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });
};
