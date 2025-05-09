import {
  FormBuilderElement,
  FormBuilderInputType,
  FormDefinition,
  IntegrationsType as IntegrationType,
} from 'nocodb-sdk';
import type { IntegrationWrapper } from '../integration';

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
}

export interface IntegrationEntry {
  type: IntegrationType;
  sub_type: string;
  wrapper: typeof IntegrationWrapper;
  form: FormDefinition;
  manifest: IntegrationManifest;
}

export {
  FormDefinition,
  FormBuilderElement,
  FormBuilderInputType,
  IntegrationType,
};

export * from './auth';
export * from './ai';
export * from './sync';
