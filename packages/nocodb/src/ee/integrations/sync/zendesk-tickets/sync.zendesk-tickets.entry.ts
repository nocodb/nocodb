import type { AuthResponse } from '~/integrations/auth/auth.helpers';
import type { RecordTypeFromSchema } from '~/integrations/sync/sync.schemas';
import { AuthType } from '~/integrations/auth/auth.helpers';
import { DataObjectStream } from '~/integrations/sync/sync.helpers';
import SyncIntegration from '~/integrations/sync/sync.interface';
import { ticketingSchema } from '~/integrations/sync/sync.schemas';

interface ZendeskTicket {
  id: number;
  subject: string;
  assignee_id?: number;
  requester_id?: number;
  status: string;
  description: string;
  parent_id?: number;
  tags?: string[];
  solved_at?: string;
  due_at?: string;
  priority?: string;
  created_at: string;
  updated_at: string;
}

export default class ZendeskTicketsIntegration extends SyncIntegration {
  public async getDestinationSchema(_auth: AuthResponse) {
    return ticketingSchema;
  }

  public async fetchData(
    auth: AuthResponse,
    payload: {
      subdomain: string;
      includeClosed: boolean;
    },
    options: {
      last_record?: RecordTypeFromSchema<typeof ticketingSchema>;
    },
  ): Promise<DataObjectStream<RecordTypeFromSchema<typeof ticketingSchema>>> {
    const stream = new DataObjectStream<
      RecordTypeFromSchema<typeof ticketingSchema>
    >();

    await (async () => {
      try {
        const { subdomain } = payload;
        const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;

        let page = 1;
        let hasMore = true;
        const fetchAfter = options.last_record?.RemoteUpdatedAt;

        while (hasMore) {
          const response = await fetch(
            `${baseUrl}/tickets.json?page=${page}&per_page=100${
              fetchAfter ? `&updated_after=${fetchAfter}` : ''
            }${!payload.includeClosed ? '&status=open' : ''}`,
            {
              headers: {
                Authorization:
                  auth.authType === AuthType.OAuth
                    ? `Bearer ${auth.accessToken}`
                    : `Basic ${auth.accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          const tickets = (data as any).tickets || [];

          if (tickets.length === 0) {
            hasMore = false;
            continue;
          }

          for (const ticket of tickets) {
            stream.push({
              recordId: ticket.id.toString(),
              data: {
                Name: ticket.subject,
                Assignees: ticket.assignee_id
                  ? ticket.assignee_id.toString()
                  : '',
                Creator: ticket.requester_id
                  ? ticket.requester_id.toString()
                  : '',
                Status: ticket.status,
                Description: ticket.description,
                'Ticket Type': 'Ticket',
                'Parent Ticket': ticket.parent_id
                  ? ticket.parent_id.toString()
                  : null,
                Tags: ticket.tags ? ticket.tags.join(', ') : '',
                'Completed At': ticket.solved_at,
                'Ticket URL': `https://${subdomain}.zendesk.com/agent/tickets/${ticket.id}`,
                'Due Date': ticket.due_at,
                Collections: null,
                Account: null,
                Contact: null,
                Priority: ticket.priority,
                Attachments: null,
                // System Fields
                RemoteCreatedAt: ticket.created_at,
                RemoteUpdatedAt: ticket.updated_at,
                RemoteRaw: JSON.stringify(ticket),
              },
            });
          }

          page++;
        }

        stream.push(null);
      } catch (error) {
        stream.destroy(error);
      }
    })();

    return stream;
  }

  public getIncrementalKey() {
    return 'RemoteUpdatedAt';
  }
}
