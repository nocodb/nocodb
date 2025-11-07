import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type {
  Comment,
  IssueLabel,
  LinearClient,
  Team,
  User,
} from '@linear/sdk';
import type {
  AuthResponse,
  SyncLinkValue,
  SyncRecord,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';

export interface LinearSyncPayload {
  teamKey: string;
  includeCanceled: boolean;
  includeCompleted: boolean;
}

interface ProcessedIssue {
  id: string;
  title: string;
  identifier: string;
  description: string | null;
  dueDate: string | null;
  priority: number | null;
  stateName: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default class LinearSyncIntegration extends SyncIntegration<LinearSyncPayload> {
  public getTitle() {
    return `${this.config.teamKey}`;
  }

  public async getDestinationSchema(_auth: AuthResponse<LinearClient>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<LinearClient>,
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
    const linear = auth;
    const { teamKey, includeCanceled, includeCompleted } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();
    const issueIdentifierMap = new Map<string, string>();

    (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Find the team by key or ID
        this.log(`[Linear Sync] Finding team with identifier: ${teamKey}`);
        
        // Check if teamKey looks like a UUID (team ID) or a short key
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamKey);
        
        let team;
        if (isUUID) {
          // It's a team ID, fetch directly
          this.log(`[Linear Sync] Detected UUID format, fetching team by ID`);
          team = await linear.team(teamKey);
        } else {
          // It's a team key, fetch all teams and find by key
          this.log(`[Linear Sync] Detected key format, searching teams by key`);
          const teamsConnection = await linear.teams();
          team = teamsConnection.nodes.find((t) => t.key === teamKey);
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

        // Use Linear SDK pagination
        let hasNextPage = true;
        let endCursor: string | null = null;
        let totalIssuesFetched = 0;

        while (hasNextPage) {
          this.log(`[Linear Sync] Fetching page with cursor: ${endCursor || 'initial'}`);
          
          const issuesConnection = await linear.issues({
            filter: issueFilter,
            first: 100,
            after: endCursor || undefined,
            includeArchived: includeCanceled || includeCompleted,
          });

          const issues = issuesConnection.nodes;
          totalIssuesFetched += issues.length;
          
          this.log(`[Linear Sync] Fetched ${issues.length} issues (total: ${totalIssuesFetched})`);
          this.log(`[Linear Sync] PageInfo - hasNextPage: ${issuesConnection.pageInfo.hasNextPage}, hasPreviousPage: ${issuesConnection.pageInfo.hasPreviousPage}`);

          const batchSize = 5;
          for (let i = 0; i < issues.length; i += batchSize) {
            const batch = issues.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (issue) => {
              try {
                const [state, assigneeUser, creatorUser, labelsConnection] = await Promise.all([
                  issue.state ? issue.state : Promise.resolve(null),
                  issue.assignee ? issue.assignee : Promise.resolve(null),
                  issue.creator ? issue.creator : Promise.resolve(null),
                  issue.labels ? issue.labels() : Promise.resolve({ nodes: [] }),
                ]);

                const stateName = state ? state.name : null;

              // Process issue
              const processedIssue: ProcessedIssue = {
                id: issue.id,
                title: issue.title,
                identifier: issue.identifier,
                description: issue.description || null,
                dueDate: issue.dueDate || null,
                priority: issue.priority,
                stateName,
                completedAt: issue.completedAt
                  ? issue.completedAt.toString()
                  : null,
                canceledAt: issue.canceledAt ? issue.canceledAt.toString() : null,
                createdAt: issue.createdAt.toString(),
                updatedAt: issue.updatedAt.toString(),
              };

              // Store the issue identifier for use with comments
              issueIdentifierMap.set(issue.id, issue.identifier);

              // Process assignee
              if (assigneeUser && !userMap.has(assigneeUser.id)) {
                userMap.set(assigneeUser.id, true);
                const userData = this.formatUser(assigneeUser);
                stream.push({
                  recordId: assigneeUser.id,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }

              // Process creator
              if (creatorUser && !userMap.has(creatorUser.id)) {
                userMap.set(creatorUser.id, true);
                const userData = this.formatUser(creatorUser);
                stream.push({
                  recordId: creatorUser.id,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }

              // Get labels
              const labelsList = labelsConnection.nodes;

              // Create ticket data
              const ticketData = this.formatTicket(
                processedIssue,
                labelsList,
                assigneeUser,
                creatorUser,
              );
              stream.push({
                recordId: issue.id,
                targetTable: TARGET_TABLES.TICKETING_TICKET,
                data: ticketData.data as TicketingTicketRecord,
                links: ticketData.links,
              });

              // Fetch comments if requested
              if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
                try {
                  const commentsConnection = await issue.comments();
                  const comments = commentsConnection.nodes;

                  // Process comments in parallel
                  await Promise.all(comments.map(async (comment) => {
                    // Get comment user
                    const commentUser = comment.user ? await comment.user : null;
                    
                    if (commentUser && !userMap.has(commentUser.id)) {
                      userMap.set(commentUser.id, true);
                      const userData = this.formatUser(commentUser);
                      stream.push({
                        recordId: commentUser.id,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        data: userData.data as TicketingUserRecord,
                      });
                    }

                    const commentData = this.formatComment(
                      comment,
                      issue.id,
                      commentUser,
                      issue.identifier,
                    );
                    stream.push({
                      recordId: comment.id,
                      targetTable: TARGET_TABLES.TICKETING_COMMENT,
                      data: commentData.data as TicketingCommentRecord,
                      links: commentData.links,
                    });
                  }));
                } catch (error) {
                  this.log(
                    `[Linear Sync] Error fetching comments for issue ${issue.identifier}: ${error}`,
                  );
                }
              }
              } catch (error) {
                this.log(
                  `[Linear Sync] Error processing issue ${issue.identifier}: ${error}`,
                );
              }
            }));
          }

          hasNextPage = issuesConnection.pageInfo.hasNextPage;
          endCursor = issuesConnection.pageInfo.endCursor ?? null;
          
          this.log(`[Linear Sync] Page complete. Has next: ${hasNextPage}, End cursor: ${endCursor}`);
        }
        
        this.log(`[Linear Sync] Completed fetching all issues. Total: ${totalIssuesFetched}`);

        // Fetch team members if needed
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          try {
            const membersConnection = await team.members();
            const members = membersConnection.nodes;
            this.log(
              `[Linear Sync] Fetched ${members.length} members for team ${teamKey}`,
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
              `[Linear Sync] Error fetching members for team ${teamKey}: ${error}`,
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
      | User
      | Comment
      | Team
      | {
          issue?: ProcessedIssue;
          comment: Comment;
          user?: User;
          issueIdentifier?: string;
        },
  ): {
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        // Check if we have a ProcessedIssue with labels, assignee, creator
        if ('issue' in data) {
          return this.formatTicket(
            data.issue as ProcessedIssue,
            'labels' in data ? (data.labels as IssueLabel[]) : undefined,
            'assignee' in data ? (data.assignee as User) : undefined,
            'creator' in data ? (data.creator as User) : undefined,
          );
        }
        return this.formatTicket(data as ProcessedIssue);

      case TARGET_TABLES.TICKETING_USER:
        return this.formatUser(data as User);

      case TARGET_TABLES.TICKETING_COMMENT:
        // Handle the enhanced comment case
        if ('comment' in data) {
          return this.formatComment(
            data.comment,
            data.issue?.id,
            data.user || null,
            data.issueIdentifier,
          );
        }
        // Handle basic comment
        return this.formatComment(data as Comment);

      case TARGET_TABLES.TICKETING_TEAM:
        return this.formatTeam(data as Team);

      default:
        throw new Error(`Unsupported table: ${targetTable}`);
    }
  }

  private formatTicket(
    issue: ProcessedIssue,
    labels: IssueLabel[] = [],
    assignee: User | null = null,
    creator: User | null = null,
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
      'Ticket Type': null,
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

  private formatUser(user: User): {
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
    comment: Comment,
    issueId?: string,
    user: User | null = null,
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

  private formatTeam(team: Team): {
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
