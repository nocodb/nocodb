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

interface SendCampaignConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  campaignId: string;
}

export class SendCampaignNode extends WorkflowNodeIntegration<SendCampaignConfig> {
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
        helpText:
          'The ID of the campaign to send. Typically from a Create Campaign node output.',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Campaign ID is required',
          },
        ],
      },
    ];

    return {
      id: 'mailchimp.send_campaign',
      title: 'Send campaign',
      description: 'Send an existing Mailchimp campaign',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      group: 'campaign',
      groupLabel: 'Campaign',
      groupOrder: 2,
      keywords: ['mailchimp', 'campaign', 'send', 'email', 'marketing'],
    };
  }

  public async fetchOptions(_key: string): Promise<unknown> {
    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<SendCampaignConfig>,
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
          error: {
            message: 'Mailchimp integration is required',
            code: 'MISSING_AUTH',
          },
          logs,
        };
      }

      if (!campaignId) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Campaign ID is required',
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      logs.push({
        level: 'info',
        message: `Sending campaign: ${campaignId}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      await auth.use(async (client) => {
        return await client.campaigns.send(campaignId);
      });

      logs.push({
        level: 'info',
        message: `Campaign ${campaignId} sent successfully`,
        ts: Date.now(),
      });

      return {
        outputs: {
          complete: true,
          status: 'sent',
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to send campaign',
        ts: Date.now(),
      });

      return {
        outputs: {
          complete: false,
          status: 'error',
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to send campaign',
          code: error.code || 'UNKNOWN_ERROR',
        },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.campaignId',
        type: NocoSDK.VariableType.String,
        name: 'Campaign ID',
        extra: { icon: 'ncHash' },
      },
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'complete',
        type: NocoSDK.VariableType.Boolean,
        name: 'Complete',
        extra: { icon: 'cellCheckbox' },
      },
      {
        key: 'status',
        type: NocoSDK.VariableType.String,
        name: 'Status',
        extra: { icon: 'ncInfo' },
      },
    ];
  }
}
