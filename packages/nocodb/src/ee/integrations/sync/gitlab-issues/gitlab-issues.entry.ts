import { DataObjectStream } from '../sync.helpers';
import SyncIntegration from '../sync.interface';
import { ticketingSchema } from '../sync.schemas';
import type { RecordTypeFromSchema } from '../sync.schemas';
import type { Gitlab } from '@gitbeaker/rest';
import type { AuthResponse } from '../../auth/auth.helpers';

export default class GitlabIssuesIntegration extends SyncIntegration {
  public async getDestinationSchema(_auth: AuthResponse<typeof Gitlab>) {
    return ticketingSchema;
  }

  public async fetchData(
    auth: AuthResponse<typeof Gitlab>,
    payload: {
      projectId: string;
      includeClosed: boolean;
    },
    options: {
      last_record?: RecordTypeFromSchema<typeof ticketingSchema>;
    },
  ): Promise<DataObjectStream<RecordTypeFromSchema<typeof ticketingSchema>>> {
    const gitlab = auth.custom as typeof Gitlab;
    if (!gitlab) {
      throw new Error('Gitlab client is not initialized');
    }

    const { projectId } = payload;

    let fetchAfter;

    if (options.last_record) {
      fetchAfter = options.last_record.RemoteUpdatedAt;
    }

    const stream = new DataObjectStream<
      RecordTypeFromSchema<typeof ticketingSchema>
    >();

    await (async () => {
      try {
        // GitLab API pagination
        let page = 1;
        const per_page = 100;
        let hasMore = true;

        while (hasMore) {
          const issues = await (gitlab as any).Issues.all({
            projectId,
            perPage: per_page,
            page,
            updatedAfter: fetchAfter,
            state: payload.includeClosed ? 'all' : 'opened',
          });

          if (issues.length < per_page) {
            hasMore = false;
          }

          for (const issue of issues) {
            stream.push({
              recordId: issue.id.toString(),
              data: {
                Name: issue.title,
                Assignees:
                  issue.assignees
                    ?.map((assignee) => assignee.username)
                    .join(', ') || '',
                Creator: issue.author?.username || '',
                Status: issue.state,
                Description: issue.description,
                'Ticket Type': issue.merge_request_id
                  ? 'Merge Request'
                  : 'Issue',
                'Parent Ticket': `${issue.iid}`,
                Tags: issue.labels?.join(', ') || '',
                'Completed At': issue.closed_at,
                'Ticket URL': issue.web_url,
                'Due Date': issue.due_date,
                Collections: null,
                Account: null,
                Contact: null,
                Priority: '',
                Attachments: null,
                // System Fields
                RemoteCreatedAt: issue.created_at,
                RemoteUpdatedAt: issue.updated_at,
                RemoteRaw: JSON.stringify(issue),
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
