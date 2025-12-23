import {
  IntegrationType,
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
import type { WebClient } from '@slack/web-api';

interface SendMessageNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  sendTo: 'channel' | 'user';
  channelId?: string;
  userId?: string;
  message: string;
  botName?: string;
  botIcon?: string;
  unfurlLinks?: boolean;
}

export class SendMessageNode extends WorkflowNodeIntegration<SendMessageNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Slack Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'slack' },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Slack Account is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Channel/User',
        model: 'config.sendTo',
        defaultValue: 'channel',
        options: [
          {
            label: 'Channel',
            value: 'channel',
          },
          {
            label: 'User',
            value: 'user',
          },
        ],
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Please select where to send the message',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Channel',
        model: 'config.channelId',
        fetchOptionsKey: 'channels',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select a channel',
        condition: {
          model: 'config.sendTo',
          value: 'channel',
        },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Channel is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'User',
        model: 'config.userId',
        fetchOptionsKey: 'users',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select a user',
        condition: {
          model: 'config.sendTo',
          value: 'user',
        },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'User is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Message',
        model: 'config.message',
        plugins: ['multiline'],
        placeholder: 'Enter your message',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Message is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Bot name',
        model: 'config.botName',
        placeholder: 'Custom bot name (optional)',
        helpText: 'Override the default bot name for this message',
        group: 'moreOptions',
        groupCollapsible: true,
        groupLabel: 'Show more options',
        groupDefaultCollapsed: true,
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Bot icon',
        model: 'config.botIcon',
        placeholder: 'Bot icon URL or emoji (optional)',
        helpText: 'Image URL or emoji code like :robot_face:',
        group: 'moreOptions',
      },
    ];

    return {
      id: 'slack.send_message',
      title: 'Send message',
      description: 'Send a message to a Slack channel or user',
      icon: 'slack',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['slack', 'message', 'send', 'chat', 'notification'],
    };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth = await this.getAuthIntegration<any, WebClient>(
      authIntegrationId,
    );

    switch (key) {
      case 'channels': {
        const result = await auth.use(async (client) => {
          const response = await client.conversations.list({
            types: 'public_channel,private_channel',
            limit: 1000,
          });

          return response.channels || [];
        });

        return result.map((channel: any) => ({
          label: `#${channel.name}`,
          value: channel.id,
          ncItemDisabled: channel.is_archived,
          ncItemTooltip: channel.is_archived
            ? 'This channel is archived'
            : undefined,
        }));
      }

      case 'users': {
        const result = await auth.use(async (client) => {
          const response = await client.users.list({
            limit: 1000,
          });

          return response.members || [];
        });

        return result
          .filter((user: any) => !user.deleted && !user.is_bot)
          .map((user: any) => ({
            label: user.real_name || user.name,
            value: user.id,
            ncItemDisabled: user.deleted,
          }));
      }

      default:
        return [];
    }
  }

  public async run(
    ctx: WorkflowNodeRunContext<SendMessageNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: any[] = [];

    const config = ctx.inputs?.config || {};

    try {
      const {
        authIntegrationId,
        sendTo,
        channelId,
        userId,
        message,
        botName,
        botIcon,
        unfurlLinks,
      } = config;

      if (!authIntegrationId) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Slack integration is required',
            code: 'MISSING_AUTH',
          },
          logs,
        };
      }

      const auth = await this.getAuthIntegration<any, WebClient>(
        authIntegrationId,
      );

      const target = sendTo === 'channel' ? channelId : userId;

      if (!target) {
        return {
          outputs: {},
          status: 'error',
          error: {
            message: `${sendTo === 'channel' ? 'Channel' : 'User'} is required`,
            code: 'MISSING_TARGET',
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

      logs.push({
        level: 'info',
        message: `Sending message to ${sendTo}: ${target}`,
        ts: Date.now(),
      });

      const result = await auth.use(async (client) => {
        const postMessageArgs: any = {
          channel: target,
          text: message,
          unfurl_links: unfurlLinks,
        };

        if (botName) {
          postMessageArgs.username = botName;
        }

        if (botIcon) {
          if (botIcon.startsWith('http://') || botIcon.startsWith('https://')) {
            postMessageArgs.icon_url = botIcon;
          } else {
            postMessageArgs.icon_emoji = botIcon.startsWith(':')
              ? botIcon
              : `:${botIcon}:`;
          }
        }

        return await client.chat.postMessage(postMessageArgs);
      });

      logs.push({
        level: 'info',
        message: 'Message sent successfully',
        ts: Date.now(),
        data: { ts: result.ts, channel: result.channel },
      });

      return {
        outputs: {
          messageId: result.ts,
          channel: result.channel,
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
        message: error.message || 'Failed to send message',
        ts: Date.now(),
        data: error.data,
      });

      return {
        outputs: {
          success: false,
        },
        status: 'error',
        error: {
          message: error.message || 'Failed to send message',
          code: error.data?.error || 'UNKNOWN_ERROR',
          data: error.data,
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }
}
