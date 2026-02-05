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

interface RemoveIssueLabelNodeConfig extends GitHubIssueLabelBaseConfig {
  label: string;
}

export class RemoveIssueLabelNode extends GitHubIssueLabelActionNode<RemoveIssueLabelNodeConfig> {
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
        helpText: 'The issue number to remove the label from',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Issue number is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Label',
        model: 'config.label',
        placeholder: 'Select label to remove',
        fetchOptionsKey: 'labels',
        dependsOn: 'config.repo',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Label is required',
          },
        ],
      },
    ];

    return {
      id: 'github.action.remove_issue_label',
      title: 'Remove issue label',
      description: 'Remove a label from an issue in a GitHub repository',
      icon: 'githubSolid',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/github',
      keywords: ['github', 'issue', 'label', 'remove', 'delete', 'tag'],
    };
  }

  public async validate(config: RemoveIssueLabelNodeConfig) {
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

    if (!config.label) {
      errors.push({
        path: 'config.label',
        message: 'Label is required',
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
          description: 'Issue number to remove the label from',
        },
      },
    ];
  }

  public async run(
    ctx: WorkflowNodeRunContext<RemoveIssueLabelNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, repo, issueNumber, label } = config;

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

      if (!label) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Label is required',
            code: 'MISSING_LABEL',
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
        message: `Removing label "${label}" from issue #${issueNum} in ${repo}`,
        ts: Date.now(),
        data: { label },
      });

      const auth =
        await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

      const result = await auth.use(async (octokit) => {
        return await octokit.rest.issues.removeLabel({
          owner,
          repo: repoName,
          issue_number: issueNum,
          name: label,
        });
      });

      const remainingLabels = result.data.map((l) => ({
        name: typeof l === 'string' ? l : l.name,
        color: typeof l === 'string' ? null : l.color,
        description: typeof l === 'string' ? null : l.description,
      }));

      logs.push({
        level: 'info',
        message: `Label "${label}" removed successfully from issue #${issueNum}`,
        ts: Date.now(),
        data: { remainingLabels },
      });

      return {
        outputs: {
          success: true,
          labels: remainingLabels,
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
        message: error.message || 'Failed to remove label',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to remove label',
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
