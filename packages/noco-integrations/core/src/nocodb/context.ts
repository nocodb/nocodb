import type { NocoSDK } from '../sdk';
import type {
  IDataV3Service,
  IMailService,
  ITablesService,
} from './services';

/**
 * Bag of in-process NocoDB handles passed to integration wrappers that need
 * to call internal services (workflow nodes, internal sync, …) instead of
 * going over HTTP.
 *
 * Populated by the backend's executor and injected into the wrapper config
 * under the `_nocodb` slot. Wrappers should read it via the framework
 * getter (`this.nocodb`) rather than touching the slot directly.
 */
export interface NocoDBContext {
  context: NocoSDK.NcContext;
  dataService: IDataV3Service;
  tablesService: ITablesService;
  user: NocoSDK.UserType;
  mailService: IMailService;
  getBaseSchema: () => Promise<any>;
  getAccessToken: () => string;
}
