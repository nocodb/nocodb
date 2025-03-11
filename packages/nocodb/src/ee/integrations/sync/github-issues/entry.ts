import type { Octokit } from 'octokit';
import type { AuthResponse } from '~/integrations/auth/auth.helpers';
import type { RecordTypeFromSchema } from '~/integrations/sync/sync.schemas';
import { DataObjectStream } from '~/integrations/sync/sync.helpers';
import SyncIntegration from '~/integrations/sync/sync.interface';
import { ticketingSchema } from '~/integrations/sync/sync.schemas';

export default class GithubIssuesIntegration extends SyncIntegration {
  public static destinationSchema = ticketingSchema;

  public async fetchData(
    auth: AuthResponse<Octokit>,
    payload: {
      owner: string;
      repo: string;
      includeClosed: boolean;
    },
    options: {
      last_record?: RecordTypeFromSchema<typeof ticketingSchema>;
    },
  ): Promise<DataObjectStream<RecordTypeFromSchema<typeof ticketingSchema>>> {
    const octokit = auth.custom;

    const { owner, repo } = payload;

    let fetchAfter;

    if (options.last_record) {
      fetchAfter = options.last_record.RemoteUpdatedAt;
    }

    const stream = new DataObjectStream<
      RecordTypeFromSchema<typeof ticketingSchema>
    >();

    (async () => {
      try {
        const iterator = await octokit.paginate.iterator(
          octokit.rest.issues.listForRepo,
          {
            owner,
            repo,
            per_page: 100,
            since: fetchAfter,
            ...(payload.includeClosed ? { state: 'all' } : {}),
          },
        );

        for await (const { data } of iterator) {
          for (const issue of data) {
            stream.push({
              recordId: issue.id.toString(),
              data: {
                Name: issue.title,
                Assignees: issue.assignees
                  .map((assignee) => assignee.login)
                  .join(', '),
                Creator: issue.user.login,
                Status: issue.state,
                Description: issue.body,
                'Ticket Type': issue.pull_request ? 'Pull Request' : 'Issue',
                'Parent Ticket': `${issue.number}`,
                Tags: issue.labels
                  .map((label) =>
                    typeof label === 'string' ? label : label.name,
                  )
                  .join(', '),
                'Completed At': issue.closed_at,
                'Ticket URL': issue.html_url,
                'Due Date': null,
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
