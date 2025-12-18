import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type { JiraProject, JiraSearchResponse } from './types';
import type { JiraAuthIntegration } from '@noco-integrations/jira-auth';
import type {
  SyncLinkValue,
  SyncRecord,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';

export interface JiraSyncPayload {
  projects: string[];
  includeClosed: boolean;
  jqlQuery?: string;
}

export default class JiraSyncIntegration extends SyncIntegration<JiraSyncPayload> {
  public getTitle() {
    return `${this.config.projects.join(' ')}`;
  }

  public async getDestinationSchema(_auth: JiraAuthIntegration) {
    return SCHEMA_TICKETING;
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

        if (ticketIncrementalValue) {
          // Incremental filter based on last synced RemoteUpdatedAt
          jqlParts.push(`updated >= "${ticketIncrementalValue}"`);
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
              },
            });
          });
          const searchResult = searchResultResponse.data;

          const issues: any[] = searchResult.issues || [];

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
            // if (
            //   resolvedTargetTables.includes(TARGET_TABLES.TICKETING_COMMENT)
            // ) {
            //   try {
            //     const commentsResponse = await auth.use(async (client) => {
            //       return client.getComments(issueKey);
            //     });

            //     const comments: any[] =
            //       commentsResponse?.comments || commentsResponse || [];

            //     for (const comment of comments) {
            //       const commentId = comment.id?.toString();
            //       if (!commentId) {
            //         continue;
            //       }

            //       const enrichedComment = {
            //         ...comment,
            //         issueId,
            //         issue: { key: issueKey },
            //       };

            //       const commentData = this.formatComment(enrichedComment);

            //       stream.push({
            //         recordId: commentId,
            //         targetTable: TARGET_TABLES.TICKETING_COMMENT,
            //         data: commentData.data as TicketingCommentRecord,
            //         links: commentData.links,
            //       });
            //     }
            //   } catch (error) {
            //     this.log(
            //       `[Jira Sync] Error fetching comments for issue ${issueKey}: ${error}`,
            //     );
            //   }
            // }
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
    const ticket: TicketingTicketRecord = {
      Name: issue.fields?.summary || null,
      Description:
        issue.renderedFields?.description || issue.fields?.description || null,
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

  private formatComment(comment: any): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const commentData: TicketingCommentRecord = {
      Title: comment.author
        ? `${comment.author.displayName || 'User'} commented on issue ${comment.issueKey || (comment.issue ? comment.issue.key : '#' + comment.issueId)}`
        : `Comment on issue ${comment.issueKey || (comment.issue ? comment.issue.key : '#' + comment.issueId)}`,
      Body: comment.renderedBody || comment.body || null,
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
