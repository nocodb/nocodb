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

interface CreateIssueNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string;
  title: string;
  body?: string;
  milestone?: number;
  labels?: string[];
  assignees?: string[];
}

export class CreateIssueNode extends WorkflowNodeIntegration<CreateIssueNodeConfig> {
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
        label: 'Title',
        model: 'config.title',
        placeholder: 'Issue title',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Title is required',
          },
          {
            type: FormBuilderValidatorType.MaxLength,
            value: 256,
            message: 'Title must be 256 characters or less',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Body',
        model: 'config.body',
        plugins: ['multiline'],
        placeholder: 'Issue description (supports Markdown)',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Milestone',
        model: 'config.milestone',
        placeholder: 'Select milestone',
        fetchOptionsKey: 'milestones',
        dependsOn: 'config.repo',
        group: 'advanced',
        groupCollapsible: true,
        groupLabel: 'Advanced Options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Labels',
        model: 'config.labels',
        placeholder: 'Select labels',
        fetchOptionsKey: 'labels',
        dependsOn: 'config.repo',
        selectMode: 'multiple',
        group: 'advanced',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Assignees',
        model: 'config.assignees',
        placeholder: 'Select assignees',
        fetchOptionsKey: 'assignees',
        dependsOn: 'config.repo',
        selectMode: 'multiple',
        group: 'advanced',
      },
    ];

    return {
      id: 'github.action.create_issue',
      title: 'Create Issue',
      description: 'Create a new issue in a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'issue', 'create', 'bug', 'feature', 'ticket'],
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

  public async validate(config: CreateIssueNodeConfig) {
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

    if (!config.title) {
      errors.push({
        path: 'config.title',
        message: 'Title is required',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.title',
        type: NocoSDK.VariableType.String,
        name: 'Title',
        extra: {
          icon: 'cellText',
          description: 'Issue title',
        },
      },
      ...(this.config.body
        ? [
            {
              key: 'config.body',
              type: NocoSDK.VariableType.String,
              name: 'Body',
              extra: {
                icon: 'ncMessageSquare',
                description: 'Issue body/description',
              },
            },
          ]
        : []),
    ];
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
          description: 'Whether the issue was created successfully',
        },
      },
      {
        key: 'issue',
        type: NocoSDK.VariableType.Object,
        name: 'Issue',
        extra: {
          icon: 'ncGithub',
          description: 'Created issue details',
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
    ctx: WorkflowNodeRunContext<CreateIssueNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        repo,
        title,
        body,
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

      if (!title) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Title is required',
            code: 'MISSING_TITLE',
          },
          logs,
        };
      }

      const [owner, repoName] = repo.split('/');

      logs.push({
        level: 'info',
        message: `Creating issue in ${repo}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        const issueData: {
          owner: string;
          repo: string;
          title: string;
          body?: string;
          milestone?: number;
          labels?: string[];
          assignees?: string[];
        } = {
          owner,
          repo: repoName,
          title,
        };

        if (body) issueData.body = body;
        if (milestone) issueData.milestone = milestone;
        if (labels && labels.length > 0) issueData.labels = labels;
        if (assignees && assignees.length > 0) issueData.assignees = assignees;

        return await octokit.rest.issues.create(issueData);
      });

      logs.push({
        level: 'info',
        message: `Issue #${result.data.number} created successfully`,
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
            created_at: result.data.created_at,
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
        message: error.message || 'Failed to create issue',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to create issue',
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
