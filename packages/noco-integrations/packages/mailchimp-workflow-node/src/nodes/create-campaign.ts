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

interface CreateCampaignConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  type: 'regular' | 'plaintext';
  listId: string;
  segmentId?: string;
  templateId?: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
}

export class CreateCampaignNode extends WorkflowNodeIntegration<CreateCampaignConfig> {
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
        label: 'Campaign type',
        model: 'config.type',
        defaultValue: 'regular',
        options: [
          { label: 'Regular', value: 'regular' },
          { label: 'Plain-text', value: 'plaintext' },
        ],
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Campaign type is required',
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
        type: FormBuilderInputType.Select,
        label: 'Segment',
        model: 'config.segmentId',
        placeholder: 'All subscribers (optional)',
        fetchOptionsKey: 'segments',
        dependsOn: 'config.listId',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Template',
        model: 'config.templateId',
        placeholder: 'Select a template',
        fetchOptionsKey: 'templates',
        dependsOn: 'config.authIntegrationId',
        condition: {
          model: 'config.type',
          value: 'regular',
        },
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Subject',
        model: 'config.subject',
        placeholder: 'Campaign subject line',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Subject is required',
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
        placeholder: 'campaigns@example.com',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'From email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Reply to',
        model: 'config.replyTo',
        placeholder: 'reply@example.com',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'mailchimp.create_campaign',
      title: 'Create campaign',
      description: 'Create a Mailchimp email campaign',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      keywords: [
        'mailchimp',
        'campaign',
        'create',
        'email',
        'marketing',
        'newsletter',
      ],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const auth =
      await this.getIntegration<MailchimpAuthIntegration>(
        this.config.authIntegrationId,
      );

    if (key === 'lists') {
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

    if (key === 'segments') {
      if (!this.config.listId) return [];
      return await auth.use(async (client) => {
        const response = await client.lists.listSegments(this.config.listId, {
          count: 1000,
        });
        return ((response as any).segments || []).map(
          (seg: { name: string; id: number }) => ({
            label: seg.name,
            value: String(seg.id),
          }),
        );
      });
    }

    if (key === 'templates') {
      return await auth.use(async (client) => {
        const response = await client.templates.list({ count: 1000 });
        return ((response as any).templates || []).map(
          (tpl: { name: string; id: number }) => ({
            label: tpl.name,
            value: tpl.id,
          }),
        );
      });
    }

    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<CreateCampaignConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        type,
        listId,
        subject,
        fromName,
        fromEmail,
      } = config;

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

      if (!subject || !fromName || !fromEmail) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Subject, from name, and from email are required',
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({
          level: 'info',
          message: `[Test mode] Would create ${type || 'regular'} campaign for audience: ${listId}`,
          ts: Date.now(),
        });
        return {
          outputs: {
            campaignId: 'test-campaign-' + Date.now(),
            webId: 12345,
            status: 'save',
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({
        level: 'info',
        message: `Creating ${type || 'regular'} campaign`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);

      const campaignBody: any = {
        type: type || 'regular',
        recipients: {
          list_id: listId,
          ...(config.segmentId
            ? {
                segment_opts: {
                  saved_segment_id: Number(config.segmentId),
                },
              }
            : {}),
        },
        settings: {
          subject_line: subject,
          from_name: fromName,
          reply_to: config.replyTo || fromEmail,
        },
      };

      const campaign = await auth.use(async (client) => {
        return await client.campaigns.create(campaignBody);
      });

      const campaignResult = campaign as any;

      // Set template content if provided
      if (config.templateId && type !== 'plaintext') {
        await auth.use(async (client) => {
          return await client.campaigns.setContent(campaignResult.id, {
            template: {
              id: config.templateId!,
              sections: {},
            },
          });
        });
      }

      logs.push({
        level: 'info',
        message: `Campaign created — id: ${campaignResult.id}`,
        ts: Date.now(),
      });

      return {
        outputs: {
          campaignId: campaignResult.id,
          webId: campaignResult.web_id || null,
          status: campaignResult.status || 'save',
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to create campaign',
        ts: Date.now(),
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to create campaign',
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
        key: 'config.subject',
        type: NocoSDK.VariableType.String,
        name: 'Subject',
        extra: { icon: 'cellText' },
      },
      {
        key: 'config.fromName',
        type: NocoSDK.VariableType.String,
        name: 'From name',
        extra: { icon: 'ncUser' },
      },
      {
        key: 'config.fromEmail',
        type: NocoSDK.VariableType.String,
        name: 'From email',
        extra: { icon: 'ncMail' },
      },
      ...(this.config.replyTo
        ? [
            {
              key: 'config.replyTo',
              type: NocoSDK.VariableType.String,
              name: 'Reply to',
              extra: { icon: 'ncMail' },
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
        key: 'campaignId',
        type: NocoSDK.VariableType.String,
        name: 'Campaign ID',
        extra: { icon: 'ncHash' },
      },
      {
        key: 'webId',
        type: NocoSDK.VariableType.Number,
        name: 'Web ID',
        extra: { icon: 'ncHash' },
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
