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

interface SetIssueLabelsNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string;
  issueNumber: string;
  labels: string[];
}

export class SetIssueLabelsNode extends WorkflowNodeIntegration<SetIssueLabelsNodeConfig> {
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
        helpText: 'The issue number to set labels on',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Issue number is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Labels',
        model: 'config.labels',
        placeholder: 'Select labels to set',
        helpText: 'This will replace all existing labels on the issue',
        fetchOptionsKey: 'labels',
        dependsOn: 'config.repo',
        selectMode: 'multiple',
      },
    ];

    return {
      id: 'github.action.set_issue_labels',
      title: 'Set Issue Labels',
      description:
        'Replace all labels on an issue in a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'issue', 'label', 'set', 'replace', 'tag'],
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
      case 'repos': {
        try {
          const options: { label: string; value: string }[] = [];

          const reposIterator = await auth.use(async (octokit) => {
            return octokit.paginate.iterator(
              octokit.rest.repos.listForAuthenticatedUser,
              {
                per_page: 100,
                sort: 'updated',
                direction: 'desc',
              },
            );
          });

          for await (const { data: repos } of reposIterator) {
            for (const repo of repos) {
              if (
                repo.permissions?.admin ||
                repo.permissions?.maintain ||
                repo.permissions?.push
              ) {
                options.push({
                  label: `${repo.owner.login}/${repo.name}`,
                  value: `${repo.owner.login}/${repo.name}`,
                });
              }
            }
          }

          return options;
        } catch (error) {
          console.error('[GitHub] Error fetching repositories:', error);
          return [];
        }
      }

      case 'labels': {
        if (!this.config.repo) return [];

        try {
          const [owner, repo] = this.config.repo.split('/');

          const labels = await auth.use(async (octokit) => {
            const response = await octokit.rest.issues.listLabelsForRepo({
              owner,
              repo,
              per_page: 100,
            });
            return response.data;
          });

          return labels.map((label) => ({
            label: label.name,
            value: label.name,
          }));
        } catch (error) {
          console.error('[GitHub] Error fetching labels:', error);
          return [];
        }
      }

      default:
        return [];
    }
  }

  public async validate(config: SetIssueLabelsNodeConfig) {
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
    return [
      {
        key: 'config.issueNumber',
        type: NocoSDK.VariableType.String,
        name: 'Issue Number',
        extra: {
          icon: 'ncHash',
          description: 'Issue number to set labels on',
        },
      },
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
          description: 'Whether the labels were set successfully',
        },
      },
      {
        key: 'labels',
        type: NocoSDK.VariableType.Array,
        name: 'Labels',
        extra: {
          icon: 'ncTag',
          description: 'Updated list of labels on the issue',
        },
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<SetIssueLabelsNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, repo, issueNumber, labels } = config;

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

      const labelsToSet = labels || [];

      logs.push({
        level: 'info',
        message: `Setting labels on issue #${issueNum} in ${repo}`,
        ts: Date.now(),
        data: { labels: labelsToSet },
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        return await octokit.rest.issues.setLabels({
          owner,
          repo: repoName,
          issue_number: issueNum,
          labels: labelsToSet,
        });
      });

      const updatedLabels = result.data.map((label) => ({
        name: typeof label === 'string' ? label : label.name,
        color: typeof label === 'string' ? null : label.color,
        description: typeof label === 'string' ? null : label.description,
      }));

      logs.push({
        level: 'info',
        message: `Labels set successfully on issue #${issueNum}`,
        ts: Date.now(),
        data: { labels: updatedLabels },
      });

      return {
        outputs: {
          success: true,
          labels: updatedLabels,
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
        message: error.message || 'Failed to set labels',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to set labels',
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
