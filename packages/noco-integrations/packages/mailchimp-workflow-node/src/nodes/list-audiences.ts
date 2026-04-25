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

interface ListAudiencesConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  count: number;
}

export class ListAudiencesNode extends WorkflowNodeIntegration<ListAudiencesConfig> {
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
        type: FormBuilderInputType.Number,
        label: 'Max results',
        model: 'config.count',
        defaultValue: 100,
        placeholder: '100',
        helpText: 'Maximum number of audiences to return (1–1000)',
      },
    ];

    return {
      id: 'mailchimp.list_audiences',
      title: 'List audiences',
      description: 'List all audiences (lists) in a Mailchimp account',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      group: 'audience',
      groupLabel: 'Audience',
      groupOrder: 6,
      keywords: [
        'mailchimp',
        'audience',
        'list',
        'all',
        'fetch',
      ],
    };
  }

  public async fetchOptions(_key: string): Promise<unknown> {
    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<ListAudiencesConfig>,
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
        logs.push({ level: 'info', message: '[Test mode] Would list audiences', ts: Date.now() });
        return {
          outputs: {
            success: true,
            count: 2,
            audiences: [
              { id: 'list-1', name: 'Newsletter', memberCount: 1500, unsubscribeCount: 42, dateCreated: '2024-01-01T00:00:00+00:00' },
              { id: 'list-2', name: 'Product Updates', memberCount: 800, unsubscribeCount: 10, dateCreated: '2024-06-01T00:00:00+00:00' },
            ],
            totalItems: 2,
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      const count = Math.min(Math.max(config.count || 100, 1), 1000);

      logs.push({ level: 'info', message: `Listing audiences (max ${count})`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const response = await auth.use(async (client) => {
        return await client.lists.getAllLists({ count });
      });

      const result = response as any;
      const audiences = ((result.lists || []) as any[]).map((list) => ({
        id: list.id,
        name: list.name,
        memberCount: list.stats?.member_count ?? 0,
        unsubscribeCount: list.stats?.unsubscribe_count ?? 0,
        dateCreated: list.date_created || null,
      }));

      logs.push({ level: 'info', message: `Found ${audiences.length} audience(s)`, ts: Date.now() });

      return {
        outputs: {
          success: true,
          count: audiences.length,
          audiences,
          totalItems: result.total_items ?? audiences.length,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to list audiences', ts: Date.now() });
      return {
        outputs: {
          success: false,
          count: 0,
          audiences: [],
          totalItems: 0,
        },
        status: 'error',
        error: { message: error.message || 'Failed to list audiences', code: error.code || 'UNKNOWN_ERROR' },
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
        extra: { icon: 'cellCheckbox', description: 'Whether the audiences were retrieved successfully' },
      },
      {
        key: 'count',
        type: NocoSDK.VariableType.Number,
        name: 'Count',
        extra: { icon: 'ncHash', description: 'Number of audiences returned' },
      },
      {
        key: 'audiences',
        type: NocoSDK.VariableType.Array,
        name: 'Audiences',
        isArray: true,
        extra: {
          icon: 'ncList',
          description: 'List of audiences in the Mailchimp account',
          itemSchema: [
            { key: 'id', type: NocoSDK.VariableType.String, name: 'ID', extra: { icon: 'ncHash' } },
            { key: 'name', type: NocoSDK.VariableType.String, name: 'Name', extra: { icon: 'cellText' } },
            { key: 'memberCount', type: NocoSDK.VariableType.Number, name: 'Member count', extra: { icon: 'ncHash' } },
            { key: 'unsubscribeCount', type: NocoSDK.VariableType.Number, name: 'Unsubscribe count', extra: { icon: 'ncHash' } },
            { key: 'dateCreated', type: NocoSDK.VariableType.String, name: 'Date created', extra: { icon: 'ncCalendar' } },
          ],
        },
      },
      {
        key: 'totalItems',
        type: NocoSDK.VariableType.Number,
        name: 'Total items',
        extra: { icon: 'ncHash', description: 'Total number of audiences in the account' },
      },
    ];
  }
}
