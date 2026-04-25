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

interface TagContactConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  email: string;
  tags: string;
}

export class TagContactNode extends WorkflowNodeIntegration<TagContactConfig> {
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
        helpText: 'Email address of the contact to tag',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Tags',
        model: 'config.tags',
        placeholder: 'tag1, tag2, tag3',
        helpText: 'Comma-separated list of tags to add to the contact',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'At least one tag is required',
          },
        ],
      },
    ];

    return {
      id: 'mailchimp.tag_contact',
      title: 'Tag contact',
      description: 'Add tags to a contact in a Mailchimp audience',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      group: 'contact-tags',
      groupLabel: 'Contact Tags',
      groupOrder: 4,
      keywords: [
        'mailchimp',
        'contact',
        'tag',
        'add',
        'label',
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
    ctx: WorkflowNodeRunContext<TagContactConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, listId, email, tags } = config;

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

      if (!tags) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'At least one tag is required',
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (ctx.testMode) {
        logs.push({
          level: 'info',
          message: `[Test mode] Would add tags [${tagList.join(', ')}] to contact ${email}`,
          ts: Date.now(),
        });
        return {
          outputs: {
            tagged: true,
            tags: tagList,
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({
        level: 'info',
        message: `Adding tags [${tagList.join(', ')}] to contact ${email}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const subscriberHash = await this.md5(email.toLowerCase());

      await auth.use(async (client) => {
        return await client.lists.updateListMemberTags(
          listId,
          subscriberHash,
          {
            tags: tagList.map((name) => ({ name, status: 'active' })),
          },
        );
      });

      logs.push({
        level: 'info',
        message: `Tags added to contact ${email} successfully`,
        ts: Date.now(),
      });

      return {
        outputs: {
          tagged: true,
          tags: tagList,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to tag contact',
        ts: Date.now(),
      });

      return {
        outputs: { tagged: false },
        status: 'error',
        error: {
          message: error.message || 'Failed to tag contact',
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
      {
        key: 'config.tags',
        type: NocoSDK.VariableType.String,
        name: 'Tags',
        extra: { icon: 'ncTag' },
      },
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'tagged',
        type: NocoSDK.VariableType.Boolean,
        name: 'Tagged',
        extra: { icon: 'cellCheckbox' },
      },
      {
        key: 'tags',
        type: NocoSDK.VariableType.Array,
        name: 'Tags',
        extra: { icon: 'ncTag' },
      },
    ];
  }
}
