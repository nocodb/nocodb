import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface SendEmailActionConfig extends WorkflowNodeConfig {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}

export class SendEmailAction extends WorkflowNodeIntegration<SendEmailActionConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'core.action.send-email',
      title: 'Send email',
      description: 'Send an email',
      icon: 'ncMail',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      documentation:
        'https://nocodb.com/docs/workflows/nodes/action-nodes/send-email',
      form: [
        {
          type: FormBuilderInputType.WorkflowInput,
          label: 'To',
          model: 'config.to',
          placeholder: 'recipient@example.com',
          span: 24,
          validators: [
            {
              type: FormBuilderValidatorType.Required,
              message: 'To field is required',
            },
          ],
        },
        {
          type: FormBuilderInputType.WorkflowInput,
          label: 'CC',
          model: 'config.cc',
          placeholder: 'cc@example.com',
          span: 24,
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
          span: 24,
          group: 'moreOptions',
        },
        {
          type: FormBuilderInputType.WorkflowInput,
          label: 'Subject',
          model: 'config.subject',
          placeholder: 'Email subject',
          span: 24,
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
          placeholder: 'Email body content',
          plugins: ['multiline'],
          span: 24,
          validators: [
            {
              type: FormBuilderValidatorType.Required,
              message: 'Body is required',
            },
          ],
        },
      ],
      keywords: ['email', 'send', 'notification', 'mail'],
    };
  }

  public async validate(config: SendEmailActionConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.to || config.to.trim() === '') {
      errors.push({
        path: 'config.to',
        message: 'To field is required',
      });
    }

    const isDynamic = config.to.includes('$(');

    if (!isDynamic) {
      const isValidEmail = NocoSDK.validateEmail(config.to);

      if (!isValidEmail) {
        errors.push({
          path: 'config.to',
          message: 'Please provide a valid email address',
        });
      }
    }

    if (!config.subject || config.subject.trim() === '') {
      errors.push({
        path: 'config.subject',
        message: 'Subject is required',
      });
    }

    if (!config.body || config.body.trim() === '') {
      errors.push({
        path: 'config.body',
        message: 'Body is required',
      });
    }

    const toEntries = config.to
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const entry of toEntries) {
      const isDynamicEntry = /\$\([^)]*\)/.test(entry);
      if (!isDynamicEntry) {
        const isValidEmail = NocoSDK.validateEmail(entry);
        if (!isValidEmail) {
          errors.push({
            path: 'config.to',
            message: 'Please provide a valid email address',
          });
          break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { config } = ctx.inputs;

      logs.push({
        level: 'info',
        message: `Sending email to ${config.to}`,
        ts: Date.now(),
        data: { to: config.to, subject: config.subject },
      });

      const emailParams = {
        to: config.to,
        subject: config.subject,
        text: config.body,
        ...(config.cc && { cc: config.cc }),
        ...(config.bcc && { bcc: config.bcc }),
      };

      const success = await this.nocodb.mailService.sendMailRaw(emailParams);

      if (!success) {
        logs.push({
          level: 'error',
          message: 'Failed to send email',
          ts: Date.now(),
        });

        return {
          outputs: { success: false },
          status: 'error',
          error: {
            message: 'Failed to send email',
          },
          logs,
          metrics: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      logs.push({
        level: 'info',
        message: 'Email sent successfully',
        ts: Date.now(),
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          success: true,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Email failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: { success: false },
        status: 'error',
        error: {
          message: error.message || 'Email failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
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
        name: 'Body',
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
