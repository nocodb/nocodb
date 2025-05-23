import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type {
  AuthResponse,
  SyncLinkValue,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';
import type { Gitlab } from '@gitbeaker/rest';
import type {
  GroupSchema,
  IssueSchema,
  MemberSchema,
  MergeRequestSchema,
  NoteSchema,
  UserSchema,
} from '@gitbeaker/core';

export interface GitlabSyncPayload {
  projectId: string;
  includeClosed: boolean;
  includeMRs: boolean;
}

export default class GitlabSyncIntegration extends SyncIntegration<GitlabSyncPayload> {
  public getTitle() {
    return `${this.config.projectId}`;
  }

  public async getDestinationSchema(
    _auth: AuthResponse<InstanceType<typeof Gitlab>>,
  ) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<InstanceType<typeof Gitlab>>,
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
    const gitlab = auth;
    const { projectId, includeClosed, includeMRs = false } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<number, boolean>();
    const issueMap = new Map<number, { id: number; iid: number }>();
    const teamMap = new Map<number, boolean>();

    (async () => {
      try {
        // Fetch teams if they're in the target tables
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          this.log(`[GitLab Sync] Fetching groups for project ${projectId}`);

          try {
            // Get project details to find the namespace
            const project = await gitlab.Projects.show(projectId);

            if (project && project.namespace) {
              // Get all groups (teams) in the namespace
              const perPage = 100;
              let page = 1;
              let hasMoreGroups = true;

              while (hasMoreGroups) {
                const groups = await gitlab.Groups.all({
                  perPage,
                  pagination: 'offset',
                  page,
                  // Search in the project's namespace path
                  search: project.namespace.path,
                });

                if (groups.length === 0) {
                  hasMoreGroups = false;
                  break;
                }

                this.log(
                  `[GitLab Sync] Fetched ${groups.length} groups on page ${page}`,
                );

                for (const group of groups) {
                  if (!teamMap.has(group.id)) {
                    teamMap.set(group.id, true);

                    // Add group to stream as a team
                    stream.push({
                      recordId: `${group.id}`,
                      targetTable: TARGET_TABLES.TICKETING_TEAM,
                      ...this.formatData(
                        TARGET_TABLES.TICKETING_TEAM,
                        group as GroupSchema,
                      ),
                    });

                    // Fetch group members
                    try {
                      let memberPage = 1;
                      let hasMoreMembers = true;

                      while (hasMoreMembers) {
                        const members = await gitlab.GroupMembers.all(
                          group.id,
                          {
                            perPage,
                            pagination: 'offset',
                            page: memberPage,
                          },
                        );

                        if (members.length === 0) {
                          hasMoreMembers = false;
                          break;
                        }

                        this.log(
                          `[GitLab Sync] Fetched ${members.length} members for group ${group.name} on page ${memberPage}`,
                        );

                        for (const member of members) {
                          if (!userMap.has(member.id)) {
                            userMap.set(member.id, true);

                            // Add user to stream
                            stream.push({
                              recordId: `${member.id}`,
                              targetTable: TARGET_TABLES.TICKETING_USER,
                              ...this.formatData(
                                TARGET_TABLES.TICKETING_USER,
                                member as MemberSchema,
                              ),
                            });
                          }

                          // Add member to team relationships
                          stream.push({
                            recordId: `${group.id}`,
                            targetTable: TARGET_TABLES.TICKETING_TEAM,
                            links: {
                              Members: [`${member.id}`],
                            },
                          });
                        }

                        memberPage++;

                        // If we got fewer results than requested, we've reached the end
                        if (members.length < perPage) {
                          hasMoreMembers = false;
                        }
                      }
                    } catch (error) {
                      console.error(
                        `[GitLab Sync] Error fetching members for group ${group.name}:`,
                        error,
                      );
                    }
                  }
                }

                // Increment page for next request
                page++;

                // If we got fewer results than requested, we've reached the end
                if (groups.length < perPage) {
                  hasMoreGroups = false;
                }
              }
            }
          } catch (error) {
            console.error(
              '[GitLab Sync] Error fetching groups for project:',
              error,
            );
          }
        }

        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Configure issue state based on includeClosed settings
        const state = !includeClosed ? 'opened' : 'all';

        // GitLab API uses pagination with max_pages
        const perPage = 100;
        let page = 1;
        let hasMoreIssues = true;

        // Update dates for incremental sync if needed
        let updatedAfter = undefined;
        if (ticketIncrementalValue) {
          updatedAfter = new Date(ticketIncrementalValue).toISOString();
        }

        // Fetch all issues with pagination
        while (hasMoreIssues) {
          this.log(`[GitLab Sync] Fetching issues for project ${projectId}`);

          try {
            const issues = await gitlab.Issues.all({
              projectId,
              state,
              updatedAfter,
              perPage,
              page,
              orderBy: 'updated_at',
              sort: 'asc',
              pagination: 'offset',
            });

            if (issues.length === 0) {
              hasMoreIssues = false;
              break;
            }

            this.log(
              `[GitLab Sync] Fetched ${issues.length} issues on page ${page}`,
            );

            // Process each issue
            for (const issue of issues) {
              // Store issue ID and IID for later comment fetching
              issueMap.set(issue.iid, { id: issue.id, iid: issue.iid });

              stream.push({
                recordId: `${issue.id}`,
                targetTable: TARGET_TABLES.TICKETING_TICKET,
                ...this.formatData(
                  TARGET_TABLES.TICKETING_TICKET,
                  issue as IssueSchema,
                ),
              });

              // Extract and process users
              const users = [];

              // Add assignees if present
              if (
                issue.assignees &&
                Array.isArray(issue.assignees) &&
                issue.assignees.length > 0
              ) {
                users.push(...issue.assignees);
              }

              // Add author if present
              if (issue.author) {
                users.push(issue.author);
              }

              // Process unique users
              for (const user of users) {
                if (!userMap.has(user.id)) {
                  userMap.set(user.id, true);

                  stream.push({
                    recordId: `${user.id}`,
                    targetTable: TARGET_TABLES.TICKETING_USER,
                    ...this.formatData(
                      TARGET_TABLES.TICKETING_USER,
                      user as UserSchema,
                    ),
                  });
                }
              }
            }

            page++;
          } catch (error) {
            console.error(
              `[GitLab Sync] Error fetching issues for project ${projectId} on page ${page}:`,
              error,
            );
            hasMoreIssues = false;
          }
        }

        // Fetch merge requests if enabled
        if (includeMRs) {
          this.log(
            `[GitLab Sync] Fetching merge requests for project ${projectId}`,
          );

          // Reset pagination for merge requests
          let page = 1;
          let hasMoreMRs = true;

          // First fetch open merge requests
          while (hasMoreMRs) {
            try {
              const mergeRequests = await gitlab.MergeRequests.all({
                projectId,
                state: 'opened',
                updatedAfter,
                perPage,
                page,
                orderBy: 'updated_at',
                sort: 'asc',
                pagination: 'offset',
              });

              if (mergeRequests.length === 0) {
                hasMoreMRs = false;
                break;
              }

              this.log(
                `[GitLab Sync] Fetched ${mergeRequests.length} open merge requests on page ${page}`,
              );

              // Process each merge request
              for (const mr of mergeRequests) {
                // Format MR as a ticket
                const ticketData = {
                  ...mr,
                  // Mark as MR for the formatter
                  merge_request: true,
                };

                // Store MR ID and IID for later comment fetching
                // Use negative IID to avoid conflicts with issues
                issueMap.set(-mr.iid, { id: mr.id, iid: mr.iid });

                stream.push({
                  recordId: `${mr.id}`,
                  targetTable: TARGET_TABLES.TICKETING_TICKET,
                  ...this.formatData(
                    TARGET_TABLES.TICKETING_TICKET,
                    ticketData as IssueSchema | MergeRequestSchema,
                  ),
                });

                // Extract and process users
                const users = [];

                // Add assignees if present
                if (
                  mr.assignees &&
                  Array.isArray(mr.assignees) &&
                  mr.assignees.length > 0
                ) {
                  users.push(...mr.assignees);
                }

                // Add author if present
                if (mr.author) {
                  users.push(mr.author);
                }

                // Process unique users
                for (const user of users) {
                  if (!userMap.has(user.id)) {
                    userMap.set(user.id, true);

                    stream.push({
                      recordId: `${user.id}`,
                      targetTable: TARGET_TABLES.TICKETING_USER,
                      ...this.formatData(
                        TARGET_TABLES.TICKETING_USER,
                        user as UserSchema,
                      ),
                    });
                  }
                }
              }

              page++;
            } catch (error) {
              console.error(
                `[GitLab Sync] Error fetching open merge requests for project ${projectId} on page ${page}:`,
                error,
              );
              hasMoreMRs = false;
            }
          }

          // Fetch closed/merged merge requests if includeClosed is true
          if (includeClosed) {
            // Reset pagination for closed/merged merge requests
            page = 1;
            hasMoreMRs = true;

            // Fetch merged merge requests
            while (hasMoreMRs) {
              try {
                const mergeRequests = await gitlab.MergeRequests.all({
                  projectId,
                  state: 'merged',
                  updatedAfter,
                  perPage,
                  page,
                  orderBy: 'updated_at',
                  sort: 'asc',
                  pagination: 'offset',
                });

                if (mergeRequests.length === 0) {
                  hasMoreMRs = false;
                  break;
                }

                this.log(
                  `[GitLab Sync] Fetched ${mergeRequests.length} merged merge requests on page ${page}`,
                );

                // Process each merge request
                for (const mr of mergeRequests) {
                  // Format MR as a ticket
                  const ticketData = {
                    ...mr,
                    // Mark as MR for the formatter
                    merge_request: true,
                  };

                  // Store MR ID and IID for later comment fetching
                  // Use negative IID to avoid conflicts with issues
                  issueMap.set(-mr.iid, { id: mr.id, iid: mr.iid });

                  stream.push({
                    recordId: `${mr.id}`,
                    targetTable: TARGET_TABLES.TICKETING_TICKET,
                    ...this.formatData(
                      TARGET_TABLES.TICKETING_TICKET,
                      ticketData as IssueSchema | MergeRequestSchema,
                    ),
                  });

                  // Extract and process users
                  const users = [];

                  // Add assignees if present
                  if (
                    mr.assignees &&
                    Array.isArray(mr.assignees) &&
                    mr.assignees.length > 0
                  ) {
                    users.push(...mr.assignees);
                  }

                  // Add author if present
                  if (mr.author) {
                    users.push(mr.author);
                  }

                  // Process unique users
                  for (const user of users) {
                    if (!userMap.has(user.id)) {
                      userMap.set(user.id, true);

                      stream.push({
                        recordId: `${user.id}`,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_USER,
                          user as UserSchema,
                        ),
                      });
                    }
                  }
                }

                page++;
              } catch (error) {
                console.error(
                  `[GitLab Sync] Error fetching merged merge requests for project ${projectId} on page ${page}:`,
                  error,
                );
                hasMoreMRs = false;
              }
            }

            // Reset pagination for closed merge requests
            page = 1;
            hasMoreMRs = true;

            // Fetch closed merge requests
            while (hasMoreMRs) {
              try {
                const mergeRequests = await gitlab.MergeRequests.all({
                  projectId,
                  state: 'closed',
                  updatedAfter,
                  perPage,
                  page,
                  orderBy: 'updated_at',
                  sort: 'asc',
                  pagination: 'offset',
                });

                if (mergeRequests.length === 0) {
                  hasMoreMRs = false;
                  break;
                }

                this.log(
                  `[GitLab Sync] Fetched ${mergeRequests.length} closed merge requests on page ${page}`,
                );

                // Process each merge request
                for (const mr of mergeRequests) {
                  // Format MR as a ticket
                  const ticketData = {
                    ...mr,
                    // Mark as MR for the formatter
                    merge_request: true,
                  };

                  // Store MR ID and IID for later comment fetching
                  // Use negative IID to avoid conflicts with issues
                  issueMap.set(-mr.iid, { id: mr.id, iid: mr.iid });

                  stream.push({
                    recordId: `${mr.id}`,
                    targetTable: TARGET_TABLES.TICKETING_TICKET,
                    ...this.formatData(
                      TARGET_TABLES.TICKETING_TICKET,
                      ticketData as IssueSchema | MergeRequestSchema,
                    ),
                  });

                  // Extract and process users
                  const users = [];

                  // Add assignees if present
                  if (
                    mr.assignees &&
                    Array.isArray(mr.assignees) &&
                    mr.assignees.length > 0
                  ) {
                    users.push(...mr.assignees);
                  }

                  // Add author if present
                  if (mr.author) {
                    users.push(mr.author);
                  }

                  // Process unique users
                  for (const user of users) {
                    if (!userMap.has(user.id)) {
                      userMap.set(user.id, true);

                      stream.push({
                        recordId: `${user.id}`,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_USER,
                          user as UserSchema,
                        ),
                      });
                    }
                  }
                }

                page++;
              } catch (error) {
                console.error(
                  `[GitLab Sync] Error fetching closed merge requests for project ${projectId} on page ${page}:`,
                  error,
                );
                hasMoreMRs = false;
              }
            }
          }
        }

        // Fetch comments for each issue and MR
        if (issueMap.size > 0) {
          if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
            this.log(
              `[GitLab Sync] Fetching comments for project ${projectId}`,
            );

            try {
              // Process issues and MRs sequentially to be more cautious with API rate limits
              for (const [issueIid, _issueData] of issueMap.entries()) {
                try {
                  let page = 1;
                  let hasMoreComments = true;
                  const isMergeRequest = issueIid < 0;
                  const actualIid = isMergeRequest ? -issueIid : issueIid;

                  // Process all pages of comments for this issue or MR
                  while (hasMoreComments) {
                    // Use different API endpoints for issues vs merge requests
                    const comments = isMergeRequest
                      ? await gitlab.MergeRequestNotes.all(
                          projectId,
                          actualIid,
                          {
                            perPage,
                            page,
                            sort: 'asc',
                            orderBy: 'created_at',
                            pagination: 'offset',
                          },
                        )
                      : await gitlab.IssueNotes.all(projectId, actualIid, {
                          perPage,
                          page,
                          sort: 'asc',
                          orderBy: 'created_at',
                          pagination: 'offset',
                        });

                    if (comments.length === 0) {
                      hasMoreComments = false;
                      break;
                    }

                    this.log(
                      `[GitLab Sync] Fetched ${comments.length} comments for ${isMergeRequest ? 'MR' : 'issue'} #${actualIid} on page ${page}`,
                    );

                    // Process each comment
                    for (const comment of comments) {
                      // Skip system comments
                      if (comment.system) {
                        continue;
                      }

                      // Add comment to stream
                      stream.push({
                        recordId: `${comment.id}`,
                        targetTable: TARGET_TABLES.TICKETING_COMMENT,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_COMMENT,
                          comment as NoteSchema & {
                            issue?: { id: number; iid: number };
                          },
                        ),
                      });

                      // Add comment author to users if not already added
                      if (comment.author && !userMap.has(comment.author.id)) {
                        userMap.set(comment.author.id, true);

                        stream.push({
                          recordId: `${comment.author.id}`,
                          targetTable: TARGET_TABLES.TICKETING_USER,
                          ...this.formatData(
                            TARGET_TABLES.TICKETING_USER,
                            comment.author as UserSchema,
                          ),
                        });
                      }
                    }

                    page++;

                    // If we got fewer results than requested, we've reached the end
                    if (comments.length < perPage) {
                      hasMoreComments = false;
                    }
                  }
                } catch (commentError) {
                  const isMergeRequest = issueIid < 0;
                  const actualIid = isMergeRequest ? -issueIid : issueIid;
                  console.error(
                    `[GitLab Sync] Error fetching comments for ${isMergeRequest ? 'MR' : 'issue'} #${actualIid}:`,
                    commentError,
                  );
                  // Continue with the next issue/MR even if this one fails
                }
              }
            } catch (error) {
              console.error(
                '[GitLab Sync] Error in comments fetching process:',
                error,
              );
            }
          }
        }

        // All data has been processed
        stream.push(null);
      } catch (error) {
        console.error('[GitLab Sync] Error fetching data:', error);
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return stream;
  }

  public formatData(
    targetTable: TARGET_TABLES,
    data:
      | GroupSchema
      | IssueSchema
      | MergeRequestSchema
      | UserSchema
      | MemberSchema
      | NoteSchema,
  ): {
    data:
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return this.formatTicket(data as IssueSchema | MergeRequestSchema);
      case TARGET_TABLES.TICKETING_USER:
        return this.formatUser(data as UserSchema | MemberSchema);
      case TARGET_TABLES.TICKETING_COMMENT:
        return this.formatComment(
          data as NoteSchema & { issue?: { id: number; iid: number } },
        );
      case TARGET_TABLES.TICKETING_TEAM:
        return this.formatTeam(data as GroupSchema);
      default:
        throw new Error(`Unsupported table: ${targetTable}`);
    }
  }

  private formatTicket(data: IssueSchema | MergeRequestSchema): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    // Determine if this is an issue or a merge request
    const isMR = 'merge_status' in data;

    const links: Record<string, SyncLinkValue> = {};

    // Add assignee links if present
    if (
      data.assignees &&
      Array.isArray(data.assignees) &&
      data.assignees.length > 0
    ) {
      links.Assignees = data.assignees.map((assignee) =>
        (assignee.id || '').toString(),
      );
    } else if (
      data.assignee &&
      typeof data.assignee === 'object' &&
      'id' in data.assignee &&
      data.assignee.id
    ) {
      links.Assignees = [data.assignee.id.toString()];
    }

    // Add author link if present
    if (data.author && data.author.id) {
      links.Reporter = [data.author.id.toString()];
    }

    return {
      data: {
        Name: data.title || null,
        Description: data.description || null,
        'Due Date': null, // GitLab issues can have due dates, but MRs don't
        Priority: null, // GitLab doesn't have a direct priority field
        Status: this.mapIssueState(data.state || ''),
        Tags: data.labels ? data.labels.join(',') : null,
        'Ticket Type': isMR ? 'Merge Request' : 'Issue',
        Url: data.web_url || null,
        'Is Active': data.state !== 'closed',
        'Completed At': data.state === 'closed' ? data.closed_at || null : null,
        'Ticket Number': data.iid?.toString() || null,
        RemoteCreatedAt: data.created_at,
        RemoteUpdatedAt: data.updated_at,
        RemoteRaw: JSON.stringify(data),
      },
      links: Object.keys(links).length > 0 ? links : undefined,
    };
  }

  private formatUser(data: UserSchema | MemberSchema): {
    data: TicketingUserRecord;
  } {
    return {
      data: {
        Name: data.name || null,
        Email: 'email' in data && data.email ? data.email.toString() : null,
        Url: data.avatar_url || null,
        RemoteCreatedAt: null, // GitLab API doesn't expose this in user object
        RemoteUpdatedAt: null, // GitLab API doesn't expose this in user object
        RemoteRaw: JSON.stringify(data),
      },
    };
  }

  private formatComment(
    data: NoteSchema & { issue?: { id: number; iid: number } },
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const links: Record<string, SyncLinkValue> = {};

    // Link to ticket
    if (data.issue && data.issue.id) {
      links.Ticket = [data.issue.id.toString()];
    }

    // Link to author
    if (data.author && data.author.id) {
      links['Created By'] = [data.author.id.toString()];
    }

    return {
      data: {
        Title: data.author
          ? `${data.author.name || 'User'} commented on ${data.issue ? `#${data.issue.iid}` : 'issue'}`
          : `Comment on ${data.issue ? `#${data.issue.iid}` : 'issue'}`,
        Body: data.body || null,
        Url: data.web_url ? data.web_url.toString() : null,
        RemoteCreatedAt: data.created_at,
        RemoteUpdatedAt: data.updated_at,
        RemoteRaw: JSON.stringify(data),
      },
      links: Object.keys(links).length > 0 ? links : undefined,
    };
  }

  private formatTeam(data: GroupSchema): {
    data: TicketingTeamRecord;
  } {
    return {
      data: {
        Name: data.name || null,
        Description: data.description || null,
        RemoteCreatedAt: data.created_at || null,
        RemoteUpdatedAt: null, // GitLab API doesn't expose this for groups
        RemoteRaw: JSON.stringify(data),
      },
    };
  }

  private mapIssueState(state: string): string {
    switch (state.toLowerCase()) {
      case 'opened':
      case 'open':
        return 'Open';
      case 'closed':
        return 'Closed';
      case 'merged':
        return 'Merged';
      default:
        return state;
    }
  }

  public getIncrementalKey(targetTable: TARGET_TABLES): string {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_USER:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_COMMENT:
        return 'RemoteCreatedAt';
      case TARGET_TABLES.TICKETING_TEAM:
        return 'RemoteUpdatedAt';
      default:
        throw new Error(`Unsupported target table: ${targetTable}`);
    }
  }
}
