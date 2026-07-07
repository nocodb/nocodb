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
/** An env-resolved base variable exposed to script runtimes. */
export interface ResolvedBaseVariable {
  key: string;
  /** Resolved value — undefined when unset. Secrets arrive DECRYPTED: this
   * shape is for server-side sandboxes only and must never reach a client. */
  value?: string;
  secret: boolean;
}

export interface NocoDBContext {
  context: NocoSDK.NcContext;
  dataService: IDataV3Service;
  tablesService: ITablesService;
  user: NocoSDK.UserType;
  mailService: IMailService;
  getBaseSchema: () => Promise<any>;
  getAccessToken: () => string;
  /** Env-resolved base variables (incl. decrypted secrets) for the script node. */
  getVariables?: () => Promise<ResolvedBaseVariable[]>;
}
