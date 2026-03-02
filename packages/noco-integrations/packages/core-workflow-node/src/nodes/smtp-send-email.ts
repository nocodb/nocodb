import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  IntegrationType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  FormDefinition,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { SmtpAuthIntegration } from '@noco-integrations/smtp-auth';

interface SmtpSendEmailConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  fromName?: string;
  fromAddress?: string;
}

export class SmtpSendEmailNode extends WorkflowNodeIntegration<SmtpSendEmailConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'SMTP Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'smtp' },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'SMTP account is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'To',
        model: 'config.to',
        placeholder: 'recipient@example.com',
        helpText: 'Separate multiple addresses with commas',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Recipient is required',
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
        label: 'Body',
        model: 'config.body',
        plugins: ['multiline'],
        placeholder: 'Email body',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Body is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'CC',
        model: 'config.cc',
        placeholder: 'cc@example.com',
        helpText: 'Separate multiple addresses with commas',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'Show more options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'BCC',
        model: 'config.bcc',
        placeholder: 'bcc@example.com',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From name',
        model: 'config.fromName',
        placeholder: 'Leave blank to use integration default',
        helpText: 'Overrides the From name set on the SMTP integration',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From address',
        model: 'config.fromAddress',
        placeholder: 'Leave blank to use integration default',
        helpText: 'Must be an address authorised by your SMTP provider',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'core.action.send_smtp_email',
      title: 'Send Email (SMTP)',
      description:
        'Send an email via SMTP — works with SendGrid, Mailgun, SES, or any SMTP server',
      icon: 'ncMail',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      documentation:
        'https://nocodb.com/docs/workflows/nodes/action-nodes/smtp-send-email',
      form,
      keywords: [
        'smtp',
        'email',
        'send',
        'mail',
        'notification',
        'sendgrid',
        'mailgun',
        'ses',
      ],
    };
  }

  public async validate(config: SmtpSendEmailConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.authIntegrationId) {
      errors.push({
        path: 'config.authIntegrationId',
        message: 'SMTP account is required',
      });
    }

    const validateEmailList = (
      value: string | undefined,
      path: string,
      label: string,
      required = false,
    ) => {
      if (!value || !value.trim()) {
        if (required)
          errors.push({ path, message: `${label} is required` });
        return;
      }
      for (const entry of value
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)) {
        // Skip validation for $(variable) tokens — resolved at runtime
        if (!/\$\([^)]*\)/.test(entry) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry)) {
          errors.push({
            path,
            message: `"${entry}" is not a valid email address`,
          });
          break;
        }
      }
    };

    validateEmailList(config.to, 'config.to', 'To', true);
    validateEmailList(config.cc, 'config.cc', 'CC');
    validateEmailList(config.bcc, 'config.bcc', 'BCC');

    if (
      config.fromAddress &&
      !/\$\([^)]*\)/.test(config.fromAddress) &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.fromAddress)
    ) {
      errors.push({
        path: 'config.fromAddress',
        message: 'From address must be a valid email',
      });
    }

    if (!config.subject?.trim()) {
      errors.push({ path: 'config.subject', message: 'Subject is required' });
    }

    if (!config.body?.trim()) {
      errors.push({ path: 'config.body', message: 'Body is required' });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<SmtpSendEmailConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const {
        authIntegrationId,
        to,
        subject,
        body,
        cc,
        bcc,
        fromName,
        fromAddress,
      } = ctx.inputs.config;

      if (!authIntegrationId) {
        return {
          outputs: { success: false },
          status: 'error',
          error: { message: 'SMTP account not configured', code: 'MISSING_AUTH' },
          logs,
        };
      }

      const auth =
        await this.getIntegration<SmtpAuthIntegration>(authIntegrationId);

      // node-level override → integration default
      const effectiveFromAddress = fromAddress || auth.config.fromEmail;
      const effectiveFromName = fromName || auth.config.fromName;
      const from = effectiveFromName
        ? `"${this.sanitizeHeader(effectiveFromName)}" <${effectiveFromAddress}>`
        : effectiveFromAddress;

      logs.push({
        level: 'info',
        message: `Sending email to ${to}`,
        ts: Date.now(),
        data: { to, subject, from },
      });

      const messageInfo = await auth.use(async (transporter) => {
        return transporter.sendMail({
          from,
          to: this.sanitizeHeader(to),
          subject: this.sanitizeHeader(subject),
          text: body,
          ...(cc && { cc: this.sanitizeHeader(cc) }),
          ...(bcc && { bcc: this.sanitizeHeader(bcc) }),
        });
      });

      logs.push({
        level: 'info',
        message: 'Email sent successfully',
        ts: Date.now(),
        data: {
          messageId: messageInfo.messageId,
          accepted: messageInfo.accepted,
        },
      });

      return {
        outputs: {
          success: true,
          messageId: messageInfo.messageId,
          accepted: messageInfo.accepted,
          rejected: messageInfo.rejected,
          envelope: messageInfo.envelope,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: `Email send failed: ${error.message}`,
        ts: Date.now(),
        data: {
          code: error.code,
          command: error.command,
          response: error.response,
        },
      });

      return {
        outputs: { success: false },
        status: 'error',
        error: {
          message: error.message || 'Email send failed',
          code: error.code || 'SMTP_ERROR',
        },
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  /** Strip CR/LF/tab to prevent SMTP header injection */
  private sanitizeHeader(value: string): string {
    return value.replace(/[\r\n\t"]/g, ' ').trim();
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const vars: NocoSDK.VariableDefinition[] = [
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
        key: 'config.body',
        type: NocoSDK.VariableType.String,
        name: 'Body',
        extra: { icon: 'ncMessageSquare' },
      },
    ];

    if (this.config.cc)
      vars.push({
        key: 'config.cc',
        type: NocoSDK.VariableType.String,
        name: 'CC',
        extra: { icon: 'ncUsers' },
      });
    if (this.config.bcc)
      vars.push({
        key: 'config.bcc',
        type: NocoSDK.VariableType.String,
        name: 'BCC',
        extra: { icon: 'ncUsers' },
      });
    return vars;
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: { icon: 'cellCheckbox' },
      },
      {
        key: 'messageId',
        type: NocoSDK.VariableType.String,
        name: 'Message ID',
        extra: { icon: 'cellText' },
      },
      {
        key: 'accepted',
        type: NocoSDK.VariableType.Array,
        name: 'Accepted',
        extra: { icon: 'ncCheck' },
      },
      {
        key: 'rejected',
        type: NocoSDK.VariableType.Array,
        name: 'Rejected',
        extra: { icon: 'ncXCircle' },
      },
    ];
  }
}
