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

interface UnsubscribeContactConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  email: string;
}

export class UnsubscribeContactNode extends WorkflowNodeIntegration<UnsubscribeContactConfig> {
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
        helpText: 'Email address of the contact to unsubscribe',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Email is required',
          },
        ],
      },
    ];

    return {
      id: 'mailchimp.unsubscribe_contact',
      title: 'Unsubscribe contact',
      description: 'Unsubscribe a contact from a Mailchimp audience',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      keywords: [
        'mailchimp',
        'unsubscribe',
        'contact',
        'audience',
        'list',
        'opt-out',
        'member',
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
    ctx: WorkflowNodeRunContext<UnsubscribeContactConfig>,
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
          message: `[Test mode] Would unsubscribe ${email} from audience ${listId}`,
          ts: Date.now(),
        });
        return {
          outputs: {
            contactId: 'test-contact-' + Date.now(),
            email,
            status: 'unsubscribed',
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({
        level: 'info',
        message: `Unsubscribing ${email} from audience ${listId}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const subscriberHash = await this.md5(email.toLowerCase());

      const member = await auth.use(async (client) => {
        return await client.lists.updateListMember(listId, subscriberHash, {
          status: 'unsubscribed',
        });
      });

      const result = member as any;

      logs.push({
        level: 'info',
        message: `Contact unsubscribed — id: ${result.id}, status: ${result.status}`,
        ts: Date.now(),
      });

      return {
        outputs: {
          contactId: result.id || null,
          email: result.email_address || email,
          status: result.status || 'unsubscribed',
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to unsubscribe contact',
        ts: Date.now(),
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to unsubscribe contact',
          code: error.code || 'UNKNOWN_ERROR',
        },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  private async md5(str: string): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('md5').update(str).digest('hex');
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.email',
        type: NocoSDK.VariableType.String,
        name: 'Email',
        extra: { icon: 'ncMail' },
      },
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
