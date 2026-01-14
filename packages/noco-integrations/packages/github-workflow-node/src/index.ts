import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { CreateIssueNode } from './nodes/create-issue';
import { GitHubTriggerNode } from './nodes/github-trigger';
import { UpdateIssueNode } from './nodes/update-issue';

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
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'github.action.create_issue',
    wrapper: CreateIssueNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Create Issue',
      icon: 'githubSolid',
      order: 2,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'github.action.update_issue',
    wrapper: UpdateIssueNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Update Issue',
      icon: 'githubSolid',
      order: 3,
    },
    packageManifest: manifest,
  },
];

export default entries;
