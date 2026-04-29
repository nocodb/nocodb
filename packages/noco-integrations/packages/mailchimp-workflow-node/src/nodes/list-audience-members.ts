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

interface ListAudienceMembersConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  status?: string;
  count: number;
}

export class ListAudienceMembersNode extends WorkflowNodeIntegration<ListAudienceMembersConfig> {
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
      {
        type: FormBuilderInputType.Select,
        label: 'Filter by status',
        model: 'config.status',
        placeholder: 'All statuses',
        options: [
          { label: 'Subscribed', value: 'subscribed' },
          { label: 'Unsubscribed', value: 'unsubscribed' },
          { label: 'Cleaned', value: 'cleaned' },
          { label: 'Pending', value: 'pending' },
          { label: 'Transactional', value: 'transactional' },
        ],
      },
      {
        type: FormBuilderInputType.Number,
        label: 'Max results',
        model: 'config.count',
        defaultValue: 100,
        placeholder: '100',
        helpText: 'Maximum number of members to return (1–1000)',
      },
    ];

    return {
      id: 'mailchimp.list_audience_members',
      title: 'Get audience members',
      description: 'List members of a Mailchimp audience',
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
        'members',
        'contacts',
        'list',
        'subscribers',
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
    ctx: WorkflowNodeRunContext<ListAudienceMembersConfig>,
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
        logs.push({ level: 'info', message: `[Test mode] Would list members of audience ${listId}`, ts: Date.now() });
        return {
          outputs: {
            success: true,
            count: 2,
            members: [
              { id: 'abc123', email: 'john@example.com', status: 'subscribed', firstName: 'John', lastName: 'Doe', tags: ['vip'] },
              { id: 'def456', email: 'jane@example.com', status: 'subscribed', firstName: 'Jane', lastName: 'Smith', tags: [] },
            ],
            totalItems: 2,
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      const count = Math.min(Math.max(config.count || 100, 1), 1000);

      logs.push({
        level: 'info',
        message: `Listing members of audience ${listId}${config.status ? ` (status: ${config.status})` : ''} (max ${count})`,
        ts: Date.now(),
      });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const params: any = { count };
      if (config.status) params.status = config.status;

      const response = await auth.use(async (client) => {
        return await client.lists.getListMembersInfo(listId, params);
      });

      const result = response as any;
      const members = ((result.members || []) as any[]).map((m) => ({
        id: m.id,
        email: m.email_address,
        status: m.status,
        firstName: m.merge_fields?.FNAME || null,
        lastName: m.merge_fields?.LNAME || null,
        tags: (m.tags || []).map((t: any) => t.name),
      }));

      logs.push({ level: 'info', message: `Found ${members.length} member(s)`, ts: Date.now() });

      return {
        outputs: {
          success: true,
          count: members.length,
          members,
          totalItems: result.total_items ?? members.length,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to list audience members', ts: Date.now() });
      return {
        outputs: {
          success: false,
          count: 0,
          members: [],
          totalItems: 0,
        },
        status: 'error',
        error: { message: error.message || 'Failed to list audience members', code: error.code || 'UNKNOWN_ERROR' },
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
        extra: { icon: 'cellCheckbox', description: 'Whether the members were retrieved successfully' },
      },
      {
        key: 'count',
        type: NocoSDK.VariableType.Number,
        name: 'Count',
        extra: { icon: 'ncHash', description: 'Number of members returned' },
      },
      {
        key: 'members',
        type: NocoSDK.VariableType.Array,
        name: 'Members',
        isArray: true,
        extra: {
          icon: 'ncUsers',
          description: 'List of members in the audience',
          itemSchema: [
            { key: 'id', type: NocoSDK.VariableType.String, name: 'ID', extra: { icon: 'ncHash' } },
            { key: 'email', type: NocoSDK.VariableType.String, name: 'Email', extra: { icon: 'ncMail' } },
            { key: 'status', type: NocoSDK.VariableType.String, name: 'Status', extra: { icon: 'ncInfo' } },
            { key: 'firstName', type: NocoSDK.VariableType.String, name: 'First name', extra: { icon: 'ncUser' } },
            { key: 'lastName', type: NocoSDK.VariableType.String, name: 'Last name', extra: { icon: 'ncUser' } },
            { key: 'tags', type: NocoSDK.VariableType.Array, name: 'Tags', extra: { icon: 'ncTag' } },
          ],
        },
      },
      {
        key: 'totalItems',
        type: NocoSDK.VariableType.Number,
        name: 'Total items',
        extra: { icon: 'ncHash', description: 'Total number of members in the audience' },
      },
    ];
  }
}
