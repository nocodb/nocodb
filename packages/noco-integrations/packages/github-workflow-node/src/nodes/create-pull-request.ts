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
import { fetchBranches } from './utils/fetch-branches';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { GithubAuthIntegration } from '@noco-integrations/github-auth';

interface CreatePullRequestNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body?: string;
  draft?: boolean;
  maintainerCanModify?: boolean;
}

export class CreatePullRequestNode extends WorkflowNodeIntegration<CreatePullRequestNodeConfig> {
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
        label: 'Target Branch',
        model: 'config.baseBranch',
        placeholder: 'Select target branch (e.g., main)',
        fetchOptionsKey: 'baseBranches',
        dependsOn: 'config.repo',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Base branch is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Source Branch',
        model: 'config.headBranch',
        placeholder: 'Select source branch to merge',
        fetchOptionsKey: 'headBranches',
        dependsOn: 'config.repo',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Source branch is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Title',
        model: 'config.title',
        placeholder: 'Pull request title',
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
        placeholder: 'Pull request description (supports Markdown)',
      },
      {
        type: FormBuilderInputType.Checkbox,
        label: 'Draft',
        model: 'config.draft',
        group: 'advanced',
        groupCollapsible: true,
        groupLabel: 'Advanced Options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.Checkbox,
        label: 'Allow maintainer edits',
        model: 'config.maintainerCanModify',
        group: 'advanced',
      },
    ];

    return {
      id: 'github.action.create_pull_request',
      title: 'Create pull request',
      description: 'Create a new pull request in a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'pull request', 'pr', 'merge', 'branch'],
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

  public async validate(config: CreatePullRequestNodeConfig) {
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

    if (!config.baseBranch) {
      errors.push({
        path: 'config.baseBranch',
        message: 'Base branch is required',
      });
    }

    if (!config.headBranch) {
      errors.push({
        path: 'config.headBranch',
        message: 'Head branch is required',
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
          description: 'Pull request title',
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
                description: 'Pull request body/description',
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
          description: 'Whether the pull request was created successfully',
        },
      },
      {
        key: 'pr',
        type: NocoSDK.VariableType.Object,
        name: 'Pull Request',
        extra: {
          icon: 'ncGithub',
          description: 'Created pull request details',
        },
        children: [
          {
            key: 'pr.id',
            type: NocoSDK.VariableType.Number,
            name: 'ID',
            extra: {
              icon: 'ncHash',
            },
          },
          {
            key: 'pr.number',
            type: NocoSDK.VariableType.Number,
            name: 'PR Number',
            extra: {
              icon: 'ncHash',
            },
          },
          {
            key: 'pr.title',
            type: NocoSDK.VariableType.String,
            name: 'Title',
            extra: {
              icon: 'cellText',
            },
          },
          {
            key: 'pr.body',
            type: NocoSDK.VariableType.String,
            name: 'Body',
          },
          {
            key: 'pr.html_url',
            type: NocoSDK.VariableType.String,
            name: 'URL',
            extra: {
              icon: 'ncLink',
            },
          },
          {
            key: 'pr.state',
            type: NocoSDK.VariableType.String,
            name: 'State',
            extra: {
              icon: 'ncInfo',
            },
          },
          {
            key: 'pr.draft',
            type: NocoSDK.VariableType.Boolean,
            name: 'Is Draft',
            extra: {
              icon: 'cellCheckbox',
            },
          },
          {
            key: 'pr.base.ref',
            type: NocoSDK.VariableType.String,
            name: 'Target Branch',
            extra: {
              icon: 'ncBranch',
            },
          },
          {
            key: 'pr.head.ref',
            type: NocoSDK.VariableType.String,
            name: 'Source Branch',
            extra: {
              icon: 'ncBranch',
            },
          },
        ],
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<CreatePullRequestNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        repo,
        baseBranch,
        headBranch,
        title,
        body,
        draft,
        maintainerCanModify,
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

      if (!baseBranch) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Base branch is required',
            code: 'MISSING_BASE_BRANCH',
          },
          logs,
        };
      }

      if (!headBranch) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Head branch is required',
            code: 'MISSING_HEAD_BRANCH',
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
        message: `Creating PR in ${repo}: ${headBranch} -> ${baseBranch}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        const prData: {
          owner: string;
          repo: string;
          title: string;
          head: string;
          base: string;
          body?: string;
          draft?: boolean;
          maintainer_can_modify?: boolean;
        } = {
          owner,
          repo: repoName,
          title,
          head: headBranch,
          base: baseBranch,
        };

        if (body) prData.body = body;
        if (draft !== undefined) prData.draft = draft;
        if (maintainerCanModify !== undefined)
          prData.maintainer_can_modify = maintainerCanModify;

        return await octokit.rest.pulls.create(prData);
      });

      logs.push({
        level: 'info',
        message: `PR #${result.data.number} created successfully`,
        ts: Date.now(),
        data: { number: result.data.number, url: result.data.html_url },
      });

      return {
        outputs: {
          success: true,
          pr: {
            id: result.data.id,
            number: result.data.number,
            title: result.data.title,
            html_url: result.data.html_url,
            state: result.data.state,
            draft: result.data.draft || false,
            body: result.data.body,
            base: {
              ref: result.data.base.ref,
              sha: result.data.base.sha,
            },
            head: {
              ref: result.data.head.ref,
              sha: result.data.head.sha,
            },
            created_at: result.data.created_at,
            mergeable: result.data.mergeable,
            merged: result.data.merged,
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
        message: error.message || 'Failed to create pull request',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to create pull request',
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
