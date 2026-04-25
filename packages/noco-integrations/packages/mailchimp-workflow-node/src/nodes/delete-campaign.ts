import {
  IntegrationType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
} from '@noco-integrations/core';
import type { MailchimpAuthIntegration } from '@noco-integrations/mailchimp-auth';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface DeleteCampaignConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  campaignId: string;
}

export class DeleteCampaignNode extends WorkflowNodeIntegration<DeleteCampaignConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Mailchimp Account',
        model: 'config.authIntegrationId',
        integrationFilter: {
          type: IntegrationType.Auth,
          sub_type: 'mailchimp',
        },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Mailchimp Account is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Campaign ID',
        model: 'config.campaignId',
        placeholder: 'Enter campaign ID or use $(variable)',
        helpText: 'The ID of the campaign to delete. This action cannot be undone.',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Campaign ID is required',
          },
        ],
      },
    ];

    return {
      id: 'mailchimp.delete_campaign',
      title: 'Delete campaign',
      description: 'Delete a Mailchimp campaign. This action cannot be undone.',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      group: 'campaign',
      groupLabel: 'Campaign',
      groupOrder: 2,
      keywords: [
        'mailchimp',
        'campaign',
        'delete',
        'remove',
        'email',
      ],
    };
  }

  public async fetchOptions(_key: string): Promise<unknown> {
    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<DeleteCampaignConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, campaignId } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Mailchimp integration is required', code: 'MISSING_AUTH' },
          logs,
        };
      }

      if (!campaignId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Campaign ID is required', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({ level: 'info', message: `[Test mode] Would delete campaign: ${campaignId}`, ts: Date.now() });
        return {
          outputs: { deleted: true },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({ level: 'info', message: `Deleting campaign: ${campaignId}`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      await auth.use(async (client) => {
        return await client.campaigns.remove(campaignId);
      });

      logs.push({ level: 'info', message: `Campaign ${campaignId} deleted successfully`, ts: Date.now() });

      return {
        outputs: { deleted: true },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to delete campaign', ts: Date.now() });
      return {
        outputs: { deleted: false },
        status: 'error',
        error: { message: error.message || 'Failed to delete campaign', code: error.code || 'UNKNOWN_ERROR' },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      { key: 'config.campaignId', type: NocoSDK.VariableType.String, name: 'Campaign ID', extra: { icon: 'ncHash' } },
    ];
  }

  public async generateOutputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      { key: 'deleted', type: NocoSDK.VariableType.Boolean, name: 'Deleted', extra: { icon: 'cellCheckbox' } },
    ];
  }
}
