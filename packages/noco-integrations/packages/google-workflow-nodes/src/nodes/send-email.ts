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
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { gmail_v1 } from 'googleapis';

interface SendEmailNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
  inReplyTo?: string;
  isHtml?: boolean;
}

export class SendEmailNode extends WorkflowNodeIntegration<SendEmailNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Gmail Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'gmail' },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Gmail Account is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'To',
        model: 'config.to',
        placeholder: 'recipient@example.com',
        helpText: 'Separate multiple emails with commas',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Recipient email is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'CC',
        model: 'config.cc',
        placeholder: 'cc@example.com',
        helpText: 'Separate multiple emails with commas',
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
        helpText: 'Separate multiple emails with commas',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'From name',
        model: 'config.fromName',
        placeholder: 'John Doe',
        helpText: 'Send mail using this name',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'From address',
        model: 'config.fromAddress',
        fetchOptionsKey: 'sendAsAddresses',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select sender address',
        helpText:
          'Send mail from this address. This address must be listed in your Gmail "Send mail as" settings',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Reply to',
        model: 'config.replyTo',
        placeholder: 'reply@example.com',
        helpText: 'Email address(es) to use in replies to this email',
        group: 'moreOptions',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'In reply to',
        model: 'config.inReplyTo',
        placeholder: 'message-id@example.com',
        helpText: 'Message ID this email is replying to',
        group: 'moreOptions',
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
        label: 'Message',
        model: 'config.body',
        plugins: ['multiline'],
        placeholder: 'Email body',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Email body is required',
          },
        ],
      },
    ];

    return {
      id: 'google.send_email',
      title: 'Send Email',
      description: 'Send an email via Gmail',
      icon: 'gmail',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['gmail', 'email', 'send', 'mail', 'message'],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth = await this.getAuthIntegration<any, gmail_v1.Gmail>(
      authIntegrationId,
    );

    switch (key) {
      case 'sendAsAddresses': {
        const result = await auth.use(async (client) => {
          const response = await client.users.settings.sendAs.list({
            userId: 'me',
          });

          return response.data.sendAs || [];
        });

        return result.map((sendAs: any) => ({
          label: sendAs.displayName
            ? `${sendAs.displayName} <${sendAs.sendAsEmail}>`
            : sendAs.sendAsEmail,
          value: sendAs.sendAsEmail,
          ncItemDisabled: !sendAs.isDefault && !sendAs.verificationStatus,
          ncItemTooltip:
            !sendAs.isDefault && !sendAs.verificationStatus
              ? 'This address is not verified'
              : sendAs.isDefault
                ? 'Default send-as address'
                : undefined,
        }));
      }

      default:
        return [];
    }
  }

  private createRawEmail(config: SendEmailNodeConfig): string {
    const {
      to,
      subject,
      body,
      cc,
      bcc,
      fromName,
      fromAddress,
      replyTo,
      inReplyTo,
      isHtml = false,
    } = config;

    const headers: string[] = [];

    if (fromAddress) {
      const fromHeader = fromName
        ? `"${fromName}" <${fromAddress}>`
        : fromAddress;
      headers.push(`From: ${fromHeader}`);
    }

    headers.push(`To: ${to}`);

    if (cc) {
      headers.push(`Cc: ${cc}`);
    }

    if (bcc) {
      headers.push(`Bcc: ${bcc}`);
    }

    if (replyTo) {
      headers.push(`Reply-To: ${replyTo}`);
    }

    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
    }

    headers.push(`Subject: ${subject}`);
    headers.push(
      `Content-Type: text/${isHtml ? 'html' : 'plain'}; charset=utf-8`,
    );
    headers.push('MIME-Version: 1.0');

    const email = headers.join('\r\n') + '\r\n\r\n' + body;

    return Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  public async run(
    ctx: WorkflowNodeRunContext<SendEmailNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const { authIntegrationId, to, subject, body } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Gmail integration is required',
            code: 'MISSING_AUTH',
          },
          logs,
        };
      }

      if (!to) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Recipient email is required',
            code: 'MISSING_RECIPIENT',
          },
          logs,
        };
      }

      if (!subject) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Subject is required',
            code: 'MISSING_SUBJECT',
          },
          logs,
        };
      }

      if (!body) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Email body is required',
            code: 'MISSING_BODY',
          },
          logs,
        };
      }

      logs.push({
        level: 'info',
        message: `Sending email to: ${to}`,
        ts: Date.now(),
      });

      const auth = await this.getAuthIntegration<any, gmail_v1.Gmail>(
        authIntegrationId,
      );

      const rawEmail = this.createRawEmail(config);

      const result = await auth.use(async (client) => {
        return await client.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: rawEmail,
          },
        });
      });

      logs.push({
        level: 'info',
        message: 'Email sent successfully',
        ts: Date.now(),
        data: { messageId: result.data.id, threadId: result.data.threadId },
      });

      return {
        outputs: {
          messageId: result.data.id,
          threadId: result.data.threadId,
          success: true,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: error.message || 'Failed to send email',
        ts: Date.now(),
        data: error.response?.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to send email',
          code: error.code || 'UNKNOWN_ERROR',
          data: error.response?.data,
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.to',
        type: NocoSDK.VariableType.String,
        name: 'To',
        extra: {
          icon: 'ncUser',
        },
      },
      ...(this.config.cc
        ? [
            {
              key: 'config.cc',
              type: NocoSDK.VariableType.String,
              name: 'CC',
              extra: {
                icon: 'ncUsers',
              },
            },
          ]
        : []),
      ...(this.config.bcc
        ? [
            {
              key: 'config.bcc',
              type: NocoSDK.VariableType.String,
              name: 'BCC',
              extra: {
                icon: 'ncUsers',
              },
            },
          ]
        : []),
      ...(this.config.fromName
        ? [
            {
              key: 'config.fromName',
              type: NocoSDK.VariableType.String,
              name: 'From name',
              extra: {
                icon: 'ncUser',
              },
            },
          ]
        : []),
      ...(this.config.fromAddress
        ? [
            {
              key: 'config.fromAddress',
              type: NocoSDK.VariableType.String,
              name: 'From address',
              extra: {
                icon: 'ncMail',
              },
            },
          ]
        : []),
      ...(this.config.replyTo
        ? [
            {
              key: 'config.replyTo',
              type: NocoSDK.VariableType.String,
              name: 'Reply to',
              extra: {
                icon: 'ncMail',
              },
            },
          ]
        : []),
      ...(this.config.inReplyTo
        ? [
            {
              key: 'config.inReplyTo',
              type: NocoSDK.VariableType.String,
              name: 'In reply to',
              extra: {
                icon: 'ncMessageSquare',
              },
            },
          ]
        : []),
      {
        key: 'config.subject',
        type: NocoSDK.VariableType.String,
        name: 'Subject',
        extra: {
          icon: 'cellText',
        },
      },
      {
        key: 'config.body',
        type: NocoSDK.VariableType.String,
        name: 'Message',
        extra: {
          icon: 'ncMessageSquare',
        },
      },
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: {
          icon: 'cellCheckbox',
        },
      },
      {
        key: 'messageId',
        type: NocoSDK.VariableType.String,
        name: 'Message ID',
        extra: {
          icon: 'ncHash',
        },
      },
      {
        key: 'threadId',
        type: NocoSDK.VariableType.String,
        name: 'Thread ID',
        extra: {
          icon: 'ncHash',
        },
      },
    ];
  }
}
