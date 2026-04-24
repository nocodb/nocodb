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

interface SendTransactionalEmailConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  templateName: string;
  to: string;
  subject: string;
  fromEmail?: string;
  fromName?: string;
  mergeVars?: string;
}

export class SendTransactionalEmailNode extends WorkflowNodeIntegration<SendTransactionalEmailConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Mailchimp Account',
        model: 'config.authIntegrationId',
        integrationFilter: {
          type: IntegrationType.Auth,
          sub_type: 'mailchimp.api-key',
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
        label: 'Template',
        model: 'config.templateName',
        placeholder: 'Select a Mandrill template',
        fetchOptionsKey: 'mandrillTemplates',
        dependsOn: 'config.authIntegrationId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Template is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'To',
        model: 'config.to',
        placeholder: 'recipient@example.com',
        helpText: 'Recipient email address',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Recipient email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Subject',
        model: 'config.subject',
        placeholder: 'Email subject',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Subject is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From email',
        model: 'config.fromEmail',
        placeholder: 'sender@example.com',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'More options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From name',
        model: 'config.fromName',
        placeholder: 'Sender Name',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.Textarea,
        label: 'Merge variables (JSON)',
        model: 'config.mergeVars',
        placeholder:
          '[{ "name": "FNAME", "content": "John" }, { "name": "COMPANY", "content": "Acme" }]',
        helpText:
          'JSON array of merge variables. Each object needs "name" and "content" keys matching your template merge tags.',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'mailchimp.send_transactional_email',
      title: 'Send transactional email',
      description: 'Send a one-off email via Mandrill using a template',
      icon: 'ncMailchimp',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/mailchimp',
      keywords: [
        'mailchimp',
        'mandrill',
        'email',
        'transactional',
        'template',
        'send',
      ],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    if (key === 'mandrillTemplates') {
      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(
          this.config.authIntegrationId,
        );
      const mandrill = auth.getMandrillClient();
      const templates = await mandrill.templates.list();

      return (templates as any[]).map((t) => ({
        label: t.name,
        value: t.slug,
      }));
    }

    return [];
  }

  public async run(
    ctx: WorkflowNodeRunContext<SendTransactionalEmailConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];
    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, templateName, to, subject } = config;

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

      if (!templateName) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Template is required', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (!to) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Recipient email is required',
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      if (!subject) {
        return {
          outputs: {},
          status: 'error',
          error: { message: 'Subject is required', code: 'INVALID_INPUT' },
          logs,
        };
      }

      if (ctx.testMode) {
        logs.push({
          level: 'info',
          message: `[Test mode] Would send transactional email to: ${to}`,
          ts: Date.now(),
        });
        return {
          outputs: {
            messageId: 'test-msg-' + Date.now(),
            status: 'sent',
            rejectReason: null,
          },
          status: 'success',
          logs,
          metrics: { executionTimeMs: Date.now() - startTime },
        };
      }

      logs.push({
        level: 'info',
        message: `Sending transactional email to: ${to}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<MailchimpAuthIntegration>(authIntegrationId);
      const mandrill = auth.getMandrillClient();

      // Parse merge variables
      let mergeVars: Array<{ name: string; content: string }> = [];
      if (config.mergeVars) {
        try {
          mergeVars = JSON.parse(config.mergeVars);
        } catch {
          return {
            outputs: {},
            status: 'error',
            error: {
              message:
                'Invalid merge variables JSON. Expected format: [{ "name": "FNAME", "content": "John" }]',
              code: 'INVALID_INPUT',
            },
            logs,
          };
        }
      }

      const response = await mandrill.messages.sendTemplate({
        template_name: templateName,
        template_content: [],
        message: {
          subject,
          to: [{ email: to, type: 'to' as const }],
          ...(config.fromEmail ? { from_email: config.fromEmail } : {}),
          ...(config.fromName ? { from_name: config.fromName } : {}),
          merge_vars: mergeVars.length
            ? [{ rcpt: to, vars: mergeVars }]
            : undefined,
        },
      });

      const result = (response as any[])?.[0] || {};

      logs.push({
        level: 'info',
        message: `Email sent — status: ${result.status}, id: ${result._id}`,
        ts: Date.now(),
      });

      return {
        outputs: {
          messageId: result._id || null,
          status: result.status || 'unknown',
          rejectReason: result.reject_reason || null,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to send transactional email',
        ts: Date.now(),
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to send transactional email',
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
        key: 'config.to',
        type: NocoSDK.VariableType.String,
        name: 'To',
        extra: { icon: 'ncUser' },
      },
      {
        key: 'config.subject',
        type: NocoSDK.VariableType.String,
        name: 'Subject',
        extra: { icon: 'cellText' },
      },
      {
        key: 'config.templateName',
        type: NocoSDK.VariableType.String,
        name: 'Template',
        extra: { icon: 'ncMail' },
      },
      ...(this.config.fromEmail
        ? [
            {
              key: 'config.fromEmail',
              type: NocoSDK.VariableType.String,
              name: 'From email',
              extra: { icon: 'ncMail' },
            },
          ]
        : []),
      ...(this.config.fromName
        ? [
            {
              key: 'config.fromName',
              type: NocoSDK.VariableType.String,
              name: 'From name',
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
        key: 'messageId',
        type: NocoSDK.VariableType.String,
        name: 'Message ID',
        extra: { icon: 'ncHash' },
      },
      {
        key: 'status',
        type: NocoSDK.VariableType.String,
        name: 'Status',
        extra: { icon: 'ncInfo' },
      },
      {
        key: 'rejectReason',
        type: NocoSDK.VariableType.String,
        name: 'Reject Reason',
        extra: { icon: 'ncAlertTriangle' },
      },
    ];
  }
}
