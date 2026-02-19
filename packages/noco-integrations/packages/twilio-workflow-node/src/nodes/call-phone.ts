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

const VOICE_OPTIONS = [
  { label: 'Man', value: 'man' },
  { label: 'Woman', value: 'woman' },
];

const LANGUAGE_OPTIONS = [
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (UK)', value: 'en-GB' },
  { label: 'English (Australia)', value: 'en-AU' },
  { label: 'Spanish (Spain)', value: 'es-ES' },
  { label: 'Spanish (Mexico)', value: 'es-MX' },
  { label: 'French (France)', value: 'fr-FR' },
  { label: 'French (Canada)', value: 'fr-CA' },
  { label: 'German', value: 'de-DE' },
  { label: 'Italian', value: 'it-IT' },
  { label: 'Portuguese (Brazil)', value: 'pt-BR' },
  { label: 'Portuguese (Portugal)', value: 'pt-PT' },
  { label: 'Japanese', value: 'ja-JP' },
  { label: 'Korean', value: 'ko-KR' },
  { label: 'Chinese (Mandarin)', value: 'zh-CN' },
  { label: 'Chinese (Cantonese)', value: 'zh-HK' },
  { label: 'Dutch', value: 'nl-NL' },
  { label: 'Polish', value: 'pl-PL' },
  { label: 'Russian', value: 'ru-RU' },
  { label: 'Danish', value: 'da-DK' },
  { label: 'Swedish', value: 'sv-SE' },
  { label: 'Norwegian', value: 'nb-NO' },
  { label: 'Finnish', value: 'fi-FI' },
];

interface CallPhoneNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  fromNumber: string;
  toNumber: string;
  message: string;
  voice: 'man' | 'woman';
  language: string;
  sendDigits?: string;
}

export class CallPhoneNode extends WorkflowNodeIntegration<CallPhoneNodeConfig> {
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
        fetchOptionsKey: 'phoneNumbers',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select a Twilio phone number',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'From Number is required',
          },
        ],
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
        placeholder: 'Enter the message to speak',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Message is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Voice',
        model: 'config.voice',
        defaultValue: 'woman',
        options: VOICE_OPTIONS,
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Voice is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Language',
        model: 'config.language',
        defaultValue: 'en-US',
        options: LANGUAGE_OPTIONS,
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Language is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Send Digits',
        model: 'config.sendDigits',
        placeholder: '1234#',
        helpText:
          'A string of keys to dial after connecting to the number. Can be 0-9, #, *, or w (to wait 1/2 sec). Does not dial a new number for forwarding - for responding to a phone menu.',
        group: 'advanced',
        groupCollapsible: true,
        groupLabel: 'Advanced Options',
        groupDefaultCollapsed: true,
      },
    ];

    return {
      id: 'twilio.action.call_phone',
      title: 'Call Phone',
      description: 'Make a phone call using Twilio',
      icon: 'twilio',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/twilio',
      keywords: ['twilio', 'call', 'phone', 'voice', 'dial'],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth =
      await this.getIntegration<TwilioAuthIntegration>(authIntegrationId);

    switch (key) {
      case 'phoneNumbers': {
        const result = await auth.use(async (client) => {
          return await client.incomingPhoneNumbers.list();
        });

        return result.map((number) => ({
          label: `${number.friendlyName}`,
          value: number.phoneNumber,
        }));
      }

      default:
        return [];
    }
  }

  public async validate(config: CallPhoneNodeConfig) {
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
          description: 'Phone number(s) to call',
        },
      },
      {
        key: 'config.message',
        type: NocoSDK.VariableType.String,
        name: 'Message',
        extra: {
          icon: 'ncMessageSquare',
          description: 'Message to speak during the call',
        },
      },
      ...(this.config.sendDigits
        ? [
            {
              key: 'config.sendDigits',
              type: NocoSDK.VariableType.String,
              name: 'Send Digits',
              extra: {
                icon: 'ncHash',
                description: 'Keys to dial after connecting',
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
          description: 'Whether the call was initiated successfully',
        },
      },
      {
        key: 'calls',
        type: NocoSDK.VariableType.Array,
        name: 'Calls',
        extra: {
          icon: 'ncPhone',
          description: 'List of initiated calls',
          itemSchema: [
            {
              key: 'sid',
              type: NocoSDK.VariableType.String,
              name: 'Call SID',
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
              key: 'calls.status',
              type: NocoSDK.VariableType.String,
              name: 'Status',
              extra: {
                icon: 'ncInfo',
              },
            },
          ],
        },
      },
    ];
  }

  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `+${digits}`;
  }

  public async run(
    ctx: WorkflowNodeRunContext<CallPhoneNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        fromNumber,
        toNumber,
        message,
        voice,
        language,
        sendDigits,
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

      // Parse multiple phone numbers
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
        message: `Making ${phoneNumbers.length} call(s) from ${fromNumber}`,
        ts: Date.now(),
      });

      // Create TwiML for the voice message
      const twiml = `<Response><Say voice="${voice || 'woman'}" language="${language || 'en-US'}">${this.escapeXml(message)}</Say></Response>`;

      const results = await auth.use(async (client) => {
        const callPromises = phoneNumbers.map(async (to: string) => {
          const callOptions: any = {
            from: fromNumber,
            to,
            twiml,
          };

          if (sendDigits) {
            callOptions.sendDigits = sendDigits;
          }

          return client.calls.create(callOptions);
        });

        return Promise.all(callPromises);
      });

      logs.push({
        level: 'info',
        message: `Successfully initiated ${results.length} call(s)`,
        ts: Date.now(),
        data: results.map((r) => ({ sid: r.sid, to: r.to })),
      });

      return {
        outputs: {
          calls: results.map((r) => ({
            sid: r.sid,
            to: r.to,
            from: r.from,
            status: r.status,
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
        message: error.message || 'Failed to make call',
        ts: Date.now(),
        data: error.code,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to make call',
          code: error.code || 'UNKNOWN_ERROR',
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
