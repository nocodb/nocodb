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

// Define a simplified interface for our processed issue
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

        // Find the team by key
        this.log(`[Linear Sync] Finding team with key ${teamKey}`);
        const team = await linear.team(teamKey);

        if (!team) {
          throw new Error(`Team with key ${teamKey} not found`);
        }

        this.log(`[Linear Sync] Found team: ${team.name}`);

        // Add team to stream
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          const teamData = this.formatTeam(team);
          stream.push({
            recordId: team.id,
            targetTable: TARGET_TABLES.TICKETING_TEAM,
            data: teamData.data as TicketingTeamRecord,
          });
        }

        // Build issue filter
        const issueFilter: Record<string, any> = {
          team: { key: { eq: teamKey } },
        };

        // Handle incremental sync
        if (ticketIncrementalValue) {
          issueFilter.updatedAt = { gt: new Date(ticketIncrementalValue) };
        }

        // Handle state filter
        if (!includeCanceled || !includeCompleted) {
          // Create a filter for the workflow state type
          const stateTypeFilter: { [key: string]: any } = {};

          if (!includeCanceled) {
            stateTypeFilter.type = { neq: 'canceled' };
          }

          if (!includeCompleted) {
            // If we're already filtering canceled states, use OR to also filter completed
            if (!includeCanceled) {
              stateTypeFilter.or = [{ type: { neq: 'completed' } }];
            } else {
              stateTypeFilter.type = { neq: 'completed' };
            }
          }

          if (Object.keys(stateTypeFilter).length > 0) {
            issueFilter.state = stateTypeFilter;
          }
        }

        // Fetch issues
        this.log(`[Linear Sync] Fetching issues for team ${teamKey}`);

        // Use Linear SDK pagination
        let hasNextPage = true;
        let endCursor = null;

        while (hasNextPage) {
          const { nodes: issues, pageInfo } = await linear.issues({
            filter: issueFilter,
            first: 50,
            after: endCursor,
            includeArchived: includeCanceled,
          });

          this.log(`[Linear Sync] Fetched ${issues.length} issues`);

          for (const issue of issues) {
            // Get state name
            const state = issue.state ? await issue.state : null;
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

            // Process assignee and creator
            let assigneeUser = null;
            let creatorUser = null;

            if (issue.assignee) {
              assigneeUser = await issue.assignee;
              if (!userMap.has(assigneeUser.id)) {
                userMap.set(assigneeUser.id, true);

                const userData = this.formatUser(assigneeUser);
                stream.push({
                  recordId: assigneeUser.id,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }
            }

            if (issue.creator) {
              creatorUser = await issue.creator;
              if (!userMap.has(creatorUser.id)) {
                userMap.set(creatorUser.id, true);

                const userData = this.formatUser(creatorUser);
                stream.push({
                  recordId: creatorUser.id,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }
            }

            // Get labels
            const labelsList: IssueLabel[] = [];
            if (issue.labels) {
              const labelsConnection = await issue.labels();
              labelsList.push(...labelsConnection.nodes);
            }

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
                this.log(
                  `[Linear Sync] Fetched ${comments.length} comments for issue ${issue.identifier}`,
                );

                for (const comment of comments) {
                  // Get comment user
                  let commentUser = null;
                  if (comment.user) {
                    commentUser = await comment.user;
                    if (!userMap.has(commentUser.id)) {
                      userMap.set(commentUser.id, true);

                      const userData = this.formatUser(commentUser);
                      stream.push({
                        recordId: commentUser.id,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        data: userData.data as TicketingUserRecord,
                      });
                    }
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
                }
              } catch (error) {
                this.log(
                  `[Linear Sync] Error fetching comments for issue ${issue.identifier}: ${error}`,
                );
              }
            }
          }

          hasNextPage = pageInfo.hasNextPage;
          endCursor = pageInfo.endCursor;
        }

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
      'Ticket Type': null, // Linear doesn't have ticket types
      Url: `https://linear.app/issue/${issue.identifier}`,
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
