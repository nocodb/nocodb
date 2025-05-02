import axios from 'axios';
import type { AuthResponse } from '~/integrations/auth/auth.helpers';
import type { RecordTypeFromSchema } from '~/integrations/sync/sync.schemas';
import { DataObjectStream } from '~/integrations/sync/sync.helpers';
import SyncIntegration from '~/integrations/sync/sync.interface';
import { ticketingSchema } from '~/integrations/sync/sync.schemas';

export default class JiraIssuesIntegration extends SyncIntegration {
  public async getDestinationSchema(_auth: AuthResponse<any>) {
    return ticketingSchema;
  }

  public async fetchData(
    auth: AuthResponse<any>,
    payload: {
      project: string;
      includeClosed: boolean;
    },
    options: {
      last_record?: RecordTypeFromSchema<typeof ticketingSchema>;
    },
  ): Promise<DataObjectStream<RecordTypeFromSchema<typeof ticketingSchema>>> {
    const { token, domain, email } = auth.custom;
    const authHeader = auth.custom.email
      ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
      : `Bearer ${token}`;
    const { project } = payload;

    let jql = `project = "${project}"`;
    if (!payload.includeClosed) {
      jql += ' AND status not in (Done, Closed)';
    }
    if (options.last_record) {
      jql += ` AND updated > "${options.last_record.RemoteUpdatedAt}"`;
    }

    const stream = new DataObjectStream<
      RecordTypeFromSchema<typeof ticketingSchema>
    >();

    await (async () => {
      try {
        let startAt = 0;
        const maxResults = 100;
        let total = 0;

        do {
          const response = await axios.get(`${domain}/rest/api/3/search`, {
            params: {
              jql,
              startAt,
              maxResults,
              fields: [
                'summary',
                'assignee',
                'reporter',
                'status',
                'description',
                'issuetype',
                'parent',
                'labels',
                'duedate',
                'resolutiondate',
                'priority',
                'attachment',
              ],
            },
            headers: {
              Authorization: authHeader,
              Accept: 'application/json',
            },
          });

          const { issues, total: totalIssues } = response.data;
          total = totalIssues;

          for (const issue of issues) {
            stream.push({
              recordId: issue.id,
              data: {
                Name: issue.fields.summary,
                Assignees: issue.fields.assignee?.displayName || '',
                Creator: issue.fields.reporter?.displayName || '',
                Status: issue.fields.status.name,
                Description: issue.fields.description,
                'Ticket Type': issue.fields.issuetype.name,
                'Parent Ticket': issue.fields.parent?.key || '',
                Tags: (issue.fields.labels || []).join(', '),
                'Completed At': issue.fields.resolutiondate,
                'Ticket URL': `${domain}/browse/${issue.key}`,
                'Due Date': issue.fields.duedate,
                Collections: null,
                Account: null,
                Contact: null,
                Priority: issue.fields.priority?.name || '',
                Attachments: issue.fields.attachment
                  ? issue.fields.attachment
                      .map((a: any) => a.content)
                      .join(', ')
                  : null,
                // System Fields
                RemoteCreatedAt: issue.fields.created,
                RemoteUpdatedAt: issue.fields.updated,
                RemoteRaw: JSON.stringify(issue),
              },
            });
          }

          startAt += maxResults;
        } while (startAt < total);

        stream.push(null);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Jira API Error:', {
            status: error.response?.status,
            message: error.response?.data?.message,
            endpoint: error.config?.url,
          });
        }
        stream.destroy(error);
      }
    })();

    return stream;
  }

  public getIncrementalKey() {
    return 'RemoteUpdatedAt';
  }
}
