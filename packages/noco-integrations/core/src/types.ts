import {
  FormBuilderElement,
  FormBuilderInputType,
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
}

export interface IntegrationEntry {
  type: IntegrationType;
  sub_type: string;
  wrapper:  new (config: any) => IntegrationWrapper<any>;
  form: FormDefinition;
  manifest: IntegrationManifest;
}

export {
  FormDefinition,
  FormBuilderElement,
  FormBuilderInputType,
  IntegrationType,
  SyncCategory,
  UITypes,
};
