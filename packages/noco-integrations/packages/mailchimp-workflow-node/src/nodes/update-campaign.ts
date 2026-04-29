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
import { fetchLists, fetchSegments, fetchTemplates } from '../utils';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface UpdateCampaignConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  campaignId: string;
  listId?: string;
  segmentId?: string;
  templateId?: number;
  subject?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export class UpdateCampaignNode extends WorkflowNodeIntegration<UpdateCampaignConfig> {
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
        label: 'Campaign ID',
        model: 'config.campaignId',
        placeholder: 'Enter campaign ID or use $(variable)',
        helpText:
          'The ID of the campaign to update. Typically from a Create Campaign node output.',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Campaign ID is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Subject',
        model: 'config.subject',
        placeholder: 'New subject line',
        helpText: 'Leave empty to keep current subject',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From name',
        model: 'config.fromName',
        placeholder: 'Your Company',
        helpText: 'Leave empty to keep current value',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From email',
        model: 'config.fromEmail',
        placeholder: 'campaigns@example.com',
        helpText: 'Leave empty to keep current value',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Audience',
        model: 'config.listId',
        placeholder: 'Keep current audience',
        fetchOptionsKey: 'lists',
        dependsOn: 'config.authIntegrationId',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Segment',
        model: 'config.segmentId',
        placeholder: 'Keep current segment',
        fetchOptionsKey: 'segments',
        dependsOn: 'config.listId',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Template',
        model: 'config.templateId',
        placeholder: 'Keep current template',
        fetchOptionsKey: 'templates',
        dependsOn: 'config.authIntegrationId',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Reply to',
        model: 'config.replyTo',
        placeholder: 'reply@example.com',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'mailchimp.update_campaign',
      title: 'Update campaign',
      description: 'Update an existing Mailchimp campaign',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      group: 'campaign',
      groupLabel: 'Campaign',
      groupOrder: 2,
      keywords: [
        'mailchimp',
        'campaign',
        'update',
        'edit',
        'modify',
        'email',
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

    if (key === 'segments') {
      if (!this.config.listId) return [];
      const auth = await this.getIntegration<MailchimpAuthIntegration>(
        this.config.authIntegrationId,
      );
      return await fetchSegments(auth, this.config.listId);
    }

    if (key === 'templates') {
      const auth = await this.getIntegration<MailchimpAuthIntegration>(
        this.config.authIntegrationId,
      );
      return await fetchTemplates(auth);
    }

    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<UpdateCampaignConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, campaignId } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Mailchimp integration is required', code: 'MISSING_AUTH' },
          logs,
        };
      }

      if (!campaignId) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Campaign ID is required', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({ level: 'info', message: `[Test mode] Would update campaign: ${campaignId}`, ts: Date.now() });
        return {
          outputs: {
            campaignId,
            status: 'save',
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({ level: 'info', message: `Updating campaign: ${campaignId}`, ts: Date.now() });

      const auth = await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      // Build update body — only include fields that are provided
      const settings: any = {};
      if (config.subject) settings.subject_line = config.subject;
      if (config.fromName) settings.from_name = config.fromName;
      if (config.fromEmail) settings.from_email = config.fromEmail;
      if (config.replyTo) settings.reply_to = config.replyTo;

      const body: any = {};
      if (Object.keys(settings).length) body.settings = settings;

      if (config.listId) {
        body.recipients = {
          list_id: config.listId,
          ...(config.segmentId
            ? { segment_opts: { saved_segment_id: Number(config.segmentId) } }
            : {}),
        };
      }

      const campaign = await auth.use(async (client) => {
        return await client.campaigns.update(campaignId, body);
      });

      const result = campaign as any;

      // Update template content if provided
      if (config.templateId) {
        await auth.use(async (client) => {
          return await client.campaigns.setContent(result.id, {
            template: { id: config.templateId!, sections: {} },
          });
        });
      }

      logs.push({ level: 'info', message: `Campaign updated — id: ${result.id}`, ts: Date.now() });

      return {
        outputs: {
          campaignId: result.id || campaignId,
          status: result.status || null,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({ level: 'error', message: error.message || 'Failed to update campaign', ts: Date.now() });
      return {
        outputs: {},
        status: 'error',
        error: { message: error.message || 'Failed to update campaign', code: error.code || 'UNKNOWN_ERROR' },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      { key: 'config.campaignId', type: NocoSDK.VariableType.String, name: 'Campaign ID', extra: { icon: 'ncHash' } },
      ...(this.config.subject
        ? [{ key: 'config.subject', type: NocoSDK.VariableType.String, name: 'Subject', extra: { icon: 'cellText' } }]
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
      { key: 'campaignId', type: NocoSDK.VariableType.String, name: 'Campaign ID', extra: { icon: 'ncHash' } },
      { key: 'status', type: NocoSDK.VariableType.String, name: 'Status', extra: { icon: 'ncInfo' } },
    ];
  }
}
