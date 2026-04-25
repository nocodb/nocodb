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

interface CreateListConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  name: string;
  company: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  permissionReminder: string;
}

export class CreateListNode extends WorkflowNodeIntegration<CreateListConfig> {
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
        label: 'Audience name',
        model: 'config.name',
        placeholder: 'My Audience',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Audience name is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Permission reminder',
        model: 'config.permissionReminder',
        placeholder: 'You signed up for updates on our website.',
        helpText:
          'Remind subscribers how they signed up to your list (required by Mailchimp)',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Permission reminder is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From name',
        model: 'config.fromName',
        placeholder: 'Your Company',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'From name is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From email',
        model: 'config.fromEmail',
        placeholder: 'newsletters@example.com',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'From email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Subject',
        model: 'config.subject',
        placeholder: 'Default campaign subject',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Subject is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Company',
        model: 'config.company',
        placeholder: 'Your Company Name',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Company is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Address',
        model: 'config.address1',
        placeholder: '123 Main St',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Address is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'City',
        model: 'config.city',
        placeholder: 'San Francisco',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'City is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'State',
        model: 'config.state',
        placeholder: 'CA',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'State is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'ZIP code',
        model: 'config.zip',
        placeholder: '94105',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'ZIP code is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Country',
        model: 'config.country',
        placeholder: 'US',
        helpText: 'Two-letter country code (e.g. US, GB, DE)',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Country is required',
          },
        ],
      },
    ];

    return {
      id: 'mailchimp.create_list',
      title: 'Create audience',
      description: 'Create a new Mailchimp audience (list)',
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
        'create',
        'new',
      ],
    };
  }

  public async fetchOptions(_key: string): Promise<unknown> {
    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<CreateListConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, name, permissionReminder, fromName, fromEmail, subject, company, address1, city, state, zip, country } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Mailchimp integration is required', code: 'MISSING_AUTH' },
          logs,
        };
      }

      if (!name || !permissionReminder || !fromName || !fromEmail || !subject || !company || !address1 || !city || !state || !zip || !country) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'All fields are required to create an audience', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({ level: 'info', message: `[Test mode] Would create audience: ${name}`, ts: Date.now() });
        return {
          outputs: { listId: 'test-list-' + Date.now(), name, webId: 12345 },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({ level: 'info', message: `Creating audience: ${name}`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const list = await auth.use(async (client) => {
        return await client.lists.createList({
          name,
          permission_reminder: permissionReminder,
          email_type_option: true,
          contact: { company, address1, city, state, zip, country },
          campaign_defaults: {
            from_name: fromName,
            from_email: fromEmail,
            subject,
            language: 'en',
          },
        });
      });

      const result = list as any;

      logs.push({ level: 'info', message: `Audience created — id: ${result.id}`, ts: Date.now() });

      return {
        outputs: {
          listId: result.id || null,
          name: result.name || name,
          webId: result.web_id || null,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to create audience', ts: Date.now() });
      return {
        outputs: {},
        status: 'error',
        error: { message: error.message || 'Failed to create audience', code: error.code || 'UNKNOWN_ERROR' },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      { key: 'config.name', type: NocoSDK.VariableType.String, name: 'Audience name', extra: { icon: 'cellText' } },
      { key: 'config.fromName', type: NocoSDK.VariableType.String, name: 'From name', extra: { icon: 'ncUser' } },
      { key: 'config.fromEmail', type: NocoSDK.VariableType.String, name: 'From email', extra: { icon: 'ncMail' } },
      { key: 'config.subject', type: NocoSDK.VariableType.String, name: 'Subject', extra: { icon: 'cellText' } },
    ];
  }

  public async generateOutputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      { key: 'listId', type: NocoSDK.VariableType.String, name: 'List ID', extra: { icon: 'ncHash' } },
      { key: 'name', type: NocoSDK.VariableType.String, name: 'Name', extra: { icon: 'cellText' } },
      { key: 'webId', type: NocoSDK.VariableType.Number, name: 'Web ID', extra: { icon: 'ncHash' } },
    ];
  }
}
