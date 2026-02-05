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
import { fetchBranches } from './utils/fetch-branches';

interface ListPullRequestsNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  head?: string;
  base?: string;
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
  perPage?: number;
}

export class ListPullRequestsNode extends WorkflowNodeIntegration<ListPullRequestsNodeConfig> {
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
        placeholder: 'Select PR state',
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
        label: 'Head Branch',
        model: 'config.head',
        placeholder: 'Filter by source branch',
        fetchOptionsKey: 'headBranches',
        dependsOn: 'config.repo',
        group: 'filters',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Base Branch',
        model: 'config.base',
        placeholder: 'Filter by target branch',
        fetchOptionsKey: 'baseBranches',
        dependsOn: 'config.repo',
        group: 'filters',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Sort By',
        model: 'config.sort',
        placeholder: 'Sort pull requests by',
        options: [
          { label: 'Created Date', value: 'created' },
          { label: 'Updated Date', value: 'updated' },
          { label: 'Popularity', value: 'popularity' },
          { label: 'Long Running', value: 'long-running' },
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
      id: 'github.action.list_pull_requests',
      title: 'List pull requests',
      description: 'Retrieve a list of pull requests from a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'pull request', 'pr', 'list', 'query'],
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

      case 'baseBranches':
      case 'headBranches':
        return this.config.repo ? fetchBranches(auth, this.config) : [];

      default:
        return [];
    }
  }

  public async validate(config: ListPullRequestsNodeConfig) {
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
          description: 'Whether the pull requests were retrieved successfully',
        },
      },
      {
        key: 'count',
        type: NocoSDK.VariableType.Number,
        name: 'Count',
        extra: {
          icon: 'ncHash',
          description: 'Number of pull requests returned',
        },
      },
      {
        key: 'pullRequests',
        type: NocoSDK.VariableType.Array,
        name: 'Pull Requests',
        isArray: true,
        extra: {
          icon: 'ncGithub',
          description: 'List of pull requests from the repository',
          itemSchema: [
            {
              key: 'id',
              type: NocoSDK.VariableType.Number,
              name: 'ID',
            },
            {
              key: 'number',
              type: NocoSDK.VariableType.Number,
              name: 'PR Number',
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
              key: 'draft',
              type: NocoSDK.VariableType.Boolean,
              name: 'Is Draft',
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
    ctx: WorkflowNodeRunContext<ListPullRequestsNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        repo,
        state,
        head,
        base,
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
        message: `Fetching pull requests from ${repo}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        const params: {
          owner: string;
          repo: string;
          state?: 'open' | 'closed' | 'all';
          head?: string;
          base?: string;
          sort?: 'created' | 'updated' | 'popularity' | 'long-running';
          direction?: 'asc' | 'desc';
          per_page?: number;
        } = {
          owner,
          repo: repoName,
          per_page: perPage || 30,
        };

        if (state) params.state = state;
        if (head) params.head = `${owner}:${head}`;
        if (base) params.base = base;
        if (sort) params.sort = sort;
        if (direction) params.direction = direction;

        return await octokit.rest.pulls.list(params);
      });

      const pullRequests = result.data.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        draft: pr.draft || false,
        html_url: pr.html_url,
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha,
        },
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha,
        },
        user: pr.user?.login,
        labels: pr.labels.map((l) => (typeof l === 'string' ? l : l.name)),
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        closed_at: pr.closed_at,
        merged_at: pr.merged_at,
      }));

      logs.push({
        level: 'info',
        message: `Retrieved ${pullRequests.length} pull request(s)`,
        ts: Date.now(),
      });

      return {
        outputs: {
          success: true,
          count: pullRequests.length,
          pullRequests,
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
        message: error.message || 'Failed to list pull requests',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
          count: 0,
          pullRequests: [],
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to list pull requests',
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
