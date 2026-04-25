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

interface UpdateListConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  name?: string;
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  permissionReminder?: string;
  company?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export class UpdateListNode extends WorkflowNodeIntegration<UpdateListConfig> {
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
        type: FormBuilderInputType.WorkflowInput,
        label: 'Audience name',
        model: 'config.name',
        placeholder: 'New audience name',
        helpText: 'Leave empty to keep current name',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Permission reminder',
        model: 'config.permissionReminder',
        placeholder: 'You signed up for updates on our website.',
        helpText: 'Leave empty to keep current value',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From name',
        model: 'config.fromName',
        placeholder: 'Your Company',
        group: 'campaignDefaults',
        groupCollapsible: true,
        groupLabel: 'Campaign defaults',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From email',
        model: 'config.fromEmail',
        placeholder: 'newsletters@example.com',
        group: 'campaignDefaults',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Subject',
        model: 'config.subject',
        placeholder: 'Default campaign subject',
        group: 'campaignDefaults',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Company',
        model: 'config.company',
        placeholder: 'Your Company Name',
        group: 'contact',
        groupCollapsible: true,
        groupLabel: 'Contact info',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Address',
        model: 'config.address1',
        placeholder: '123 Main St',
        group: 'contact',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'City',
        model: 'config.city',
        placeholder: 'San Francisco',
        group: 'contact',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'State',
        model: 'config.state',
        placeholder: 'CA',
        group: 'contact',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'ZIP code',
        model: 'config.zip',
        placeholder: '94105',
        group: 'contact',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Country',
        model: 'config.country',
        placeholder: 'US',
        helpText: 'Two-letter country code (e.g. US, GB, DE)',
        group: 'contact',
      },
    ];

    return {
      id: 'mailchimp.update_list',
      title: 'Update audience',
      description: 'Update a Mailchimp audience (list) settings',
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
        'update',
        'edit',
        'modify',
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
    ctx: WorkflowNodeRunContext<UpdateListConfig>,
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
        logs.push({ level: 'info', message: `[Test mode] Would update audience: ${listId}`, ts: Date.now() });
        return {
          outputs: { listId, name: config.name || 'Test Audience' },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({ level: 'info', message: `Updating audience: ${listId}`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      // Fetch current list to merge with updates (Mailchimp PATCH requires full objects)
      const current = (await auth.use(async (client) => {
        return await client.lists.getList(listId);
      })) as any;

      const body: any = {
        name: config.name || current.name,
        permission_reminder: config.permissionReminder || current.permission_reminder,
        email_type_option: current.email_type_option ?? true,
        contact: {
          company: config.company || current.contact?.company,
          address1: config.address1 || current.contact?.address1,
          city: config.city || current.contact?.city,
          state: config.state || current.contact?.state,
          zip: config.zip || current.contact?.zip,
          country: config.country || current.contact?.country,
        },
        campaign_defaults: {
          from_name: config.fromName || current.campaign_defaults?.from_name,
          from_email: config.fromEmail || current.campaign_defaults?.from_email,
          subject: config.subject || current.campaign_defaults?.subject,
          language: current.campaign_defaults?.language || 'en',
        },
      };

      const list = await auth.use(async (client) => {
        return await client.lists.updateList(listId, body);
      });

      const result = list as any;

      logs.push({ level: 'info', message: `Audience updated — name: ${result.name}`, ts: Date.now() });

      return {
        outputs: {
          listId: result.id || listId,
          name: result.name || null,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to update audience', ts: Date.now() });
      return {
        outputs: {},
        status: 'error',
        error: { message: error.message || 'Failed to update audience', code: error.code || 'UNKNOWN_ERROR' },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      ...(this.config.name
        ? [{ key: 'config.name', type: NocoSDK.VariableType.String, name: 'Audience name', extra: { icon: 'cellText' } }]
        : []),
      ...(this.config.fromName
        ? [{ key: 'config.fromName', type: NocoSDK.VariableType.String, name: 'From name', extra: { icon: 'ncUser' } }]
        : []),
      ...(this.config.fromEmail
        ? [{ key: 'config.fromEmail', type: NocoSDK.VariableType.String, name: 'From email', extra: { icon: 'ncMail' } }]
        : []),
    ];
  }

  public async generateOutputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      { key: 'listId', type: NocoSDK.VariableType.String, name: 'List ID', extra: { icon: 'ncHash' } },
      { key: 'name', type: NocoSDK.VariableType.String, name: 'Name', extra: { icon: 'cellText' } },
    ];
  }
}
