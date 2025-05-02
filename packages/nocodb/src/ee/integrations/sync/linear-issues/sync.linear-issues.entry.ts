import axios from 'axios';
import type { AuthResponse } from '~/integrations/auth/auth.helpers';
import type { RecordTypeFromSchema } from '~/integrations/sync/sync.schemas';
import { DataObjectStream } from '~/integrations/sync/sync.helpers';
import SyncIntegration from '~/integrations/sync/sync.interface';
import { ticketingSchema } from '~/integrations/sync/sync.schemas';

export default class LinearIssuesIntegration extends SyncIntegration {
  public async getDestinationSchema(_auth: AuthResponse) {
    return ticketingSchema;
  }

  public async fetchData(
    auth: AuthResponse,
    payload: {
      teamId: string;
      includeArchived: boolean;
    },
    options: {
      last_record?: RecordTypeFromSchema<typeof ticketingSchema>;
    },
  ): Promise<DataObjectStream<RecordTypeFromSchema<typeof ticketingSchema>>> {
    const accessToken = auth.accessToken;

    const { teamId, includeArchived } = payload;

    let fetchAfter;

    if (options.last_record) {
      fetchAfter = options.last_record.RemoteUpdatedAt;
    }

    const stream = new DataObjectStream<
      RecordTypeFromSchema<typeof ticketingSchema>
    >();

    await (async () => {
      try {
        // GraphQL query to fetch issues
        const query = `
          query Issues($teamId: String!, $after: String, $includeArchived: Boolean) {
            team(id: $teamId) {
              issues(
                first: 50, 
                after: $after, 
                includeArchived: $includeArchived,
                ${
                  fetchAfter
                    ? `filter: { updatedAt: { gt: "${fetchAfter}" } }`
                    : ''
                }
              ) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  identifier
                  title
                  description
                  number
                  state {
                    name
                    type
                  }
                  assignee {
                    name
                    email
                  }
                  creator {
                    name
                    email
                  }
                  labels {
                    nodes {
                      name
                      color
                    }
                  }
                  estimate
                  startedAt
                  completedAt
                  canceledAt
                  dueDate
                  priority
                  createdAt
                  updatedAt
                  archivedAt
                  url
                  team {
                    name
                    key
                  }
                }
              }
            }
          }
        `;

        let hasNextPage = true;
        let cursor = null;

        while (hasNextPage) {
          const response = await axios.post(
            'https://api.linear.app/graphql',
            {
              query,
              variables: {
                teamId,
                after: cursor,
                includeArchived,
              },
            },
            {
              headers: {
                Authorization: `${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          );

          const data = response.data.data;

          if (!data || !data.team || !data.team.issues) {
            throw new Error('Failed to fetch issues from Linear');
          }

          const issues = data.team.issues.nodes;
          const pageInfo = data.team.issues.pageInfo;

          for (const issue of issues) {
            stream.push({
              recordId: issue.id,
              data: {
                Name: issue.title,
                Assignees: issue.assignee?.name || '',
                Creator: issue.creator ? issue.creator.name : null,
                Status: issue.state ? issue.state.name : null,
                Description: issue.description,
                'Ticket Type': 'Issue',
                'Parent Ticket': issue.identifier,
                Tags: issue.labels?.nodes?.map((l) => l.name).join(', ') || '',
                'Completed At': issue.archivedAt,
                'Ticket URL': issue.url,
                'Due Date': issue.dueDate,
                Collections: null,
                Account: null,
                Contact: null,
                Priority: issue.priority ? String(issue.priority) : '',
                Attachments: null,
                // System Fields
                RemoteCreatedAt: issue.createdAt,
                RemoteUpdatedAt: issue.updatedAt,
                RemoteRaw: JSON.stringify(issue),
              },
            });
          }

          hasNextPage = pageInfo.hasNextPage;
          cursor = pageInfo.endCursor;
        }

        stream.push(null);
      } catch (error) {
        console.log(error?.response?.data);
        stream.destroy(error);
      }
    })();

    return stream;
  }

  public getIncrementalKey() {
    return 'RemoteUpdatedAt';
  }
}
