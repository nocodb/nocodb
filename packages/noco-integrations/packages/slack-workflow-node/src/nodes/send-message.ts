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
import type { SlackAuthIntegration } from '@noco-integrations/slack-auth';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

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
        searchable: true,
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Search for a channel...',
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
        searchable: true,
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Search for a user...',
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
      documentation:
        'https://nocodb.com/docs/workflows/nodes/integration-nodes/slack',
      keywords: ['slack', 'message', 'send', 'chat', 'notification'],
    };
  }

  public async fetchOptions(
    key: string,
    searchQuery?: string,
  ): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth =
      await this.getIntegration<SlackAuthIntegration>(authIntegrationId);

    const query = searchQuery?.trim().toLowerCase();

    switch (key) {
      case 'channels': {
        const result = await auth.use(async (client) => {
          const channels: any[] = [];
          let cursor: string | undefined;

          do {
            const response = await client.conversations.list({
              types: 'public_channel,private_channel',
              exclude_archived: true,
              limit: 1000,
              cursor,
            });

            channels.push(...(response.channels || []));
            cursor = response.response_metadata?.next_cursor || undefined;
          } while (cursor);

          return channels;
        });

        const filtered = query
          ? result.filter((channel: any) =>
              channel.name?.toLowerCase().includes(query),
            )
          : result;

        return filtered.map((channel: any) => ({
          label: `#${channel.name}`,
          value: channel.id,
        }));
      }

      case 'users': {
        const result = await auth.use(async (client) => {
          const members: any[] = [];
          let cursor: string | undefined;

          do {
            const response = await client.users.list({
              limit: 1000,
              cursor,
            });

            members.push(...(response.members || []));
            cursor = response.response_metadata?.next_cursor || undefined;
          } while (cursor);

          return members;
        });

        const filtered = result.filter((user: any) => {
          if (user.deleted || user.is_bot) return false;
          if (!query) return true;
          const name = (user.real_name || user.name || '').toLowerCase();
          return name.includes(query);
        });

        return filtered.map((user: any) => ({
          label: user.real_name || user.name,
          value: user.id,
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

      const auth =
        await this.getIntegration<SlackAuthIntegration>(authIntegrationId);

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

      // Convert mentions to Slack's special syntax
      // Broadcast: @everyone, @channel, @here → <!keyword>
      // User: <@display name> or <@username> → <@USER_ID>
      // User group: handled by link_names parameter
      let finalMessage = message
        .replace(/@everyone\b/g, '<!everyone>')
        .replace(/@channel\b/g, '<!channel>')
        .replace(/@here\b/g, '<!here>');

      // Resolve <@name> user mentions to <@USER_ID> format
      const userMentionPattern = /<@([^>]+)>/g;
      const mentionMatches = [...finalMessage.matchAll(userMentionPattern)];

      if (mentionMatches.length > 0) {
        // Fetch workspace users to resolve names to IDs
        const members = await auth.use(async (client) => {
          const allMembers: any[] = [];
          let cursor: string | undefined;

          do {
            const response = await client.users.list({
              limit: 1000,
              cursor,
            });

            allMembers.push(...(response.members || []));
            cursor = response.response_metadata?.next_cursor || undefined;
          } while (cursor);

          return allMembers;
        });

        // Build lookup maps: username → ID, display_name → ID, real_name → ID
        const nameToId = new Map<string, string>();

        for (const member of members) {
          if (member.deleted || member.is_bot) continue;

          if (member.name) {
            nameToId.set(member.name.toLowerCase(), member.id);
          }

          if (member.profile?.display_name) {
            nameToId.set(member.profile.display_name.toLowerCase(), member.id);
          }

          if (member.real_name) {
            nameToId.set(member.real_name.toLowerCase(), member.id);
          }
        }

        // Replace <@name> with <@USER_ID> where a match is found
        // If name is already a Slack user ID (U...), leave it as-is
        for (const match of mentionMatches) {
          const name = match[1].trim();

          if (/^U[A-Z0-9]+$/.test(name)) continue;

          const slackUserId = nameToId.get(name.toLowerCase());

          if (slackUserId) {
            finalMessage = finalMessage.replace(match[0], `<@${slackUserId}>`);
          }
        }
      }

      const result = await auth.use(async (client) => {
        const postMessageArgs: any = {
          channel: target,
          text: finalMessage,
          link_names: true,
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
