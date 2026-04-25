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

interface DeleteListConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  listId: string;
}

export class DeleteListNode extends WorkflowNodeIntegration<DeleteListConfig> {
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
        placeholder: 'Select an audience/list to delete',
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
      id: 'mailchimp.delete_list',
      title: 'Delete audience',
      description: 'Delete a Mailchimp audience (list). This action cannot be undone.',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      keywords: [
        'mailchimp',
        'audience',
        'list',
        'delete',
        'remove',
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
    ctx: WorkflowNodeRunContext<DeleteListConfig>,
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
        logs.push({ level: 'info', message: `[Test mode] Would delete audience: ${listId}`, ts: Date.now() });
        return {
          outputs: { deleted: true },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({ level: 'info', message: `Deleting audience: ${listId}`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      await auth.use(async (client) => {
        return await client.lists.deleteList(listId);
      });

      logs.push({ level: 'info', message: `Audience ${listId} deleted successfully`, ts: Date.now() });

      return {
        outputs: { deleted: true },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to delete audience', ts: Date.now() });
      return {
        outputs: { deleted: false },
        status: 'error',
        error: { message: error.message || 'Failed to delete audience', code: error.code || 'UNKNOWN_ERROR' },
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
      { key: 'deleted', type: NocoSDK.VariableType.Boolean, name: 'Deleted', extra: { icon: 'cellCheckbox' } },
    ];
  }
}
