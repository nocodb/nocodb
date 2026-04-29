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
import { subscriberHash, fetchLists } from '../utils';

interface DeleteContactConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
  email: string;
  permanent: boolean;
}

export class DeleteContactNode extends WorkflowNodeIntegration<DeleteContactConfig> {
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
        helpText: 'Email address of the contact to delete',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Switch,
        label: 'Permanently delete',
        model: 'config.permanent',
        defaultValue: false,
        helpText:
          'If enabled, the contact is permanently deleted and cannot be re-imported. Otherwise, the contact is archived.',
      },
    ];

    return {
      id: 'mailchimp.delete_contact',
      title: 'Delete contact',
      description: 'Delete or archive a contact from a Mailchimp audience',
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
        'delete',
        'remove',
        'archive',
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
    ctx: WorkflowNodeRunContext<DeleteContactConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, listId, email, permanent } = config;

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
        message: `${permanent ? 'Permanently deleting' : 'Archiving'} contact ${email} from audience ${listId}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const hash = subscriberHash(email);

      if (permanent) {
        await auth.use(async (client) => {
          return await client.lists.deleteListMemberPermanent(
            listId,
            hash,
          );
        });
      } else {
        await auth.use(async (client) => {
          return await client.lists.deleteListMember(listId, hash);
        });
      }

      logs.push({
        level: 'info',
        message: `Contact ${email} ${permanent ? 'permanently deleted' : 'archived'} successfully`,
        ts: Date.now(),
      });

      return {
        outputs: {
          deleted: true,
          permanent: !!permanent,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to delete contact',
        ts: Date.now(),
      });

      return {
        outputs: { deleted: false },
        status: 'error',
        error: {
          message: error.message || 'Failed to delete contact',
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
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'deleted',
        type: NocoSDK.VariableType.Boolean,
        name: 'Deleted',
        extra: { icon: 'cellCheckbox' },
      },
      {
        key: 'permanent',
        type: NocoSDK.VariableType.Boolean,
        name: 'Permanent',
        extra: { icon: 'ncInfo' },
      },
    ];
  }
}
