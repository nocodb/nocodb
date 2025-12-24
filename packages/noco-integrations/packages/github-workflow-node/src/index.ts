import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { GitHubTriggerNode } from './nodes/github-trigger';

export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'github.trigger',
    wrapper: GitHubTriggerNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'GitHub Webhook Trigger',
      icon: 'ncGithub',
    },
  },
];

export default entries;
