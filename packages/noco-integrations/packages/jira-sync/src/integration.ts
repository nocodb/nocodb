import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { adfToString } from './utils';
import type {
  JiraComment,
  JiraCommentsResponse,
  JiraProject,
  JiraSearchResponse,
  JiraUserFull,
} from './types';
import type { JiraAuthIntegration } from '@noco-integrations/jira-auth';
import type {
  SyncLinkValue,
  SyncRecord,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface JiraSyncPayload {
  projects: string[];
  includeClosed: boolean;
  jqlQuery?: string;
}

const ISSUE_FIELDS = [
  'summary',
  'description',
  'issuetype',
  'status',
  'priority',
  'assignee',
  'reporter',
  'created',
  'updated',
  'duedate',
  'labels',
  'components',
  'fixVersions',
  'parent',
];

export default class JiraSyncIntegration extends SyncIntegration<JiraSyncPayload> {
  public getTitle() {
    return `${this.config.projects.join(' ')}`;
  }

  public async getDestinationSchema(_auth: JiraAuthIntegration) {
    return SCHEMA_TICKETING;
  }

  async getTimezone(auth: JiraAuthIntegration) {
    let configVars = this.getVars();
    if (!configVars?.timezone) {
      const myself = (await auth.use((client) => client.get('/myself'))) as {
        data: JiraUserFull;
      };

      configVars = configVars ?? {};
      configVars.timezone = myself.data.timeZone;
      await this.saveVars(configVars);
    }
    return configVars.timezone;
  }

  async getJiraTimeFromIncremental(auth: JiraAuthIntegration, value?: string) {
    if (!value) {
      return value;
    }
    const timezone = await this.getTimezone(auth);
    return dayjs.utc(value).tz(timezone).format('YYYY/MM/DD HH:mm');
  }

  public async fetchData(
    auth: JiraAuthIntegration,
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
    const { projects, includeClosed, jqlQuery } = this.config;
    const { targetTables, targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();
    const issueMap = new Map<string, { id: string; key: string }>();

    void (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        const resolvedTargetTables =
          targetTables && targetTables.length > 0
            ? targetTables
            : [
                TARGET_TABLES.TICKETING_TICKET,
                TARGET_TABLES.TICKETING_USER,
                TARGET_TABLES.TICKETING_COMMENT,
              ];

        const jqlParts: string[] = [`project in (${projects.join(' ')})`];

        if (!includeClosed) {
          // Exclude issues in the Done status category when includeClosed is false
          jqlParts.push('statusCategory != Done');
        }

        if (jqlQuery && jqlQuery.trim().length > 0) {
          jqlParts.push(`(${jqlQuery})`);
        }

        let jiraTicketIncrementalValue: string | undefined;
        if (ticketIncrementalValue) {
          jiraTicketIncrementalValue = await this.getJiraTimeFromIncremental(
            auth,
            ticketIncrementalValue,
          );
          // Incremental filter based on last synced RemoteUpdatedAt
          // however somehow jira still treat this as >= so the last issue will still be fetched :|
          jqlParts.push(`updated > "${jiraTicketIncrementalValue}"`);
        }

        const jql = jqlParts.join(' AND ');

        this.log(`[Jira Sync] Fetching issues with JQL: ${jql}`);

        const maxResults = 100;
        let startAt = 0;
        let total = 0;
        let fetched = 0;

        // Paginate through Jira issues
        while (true) {
          const searchResultResponse = await auth.use(async (client) => {
            return client.get<JiraSearchResponse>('/search/jql', {
              params: {
                jql,
                startAt,
                maxResults,
                fields: ISSUE_FIELDS.join(','),
                expand: 'renderedFields',
              },
            });
          });
          const searchResult = searchResultResponse.data;

          const issues = searchResult.issues || [];

          if (!issues.length) {
            break;
          }

          total = searchResult.total ?? total;
          fetched += issues.length;

          this.log(
            `[Jira Sync] Fetched ${issues.length} issues (fetched=${fetched}, total=${total})`,
          );

          for (const issue of issues) {
            const issueId = issue.id?.toString() ?? issue.key;
            const issueKey = issue.key;

            if (!issueId || !issueKey) {
              continue;
            }

            issueMap.set(issueId, { id: issueId, key: issueKey });

            // Stream ticket records
            if (resolvedTargetTables.includes(TARGET_TABLES.TICKETING_TICKET)) {
              const ticketData = this.formatTicket(issue);

              stream.push({
                recordId: issueId,
                targetTable: TARGET_TABLES.TICKETING_TICKET,
                data: ticketData.data as TicketingTicketRecord,
                links: ticketData.links,
              });
            }

            // Collect and stream users related to the issue
            if (resolvedTargetTables.includes(TARGET_TABLES.TICKETING_USER)) {
              const users: any[] = [];

              if (issue.fields?.assignee) {
                users.push(issue.fields.assignee);
              }

              if (issue.fields?.reporter) {
                users.push(issue.fields.reporter);
              }

              for (const user of users) {
                const accountId: string | undefined = user.accountId;
                if (!accountId || userMap.has(accountId)) {
                  continue;
                }

                userMap.set(accountId, true);

                const userData = this.formatUser(user);

                stream.push({
                  recordId: accountId,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }
            }

            // // Stream comments for the issue if requested
            if (
              resolvedTargetTables.includes(TARGET_TABLES.TICKETING_COMMENT)
            ) {
              try {
                const { data: commentsResponse } = (await auth.use(
                  async (client) => {
                    return client.get(`/issue/${issueId}/comment`);
                  },
                )) as { data: JiraCommentsResponse };

                const comments =
                  commentsResponse?.comments || commentsResponse || [];

                for (const comment of comments) {
                  const commentId = comment.id?.toString();
                  if (!commentId) {
                    continue;
                  }
                  if (
                    jiraTicketIncrementalValue &&
                    dayjs(comment.updated).valueOf() <
                      dayjs(jiraTicketIncrementalValue).valueOf()
                  ) {
                    // skip comment, before last sync
                    continue;
                  }

                  const enrichedComment = {
                    ...comment,
                    issueId,
                    issue: { key: issueKey },
                  };

                  const commentData = this.formatComment(enrichedComment);

                  stream.push({
                    recordId: commentId,
                    targetTable: TARGET_TABLES.TICKETING_COMMENT,
                    data: commentData.data as TicketingCommentRecord,
                    links: commentData.links,
                  });
                }
              } catch (error) {
                this.log(
                  `[Jira Sync] Error fetching comments for issue ${issueKey}: ${error}`,
                );
              }
            }
          }

          startAt += maxResults;

          if (fetched >= total) {
            break;
          }
        }

        stream.push(null); // End the stream
      } catch (error) {
        this.log(`[Jira Sync] Error fetching data: ${error}`);
        stream.emit('error', error as Error);
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

  private formatTicket(issue: any): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    let description: string | null = null;
    if (issue.renderedFields?.description) {
      description = issue.renderedFields.description;
    } else if (issue.fields?.description) {
      description = adfToString(issue.fields.description);
    }

    const ticket: TicketingTicketRecord = {
      Name: issue.fields?.summary || null,
      Description: description,
      'Due Date': issue.fields?.duedate || null,
      Priority: issue.fields?.priority?.name || null,
      Status: issue.fields?.status?.name || null,
      Tags: issue.fields?.labels?.join(', ') || null,
      'Ticket Type': issue.fields?.issuetype?.name || null,
      Url: issue.self
        ? `${issue.self.split('/rest/')[0]}/browse/${issue.key}`
        : null,
      'Is Active': issue.fields?.status?.statusCategory?.key !== 'done',
      'Completed At': issue.fields?.resolutiondate || null,
      'Ticket Number': issue.key || null,
      RemoteCreatedAt: issue.fields?.created || null,
      RemoteUpdatedAt: issue.fields?.updated || null,
      RemoteRaw: JSON.stringify(issue),
    };

    const links: Record<string, string[]> = {};

    if (issue.fields?.assignee) {
      links.Assignees = [issue.fields.assignee.accountId];
    }

    if (issue.fields?.reporter) {
      links.Creator = [issue.fields.reporter.accountId];
    }

    return {
      data: ticket,
      links,
    };
  }

  private formatUser(user: any): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: user.displayName || null,
      Email: user.emailAddress || null,
      Url: user.self || null,
      RemoteCreatedAt: null, // Jira API doesn't provide this information
      RemoteUpdatedAt: null, // Jira API doesn't provide this information
      RemoteRaw: JSON.stringify(user),
    };

    return {
      data: userData,
    };
  }

  private formatComment(
    comment: JiraComment & {
      issueId: string;
      issue: { key: string };
    },
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    let description: string | null = adfToString(comment.body);

    const commentData: TicketingCommentRecord = {
      Title: comment.author
        ? `${comment.author.displayName || 'User'} commented on issue ${comment.issue?.key || (comment.issue ? comment.issue.key : '#' + comment.issueId)}`
        : `Comment on issue ${comment.issue?.key || (comment.issue ? comment.issue.key : '#' + comment.issueId)}`,
      Body: description,
      Url: comment.self || null,
      RemoteCreatedAt: comment.created || null,
      RemoteUpdatedAt: comment.updated || null,
      RemoteRaw: JSON.stringify(comment),
    };

    const links: Record<string, string[]> = {};

    if (comment.issueId) {
      links.Ticket = [comment.issueId];
    }

    if (comment.author) {
      links['Created By'] = [comment.author.accountId];
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
      Description: team.description || null,
      RemoteCreatedAt: null, // Jira API doesn't provide this information
      RemoteUpdatedAt: null, // Jira API doesn't provide this information
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
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_USER:
      case TARGET_TABLES.TICKETING_TEAM:
      default:
        return '';
    }
  }

  async fetchOptions(
    auth: JiraAuthIntegration,
    key: string,
  ): Promise<{ label: string; value: string }[]> {
    switch (key) {
      case 'projects': {
        const response = await auth.use((client) =>
          client.get<JiraProject[]>('/project'),
        );
        return response.data.map((project: any) => {
          return {
            label: project.name,
            value: project.key,
          };
        });
      }
      default: {
        return [];
      }
    }
  }
}
