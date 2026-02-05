import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { GithubAuthIntegration } from '@noco-integrations/github-auth';
import { fetchRepo } from './utils/fetch-repo';
import { fetchLabel } from './utils/fetch-label';
import { fetchAssignee } from './utils/fetch-assignee';
import { fetchMilestone } from './utils/fetch-milestone';

interface ListIssuesNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  milestone?: number;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  perPage?: number;
}

export class ListIssuesNode extends WorkflowNodeIntegration<ListIssuesNodeConfig> {
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
        type: FormBuilderInputType.Select,
        label: 'State',
        model: 'config.state',
        placeholder: 'Select issue state',
        options: [
          { label: 'Open', value: 'open' },
          { label: 'Closed', value: 'closed' },
          { label: 'All', value: 'all' },
        ],
        group: 'filters',
        groupCollapsible: true,
        groupLabel: 'Filters',
        groupDefaultCollapsed: false,
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Labels',
        model: 'config.labels',
        placeholder: 'Filter by labels',
        fetchOptionsKey: 'labels',
        dependsOn: 'config.repo',
        selectMode: 'multiple',
        group: 'filters',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Assignee',
        model: 'config.assignee',
        placeholder: 'Filter by assignee',
        fetchOptionsKey: 'assignees',
        dependsOn: 'config.repo',
        group: 'filters',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Milestone',
        model: 'config.milestone',
        placeholder: 'Filter by milestone',
        fetchOptionsKey: 'milestones',
        dependsOn: 'config.repo',
        group: 'filters',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Sort By',
        model: 'config.sort',
        placeholder: 'Sort issues by',
        options: [
          { label: 'Created Date', value: 'created' },
          { label: 'Updated Date', value: 'updated' },
          { label: 'Comments', value: 'comments' },
        ],
        group: 'advanced',
        groupCollapsible: true,
        groupLabel: 'Advanced Options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Direction',
        model: 'config.direction',
        placeholder: 'Sort direction',
        options: [
          { label: 'Descending', value: 'desc' },
          { label: 'Ascending', value: 'asc' },
        ],
        group: 'advanced',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Results Per Page',
        model: 'config.perPage',
        placeholder: '30',
        group: 'advanced',
        validators: [
          {
            type: FormBuilderValidatorType.MaxLength,
            value: 100,
            message: 'Maximum 100 results per page',
          },
        ],
      },
    ];

    return {
      id: 'github.action.list_issues',
      title: 'List issues',
      description: 'Retrieve a list of issues from a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'issue', 'list', 'query', 'search'],
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

      case 'labels':
        return this.config.repo ? fetchLabel(auth, this.config) : [];

      case 'assignees':
        return this.config.repo ? fetchAssignee(auth, this.config) : [];

      case 'milestones':
        return this.config.repo ? fetchMilestone(auth, this.config) : [];

      default:
        return [];
    }
  }

  public async validate(config: ListIssuesNodeConfig) {
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

    return { valid: errors.length === 0, errors };
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
          description: 'Whether the issues were retrieved successfully',
        },
      },
      {
        key: 'count',
        type: NocoSDK.VariableType.Number,
        name: 'Count',
        extra: {
          icon: 'ncHash',
          description: 'Number of issues returned',
        },
      },
      {
        key: 'issues',
        type: NocoSDK.VariableType.Array,
        name: 'Issues',
        isArray: true,
        extra: {
          icon: 'ncGithub',
          description: 'List of issues from the repository',
          itemSchema: [
            {
              key: 'id',
              type: NocoSDK.VariableType.Number,
              name: 'ID',
            },
            {
              key: 'number',
              type: NocoSDK.VariableType.Number,
              name: 'Issue Number',
            },
            {
              key: 'title',
              type: NocoSDK.VariableType.String,
              name: 'Title',
            },
            {
              key: 'body',
              type: NocoSDK.VariableType.String,
              name: 'Body',
            },
            {
              key: 'state',
              type: NocoSDK.VariableType.String,
              name: 'State',
            },
            {
              key: 'html_url',
              type: NocoSDK.VariableType.String,
              name: 'URL',
            },
            {
              key: 'created_at',
              type: NocoSDK.VariableType.String,
              name: 'Created At',
            },
            {
              key: 'updated_at',
              type: NocoSDK.VariableType.String,
              name: 'Updated At',
            },
          ],
        },
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<ListIssuesNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        repo,
        state,
        labels,
        assignee,
        milestone,
        sort,
        direction,
        perPage,
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

      const [owner, repoName] = repo.split('/');

      logs.push({
        level: 'info',
        message: `Fetching issues from ${repo}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        const params: {
          owner: string;
          repo: string;
          state?: 'open' | 'closed' | 'all';
          labels?: string;
          assignee?: string;
          milestone?: string;
          sort?: 'created' | 'updated' | 'comments';
          direction?: 'asc' | 'desc';
          per_page?: number;
        } = {
          owner,
          repo: repoName,
          per_page: perPage || 30,
        };

        if (state) params.state = state;
        if (labels && labels.length > 0) params.labels = labels.join(',');
        if (assignee) params.assignee = assignee;
        if (milestone) params.milestone = milestone.toString();
        if (sort) params.sort = sort;
        if (direction) params.direction = direction;

        return await octokit.rest.issues.listForRepo(params);
      });

      const issues = result.data.map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        html_url: issue.html_url,
        labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
        assignees: issue.assignees?.map((a) => a.login) || [],
        milestone: issue.milestone?.title,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        comments: issue.comments,
      }));

      logs.push({
        level: 'info',
        message: `Retrieved ${issues.length} issue(s)`,
        ts: Date.now(),
      });

      return {
        outputs: {
          success: true,
          count: issues.length,
          issues,
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
        message: error.message || 'Failed to list issues',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
          count: 0,
          issues: [],
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to list issues',
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
