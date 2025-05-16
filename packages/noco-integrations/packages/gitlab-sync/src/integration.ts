import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type {
  AuthResponse,
  TicketingCommentRecord,
  TicketingTeamRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';
import type { Gitlab } from '@gitbeaker/rest';

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
    const gitlab = auth.custom as InstanceType<typeof Gitlab>;
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
                      ...this.formatData(TARGET_TABLES.TICKETING_TEAM, group),
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
                                member,
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
                ...this.formatData(TARGET_TABLES.TICKETING_TICKET, issue),
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
                    ...this.formatData(TARGET_TABLES.TICKETING_USER, user),
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
                    ticketData,
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
                      ...this.formatData(TARGET_TABLES.TICKETING_USER, user),
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
                      ticketData,
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
                        ...this.formatData(TARGET_TABLES.TICKETING_USER, user),
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
                      ticketData,
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
                        ...this.formatData(TARGET_TABLES.TICKETING_USER, user),
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
              for (const [issueIid, issueData] of issueMap.entries()) {
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

                      // Add issue/MR data to the comment
                      const commentWithIssue = {
                        ...comment,
                        issue: issueData,
                      };

                      // Add comment to stream
                      stream.push({
                        recordId: `${comment.id}`,
                        targetTable: TARGET_TABLES.TICKETING_COMMENT,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_COMMENT,
                          commentWithIssue,
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
                            comment.author,
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

  public formatData(targetTable: TARGET_TABLES, data: any) {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET: {
        const ticketData: TicketingTicketRecord = {
          Name: data.title,
          Description: data.description || null,
          Status: this.mapIssueState(data.state),
          Priority: null, // GitLab doesn't have built-in priority
          'Ticket Type': data.merge_request ? 'Merge Request' : 'Issue',
          'Ticket Url': data.web_url || null,
          'Ticket Number': data.iid,
          'Is Active': data.state !== 'closed',
          'Completed At': data.state === 'closed' ? data.closed_at : null,
          'Due Date': data.due_date || null,
          Tags: data.labels ? data.labels.join(',') : null,
          RemoteCreatedAt: data.created_at,
          RemoteUpdatedAt: data.updated_at,
          RemoteRaw: JSON.stringify(data),
        };

        const ticketLinks: Record<string, string[]> = {};

        // Add assignees links if present
        if (
          data.assignees &&
          Array.isArray(data.assignees) &&
          data.assignees.length > 0
        ) {
          ticketLinks.Assignees = data.assignees.map(
            (assignee: any) => `${assignee.id}`,
          );
        }

        // Add author link if present
        if (data.author) {
          ticketLinks.Creator = [`${data.author.id}`];
        }

        return {
          data: ticketData,
          links: ticketLinks,
        };
      }

      case TARGET_TABLES.TICKETING_USER: {
        const userData: TicketingUserRecord = {
          Name: data.name || null,
          Email: data.email || null,
          RemoteCreatedAt: data.created_at || null,
          RemoteUpdatedAt: data.updated_at || null,
          RemoteRaw: JSON.stringify(data),
        };

        return {
          data: userData,
        };
      }

      case TARGET_TABLES.TICKETING_COMMENT: {
        const commentData: TicketingCommentRecord = {
          Title: null, // GitLab comments don't have titles
          Body: data.body || null,
          RemoteCreatedAt: data.created_at,
          RemoteUpdatedAt: data.updated_at,
          RemoteRaw: JSON.stringify(data),
        };

        const commentLinks: Record<string, string[]> = {};

        // Add author link if present
        if (data.author) {
          commentLinks['Created By'] = [`${data.author.id}`];
        }

        // Add issue link
        if (data.issue) {
          commentLinks.Ticket = [`${data.issue.id}`];
        }

        return {
          data: commentData,
          links: commentLinks,
        };
      }

      case TARGET_TABLES.TICKETING_TEAM: {
        const teamData: TicketingTeamRecord = {
          Name: data.name || null,
          Description: data.description || null,
          RemoteCreatedAt: data.created_at || null,
          RemoteUpdatedAt: data.updated_at || null,
          RemoteRaw: JSON.stringify(data),
        };

        return {
          data: teamData,
        };
      }

      default:
        throw new Error(`Unsupported target table: ${targetTable}`);
    }
  }

  private mapIssueState(state: string): string {
    switch (state) {
      case 'opened':
        return 'Open';
      case 'closed':
        return 'Closed';
      default:
        return state;
    }
  }

  public getIncrementalKey(targetTable: TARGET_TABLES) {
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
