import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  IntegrationType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { TwilioAuthIntegration } from '@noco-integrations/twilio-auth';

interface SendWhatsAppNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  fromNumber: string;
  alphanumericSenderId?: string;
  toNumber: string;
  message: string;
  mediaUrl?: string;
}

export class SendWhatsAppNode extends WorkflowNodeIntegration<SendWhatsAppNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Twilio Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'twilio' },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Twilio Account is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'From Number',
        model: 'config.fromNumber',
        fetchOptionsKey: 'whatsappNumbers',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select a WhatsApp-enabled Twilio number',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'From Number is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Alphanumeric Sender ID',
        model: 'config.alphanumericSenderId',
        placeholder: 'e.g. MyCompany',
        helpText:
          'Enter up to 11 characters using A-Z, a-z, 0-9 and spaces. You must enable with Twilio first and can only send to supported countries.',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'To Number',
        model: 'config.toNumber',
        placeholder: '15554443333,44111222333',
        helpText:
          'Include country code. Separate multiple numbers with commas.',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'To Number is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Message',
        model: 'config.message',
        plugins: ['multiline'],
        placeholder: 'Enter your WhatsApp message',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Message is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Media URL',
        model: 'config.mediaUrl',
        placeholder: 'https://example.com/image.jpg',
        helpText:
          'Must be a URL that Twilio can download (so private URLs or files may not work!)',
      },
    ];

    return {
      id: 'twilio.action.send_whatsapp',
      title: 'Send WhatsApp Message',
      description: 'Send a WhatsApp message using Twilio',
      icon: 'twilio',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/twilio',
      keywords: ['twilio', 'whatsapp', 'message', 'send', 'chat'],
      hidden: true,
    };
  }

  public async validate(config: SendWhatsAppNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.authIntegrationId) {
      errors.push({
        path: 'config.authIntegrationId',
        message: 'Twilio Account is required',
      });
    }

    if (!config.fromNumber) {
      errors.push({
        path: 'config.fromNumber',
        message: 'From Number is required',
      });
    }

    if (!config.toNumber) {
      errors.push({
        path: 'config.toNumber',
        message: 'To Number is required',
      });
    }

    if (!config.message) {
      errors.push({
        path: 'config.message',
        message: 'Message is required',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.toNumber',
        type: NocoSDK.VariableType.String,
        name: 'To Number',
        extra: {
          icon: 'ncPhone',
          description: 'Phone number(s) to send WhatsApp message to',
        },
      },
      {
        key: 'config.message',
        type: NocoSDK.VariableType.String,
        name: 'Message',
        extra: {
          icon: 'ncMessageSquare',
          description: 'WhatsApp message content',
        },
      },
      ...(this.config.alphanumericSenderId
        ? [
            {
              key: 'config.alphanumericSenderId',
              type: NocoSDK.VariableType.String,
              name: 'Alphanumeric Sender ID',
              extra: {
                icon: 'ncUser',
                description: 'Custom sender ID',
              },
            },
          ]
        : []),
      ...(this.config.mediaUrl
        ? [
            {
              key: 'config.mediaUrl',
              type: NocoSDK.VariableType.String,
              name: 'Media URL',
              extra: {
                icon: 'ncLink',
                description: 'URL of media to attach',
              },
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
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: {
          icon: 'cellCheckbox',
          description: 'Whether the WhatsApp message was sent successfully',
        },
      },
      {
        key: 'messages',
        type: NocoSDK.VariableType.Array,
        name: 'Messages',
        extra: {
          icon: 'ncMessageSquare',
          description: 'List of sent messages',
          itemSchema: [
            {
              key: 'sid',
              type: NocoSDK.VariableType.String,
              name: 'Message SID',
              extra: {
                icon: 'ncHash',
              },
            },
            {
              key: 'to',
              type: NocoSDK.VariableType.String,
              name: 'To',
              extra: {
                icon: 'ncPhone',
              },
            },
            {
              key: 'from',
              type: NocoSDK.VariableType.String,
              name: 'From',
              extra: {
                icon: 'ncPhone',
              },
            },
            {
              key: 'status',
              type: NocoSDK.VariableType.String,
              name: 'Status',
              extra: {
                icon: 'ncInfo',
              },
            },
            {
              key: 'body',
              type: NocoSDK.VariableType.String,
              name: 'Body',
              extra: {
                icon: 'ncMessageSquare',
              },
            },
          ],
        },
      },
    ];
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth =
      await this.getIntegration<TwilioAuthIntegration>(authIntegrationId);

    switch (key) {
      case 'whatsappNumbers': {
        const result = await auth.use(async (client: any) => {
          return await client.incomingPhoneNumbers.list();
        });
        return result.map((number: any) => ({
          label: `${number.friendlyName}`,
          value: number.phoneNumber,
        }));
      }

      default:
        return [];
    }
  }

  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `+${digits}`;
  }

  public async run(
    ctx: WorkflowNodeRunContext<SendWhatsAppNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        fromNumber,
        alphanumericSenderId,
        toNumber,
        message,
        mediaUrl,
      } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Twilio integration is required',
            code: 'MISSING_AUTH',
          },
          logs,
        };
      }

      if (!fromNumber) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'From Number is required',
            code: 'MISSING_FROM_NUMBER',
          },
          logs,
        };
      }

      if (!toNumber) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'To Number is required',
            code: 'MISSING_TO_NUMBER',
          },
          logs,
        };
      }

      if (!message) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Message is required',
            code: 'MISSING_MESSAGE',
          },
          logs,
        };
      }

      const auth =
        await this.getIntegration<TwilioAuthIntegration>(authIntegrationId);

      const phoneNumbers = toNumber
        .split(',')
        .map((num: string) => this.normalizePhoneNumber(num.trim()))
        .filter((num: string) => num.length > 1);

      if (phoneNumbers.length === 0) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'No valid phone numbers provided',
            code: 'INVALID_PHONE_NUMBERS',
          },
          logs,
        };
      }

      logs.push({
        level: 'info',
        message: `Sending WhatsApp message to ${phoneNumbers.length} recipient(s)`,
        ts: Date.now(),
      });

      // Determine the from address
      const fromAddress = alphanumericSenderId
        ? `whatsapp:${alphanumericSenderId}`
        : `whatsapp:${fromNumber}`;

      const results = await auth.use(async (client) => {
        const messagePromises = phoneNumbers.map(async (to: string) => {
          const messageOptions: any = {
            from: fromAddress,
            to: `whatsapp:${to}`,
            body: message,
          };

          if (mediaUrl) {
            messageOptions.mediaUrl = [mediaUrl];
          }

          return client.messages.create(messageOptions);
        });

        return Promise.all(messagePromises);
      });

      logs.push({
        level: 'info',
        message: `Successfully sent ${results.length} WhatsApp message(s)`,
        ts: Date.now(),
        data: results.map((r) => ({ sid: r.sid, to: r.to })),
      });

      return {
        outputs: {
          messages: results.map((r) => ({
            sid: r.sid,
            to: r.to,
            from: r.from,
            status: r.status,
            body: r.body,
          })),
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
        message: error.message || 'Failed to send WhatsApp message',
        ts: Date.now(),
        data: error.code,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to send WhatsApp message',
          code: error.code || 'UNKNOWN_ERROR',
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }
}
