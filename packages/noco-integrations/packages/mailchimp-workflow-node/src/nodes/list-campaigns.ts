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

interface ListCampaignsConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  status?: string;
  type?: string;
  listId?: string;
  count: number;
}

export class ListCampaignsNode extends WorkflowNodeIntegration<ListCampaignsConfig> {
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
        type: FormBuilderInputType.Select,
        label: 'Filter by status',
        model: 'config.status',
        placeholder: 'All statuses',
        options: [
          { label: 'Save (draft)', value: 'save' },
          { label: 'Paused', value: 'paused' },
          { label: 'Schedule', value: 'schedule' },
          { label: 'Sending', value: 'sending' },
          { label: 'Sent', value: 'sent' },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Filter by type',
        model: 'config.type',
        placeholder: 'All types',
        options: [
          { label: 'Regular', value: 'regular' },
          { label: 'Plain-text', value: 'plaintext' },
          { label: 'RSS', value: 'rss' },
          { label: 'A/B test', value: 'variate' },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Filter by audience',
        model: 'config.listId',
        placeholder: 'All audiences',
        fetchOptionsKey: 'lists',
        dependsOn: 'config.authIntegrationId',
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Max results',
        model: 'config.count',
        defaultValue: 100,
        placeholder: '100',
        helpText: 'Maximum number of campaigns to return (1–1000)',
      },
    ];

    return {
      id: 'mailchimp.list_campaigns',
      title: 'List campaigns',
      description: 'List campaigns in a Mailchimp account',
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
        'list',
        'all',
        'fetch',
        'email',
      ],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    if (key === 'lists') {
      const auth = await this.getIntegration<MailchimpAuthIntegration>(
        this.config.authIntegrationId,
      );
      return await auth.use(async (client) => {
        const response = await client.lists.getAllLists({ count: 1000 });
        return ((response as any).lists || []).map(
          (list: { name: string; id: string }) => ({
            label: list.name,
            value: list.id,
          }),
        );
      });
    }

    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<ListCampaignsConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Mailchimp integration is required', code: 'MISSING_AUTH' },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({ level: 'info', message: '[Test mode] Would list campaigns', ts: Date.now() });
        return {
          outputs: {
            success: true,
            count: 2,
            campaigns: [
              { id: 'camp-1', type: 'regular', status: 'sent', subject: 'Newsletter #1', sendTime: '2024-06-01T10:00:00+00:00', emailsSent: 1200 },
              { id: 'camp-2', type: 'regular', status: 'save', subject: 'Newsletter #2', sendTime: null, emailsSent: 0 },
            ],
            totalItems: 2,
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      const count = Math.min(Math.max(config.count || 100, 1), 1000);

      const filters: string[] = [];
      if (config.status) filters.push(`status: ${config.status}`);
      if (config.type) filters.push(`type: ${config.type}`);
      if (config.listId) filters.push(`audience: ${config.listId}`);

      logs.push({
        level: 'info',
        message: `Listing campaigns (max ${count})${filters.length ? ` — ${filters.join(', ')}` : ''}`,
        ts: Date.now(),
      });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const params: any = { count };
      if (config.status) params.status = config.status;
      if (config.type) params.type = config.type;
      if (config.listId) params.list_id = config.listId;

      const response = await auth.use(async (client) => {
        return await client.campaigns.list(params);
      });

      const result = response as any;
      const campaigns = ((result.campaigns || []) as any[]).map((c) => ({
        id: c.id,
        type: c.type || null,
        status: c.status || null,
        subject: c.settings?.subject_line || null,
        fromName: c.settings?.from_name || null,
        fromEmail: c.settings?.from_email || null,
        listId: c.recipients?.list_id || null,
        sendTime: c.send_time || null,
        emailsSent: c.emails_sent ?? 0,
      }));

      logs.push({ level: 'info', message: `Found ${campaigns.length} campaign(s)`, ts: Date.now() });

      return {
        outputs: {
          success: true,
          count: campaigns.length,
          campaigns,
          totalItems: result.total_items ?? campaigns.length,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to list campaigns', ts: Date.now() });
      return {
        outputs: {
          success: false,
          count: 0,
          campaigns: [],
          totalItems: 0,
        },
        status: 'error',
        error: { message: error.message || 'Failed to list campaigns', code: error.code || 'UNKNOWN_ERROR' },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [];
  }

  public async generateOutputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: { icon: 'cellCheckbox', description: 'Whether the campaigns were retrieved successfully' },
      },
      {
        key: 'count',
        type: NocoSDK.VariableType.Number,
        name: 'Count',
        extra: { icon: 'ncHash', description: 'Number of campaigns returned' },
      },
      {
        key: 'campaigns',
        type: NocoSDK.VariableType.Array,
        name: 'Campaigns',
        isArray: true,
        extra: {
          icon: 'ncMail',
          description: 'List of campaigns',
          itemSchema: [
            { key: 'id', type: NocoSDK.VariableType.String, name: 'ID', extra: { icon: 'ncHash' } },
            { key: 'type', type: NocoSDK.VariableType.String, name: 'Type', extra: { icon: 'ncInfo' } },
            { key: 'status', type: NocoSDK.VariableType.String, name: 'Status', extra: { icon: 'ncInfo' } },
            { key: 'subject', type: NocoSDK.VariableType.String, name: 'Subject', extra: { icon: 'cellText' } },
            { key: 'fromName', type: NocoSDK.VariableType.String, name: 'From name', extra: { icon: 'ncUser' } },
            { key: 'fromEmail', type: NocoSDK.VariableType.String, name: 'From email', extra: { icon: 'ncMail' } },
            { key: 'listId', type: NocoSDK.VariableType.String, name: 'List ID', extra: { icon: 'ncHash' } },
            { key: 'sendTime', type: NocoSDK.VariableType.String, name: 'Send time', extra: { icon: 'ncCalendar' } },
            { key: 'emailsSent', type: NocoSDK.VariableType.Number, name: 'Emails sent', extra: { icon: 'ncHash' } },
          ],
        },
      },
      {
        key: 'totalItems',
        type: NocoSDK.VariableType.Number,
        name: 'Total items',
        extra: { icon: 'ncHash', description: 'Total number of campaigns in the account' },
      },
    ];
  }
}
