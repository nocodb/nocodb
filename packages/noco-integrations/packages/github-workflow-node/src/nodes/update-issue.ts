import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import { fetchRepo } from './utils/fetch-repo';
import { fetchLabel } from './utils/fetch-label';
import { fetchMilestone } from './utils/fetch-milestone';
import { fetchAssignee } from './utils/fetch-assignee';
import type { GithubAuthIntegration } from '@noco-integrations/github-auth';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

const STATE_OPTIONS = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
];

interface UpdateIssueNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string;
  issueNumber: string;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  milestone?: number | null;
  labels?: string[];
  assignees?: string[];
}

export class UpdateIssueNode extends WorkflowNodeIntegration<UpdateIssueNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'GitHub Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'github' },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'GitHub account is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Repository',
        model: 'config.repo',
        placeholder: 'Select repository',
        fetchOptionsKey: 'repos',
        dependsOn: 'config.authIntegrationId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Repository is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Issue Number',
        model: 'config.issueNumber',
        placeholder: 'e.g. 123',
        helpText: 'The issue number to update',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Issue number is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Title',
        model: 'config.title',
        placeholder: 'New issue title (leave empty to keep current)',
        group: 'fields',
        groupCollapsible: true,
        groupLabel: 'Fields to Update',
        groupDefaultCollapsed: false,
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Body',
        model: 'config.body',
        plugins: ['multiline'],
        placeholder: 'New issue description (leave empty to keep current)',
        group: 'fields',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'State',
        model: 'config.state',
        placeholder: 'Select state',
        options: STATE_OPTIONS,
        group: 'fields',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Milestone',
        model: 'config.milestone',
        placeholder: 'Select milestone',
        fetchOptionsKey: 'milestones',
        dependsOn: 'config.repo',
        group: 'fields',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Labels',
        model: 'config.labels',
        placeholder: 'Select labels',
        fetchOptionsKey: 'labels',
        dependsOn: 'config.repo',
        selectMode: 'multiple',
        group: 'fields',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Assignees',
        model: 'config.assignees',
        placeholder: 'Select assignees',
        fetchOptionsKey: 'assignees',
        dependsOn: 'config.repo',
        selectMode: 'multiple',
        group: 'fields',
      },
    ];

    return {
      id: 'github.action.update_issue',
      title: 'Update Issue',
      description: 'Update an existing issue in a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'issue', 'update', 'edit', 'modify', 'ticket'],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth =
      await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

    switch (key) {
      case 'repos':
        return fetchRepo(auth);

      case 'milestones':
        return this.config.repo ? fetchMilestone(auth, this.config) : [];

      case 'labels':
        return this.config.repo ? fetchLabel(auth, this.config) : [];

      case 'assignees':
        return this.config.repo ? fetchAssignee(auth, this.config) : [];

      default:
        return [];
    }
  }

  public async validate(config: UpdateIssueNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.authIntegrationId) {
      errors.push({
        path: 'config.authIntegrationId',
        message: 'GitHub account is required',
      });
    }

    if (!config.repo) {
      errors.push({
        path: 'config.repo',
        message: 'Repository is required',
      });
    }

    if (!config.issueNumber) {
      errors.push({
        path: 'config.issueNumber',
        message: 'Issue number is required',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const variables: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.issueNumber',
        type: NocoSDK.VariableType.String,
        name: 'Issue Number',
        extra: {
          icon: 'ncHash',
          description: 'Issue number to update',
        },
      },
    ];

    if (this.config.title) {
      variables.push({
        key: 'config.title',
        type: NocoSDK.VariableType.String,
        name: 'Title',
        extra: {
          icon: 'cellText',
          description: 'New issue title',
        },
      });
    }

    if (this.config.body) {
      variables.push({
        key: 'config.body',
        type: NocoSDK.VariableType.String,
        name: 'Body',
        extra: {
          icon: 'ncMessageSquare',
          description: 'New issue body/description',
        },
      });
    }

    return variables;
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: {
          icon: 'cellCheckbox',
          description: 'Whether the issue was updated successfully',
        },
      },
      {
        key: 'issue',
        type: NocoSDK.VariableType.Object,
        name: 'Issue',
        extra: {
          icon: 'ncGithub',
          description: 'Updated issue details',
        },
        children: [
          {
            key: 'issue.id',
            type: NocoSDK.VariableType.Number,
            name: 'ID',
            extra: {
              icon: 'ncHash',
            },
          },
          {
            key: 'issue.number',
            type: NocoSDK.VariableType.Number,
            name: 'Issue Number',
            extra: {
              icon: 'ncHash',
            },
          },
          {
            key: 'issue.title',
            type: NocoSDK.VariableType.String,
            name: 'Title',
            extra: {
              icon: 'cellText',
            },
          },
          {
            key: 'issue.html_url',
            type: NocoSDK.VariableType.String,
            name: 'URL',
            extra: {
              icon: 'ncLink',
            },
          },
          {
            key: 'issue.state',
            type: NocoSDK.VariableType.String,
            name: 'State',
            extra: {
              icon: 'ncInfo',
            },
          },
        ],
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<UpdateIssueNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        repo,
        issueNumber,
        title,
        body,
        state,
        milestone,
        labels,
        assignees,
      } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'GitHub account is required',
            code: 'MISSING_AUTH',
          },
          logs,
        };
      }

      if (!repo) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Repository is required',
            code: 'MISSING_REPO',
          },
          logs,
        };
      }

      if (!issueNumber) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Issue number is required',
            code: 'MISSING_ISSUE_NUMBER',
          },
          logs,
        };
      }

      const issueNum = parseInt(issueNumber, 10);
      if (isNaN(issueNum)) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Issue number must be a valid number',
            code: 'INVALID_ISSUE_NUMBER',
          },
          logs,
        };
      }

      const [owner, repoName] = repo.split('/');

      logs.push({
        level: 'info',
        message: `Updating issue #${issueNum} in ${repo}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        const updateData: {
          owner: string;
          repo: string;
          issue_number: number;
          title?: string;
          body?: string;
          state?: 'open' | 'closed';
          milestone?: number | null;
          labels?: string[];
          assignees?: string[];
        } = {
          owner,
          repo: repoName,
          issue_number: issueNum,
        };

        if (title !== undefined && title !== '') updateData.title = title;
        if (body !== undefined && body !== '') updateData.body = body;
        if (state) updateData.state = state;
        if (milestone !== undefined) updateData.milestone = milestone;
        if (labels !== undefined) updateData.labels = labels;
        if (assignees !== undefined) updateData.assignees = assignees;

        return await octokit.rest.issues.update(updateData);
      });

      logs.push({
        level: 'info',
        message: `Issue #${result.data.number} updated successfully`,
        ts: Date.now(),
        data: { number: result.data.number, url: result.data.html_url },
      });

      return {
        outputs: {
          success: true,
          issue: {
            id: result.data.id,
            number: result.data.number,
            title: result.data.title,
            html_url: result.data.html_url,
            state: result.data.state,
            body: result.data.body,
            labels: result.data.labels.map((l) =>
              typeof l === 'string' ? l : l.name,
            ),
            assignees: result.data.assignees?.map((a) => a.login) || [],
            milestone: result.data.milestone?.title,
            updated_at: result.data.updated_at,
          },
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to update issue',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to update issue',
          code: error.status?.toString() || 'UNKNOWN_ERROR',
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }
}
