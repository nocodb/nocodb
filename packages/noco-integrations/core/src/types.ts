import {
  FormBuilderElement,
  FormBuilderInputType,
  FormBuilderValidatorType,
  FormDefinition,
  IntegrationsType as IntegrationType,
  SyncCategory,
  UITypes,
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
};
