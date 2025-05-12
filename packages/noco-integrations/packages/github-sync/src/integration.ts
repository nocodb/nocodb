import { DataObjectStream, SyncIntegration } from '@noco-integrations/core';
import { SCHEMA_TICKETING } from '@noco-integrations/core';
import type { AnyRecordType, AuthResponse} from '@noco-integrations/core';
import type { Octokit } from 'octokit';

export interface GithubIssuesPayload {
  owner: string;
  repo: string;
  includeClosed: boolean;
}

interface GithubIssue {
  title: string;
  assignees?: Array<{ login: string }>;
  user?: { login: string };
  state: string;
  body: string | null;
  pull_request?: any;
  number: number;
  labels?: Array<{ name: string } | string>;
  closed_at: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export default class GithubIssuesIntegration extends SyncIntegration<GithubIssuesPayload> {
  public async getDestinationSchema(
    _auth: AuthResponse<Octokit>,
  ) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<Octokit>,
    args: {
      targetTables?: string[];
      lastRecord?: AnyRecordType;
    },
  ): Promise<DataObjectStream> {
    const octokit = auth.custom as Octokit;
    const { owner, repo, includeClosed } = this.config;
    const { lastRecord } = args;

    const stream = new DataObjectStream();

    try {
      const fetchAfter = lastRecord?.RemoteUpdatedAt;
      const iterator = octokit.paginate.iterator(
        octokit.rest.issues.listForRepo,
        {
          owner,
          repo,
          per_page: 100,
          since: fetchAfter || undefined,
          ...(includeClosed ? { state: 'all' } : {}),
        },
      );

      for await (const { data } of iterator) {
        for (const issue of data as GithubIssue[]) {
          stream.push({
            recordId: `${issue.number}`,
            data: {
              Name: issue.title,
              Assignees:
                issue.assignees?.map((assignee) => assignee.login).join(', ') ||
                '',
              Creator: issue.user?.login || '',
              Status: issue.state,
              Description: issue.body || null,
              'Ticket Type': issue.pull_request ? 'Pull Request' : 'Issue',
              'Parent Ticket': `${issue.number}`,
              Tags:
                issue.labels
                  ?.map((label) =>
                    typeof label === 'string' ? label : label.name || '',
                  )
                  .join(', ') || '',
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
      console.error('Error fetching GitHub issues:', error);
      stream.destroy(error instanceof Error ? error : new Error(String(error)));
    }

    return stream;
  }

  public getIncrementalKey() {
    return 'RemoteUpdatedAt';
  }
}
