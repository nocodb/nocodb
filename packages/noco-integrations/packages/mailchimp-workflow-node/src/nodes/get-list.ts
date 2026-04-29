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
import { fetchLists } from '../utils';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface GetListConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
}

export class GetListNode extends WorkflowNodeIntegration<GetListConfig> {
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
        label: 'Audience',
        model: 'config.listId',
        placeholder: 'Select an audience/list',
        fetchOptionsKey: 'lists',
        dependsOn: 'config.authIntegrationId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Audience is required',
          },
        ],
      },
    ];

    return {
      id: 'mailchimp.get_list',
      title: 'Get audience',
      description: 'Get details of a Mailchimp audience (list)',
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
        'get',
        'find',
        'details',
      ],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    if (!this.config.authIntegrationId) return [];

    if (key === 'lists') {
      const auth = await this.getIntegration<MailchimpAuthIntegration>(
        this.config.authIntegrationId,
      );
      return await fetchLists(auth);
    }

    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<GetListConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, listId } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Mailchimp integration is required', code: 'MISSING_AUTH' },
          logs,
        };
      }

      if (!listId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Audience is required', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({ level: 'info', message: `[Test mode] Would get audience: ${listId}`, ts: Date.now() });
        return {
          outputs: {
            listId,
            name: 'Test Audience',
            memberCount: 1500,
            unsubscribeCount: 42,
            cleanedCount: 10,
            campaignCount: 25,
            dateCreated: '2024-01-01T00:00:00+00:00',
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({ level: 'info', message: `Getting audience: ${listId}`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const list = await auth.use(async (client) => {
        return await client.lists.getList(listId);
      });

      const result = list as any;

      logs.push({ level: 'info', message: `Audience found — name: ${result.name}`, ts: Date.now() });

      return {
        outputs: {
          listId: result.id || listId,
          name: result.name || null,
          memberCount: result.stats?.member_count ?? 0,
          unsubscribeCount: result.stats?.unsubscribe_count ?? 0,
          cleanedCount: result.stats?.cleaned_count ?? 0,
          campaignCount: result.stats?.campaign_count ?? 0,
          dateCreated: result.date_created || null,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to get audience', ts: Date.now() });
      return {
        outputs: {},
        status: 'error',
        error: { message: error.message || 'Failed to get audience', code: error.code || 'UNKNOWN_ERROR' },
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
      { key: 'listId', type: NocoSDK.VariableType.String, name: 'List ID', extra: { icon: 'ncHash' } },
      { key: 'name', type: NocoSDK.VariableType.String, name: 'Name', extra: { icon: 'cellText' } },
      { key: 'memberCount', type: NocoSDK.VariableType.Number, name: 'Member count', extra: { icon: 'ncHash' } },
      { key: 'unsubscribeCount', type: NocoSDK.VariableType.Number, name: 'Unsubscribe count', extra: { icon: 'ncHash' } },
      { key: 'cleanedCount', type: NocoSDK.VariableType.Number, name: 'Cleaned count', extra: { icon: 'ncHash' } },
      { key: 'campaignCount', type: NocoSDK.VariableType.Number, name: 'Campaign count', extra: { icon: 'ncHash' } },
      { key: 'dateCreated', type: NocoSDK.VariableType.String, name: 'Date created', extra: { icon: 'ncCalendar' } },
    ];
  }
}
