import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type {
  AuthResponse,
  SyncLinkValue,
  SyncRecord,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';
import type JiraClient from 'jira-client';

export interface JiraSyncPayload {
  projectKey: string;
  includeClosed: boolean;
  jqlQuery?: string;
}

export default class JiraSyncIntegration extends SyncIntegration<JiraSyncPayload> {
  public getTitle() {
    return `${this.config.projectKey}`;
  }

  public async getDestinationSchema(_auth: AuthResponse<JiraClient>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<JiraClient>,
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
    const jira = auth;
    const { projectKey, includeClosed, jqlQuery } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();
    const issueMap = new Map<string, { id: string; key: string }>();

    (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Build JQL query
        let query = `project = "${projectKey}"`;

        if (!includeClosed) {
          query +=
            ' AND status != Closed AND status != Done AND status != Resolved';
        }

        if (jqlQuery) {
          query += ` AND (${jqlQuery})`;
        }

        if (ticketIncrementalValue) {
          query += ` AND updated >= "${ticketIncrementalValue}"`;
        }

        // Fetch issues
        this.log(`[Jira Sync] Fetching issues from project ${projectKey}`);

        let startAt = 0;
        const maxResults = 100;
        let totalIssues = 0;
        let fetchedIssues = 0;

        // First fetch to get total count
        const initialResult = await jira.searchJira(query, {
          startAt: 0,
          maxResults,
          expand: ['renderedFields', 'names'],
        });

        totalIssues = initialResult.total;
        this.log(`[Jira Sync] Total issues to fetch: ${totalIssues}`);

        do {
          const result =
            startAt === 0
              ? initialResult
              : await jira.searchJira(query, {
                  startAt,
                  maxResults,
                  expand: ['renderedFields', 'names'],
                });

          this.log(`[Jira Sync] Fetched ${result.issues.length} issues`);
          fetchedIssues += result.issues.length;

          for (const issue of result.issues) {
            // Store issue ID and key for later comment fetching
            issueMap.set(issue.id, { id: issue.id, key: issue.key });

            // Process issue
            const ticketData = this.formatTicket(issue);
            stream.push({
              recordId: issue.id,
              targetTable: TARGET_TABLES.TICKETING_TICKET,
              data: ticketData.data as TicketingTicketRecord,
              links: ticketData.links,
            });

            // Process users (reporter, assignee)
            const users = [];
            if (issue.fields.reporter) {
              users.push(issue.fields.reporter);
            }
            if (issue.fields.assignee) {
              users.push(issue.fields.assignee);
            }

            for (const user of users) {
              if (!userMap.has(user.accountId)) {
                userMap.set(user.accountId, true);

                const userData = this.formatUser(user);
                stream.push({
                  recordId: user.accountId,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }
            }

            // If comments are requested, fetch them for each issue
            if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
              try {
                const comments = await jira.getComments(issue.key);
                this.log(
                  `[Jira Sync] Fetched ${comments.comments.length} comments for issue ${issue.key}`,
                );

                for (const comment of comments.comments) {
                  const commentData = this.formatComment({
                    ...comment,
                    issueId: issue.id,
                  });
                  stream.push({
                    recordId: comment.id,
                    targetTable: TARGET_TABLES.TICKETING_COMMENT,
                    data: commentData.data as TicketingCommentRecord,
                    links: commentData.links,
                  });

                  // Add comment author to users if not already added
                  if (
                    comment.author &&
                    !userMap.has(comment.author.accountId)
                  ) {
                    userMap.set(comment.author.accountId, true);

                    const userData = this.formatUser(comment.author);
                    stream.push({
                      recordId: comment.author.accountId,
                      targetTable: TARGET_TABLES.TICKETING_USER,
                      data: userData.data as TicketingUserRecord,
                    });
                  }
                }
              } catch (error) {
                this.log(
                  `[Jira Sync] Error fetching comments for issue ${issue.key}: ${error}`,
                );
              }
            }
          }

          startAt += maxResults;
        } while (fetchedIssues < totalIssues);

        // Fetch project information to create a team
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          try {
            const project = await jira.getProject(projectKey);
            this.log(`[Jira Sync] Fetched project ${project.key}`);

            const teamData = this.formatTeam(project);
            stream.push({
              recordId: project.id,
              targetTable: TARGET_TABLES.TICKETING_TEAM,
              data: teamData.data as TicketingTeamRecord,
            });

            // Fetch project members (users)
            try {
              const projectUsers = await jira.getUsersInProject(projectKey);
              this.log(
                `[Jira Sync] Fetched ${projectUsers.length} users in project ${projectKey}`,
              );

              for (const member of projectUsers) {
                if (!userMap.has(member.accountId)) {
                  userMap.set(member.accountId, true);

                  const userData = this.formatUser(member);
                  stream.push({
                    recordId: member.accountId,
                    targetTable: TARGET_TABLES.TICKETING_USER,
                    data: userData.data as TicketingUserRecord,
                  });
                }

                // Add member to team relationships
                stream.push({
                  recordId: project.id,
                  targetTable: TARGET_TABLES.TICKETING_TEAM,
                  links: {
                    Members: [member.accountId],
                  },
                });
              }
            } catch (error) {
              this.log(
                `[Jira Sync] Error fetching users for project ${projectKey}: ${error}`,
              );
            }
          } catch (error) {
            this.log(
              `[Jira Sync] Error fetching project ${projectKey}: ${error}`,
            );
          }
        }

        stream.push(null); // End the stream
      } catch (error) {
        this.log(`[Jira Sync] Error fetching data: ${error}`);
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
}
