import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type { FreshdeskAuthIntegration } from '@noco-integrations/freshdesk-auth';
import type {
  SyncLinkValue,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';

/**
 * Freshdesk Sync Integration Configuration
 */
export interface FreshdeskSyncPayload {
  includeClosed: boolean;
}

/**
 * Freshdesk Sync Integration
 *
 * Syncs tickets, contacts (users), agents, and groups from Freshdesk.
 *
 * @see https://developers.freshdesk.com/api/
 */
export default class FreshdeskSyncIntegration extends SyncIntegration<FreshdeskSyncPayload> {
  public getTitle() {
    return 'Freshdesk Tickets';
  }

  public async getDestinationSchema(_auth: FreshdeskAuthIntegration) {
    return SCHEMA_TICKETING;
  }

  /**
   * Main data fetching method
   * Fetches tickets, contacts, agents, and groups from Freshdesk
   */
  public async fetchData(
    auth: FreshdeskAuthIntegration,
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
    const { includeClosed } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();
    const agentMap = new Map<string, boolean>();
    const ticketIds: string[] = [];

    void (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Fetch tickets
        await this.fetchTickets(
          auth,
          stream,
          ticketIncrementalValue,
          includeClosed,
          userMap,
          agentMap,
          ticketIds,
        );

        // Fetch contacts (users)
        await this.fetchContacts(auth, stream, userMap);

        // Fetch agents
        await this.fetchAgents(auth, stream, agentMap);

        // Fetch groups (teams)
        await this.fetchGroups(auth, stream);

        // Fetch conversations (comments) for all tickets
        await this.fetchConversations(
          auth,
          stream,
          ticketIds,
          userMap,
          agentMap,
        );

        stream.push(null);
      } catch (error) {
        this.log(`[Freshdesk Sync] Error: ${error}`);
        stream.destroy(error as Error);
      }
    })();

    return stream;
  }

  public formatData(
    targetTable: TARGET_TABLES,
    data: any,
  ): {
    data:
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return this.formatTicket(data);
      case TARGET_TABLES.TICKETING_USER:
        return data.contact ? this.formatAgent(data) : this.formatContact(data);
      case TARGET_TABLES.TICKETING_TEAM:
        return this.formatGroup(data);
      case TARGET_TABLES.TICKETING_COMMENT:
        return this.formatConversation(
          data.conversation || data,
          data.ticketId,
        );
      default:
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
          } as any,
        };
    }
  }

  public getIncrementalKey(targetTable: TARGET_TABLES): string {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_USER:
      case TARGET_TABLES.TICKETING_TEAM:
      case TARGET_TABLES.TICKETING_COMMENT:
      default:
        return '';
    }
  }

  /**
   * Fetch tickets from Freshdesk
   * Pagination: page parameter (starts at 1), per_page max 100
   */
  private async fetchTickets(
    auth: FreshdeskAuthIntegration,
    stream: DataObjectStream<any>,
    incrementalValue: string | undefined,
    includeClosed: boolean,
    userMap: Map<string, boolean>,
    agentMap: Map<string, boolean>,
    ticketIds: string[],
  ): Promise<void> {
    this.log('[Freshdesk Sync] Fetching tickets');

    let page = 1;
    let totalTickets = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const queryParams = new URLSearchParams({
          per_page: '100',
          page: page.toString(),
        });

        // Add incremental filter if provided
        if (incrementalValue) {
          const date = new Date(incrementalValue);
          if (!isNaN(date.getTime())) {
            queryParams.set('updated_since', date.toISOString());
          }
        }

        this.log(`[Freshdesk Sync] Fetching tickets page ${page}`);

        const response = await auth.use(async (client) => {
          return await client.get(`/tickets?${queryParams.toString()}`);
        });

        const tickets = response.data;

        if (!tickets || tickets.length === 0) {
          hasMore = false;
          break;
        }

        this.log(`[Freshdesk Sync] Fetched ${tickets.length} tickets`);

        for (const ticket of tickets) {
          if (!includeClosed && [4, 5].includes(ticket.status)) {
            continue;
          }

          totalTickets++;

          // Process ticket
          const ticketData = this.formatData(
            TARGET_TABLES.TICKETING_TICKET,
            ticket,
          );
          stream.push({
            recordId: ticket.id.toString(),
            targetTable: TARGET_TABLES.TICKETING_TICKET,
            data: ticketData.data as TicketingTicketRecord,
            links: ticketData.links,
          });

          ticketIds.push(ticket.id.toString());

          if (ticket.requester_id) {
            userMap.set(ticket.requester_id.toString(), true);
          }
          if (ticket.responder_id) {
            agentMap.set(ticket.responder_id.toString(), true);
          }
        }

        page++;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          // No more pages
          hasMore = false;
        } else {
          throw error;
        }
      }
    }

    this.log(`[Freshdesk Sync] Total tickets fetched: ${totalTickets}`);
  }

  /**
   * Fetch contacts (users/requesters) from Freshdesk
   */
  private async fetchContacts(
    auth: FreshdeskAuthIntegration,
    stream: DataObjectStream<any>,
    userMap: Map<string, boolean>,
  ): Promise<void> {
    if (userMap.size === 0) {
      return;
    }

    this.log(`[Freshdesk Sync] Fetching ${userMap.size} contacts`);

    const userIds = Array.from(userMap.keys());

    for (const userId of userIds) {
      try {
        const response = await auth.use(async (client) => {
          return await client.get(`/contacts/${userId}`);
        });
        const contact = response.data;

        const userData = this.formatData(TARGET_TABLES.TICKETING_USER, contact);
        stream.push({
          recordId: contact.id.toString(),
          targetTable: TARGET_TABLES.TICKETING_USER,
          data: userData.data as TicketingUserRecord,
        });
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          this.log(
            `[Freshdesk Sync] Error fetching contact ${userId}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Fetch agents from Freshdesk
   */
  private async fetchAgents(
    auth: FreshdeskAuthIntegration,
    stream: DataObjectStream<any>,
    agentMap: Map<string, boolean>,
  ): Promise<void> {
    if (agentMap.size === 0) {
      return;
    }

    this.log(`[Freshdesk Sync] Fetching ${agentMap.size} agents`);

    const agentIds = Array.from(agentMap.keys());

    for (const agentId of agentIds) {
      try {
        const response = await auth.use(async (client) => {
          return await client.get(`/agents/${agentId}`);
        });
        const agent = response.data;

        const agentData = this.formatData(TARGET_TABLES.TICKETING_USER, agent);
        stream.push({
          recordId: agent.id.toString(),
          targetTable: TARGET_TABLES.TICKETING_USER,
          data: agentData.data as TicketingUserRecord,
        });
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          this.log(
            `[Freshdesk Sync] Error fetching agent ${agentId}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Fetch groups (teams) from Freshdesk
   * Groups are associated with agents, fetched from /api/v2/admin/groups
   */
  private async fetchGroups(
    auth: FreshdeskAuthIntegration,
    stream: DataObjectStream<any>,
  ): Promise<void> {
    this.log('[Freshdesk Sync] Fetching groups');

    try {
      const response = await auth.use(async (client) => {
        return await client.get(`/admin/groups`);
      });
      const groups = response.data;

      if (!groups || groups.length === 0) {
        this.log('[Freshdesk Sync] No groups found');
        return;
      }

      this.log(`[Freshdesk Sync] Fetched ${groups.length} groups`);

      for (const group of groups) {
        const groupData = this.formatData(TARGET_TABLES.TICKETING_TEAM, group);
        stream.push({
          recordId: group.id.toString(),
          targetTable: TARGET_TABLES.TICKETING_TEAM,
          data: groupData.data as TicketingTeamRecord,
          links: groupData.links,
        });
      }
    } catch (error: any) {
      this.log(`[Freshdesk Sync] Error fetching groups: ${error.message}`);
    }
  }

  /**
   * Fetch conversations (comments) for tickets from Freshdesk
   */
  private async fetchConversations(
    auth: FreshdeskAuthIntegration,
    stream: DataObjectStream<any>,
    ticketIds: string[],
    userMap: Map<string, boolean>,
    agentMap: Map<string, boolean>,
  ): Promise<void> {
    if (ticketIds.length === 0) {
      return;
    }

    this.log(
      `[Freshdesk Sync] Fetching conversations for ${ticketIds.length} tickets`,
    );

    let totalConversations = 0;

    for (const ticketId of ticketIds) {
      try {
        // Fetch conversations with pagination
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const queryParams = new URLSearchParams({
            per_page: '30',
            page: page.toString(),
          });

          const response = await auth.use(async (client) => {
            return await client.get(
              `/tickets/${ticketId}/conversations?${queryParams.toString()}`,
            );
          });
          const conversations = response.data;

          if (!conversations || conversations.length === 0) {
            hasMore = false;
            break;
          }

          for (const conversation of conversations) {
            const commentData = this.formatData(
              TARGET_TABLES.TICKETING_COMMENT,
              {
                ...conversation,
                ticketId,
              },
            );
            stream.push({
              recordId: conversation.id.toString(),
              targetTable: TARGET_TABLES.TICKETING_COMMENT,
              data: commentData.data as TicketingCommentRecord,
              links: commentData.links,
            });

            totalConversations++;

            if (conversation.user_id) {
              if (conversation.incoming) {
                userMap.set(conversation.user_id.toString(), true);
              } else {
                agentMap.set(conversation.user_id.toString(), true);
              }
            }
          }

          page++;
        }
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          this.log(
            `[Freshdesk Sync] Error fetching conversations for ticket ${ticketId}: ${error.message}`,
          );
        }
      }
    }

    this.log(
      `[Freshdesk Sync] Total conversations fetched: ${totalConversations}`,
    );
  }

  /**
   * Format Freshdesk ticket to NocoDB ticketing schema
   */
  private formatTicket(ticket: any): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    // Map Freshdesk status to standard status
    // 2=Open, 3=Pending, 4=Resolved, 5=Closed
    const statusMap: Record<number, string> = {
      2: 'Open',
      3: 'Pending',
      4: 'Resolved',
      5: 'Closed',
    };

    // Map Freshdesk priority to standard priority
    // 1=Low, 2=Medium, 3=High, 4=Urgent
    const priorityMap: Record<number, string> = {
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Urgent',
    };

    const links: Record<string, string[]> = {};

    if (ticket.requester_id) {
      links.Creator = [ticket.requester_id.toString()];
    }

    if (ticket.responder_id) {
      links.Assignees = [ticket.responder_id.toString()];
    }

    const ticketData: TicketingTicketRecord = {
      Name: ticket.subject || null,
      Description: ticket.description_text || ticket.description || null,
      'Due Date': ticket.due_by || null,
      Priority: priorityMap[ticket.priority] || null,
      Status: statusMap[ticket.status] || null,
      Tags: ticket.tags?.join(', ') || null,
      'Ticket Type': ticket.type || null,
      Url: `https://${ticket.domain || 'domain'}.freshdesk.com/a/tickets/${ticket.id}`,
      'Is Active': ![4, 5].includes(ticket.status),
      'Completed At':
        ticket.stats?.closed_at || ticket.stats?.resolved_at || null,
      'Ticket Number': ticket.id?.toString() || null,
      RemoteCreatedAt: ticket.created_at || null,
      RemoteUpdatedAt: ticket.updated_at || null,
      RemoteRaw: JSON.stringify(ticket),
    };

    return {
      data: ticketData,
      links,
    };
  }

  /**
   * Format Freshdesk contact to NocoDB user schema
   */
  private formatContact(contact: any): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: contact.name || null,
      Email: contact.email || null,
      Url: null,
      RemoteCreatedAt: contact.created_at || null,
      RemoteUpdatedAt: contact.updated_at || null,
      RemoteRaw: JSON.stringify(contact),
    };

    return {
      data: userData,
    };
  }

  /**
   * Format Freshdesk agent to NocoDB user schema
   */
  private formatAgent(agent: any): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: agent.contact?.name || null,
      Email: agent.contact?.email || null,
      Url: null,
      RemoteCreatedAt: agent.created_at || null,
      RemoteUpdatedAt: agent.updated_at || null,
      RemoteRaw: JSON.stringify(agent),
    };

    return {
      data: userData,
    };
  }

  /**
   * Format Freshdesk group to NocoDB team schema
   */
  private formatGroup(group: any): {
    data: TicketingTeamRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const teamData: TicketingTeamRecord = {
      Name: group.name || null,
      Description: group.description || null,
      RemoteCreatedAt: group.created_at || null,
      RemoteUpdatedAt: group.updated_at || null,
      RemoteRaw: JSON.stringify(group),
    };

    const links: Record<string, string[]> = {};

    // Link to agents in the group
    if (
      group.agent_ids &&
      Array.isArray(group.agent_ids) &&
      group.agent_ids.length > 0
    ) {
      links.Members = group.agent_ids.map((id: number) => id.toString());
    }

    return {
      data: teamData,
      links: Object.keys(links).length > 0 ? links : undefined,
    };
  }

  /**
   * Format Freshdesk conversation to NocoDB comment schema
   */
  private formatConversation(
    conversation: any,
    ticketId: string,
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const commentData: TicketingCommentRecord = {
      Title: conversation.private
        ? `Private note on ticket #${ticketId}`
        : `Comment on ticket #${ticketId}`,
      Body: conversation.body_text || conversation.body || null,
      Url: null,
      RemoteCreatedAt: conversation.created_at || null,
      RemoteUpdatedAt: conversation.updated_at || null,
      RemoteRaw: JSON.stringify(conversation),
    };

    const links: Record<string, string[]> = {};

    // Link to the ticket
    if (ticketId) {
      links.Ticket = [ticketId];
    }

    // Link to the user who created the conversation
    if (conversation.user_id) {
      links['Created By'] = [conversation.user_id.toString()];
    }

    return {
      data: commentData,
      links,
    };
  }
}
