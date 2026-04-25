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

interface GetCampaignConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  campaignId: string;
}

export class GetCampaignNode extends WorkflowNodeIntegration<GetCampaignConfig> {
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
        helpText: 'The ID of the campaign to retrieve',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Campaign ID is required',
          },
        ],
      },
    ];

    return {
      id: 'mailchimp.get_campaign',
      title: 'Get campaign',
      description: 'Get details of a Mailchimp campaign',
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
        'get',
        'find',
        'details',
        'email',
      ],
    };
  }

  public async fetchOptions(_key: string): Promise<unknown> {
    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<GetCampaignConfig>,
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
        logs.push({ level: 'info', message: `[Test mode] Would get campaign: ${campaignId}`, ts: Date.now() });
        return {
          outputs: {
            campaignId,
            type: 'regular',
            status: 'save',
            subject: 'Test Campaign',
            fromName: 'Test User',
            fromEmail: 'test@example.com',
            listId: 'test-list-123',
            sendTime: null,
            webId: 12345,
            emailsSent: 0,
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({ level: 'info', message: `Getting campaign: ${campaignId}`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const campaign = await auth.use(async (client) => {
        return await client.campaigns.get(campaignId);
      });

      const result = campaign as any;

      logs.push({ level: 'info', message: `Campaign found — status: ${result.status}`, ts: Date.now() });

      return {
        outputs: {
          campaignId: result.id || campaignId,
          type: result.type || null,
          status: result.status || null,
          subject: result.settings?.subject_line || null,
          fromName: result.settings?.from_name || null,
          fromEmail: result.settings?.from_email || null,
          listId: result.recipients?.list_id || null,
          sendTime: result.send_time || null,
          webId: result.web_id || null,
          emailsSent: result.emails_sent ?? 0,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to get campaign', ts: Date.now() });
      return {
        outputs: {},
        status: 'error',
        error: { message: error.message || 'Failed to get campaign', code: error.code || 'UNKNOWN_ERROR' },
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
      { key: 'campaignId', type: NocoSDK.VariableType.String, name: 'Campaign ID', extra: { icon: 'ncHash' } },
      { key: 'type', type: NocoSDK.VariableType.String, name: 'Type', extra: { icon: 'ncInfo' } },
      { key: 'status', type: NocoSDK.VariableType.String, name: 'Status', extra: { icon: 'ncInfo' } },
      { key: 'subject', type: NocoSDK.VariableType.String, name: 'Subject', extra: { icon: 'cellText' } },
      { key: 'fromName', type: NocoSDK.VariableType.String, name: 'From name', extra: { icon: 'ncUser' } },
      { key: 'fromEmail', type: NocoSDK.VariableType.String, name: 'From email', extra: { icon: 'ncMail' } },
      { key: 'listId', type: NocoSDK.VariableType.String, name: 'List ID', extra: { icon: 'ncHash' } },
      { key: 'sendTime', type: NocoSDK.VariableType.String, name: 'Send time', extra: { icon: 'ncCalendar' } },
      { key: 'webId', type: NocoSDK.VariableType.Number, name: 'Web ID', extra: { icon: 'ncHash' } },
      { key: 'emailsSent', type: NocoSDK.VariableType.Number, name: 'Emails sent', extra: { icon: 'ncHash' } },
    ];
  }
}
