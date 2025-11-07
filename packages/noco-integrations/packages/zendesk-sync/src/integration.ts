import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type  { ZendeskClient } from '@noco-integrations/zendesk-auth';
import type {
  AuthResponse,
  SyncLinkValue,
  SyncRecord,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';

export interface ZendeskSyncPayload {
  includeClosed: boolean;
}

export default class ZendeskSyncIntegration extends SyncIntegration<ZendeskSyncPayload> {
  public getTitle() {
    return 'Zendesk Tickets';
  }

  public async getDestinationSchema(_auth: AuthResponse<ZendeskClient>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<ZendeskClient>,
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
    const client = auth;
    const { includeClosed } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();
    const ticketMap = new Map<string, boolean>();

    (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Build query parameters for regular tickets API
        const queryParams = new URLSearchParams({
          per_page: '100',
        });
        
        if (ticketIncrementalValue) {
          queryParams.set('updated_after', ticketIncrementalValue);
        }
        
        if (!includeClosed) {
          queryParams.set('status', 'open');
        }

        // Fetch tickets using regular API (not incremental)
        this.log('[Zendesk Sync] Fetching tickets');

        let page = 1;
        let totalTickets = 0;
        let hasMore = true;

        while (hasMore) {
          queryParams.set('page', page.toString());
          this.log(`[Zendesk Sync] Fetching page ${page}`);
          
          const response: any = await client.axios.get(`/tickets.json?${queryParams.toString()}`);
          const data: any = response.data;

          this.log(`[Zendesk Sync] Fetched ${data.tickets.length} tickets`);
          
          // Break if no tickets returned
          if (!data.tickets || data.tickets.length === 0) {
            hasMore = false;
            break;
          }
          
          totalTickets += data.tickets.length;

          for (const ticket of data.tickets) {
            // Filter based on status
            if (!includeClosed && ['closed', 'solved'].includes(ticket.status)) {
              continue;
            }

            ticketMap.set(ticket.id.toString(), true);

            // Process ticket
            const ticketData = this.formatTicket(ticket);
            stream.push({
              recordId: ticket.id.toString(),
              targetTable: TARGET_TABLES.TICKETING_TICKET,
              data: ticketData.data as TicketingTicketRecord,
              links: ticketData.links,
            });

            // Process users (requester, assignee, submitter)
            const userIds = [
              ticket.requester_id,
              ticket.assignee_id,
              ticket.submitter_id,
            ].filter((id) => id);

            for (const userId of userIds) {
              if (!userMap.has(userId.toString())) {
                userMap.set(userId.toString(), true);
              }
            }
          }

          page++;

          // Respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        this.log(`[Zendesk Sync] Total tickets fetched: ${totalTickets}`);

        // Fetch users
        if (userMap.size > 0) {
          this.log(`[Zendesk Sync] Fetching ${userMap.size} users`);

          const userIds = Array.from(userMap.keys());
          const batchSize = 100;

          for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            const userQueryParams = new URLSearchParams({
              ids: batch.join(','),
            });

            try {
              const response = await client.axios.get(
                `/users/show_many.json?${userQueryParams.toString()}`,
              );

              for (const user of response.data.users) {
                const userData = this.formatUser(user);
                stream.push({
                  recordId: user.id.toString(),
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }
            } catch (error) {
              this.log(`[Zendesk Sync] Error fetching users batch: ${error}`);
            }

            // Respect rate limits
            if (i + batchSize < userIds.length) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        }

        // Fetch comments if requested
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
          this.log('[Zendesk Sync] Fetching comments');

          for (const ticketId of ticketMap.keys()) {
            try {
              const response = await client.axios.get(
                `/tickets/${ticketId}/comments.json`,
              );

              if (!response.data.comments) {
                continue;
              }

              for (const comment of response.data.comments) {
                const commentData = this.formatComment({
                  ...comment,
                  ticketId,
                });
                stream.push({
                  recordId: comment.id.toString(),
                  targetTable: TARGET_TABLES.TICKETING_COMMENT,
                  data: commentData.data as TicketingCommentRecord,
                  links: commentData.links,
                });

                // Add comment author to users if not already added
                if (comment.author_id && !userMap.has(comment.author_id.toString())) {
                  userMap.set(comment.author_id.toString(), true);

                  try {
                    const userResponse = await client.axios.get(
                      `/users/${comment.author_id}.json`,
                    );

                    const userData = this.formatUser(userResponse.data.user);
                    stream.push({
                      recordId: comment.author_id.toString(),
                      targetTable: TARGET_TABLES.TICKETING_USER,
                      data: userData.data as TicketingUserRecord,
                    });
                  } catch (error) {
                    this.log(
                      `[Zendesk Sync] Error fetching comment author ${comment.author_id}: ${error}`,
                    );
                  }
                }
              }

              // Respect rate limits
              await new Promise((resolve) => setTimeout(resolve, 200));
            } catch (error: any) {
              // Log but don't fail - comments might not be accessible
              if (error.response?.status === 401) {
                this.log(
                  `[Zendesk Sync] No permission to fetch comments for ticket ${ticketId}. Skipping comments.`,
                );
                // Stop trying to fetch more comments if we get 401
                break;
              } else {
                this.log(
                  `[Zendesk Sync] Error fetching comments for ticket ${ticketId}: ${error.message || error}`,
                );
              }
            }
          }
        }

        // Fetch organization (team) if requested
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          this.log('[Zendesk Sync] Fetching organizations');

          try {
            let orgNextPage: string | null = '/organizations.json';

            while (orgNextPage) {
              const response: any = await client.axios.get(orgNextPage);
              const data: any = response.data;

              for (const org of data.organizations) {
                const teamData = this.formatTeam(org);
                stream.push({
                  recordId: org.id.toString(),
                  targetTable: TARGET_TABLES.TICKETING_TEAM,
                  data: teamData.data as TicketingTeamRecord,
                });
              }

              orgNextPage = data.next_page;

              if (orgNextPage) {
                await new Promise((resolve) => setTimeout(resolve, 200));
              }
            }
          } catch (error) {
            this.log(`[Zendesk Sync] Error fetching organizations: ${error}`);
          }
        }

        stream.push(null); // End the stream
      } catch (error) {
        this.log(`[Zendesk Sync] Error fetching data: ${error}`);
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
        return this.formatComment(data);
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

  private formatTicket(ticket: any): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const ticketData: TicketingTicketRecord = {
      Name: ticket.subject || null,
      Description: ticket.description || null,
      'Due Date': ticket.due_at || null,
      Priority: ticket.priority || null,
      Status: ticket.status || null,
      Tags: ticket.tags?.join(', ') || null,
      'Ticket Type': ticket.type || null,
      Url: ticket.url || null,
      'Is Active': !['closed', 'solved'].includes(ticket.status),
      'Completed At': ['closed', 'solved'].includes(ticket.status) ? ticket.updated_at : null,
      'Ticket Number': ticket.id?.toString() || null,
      RemoteCreatedAt: ticket.created_at || null,
      RemoteUpdatedAt: ticket.updated_at || null,
      RemoteRaw: JSON.stringify(ticket),
    };

    const links: Record<string, string[]> = {};

    if (ticket.assignee_id) {
      links.Assignees = [ticket.assignee_id.toString()];
    }

    if (ticket.requester_id) {
      links.Creator = [ticket.requester_id.toString()];
    }

    if (ticket.organization_id) {
      links.Team = [ticket.organization_id.toString()];
    }

    return {
      data: ticketData,
      links,
    };
  }

  private formatUser(user: any): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: user.name || null,
      Email: user.email || null,
      Url: user.url || null,
      RemoteCreatedAt: user.created_at || null,
      RemoteUpdatedAt: user.updated_at || null,
      RemoteRaw: JSON.stringify(user),
    };

    return {
      data: userData,
    };
  }

  private formatComment(comment: any): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const commentData: TicketingCommentRecord = {
      Title: `Comment on ticket #${comment.ticketId}`,
      Body: comment.body || comment.html_body || null,
      Url: null,
      RemoteCreatedAt: comment.created_at || null,
      RemoteUpdatedAt: null,
      RemoteRaw: JSON.stringify(comment),
    };

    const links: Record<string, string[]> = {};

    if (comment.ticketId) {
      links.Ticket = [comment.ticketId.toString()];
    }

    if (comment.author_id) {
      links['Created By'] = [comment.author_id.toString()];
    }

    return {
      data: commentData,
      links,
    };
  }

  private formatTeam(team: any): {
    data: TicketingTeamRecord;
  } {
    const teamData: TicketingTeamRecord = {
      Name: team.name || null,
      Description: team.details || null,
      RemoteCreatedAt: team.created_at || null,
      RemoteUpdatedAt: team.updated_at || null,
      RemoteRaw: JSON.stringify(team),
    };

    return {
      data: teamData,
    };
  }

  public getIncrementalKey(targetTable: TARGET_TABLES): string {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_COMMENT:
        return 'RemoteCreatedAt';
      case TARGET_TABLES.TICKETING_USER:
      case TARGET_TABLES.TICKETING_TEAM:
      default:
        return '';
    }
  }
}
