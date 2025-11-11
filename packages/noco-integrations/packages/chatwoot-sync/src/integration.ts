import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type { ChatwootAuthIntegration } from '@noco-integrations/chatwoot-auth';
import type {
  ChatwootAgent,
  ChatwootContact,
  ChatwootConversation,
  ChatwootMessage,
  ChatwootSyncPayload,
  ChatwootTeam,
} from './types';
import type {
  SyncLinkValue,
  SyncRecord,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';

export default class ChatwootSyncIntegration extends SyncIntegration<ChatwootSyncPayload> {
  public getTitle() {
    return 'Chatwoot Conversations';
  }

  /**
   * Safely convert Unix timestamp to ISO string
   * Chatwoot returns timestamps in seconds, not milliseconds
   */
  private toISOString(timestamp: number | null | undefined): string | null {
    if (!timestamp || isNaN(timestamp)) {
      return null;
    }
    try {
      // Convert seconds to milliseconds
      const date = new Date(timestamp * 1000);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    } catch (error) {
      this.log(
        `[Chatwoot Sync] Error converting timestamp ${timestamp}: ${error}`,
      );
      return null;
    }
  }

  public async getDestinationSchema(_auth: ChatwootAuthIntegration) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: ChatwootAuthIntegration,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<
    DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >
  > {
    const { includeResolved, inboxId } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<number, boolean>();
    const teamMap = new Map<number, boolean>();

    void (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Build query parameters
        const params: any = {
          page: 1,
          status: 'all',
        };

        // Filter by inbox if specified
        if (inboxId) {
          params.inbox_id = inboxId;
        }

        this.log('[Chatwoot Sync] Fetching conversations');

        let hasMore = true;
        let totalFetched = 0;

        while (hasMore) {
          const response = await auth.use(async (client) => {
            return await client.get('/conversations', { params });
          });
          const conversations: ChatwootConversation[] =
            response.data?.data?.payload || [];

          this.log(
            `[Chatwoot Sync] Fetched ${conversations.length} conversations (page ${params.page})`,
          );

          if (conversations.length === 0) {
            hasMore = false;
            break;
          }

          for (const conversation of conversations) {
            // Skip resolved conversations if user doesn't want them
            if (!includeResolved && conversation.status === 'resolved') {
              continue;
            }

            if (ticketIncrementalValue) {
              const updatedAt = this.toISOString(conversation.updated_at);
              if (updatedAt && updatedAt <= ticketIncrementalValue) {
                continue;
              }
            }

            // Process conversation as ticket
            const ticketData = this.formatData(
              TARGET_TABLES.TICKETING_TICKET,
              conversation,
            );
            stream.push({
              recordId: conversation.id.toString(),
              targetTable: TARGET_TABLES.TICKETING_TICKET,
              data: ticketData.data as TicketingTicketRecord,
              links: ticketData.links,
            });

            // Process contact (sender)
            if (conversation.meta?.sender) {
              const contact = conversation.meta.sender;
              if (!userMap.has(contact.id)) {
                userMap.set(contact.id, true);

                const userData = this.formatData(
                  TARGET_TABLES.TICKETING_USER,
                  contact,
                );
                stream.push({
                  recordId: `${contact.id}`,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }
            }

            // Process assignee
            if (conversation.meta?.assignee) {
              const assignee = conversation.meta.assignee;
              if (!userMap.has(assignee.id)) {
                userMap.set(assignee.id, true);

                const userData = this.formatData(
                  TARGET_TABLES.TICKETING_USER,
                  assignee,
                );
                stream.push({
                  recordId: `${assignee.id}`,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }
            }

            // Process messages as comments
            if (
              args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT) &&
              conversation.messages
            ) {
              for (const message of conversation.messages) {
                const commentData = this.formatData(
                  TARGET_TABLES.TICKETING_COMMENT,
                  { ...message, conversation_id: conversation.id },
                );
                stream.push({
                  recordId: message.id.toString(),
                  targetTable: TARGET_TABLES.TICKETING_COMMENT,
                  data: commentData.data as TicketingCommentRecord,
                  links: commentData.links,
                });

                // Add message sender to users if not already added
                if (message.sender && !userMap.has(message.sender_id)) {
                  userMap.set(message.sender_id, true);

                  const userData = this.formatData(
                    TARGET_TABLES.TICKETING_USER,
                    message.sender,
                  );
                  stream.push({
                    recordId: `${message.sender_id}`,
                    targetTable: TARGET_TABLES.TICKETING_USER,
                    data: userData.data as TicketingUserRecord,
                  });
                }
              }
            }

            totalFetched++;
          }

          // Check if there are more pages
          if (conversations.length < 25) {
            // Chatwoot default page size is 25
            hasMore = false;
          } else {
            params.page++;
          }
        }

        this.log(
          `[Chatwoot Sync] Total conversations fetched: ${totalFetched}`,
        );

        // Fetch teams if requested
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          try {
            this.log('[Chatwoot Sync] Fetching teams');
            const teamsResponse = await auth.use(async (client) => {
              return await client.get('/teams');
            });
            const teams: ChatwootTeam[] = teamsResponse.data || [];

            this.log(`[Chatwoot Sync] Fetched ${teams.length} teams`);
            for (const team of teams) {
              if (!teamMap.has(team.id)) {
                teamMap.set(team.id, true);

                // Fetch team members
                const memberIds: string[] = [];
                try {
                  const membersResponse = await auth.use(async (client) => {
                    return await client.get(`/teams/${team.id}/team_members`);
                  });
                  const members: ChatwootAgent[] = membersResponse.data || [];

                  this.log(
                    `[Chatwoot Sync] Fetched ${members.length} members for team ${team.id}`,
                  );

                  // Add team members to user list and collect IDs
                  for (const member of members) {
                    if (!userMap.has(member.id)) {
                      userMap.set(member.id, true);

                      const userData = this.formatData(
                        TARGET_TABLES.TICKETING_USER,
                        member,
                      );
                      stream.push({
                        recordId: `${member.id}`,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        data: userData.data as TicketingUserRecord,
                      });
                    }
                    memberIds.push(member.id.toString());
                  }
                } catch (memberError) {
                  this.log(
                    `[Chatwoot Sync] Error fetching members for team ${team.id}: ${memberError}`,
                  );
                }

                const teamData = this.formatData(
                  TARGET_TABLES.TICKETING_TEAM,
                  team,
                );
                stream.push({
                  recordId: team.id.toString(),
                  targetTable: TARGET_TABLES.TICKETING_TEAM,
                  data: teamData.data as TicketingTeamRecord,
                  links: {
                    Members: memberIds,
                  },
                });
              }
            }
          } catch (error) {
            this.log(`[Chatwoot Sync] Error fetching teams: ${error}`);
          }
        }

        stream.push(null); // End the stream
      } catch (error) {
        this.log(`[Chatwoot Sync] Error fetching data: ${error}`);
        stream.emit('error', error);
      }
    })();

    return stream;
  }

  public formatData(
    targetTable: TARGET_TABLES,
    data: any,
  ): {
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return this.formatTicket(data);
      case TARGET_TABLES.TICKETING_USER:
        return this.formatUser(data);
      case TARGET_TABLES.TICKETING_COMMENT:
        return this.formatComment(data, data.conversation_id);
      case TARGET_TABLES.TICKETING_TEAM:
        return this.formatTeam(data);
      default: {
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
          },
        };
      }
    }
  }

  private formatTicket(conversation: ChatwootConversation): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    // Get the last non-activity message for description
    const lastMessage =
      conversation.messages?.[conversation.messages.length - 1];
    const contactName = conversation.meta?.sender?.name || 'Unknown';

    const ticket: TicketingTicketRecord = {
      Name: lastMessage?.content
        ? `${contactName}: ${lastMessage.content.substring(0, 100)}${lastMessage.content.length > 100 ? '...' : ''}`
        : `Conversation with ${contactName}`,
      Description: lastMessage?.content || null,
      'Due Date': null,
      Priority: conversation.priority || null,
      Status: this.mapStatus(conversation.status),
      Tags: conversation.labels?.join(', ') || null,
      'Ticket Type': 'Conversation',
      Url: null, // Chatwoot doesn't provide direct conversation URLs in API
      'Is Active': conversation.status !== 'resolved',
      'Completed At':
        conversation.status === 'resolved'
          ? this.toISOString(conversation.updated_at)
          : null,
      'Ticket Number': conversation.id.toString(),
      RemoteCreatedAt: this.toISOString(conversation.created_at),
      RemoteUpdatedAt: this.toISOString(conversation.updated_at),
      RemoteRaw: JSON.stringify(conversation),
    };

    const links: Record<string, string[]> = {};

    if (conversation.meta?.assignee) {
      links.Assignees = [`${conversation.meta.assignee.id}`];
    }

    if (conversation.meta?.sender) {
      links.Creator = [`${conversation.meta.sender.id}`];
    }

    return {
      data: ticket,
      links,
    };
  }

  private formatUser(user: ChatwootAgent | ChatwootContact): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: user.name || null,
      Email: user.email || null,
      Url: null,
      RemoteCreatedAt:
        'created_at' in user && user.created_at
          ? this.toISOString(user.created_at)
          : null,
      RemoteUpdatedAt: null,
      RemoteRaw: JSON.stringify(user),
    };

    return {
      data: userData,
    };
  }

  private formatComment(
    message: ChatwootMessage,
    conversationId: number,
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const senderName =
      message.sender?.name ||
      (message.sender && 'display_name' in message.sender
        ? message.sender.display_name
        : null) ||
      'User';
    const preview = message.content?.substring(0, 50) || 'Message';

    const commentData: TicketingCommentRecord = {
      Title: `${senderName}: ${preview}${message.content?.length > 50 ? '...' : ''}`,
      Body: message.content || null,
      Url: null,
      RemoteCreatedAt: this.toISOString(message.created_at),
      RemoteUpdatedAt: this.toISOString(message.updated_at),
      RemoteRaw: JSON.stringify(message),
    };

    const links: Record<string, string[]> = {};

    links.Ticket = [conversationId.toString()];

    if (message.sender_id && message.sender_type) {
      links['Created By'] = [`${message.sender_id}`];
    }

    return {
      data: commentData,
      links,
    };
  }

  private formatTeam(team: ChatwootTeam): {
    data: TicketingTeamRecord;
  } {
    const teamData: TicketingTeamRecord = {
      Name: team.name || null,
      Description: team.description || null,
      RemoteCreatedAt: null, // Chatwoot API doesn't provide team creation timestamp
      RemoteUpdatedAt: null, // Chatwoot API doesn't provide team update timestamp
      RemoteRaw: JSON.stringify(team),
    };

    return {
      data: teamData,
    };
  }

  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      open: 'Open',
      resolved: 'Resolved',
      pending: 'Pending',
      snoozed: 'Snoozed',
    };

    return statusMap[status] || status;
  }

  public getIncrementalKey(targetTable: TARGET_TABLES): string {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_COMMENT:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_USER:
      case TARGET_TABLES.TICKETING_TEAM:
      default:
        return '';
    }
  }
}
