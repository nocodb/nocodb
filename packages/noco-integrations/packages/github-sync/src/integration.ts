import {
  DataObjectStream,
  NC_LINK_VALUES_KEY,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type {
  AnyRecordType,
  AuthResponse,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';
import type { Octokit } from 'octokit';

export interface GithubSyncPayload {
  owner: string;
  repo: string;
  includeClosed: boolean;
}

export default class GithubSyncIntegration extends SyncIntegration<GithubSyncPayload> {
  public async getDestinationSchema(_auth: AuthResponse<Octokit>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<Octokit>,
    args: {
      targetTables?: string[];
      lastRecord?: AnyRecordType;
    },
  ): Promise<DataObjectStream<TicketingTicketRecord | TicketingUserRecord>> {
    const octokit = auth.custom as Octokit;
    const { owner, repo, includeClosed } = this.config;
    const { lastRecord } = args;

    const stream = new DataObjectStream<TicketingTicketRecord | TicketingUserRecord>();

    const userMap = new Map<string, boolean>();

    try {
      const fetchAfter = lastRecord?.RemoteUpdatedAt;
      const iterator = octokit.paginate.iterator(
        octokit.rest.issues.listForRepo,
        {
          owner,
          repo,
          per_page: 100,
          since: fetchAfter ? `${fetchAfter}` : undefined,
          ...(includeClosed ? { state: 'all' } : {}),
        },
      );

      for await (const { data } of iterator) {
        for (const issue of data) {
          stream.push({
            recordId: `${issue.id}`,
            targetTable: TARGET_TABLES.TICKETING_TICKET,
            data: {
              Name: issue.title,
              Status: issue.state,
              Description: issue.body || null,
              'Ticket Type': issue.pull_request ? 'Pull Request' : 'Issue',
              Tags:
                issue.labels
                  ?.map((label) =>
                    typeof label === 'string' ? label : label.name || '',
                  )
                  .join(', ') || '',
              'Completed At': issue.closed_at,
              'Ticket Url': issue.html_url,
              'Due Date': null,
              Priority: '',
              'Is Active': issue.state === 'open',
              // System Fields
              RemoteCreatedAt: issue.created_at,
              RemoteUpdatedAt: issue.updated_at,
              RemoteRaw: JSON.stringify(issue),
              // Link values
              [NC_LINK_VALUES_KEY]: {
                Assignees:
                  issue.assignees?.map((assignee) => `${assignee.id}`) || [],
                Creator: issue.user?.id ? [`${issue.user.id}`] : [],
              },
            },
          });

          // extract users and stream
          const users: {
            id: number;
            login: string;
          }[] = [...(issue.assignees || [])];

          if (issue.user) {
            users.push(issue.user);
          }

          for (const user of users) {
            if (!userMap.has(user.login)) {
              userMap.set(user.login, true);

              let email = null;

              try {
                // Fetch user details to get public email
                const { data: userData } =
                  await octokit.rest.users.getByUsername({
                    username: user.login,
                  });

                email = userData.email || null;
              } catch (error) {
                console.error(
                  `Error fetching details for user ${user.login}:`,
                  error,
                );
              }

              stream.push({
                recordId: `${user.id}`,
                targetTable: TARGET_TABLES.TICKETING_USER,
                data: {
                  Name: user.login,
                  Email: email,
                  // System Fields
                  RemoteRaw: JSON.stringify(user),
                },
              });
            }
          }
        }
      }

      stream.push(null);
    } catch (error) {
      console.error('Error fetching GitHub issues:', error);
      stream.destroy(error instanceof Error ? error : new Error(String(error)));
    }

    return stream;
  }

  public getIncrementalKey() {
    return 'RemoteUpdatedAt';
  }
}
