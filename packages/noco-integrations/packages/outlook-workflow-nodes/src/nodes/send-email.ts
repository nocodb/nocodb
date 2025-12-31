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
import type { OutlookAuthIntegration } from '@noco-integrations/outlook-mail-auth';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface SendEmailNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  fromAddress?: string;
  replyTo?: string;
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
        type: FormBuilderInputType.WorkflowInput,
        label: 'From address',
        model: 'config.fromAddress',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select sender address',
        helpText:
          'Send mail from this address. Your Outlook account must have permission to send from this address\n',
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
      title: 'Send email',
      description: 'Send an email via Outlook',
      icon: 'microsoftOutlook',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['outlook', 'email', 'send', 'mail', 'message', 'microsoft'],
    };
  }

  public async fetchOptions(_key: string): Promise<unknown> {
    return [];
  }

  /**
   * Validates email addresses in a comma-separated list.
   * Skips validation for dynamic values (variables like $(variableName)).
   *
   * @param emails Comma-separated email addresses
   * @returns True if all emails are valid or dynamic, false otherwise
   */
  private validateEmails(emails: string): boolean {
    if (!emails || !emails.trim()) return false;

    const emailList = emails
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const email of emailList) {
      // Skip validation for dynamic values
      const isDynamic = /\$\([^)]*\)/.test(email);
      if (!isDynamic) {
        const isValid = NocoSDK.validateEmail(email);
        if (!isValid) {
          return false;
        }
      }
    }

    return true;
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
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      if (!this.validateEmails(to)) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Please provide a valid email address in the To field',
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      if (config.cc && !this.validateEmails(config.cc)) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Please provide a valid email address in the CC field',
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      if (config.bcc && !this.validateEmails(config.bcc)) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Please provide a valid email address in the BCC field',
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      if (config.replyTo && !this.validateEmails(config.replyTo)) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message:
              'Please provide a valid email address in the Reply To field',
            code: 'INVALID_INPUT',
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
            code: 'INVALID_INPUT',
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
            code: 'INVALID_INPUT',
          },
          logs,
        };
      }

      logs.push({
        level: 'info',
        message: `Sending email to: ${to}`,
        ts: Date.now(),
      });

      const auth =
        await this.getIntegration<OutlookAuthIntegration>(authIntegrationId);

      const message: any = {
        subject,
        body: {
          contentType: 'Text',
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
