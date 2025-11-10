import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import { ncIsUUID } from 'nocodb-sdk';
import {
  ISSUES_WITH_RELATIONS_QUERY,
  TEAM_WITH_MEMBERS_QUERY,
  TEAMS_QUERY,
} from './graphql';
import type { AxiosInstance } from 'axios';
import type {
  AuthResponse,
  SyncLinkValue,
  SyncRecord,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';


import type { LinearComment, LinearIssue, LinearLabel, LinearSyncPayload , LinearTeam, LinearUser, ProcessedIssue} from './types';

export default class LinearSyncIntegration extends SyncIntegration<LinearSyncPayload> {
  public getTitle() {
    return `${this.config.teamKey}`;
  }

  public async getDestinationSchema(_auth: AuthResponse<AxiosInstance>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<AxiosInstance>,
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
    const axiosClient = auth;
    const { teamKey, includeCanceled, includeCompleted } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();

    (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Find the team by key or ID
        this.log(`[Linear Sync] Finding team with identifier: ${teamKey}`);

        let team: LinearTeam;
        if (ncIsUUID(teamKey)) {
          // It's a team ID, fetch directly
          this.log(`[Linear Sync] Detected UUID format, fetching team by ID`);
          const response = await axiosClient.post('', {
            query: TEAM_WITH_MEMBERS_QUERY,
            variables: { id: teamKey },
          });
          
          if (response.data.errors) {
            throw new Error(`Linear GraphQL errors: ${JSON.stringify(response.data.errors)}`);
          }
          
          team = response.data.data.team;
        } else {
          // It's a team key, fetch all teams and find by key
          this.log(`[Linear Sync] Detected key format, searching teams by key`);
          const response = await axiosClient.post('', {
            query: TEAMS_QUERY,
          });
          
          if (response.data.errors) {
            throw new Error(`Linear GraphQL errors: ${JSON.stringify(response.data.errors)}`);
          }
          
          const teams: LinearTeam[] = response.data.data.teams.nodes;
          const foundTeam = teams.find((t) => t.key === teamKey);
          
          if (!foundTeam) {
            throw new Error(`Team with key ${teamKey} not found`);
          }
          
          // Fetch full team with members
          const teamResponse = await axiosClient.post('', {
            query: TEAM_WITH_MEMBERS_QUERY,
            variables: { id: foundTeam.id },
          });
          
          if (teamResponse.data.errors) {
            throw new Error(`Linear GraphQL errors: ${JSON.stringify(teamResponse.data.errors)}`);
          }
          
          team = teamResponse.data.data.team;
        }

        if (!team) {
          throw new Error(`Team with identifier ${teamKey} not found`);
        }

        this.log(`[Linear Sync] Found team: ${team.name} (ID: ${team.id}, Key: ${team.key})`);

        // Add team to stream
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          const teamData = this.formatTeam(team);
          stream.push({
            recordId: team.id,
            targetTable: TARGET_TABLES.TICKETING_TEAM,
            data: teamData.data as TicketingTeamRecord,
          });
        }

        // Build issue filter using team ID
        const issueFilter: Record<string, any> = {
          team: { id: { eq: team.id } },
        };

        // Handle incremental sync
        if (ticketIncrementalValue) {
          const incrementalDate = new Date(ticketIncrementalValue);
          issueFilter.updatedAt = { gt: incrementalDate };
          this.log(`[Linear Sync] Incremental sync from: ${incrementalDate.toISOString()}`);
        }

        // Handle state filter - exclude canceled and/or completed states
        if (!includeCanceled && !includeCompleted) {
          // Exclude both canceled and completed
          issueFilter.state = {
            type: { nin: ['canceled', 'completed'] }
          };
        } else if (!includeCanceled) {
          // Exclude only canceled
          issueFilter.state = {
            type: { neq: 'canceled' }
          };
        } else if (!includeCompleted) {
          // Exclude only completed
          issueFilter.state = {
            type: { neq: 'completed' }
          };
        }

        // Fetch issues
        this.log(`[Linear Sync] Fetching issues for team ${teamKey} (ID: ${team.id})`);
        this.log(`[Linear Sync] Include canceled: ${includeCanceled}, Include completed: ${includeCompleted}`);

        let hasNextPage = true;
        let endCursor: string | null = null;
        let totalIssuesFetched = 0;

        while (hasNextPage) {
          this.log(`[Linear Sync] Fetching page with cursor: ${endCursor || 'initial'}`);
          
          // Single GraphQL query fetches issues with ALL relations (state, assignee, creator, labels, comments)
          const response = (await axiosClient.post('', {
            query: ISSUES_WITH_RELATIONS_QUERY,
            variables: {
              filter: issueFilter,
              first: 100,
              after: endCursor || undefined,
              includeArchived: includeCanceled || includeCompleted,
            },
          })) as any;

          if (response?.data?.errors) {
            throw new Error(`Linear GraphQL errors: ${JSON.stringify(response.data.errors)}`);
          }

          const issuesData = response.data.data.issues;
          const issues: LinearIssue[] = issuesData.nodes;
          totalIssuesFetched += issues.length;
          
          this.log(`[Linear Sync] Fetched ${issues.length} issues (total: ${totalIssuesFetched})`);
          this.log(`[Linear Sync] PageInfo - hasNextPage: ${issuesData.pageInfo.hasNextPage}`);

          // Process all issues
          for (const issue of issues) {
            try {
              const stateName = issue.state ? issue.state.name : null;

              // Process issue
              const processedIssue: ProcessedIssue = {
                id: issue.id,
                title: issue.title,
                identifier: issue.identifier,
                description: issue.description || null,
                dueDate: issue.dueDate || null,
                priority: issue.priority,
                stateName,
                completedAt: issue.completedAt || null,
                canceledAt: issue.canceledAt || null,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt,
              };

              // Process assignee
              if (issue.assignee && !userMap.has(issue.assignee.id)) {
                userMap.set(issue.assignee.id, true);
                const userData = this.formatUser(issue.assignee);
                stream.push({
                  recordId: issue.assignee.id,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }

              // Process creator
              if (issue.creator && !userMap.has(issue.creator.id)) {
                userMap.set(issue.creator.id, true);
                const userData = this.formatUser(issue.creator);
                stream.push({
                  recordId: issue.creator.id,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }

              // Get labels
              const labelsList = issue.labels.nodes;

              // Create ticket data
              const ticketData = this.formatTicket(
                processedIssue,
                labelsList,
                issue.assignee,
                issue.creator,
              );
              stream.push({
                recordId: issue.id,
                targetTable: TARGET_TABLES.TICKETING_TICKET,
                data: ticketData.data as TicketingTicketRecord,
                links: ticketData.links,
              });

              // Process comments
              if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
                const comments = issue.comments.nodes;

                for (const comment of comments) {
                  // Process comment user
                  if (comment.user && !userMap.has(comment.user.id)) {
                    userMap.set(comment.user.id, true);
                    const userData = this.formatUser(comment.user);
                    stream.push({
                      recordId: comment.user.id,
                      targetTable: TARGET_TABLES.TICKETING_USER,
                      data: userData.data as TicketingUserRecord,
                    });
                  }

                  const commentData = this.formatComment(
                    comment,
                    issue.id,
                    comment.user,
                    issue.identifier,
                  );
                  stream.push({
                    recordId: comment.id,
                    targetTable: TARGET_TABLES.TICKETING_COMMENT,
                    data: commentData.data as TicketingCommentRecord,
                    links: commentData.links,
                  });
                }
              }
            } catch (error) {
              this.log(
                `[Linear Sync] Error processing issue ${issue.identifier}: ${error}`,
              );
            }
          }

          hasNextPage = issuesData.pageInfo.hasNextPage;
          endCursor = issuesData.pageInfo.endCursor ?? null;
          
          this.log(`[Linear Sync] Page complete. Has next: ${hasNextPage}, End cursor: ${endCursor}`);
        }
        
        this.log(`[Linear Sync] Completed fetching all issues. Total: ${totalIssuesFetched}`);

        // Process team members
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM) && team.members) {
          try {
            const members = team.members.nodes;
            this.log(
              `[Linear Sync] Processing ${members.length} members for team ${teamKey}`,
            );

            for (const member of members) {
              if (!userMap.has(member.id)) {
                userMap.set(member.id, true);

                const userData = this.formatUser(member);
                stream.push({
                  recordId: member.id,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }

              // Link member to team
              stream.push({
                recordId: team.id,
                targetTable: TARGET_TABLES.TICKETING_TEAM,
                links: {
                  Members: [member.id],
                },
              });
            }
          } catch (error) {
            this.log(
              `[Linear Sync] Error processing members for team ${teamKey}: ${error}`,
            );
          }
        }

        stream.push(null); // End the stream
      } catch (error) {
        this.log(`[Linear Sync] Error fetching data: ${error}`);
        stream.emit('error', error);
      }
    })();

    return stream;
  }

  public formatData(
    targetTable: TARGET_TABLES,
    data:
      | ProcessedIssue
      | LinearUser
      | LinearComment
      | LinearTeam
      | {
          issue?: ProcessedIssue;
          comment: LinearComment;
          user?: LinearUser;
          issueIdentifier?: string;
        },
  ): {
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        if ('issue' in data) {
          return this.formatTicket(
            data.issue as ProcessedIssue,
            'labels' in data ? (data.labels as LinearLabel[]) : undefined,
            'assignee' in data ? (data.assignee as LinearUser) : undefined,
            'creator' in data ? (data.creator as LinearUser) : undefined,
          );
        }
        return this.formatTicket(data as ProcessedIssue);

      case TARGET_TABLES.TICKETING_USER:
        return this.formatUser(data as LinearUser);

      case TARGET_TABLES.TICKETING_COMMENT:
        if ('comment' in data) {
          return this.formatComment(
            data.comment,
            data.issue?.id,
            data.user || null,
            data.issueIdentifier,
          );
        }
        return this.formatComment(data as LinearComment);

      case TARGET_TABLES.TICKETING_TEAM:
        return this.formatTeam(data as LinearTeam);

      default:
        throw new Error(`Unsupported table: ${targetTable}`);
    }
  }

  private formatTicket(
    issue: ProcessedIssue,
    labels: LinearLabel[] = [],
    assignee: LinearUser | null = null,
    creator: LinearUser | null = null,
  ): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    // Format tags from labels
    let tags = null;
    if (labels && labels.length > 0) {
      tags = labels.map((label) => label.name).join(', ');
    }

    const ticket: TicketingTicketRecord = {
      Name: issue.title,
      Description: issue.description || null,
      'Due Date': issue.dueDate ? new Date(issue.dueDate).toISOString() : null,
      Priority: issue.priority ? this.getPriorityName(issue.priority) : null,
      Status: issue.stateName || null,
      Tags: tags,
      'Ticket Type': 'Issue',
      Url: null,
      'Is Active': !issue.completedAt && !issue.canceledAt,
      'Completed At': issue.completedAt
        ? new Date(issue.completedAt).toISOString()
        : null,
      'Ticket Number': issue.identifier,
      RemoteCreatedAt: issue.createdAt
        ? new Date(issue.createdAt).toISOString()
        : null,
      RemoteUpdatedAt: issue.updatedAt
        ? new Date(issue.updatedAt).toISOString()
        : null,
      RemoteRaw: JSON.stringify(issue),
    };

    const links: Record<string, string[]> = {};

    if (assignee) {
      links.Assignees = [assignee.id];
    }

    if (creator) {
      links.Creator = [creator.id];
    }

    return {
      data: ticket,
      links,
    };
  }

  private formatUser(user: LinearUser): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: user.name || user.displayName || null,
      Email: user.email || null,
      Url: null, // Linear API doesn't provide direct user URL
      RemoteCreatedAt: user.createdAt
        ? new Date(user.createdAt).toISOString()
        : null,
      RemoteUpdatedAt: user.updatedAt
        ? new Date(user.updatedAt).toISOString()
        : null,
      RemoteRaw: JSON.stringify(user),
    };

    return {
      data: userData,
    };
  }

  private formatComment(
    comment: LinearComment,
    issueId?: string,
    user: LinearUser | null = null,
    issueIdentifier?: string,
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const commentData: TicketingCommentRecord = {
      Title: user
        ? `${user.name || user.displayName || 'User'} commented on issue ${issueIdentifier || '#' + issueId}`
        : `Comment on issue ${issueIdentifier || '#' + issueId}`,
      Body: comment.body || null,
      Url: null, // Linear API doesn't provide direct comment URL
      RemoteCreatedAt: comment.createdAt
        ? new Date(comment.createdAt).toISOString()
        : null,
      RemoteUpdatedAt: comment.updatedAt
        ? new Date(comment.updatedAt).toISOString()
        : null,
      RemoteRaw: JSON.stringify(comment),
    };

    const links: Record<string, string[]> = {};

    if (issueId) {
      links.Ticket = [issueId];
    }

    if (user) {
      links['Created By'] = [user.id];
    }

    return {
      data: commentData,
      links,
    };
  }

  private formatTeam(team: LinearTeam): {
    data: TicketingTeamRecord;
  } {
    const teamData: TicketingTeamRecord = {
      Name: team.name || null,
      Description: team.description || null,
      RemoteCreatedAt: team.createdAt
        ? new Date(team.createdAt).toISOString()
        : null,
      RemoteUpdatedAt: team.updatedAt
        ? new Date(team.updatedAt).toISOString()
        : null,
      RemoteRaw: JSON.stringify(team),
    };

    return {
      data: teamData,
    };
  }

  private getPriorityName(priority: number): string {
    switch (priority) {
      case 0:
        return 'No Priority';
      case 1:
        return 'Urgent';
      case 2:
        return 'High';
      case 3:
        return 'Medium';
      case 4:
        return 'Low';
      default:
        return 'Unknown';
    }
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
