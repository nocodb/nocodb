import {
  FormBuilderElement,
  FormBuilderInputType,
  FormBuilderValidatorType,
  FormDefinition,
  IntegrationsType as IntegrationType,
  SyncCategory,
  UITypes,
  EntitySelectorMode,
} from 'nocodb-sdk';
import type { IntegrationWrapper } from './integration';

export interface IntegrationManifest {
  title: string;
  icon: string;
  version: string;
  description?: string;
  author?: string;
  website?: string;
  expose?: string[];
  hidden?: boolean;
  order?: number;
  sync_category?: SyncCategory;
  iconStyle?: any;
  /**
   * AUTH integrations only: this provider supports per-user credentials
   * (`credential_mode: 'per_user'` — each user connects their own account).
   * Opt in only for OAuth2 authorization-code providers, where a credential
   * represents a user identity; API-key/client-credential auth never qualifies.
   */
  allowsPerUserCredentials?: boolean;
}

export interface IntegrationEntry<T = any> {
  type: IntegrationType;
  sub_type: string;
  wrapper: new (config: T, option: {
    saveConfig?(config: any): Promise<void>;
    logger?: (message: string) => void;
  }) => IntegrationWrapper<T>;
  form: FormDefinition;
  manifest: IntegrationManifest;
  packageManifest?: IntegrationManifest;
}

export {
  FormDefinition,
  FormBuilderElement,
  FormBuilderInputType,
  FormBuilderValidatorType,
  IntegrationType,
  SyncCategory,
  UITypes,
  EntitySelectorMode,
};
