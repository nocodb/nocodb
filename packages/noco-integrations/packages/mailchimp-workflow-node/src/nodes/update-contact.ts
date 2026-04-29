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
import { subscriberHash, fetchLists } from '../utils';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface UpdateContactConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  mergeFields?: string;
}

export class UpdateContactNode extends WorkflowNodeIntegration<UpdateContactConfig> {
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
        helpText: 'Email address of the contact to update',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'First name',
        model: 'config.firstName',
        placeholder: 'John',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Last name',
        model: 'config.lastName',
        placeholder: 'Doe',
      },
      {
        type: FormBuilderInputType.Textarea,
        label: 'Merge fields (JSON)',
        model: 'config.mergeFields',
        placeholder: '{ "COMPANY": "Acme", "PHONE": "+1234567890" }',
        helpText:
          'JSON object of merge field values to update. Keys must match your audience merge field tags.',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'mailchimp.update_contact',
      title: 'Update contact',
      description: 'Update a contact in a Mailchimp audience',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      group: 'contact',
      groupLabel: 'Contact',
      groupOrder: 3,
      keywords: [
        'mailchimp',
        'contact',
        'update',
        'edit',
        'modify',
        'member',
        'audience',
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
    ctx: WorkflowNodeRunContext<UpdateContactConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, listId, email } = config;

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
          message: `[Test mode] Would update contact ${email} in audience ${listId}`,
          ts: Date.now(),
        });
        return {
          outputs: {
            contactId: 'test-contact-' + Date.now(),
            email,
            status: 'subscribed',
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({
        level: 'info',
        message: `Updating contact ${email} in audience ${listId}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const hash = subscriberHash(email);

      // Build merge fields
      const mergeFields: Record<string, string> = {};
      if (config.firstName !== undefined) mergeFields.FNAME = config.firstName;
      if (config.lastName !== undefined) mergeFields.LNAME = config.lastName;

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

      const body: any = {
        ...(Object.keys(mergeFields).length
          ? { merge_fields: mergeFields }
          : {}),
      };

      const member = await auth.use(async (client) => {
        return await client.lists.updateListMember(
          listId,
          hash,
          body,
        );
      });

      const result = member as any;

      logs.push({
        level: 'info',
        message: `Contact updated — id: ${result.id}, status: ${result.status}`,
        ts: Date.now(),
      });

      return {
        outputs: {
          contactId: result.id || null,
          email: result.email_address || email,
          status: result.status || null,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to update contact',
        ts: Date.now(),
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to update contact',
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
      ...(this.config.firstName !== undefined
        ? [
            {
              key: 'config.firstName',
              type: NocoSDK.VariableType.String,
              name: 'First name',
              extra: { icon: 'ncUser' },
            },
          ]
        : []),
      ...(this.config.lastName !== undefined
        ? [
            {
              key: 'config.lastName',
              type: NocoSDK.VariableType.String,
              name: 'Last name',
              extra: { icon: 'ncUser' },
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
