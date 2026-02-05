import {
  type IntegrationEntry,
  IntegrationType,
} from '@noco-integrations/core';
import { manifest } from './manifest';
import { AddIssueLabelsNode } from './nodes/add-issue-labels';
import { CreateIssueNode } from './nodes/create-issue';
import { GitHubTriggerNode } from './nodes/github-trigger';
import { RemoveIssueLabelNode } from './nodes/remove-issue-label';
import { SetIssueLabelsNode } from './nodes/set-issue-labels';
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
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'github.action.add_issue_labels',
    wrapper: AddIssueLabelsNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Add Issue Labels',
      icon: 'githubSolid',
      order: 4,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'github.action.set_issue_labels',
    wrapper: SetIssueLabelsNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Set Issue Labels',
      icon: 'githubSolid',
      order: 5,
    },
    packageManifest: manifest,
  },
  {
    type: IntegrationType.WorkflowNode,
    sub_type: 'github.action.remove_issue_label',
    wrapper: RemoveIssueLabelNode,
    form: [],
    manifest: {
      ...manifest,
      title: 'Remove Issue Label',
      icon: 'githubSolid',
      order: 6,
    },
    packageManifest: manifest,
  },
];

export default entries;
