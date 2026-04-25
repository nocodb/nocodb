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

interface AddContactConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  email: string;
  status: 'subscribed' | 'pending' | 'transactional';
  firstName?: string;
  lastName?: string;
  mergeFields?: string;
  tags?: string;
}

export class AddContactNode extends WorkflowNodeIntegration<AddContactConfig> {
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
        label: 'Email',
        model: 'config.email',
        placeholder: 'contact@example.com',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Status',
        model: 'config.status',
        defaultValue: 'subscribed',
        options: [
          { label: 'Subscribed', value: 'subscribed' },
          { label: 'Pending (double opt-in)', value: 'pending' },
          { label: 'Transactional', value: 'transactional' },
        ],
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Status is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'First name',
        model: 'config.firstName',
        placeholder: 'John',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Last name',
        model: 'config.lastName',
        placeholder: 'Doe',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Tags',
        model: 'config.tags',
        placeholder: 'tag1, tag2, tag3',
        helpText: 'Comma-separated list of tags to assign to the contact',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.Textarea,
        label: 'Merge fields (JSON)',
        model: 'config.mergeFields',
        placeholder: '{ "COMPANY": "Acme", "PHONE": "+1234567890" }',
        helpText:
          'JSON object of merge field values. Keys must match your audience merge field tags.',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'mailchimp.add_contact',
      title: 'Add contact',
      description: 'Add a new contact to a Mailchimp audience',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      keywords: [
        'mailchimp',
        'contact',
        'add',
        'create',
        'subscriber',
        'member',
        'audience',
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
    ctx: WorkflowNodeRunContext<AddContactConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, listId, email, status } = config;

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

      if (!listId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Audience is required', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (!email) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Email is required', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({
          level: 'info',
          message: `[Test mode] Would add contact ${email} to audience ${listId}`,
          ts: Date.now(),
        });
        return {
          outputs: {
            contactId: 'test-contact-' + Date.now(),
            email,
            status: status || 'subscribed',
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({
        level: 'info',
        message: `Adding contact ${email} to audience ${listId}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      // Build merge fields
      const mergeFields: Record<string, string> = {};
      if (config.firstName) mergeFields.FNAME = config.firstName;
      if (config.lastName) mergeFields.LNAME = config.lastName;

      if (config.mergeFields) {
        try {
          Object.assign(mergeFields, JSON.parse(config.mergeFields));
        } catch {
          return {
            outputs: {},
            status: 'error',
            error: {
              message:
                'Invalid merge fields JSON. Expected format: { "FIELD": "value" }',
              code: 'INVALID_INPUT',
            },
            logs,
          };
        }
      }

      // Build tags array
      const tags: string[] = [];
      if (config.tags) {
        tags.push(
          ...config.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        );
      }

      const body: any = {
        email_address: email,
        status: status || 'subscribed',
        ...(Object.keys(mergeFields).length
          ? { merge_fields: mergeFields }
          : {}),
        ...(tags.length ? { tags } : {}),
      };

      const member = await auth.use(async (client) => {
        return await client.lists.addListMember(listId, body);
      });

      const result = member as any;

      logs.push({
        level: 'info',
        message: `Contact added — id: ${result.id}, status: ${result.status}`,
        ts: Date.now(),
      });

      return {
        outputs: {
          contactId: result.id || null,
          email: result.email_address || email,
          status: result.status || 'subscribed',
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to add contact',
        ts: Date.now(),
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to add contact',
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
        key: 'config.email',
        type: NocoSDK.VariableType.String,
        name: 'Email',
        extra: { icon: 'ncMail' },
      },
      ...(this.config.firstName
        ? [
            {
              key: 'config.firstName',
              type: NocoSDK.VariableType.String,
              name: 'First name',
              extra: { icon: 'ncUser' },
            },
          ]
        : []),
      ...(this.config.lastName
        ? [
            {
              key: 'config.lastName',
              type: NocoSDK.VariableType.String,
              name: 'Last name',
              extra: { icon: 'ncUser' },
            },
          ]
        : []),
      ...(this.config.tags
        ? [
            {
              key: 'config.tags',
              type: NocoSDK.VariableType.String,
              name: 'Tags',
              extra: { icon: 'ncTag' },
            },
          ]
        : []),
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'contactId',
        type: NocoSDK.VariableType.String,
        name: 'Contact ID',
        extra: { icon: 'ncHash' },
      },
      {
        key: 'email',
        type: NocoSDK.VariableType.String,
        name: 'Email',
        extra: { icon: 'ncMail' },
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
