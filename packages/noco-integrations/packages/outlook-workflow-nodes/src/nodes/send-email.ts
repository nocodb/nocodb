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
import type { Client } from '@microsoft/microsoft-graph-client';

interface SendEmailNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  fromAddress?: string;
  replyTo?: string;
  importance?: 'low' | 'normal' | 'high';
  isHtml?: boolean;
}

export class SendEmailNode extends WorkflowNodeIntegration<SendEmailNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Outlook Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'outlook' },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Outlook Account is required',
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
        type: FormBuilderInputType.Select,
        label: 'From address',
        model: 'config.fromAddress',
        fetchOptionsKey: 'mailboxes',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select sender address',
        helpText:
          'Send mail from this mailbox (if you have access to multiple mailboxes)',
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
        type: FormBuilderInputType.Select,
        label: 'Importance',
        model: 'config.importance',
        defaultValue: 'normal',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Normal', value: 'normal' },
          { label: 'High', value: 'high' },
        ],
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
      id: 'outlook.send_email',
      title: 'Send Email',
      description: 'Send an email via Outlook',
      icon: 'microsoftOutlook',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['outlook', 'email', 'send', 'mail', 'message', 'microsoft'],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth = await this.getAuthIntegration<any, Client>(authIntegrationId);

    switch (key) {
      case 'mailboxes': {
        const result = await auth.use(async (client) => {
          const user = await client.api('/me').get();
          return [{ email: user.mail || user.userPrincipalName }];
        });

        return result.map((mailbox: any) => ({
          label: mailbox.email,
          value: mailbox.email,
        }));
      }

      default:
        return [];
    }
  }

  private parseEmailAddresses(
    emails: string,
  ): Array<{ emailAddress: { address: string } }> {
    return emails
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0)
      .map((email) => ({
        emailAddress: {
          address: email,
        },
      }));
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
            message: 'Outlook integration is required',
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

      const auth = await this.getAuthIntegration<any, Client>(
        authIntegrationId,
      );

      const message: any = {
        subject,
        body: {
          contentType: config.isHtml ? 'HTML' : 'Text',
          content: body,
        },
        toRecipients: this.parseEmailAddresses(to),
      };

      if (config.cc) {
        message.ccRecipients = this.parseEmailAddresses(config.cc);
      }

      if (config.bcc) {
        message.bccRecipients = this.parseEmailAddresses(config.bcc);
      }

      if (config.replyTo) {
        message.replyTo = this.parseEmailAddresses(config.replyTo);
      }

      if (config.importance) {
        message.importance = config.importance;
      }

      await auth.use(async (client) => {
        const endpoint = config.fromAddress
          ? `/users/${config.fromAddress}/sendMail`
          : '/me/sendMail';

        return await client.api(endpoint).post({
          message,
          saveToSentItems: true,
        });
      });

      logs.push({
        level: 'info',
        message: 'Email sent successfully',
        ts: Date.now(),
      });

      return {
        outputs: {
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
        data: error.body,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to send email',
          code: error.code || 'UNKNOWN_ERROR',
          data: error.body,
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
    ];
  }
}
