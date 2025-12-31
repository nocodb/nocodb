import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { GenerateTextAction } from './nodes/generate-text';
import { GenerateStructuredAction } from './nodes/generate-structured';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'ai.action.generate-text',
    wrapper: GenerateTextAction,
    form: [],
    manifest: {
      ...manifest,
      title: 'Generate Text',
      icon: 'openai',
      order: 13,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'ai.action.generate-structured',
    wrapper: GenerateStructuredAction,
    form: [],
    manifest: {
      ...manifest,
      title: 'Generate Structured Data',
      icon: 'openai',
      order: 14,
    },
    packageManifest: manifest,
  },
];

export default entries;
