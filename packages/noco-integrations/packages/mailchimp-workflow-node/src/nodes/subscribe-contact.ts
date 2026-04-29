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

interface SubscribeContactConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  email: string;
  status: 'subscribed' | 'pending';
  firstName?: string;
  lastName?: string;
}

export class SubscribeContactNode extends WorkflowNodeIntegration<SubscribeContactConfig> {
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
        helpText:
          'Email address to subscribe. If the contact already exists, their status will be updated.',
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
    ];

    return {
      id: 'mailchimp.subscribe_contact',
      title: 'Subscribe contact',
      description:
        'Subscribe a contact to a Mailchimp audience. Creates the contact if it does not exist.',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      group: 'subscription',
      groupLabel: 'Subscription',
      groupOrder: 5,
      keywords: [
        'mailchimp',
        'subscribe',
        'contact',
        'audience',
        'list',
        'opt-in',
        'member',
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
    ctx: WorkflowNodeRunContext<SubscribeContactConfig>,
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

      logs.push({
        level: 'info',
        message: `Subscribing ${email} to audience ${listId}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const hash = subscriberHash(email);

      const mergeFields: Record<string, string> = {};
      if (config.firstName) mergeFields.FNAME = config.firstName;
      if (config.lastName) mergeFields.LNAME = config.lastName;

      // Use setListMember (PUT) to create-or-update
      const member = await auth.use(async (client) => {
        return await client.lists.setListMember(listId, hash, {
          email_address: email,
          status_if_new: status || 'subscribed',
          status: status || 'subscribed',
          ...(Object.keys(mergeFields).length
            ? { merge_fields: mergeFields }
            : {}),
        });
      });

      const result = member as any;

      logs.push({
        level: 'info',
        message: `Contact subscribed — id: ${result.id}, status: ${result.status}`,
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
        message: error.message || 'Failed to subscribe contact',
        ts: Date.now(),
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to subscribe contact',
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
