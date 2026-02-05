import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
  NocoSDK,
  WorkflowNodeCategory,
} from '@noco-integrations/core';
import type {
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { GithubAuthIntegration } from '@noco-integrations/github-auth';
import {
  GitHubIssueLabelActionNode,
  type GitHubIssueLabelBaseConfig,
} from './abstract/issue-labels';

interface AddIssueLabelsNodeConfig extends GitHubIssueLabelBaseConfig {
  labels: string[];
}

export class AddIssueLabelsNode extends GitHubIssueLabelActionNode<AddIssueLabelsNodeConfig> {
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
        helpText: 'The issue number to add labels to',
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
        placeholder: 'Select labels to add',
        fetchOptionsKey: 'labels',
        dependsOn: 'config.repo',
        selectMode: 'multiple',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'At least one label is required',
          },
        ],
      },
    ];

    return {
      id: 'github.action.add_issue_labels',
      title: 'Add issue labels',
      description: 'Add labels to an existing issue in a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'issue', 'label', 'add', 'tag'],
    };
  }

  public async validate(config: AddIssueLabelsNodeConfig) {
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

    if (!config.labels || config.labels.length === 0) {
      errors.push({
        path: 'config.labels',
        message: 'At least one label is required',
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
          description: 'Issue number to add labels to',
        },
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<AddIssueLabelsNodeConfig>,
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

      if (!labels || labels.length === 0) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'At least one label is required',
            code: 'MISSING_LABELS',
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
        message: `Adding labels to issue #${issueNum} in ${repo}`,
        ts: Date.now(),
        data: { labels },
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        return await octokit.rest.issues.addLabels({
          owner,
          repo: repoName,
          issue_number: issueNum,
          labels,
        });
      });

      const updatedLabels = result.data.map((label) => ({
        name: typeof label === 'string' ? label : label.name,
        color: typeof label === 'string' ? null : label.color,
        description: typeof label === 'string' ? null : label.description,
      }));

      logs.push({
        level: 'info',
        message: `Labels added successfully to issue #${issueNum}`,
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
        message: error.message || 'Failed to add labels',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to add labels',
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
