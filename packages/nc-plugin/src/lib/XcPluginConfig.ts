import { XcForm } from 'nc-common';

import XcPlugin from './XcPlugin';
import XcPluginMigration from './XcPluginMigration';

export default interface XcPluginConfig {
  title: string;
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
