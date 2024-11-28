import type { XcForm } from '~/types/nc-plugin';

import type XcPlugin from './XcPlugin';
import type XcPluginMigration from './XcPluginMigration';

export default interface XcPluginConfig {
  id: string;
  title: string;
  recoveryTitle?: string;
  logo?: string;
  tags?: string;
  description?: string;
  version: string;
  category?: string;
  permissions?: string[];
  inputs?: XcForm;
  price?: string;
  builder: Constructor<any>;
  migrations?: XcPluginMigration[];
  msgOnInstall?: string;
  msgOnUninstall?: string;
}

type Constructor<T extends XcPlugin> = {
  new (...args: any[]): T;
};
