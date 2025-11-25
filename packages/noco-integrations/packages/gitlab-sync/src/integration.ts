import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type { GitlabAuthIntegration } from '@noco-integrations/gitlab-auth';
import type {
  SyncLinkValue,
  TicketingCommentRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';
import type {
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

  public async getDestinationSchema(_auth: GitlabAuthIntegration) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: GitlabAuthIntegration,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<
    DataObjectStream<
      TicketingTicketRecord | TicketingUserRecord | TicketingCommentRecord
    >
  > {
    const { projectId, includeClosed, includeMRs = false } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      TicketingTicketRecord | TicketingUserRecord | TicketingCommentRecord
    >();
    const userMap = new Map<number, boolean>();
    const issueMap = new Map<number, { id: number; iid: number }>();

    void (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Configure issue state based on includeClosed settings
        const state = !includeClosed ? 'opened' : 'all';

        // GitLab API uses pagination
        const perPage = 100;
        let page = 1;
        let hasMoreIssues = true;

        // Update dates for incremental sync if needed
        let updatedAfter = undefined;
        if (ticketIncrementalValue) {
          updatedAfter = new Date(ticketIncrementalValue).toISOString();
        }

        this.log(`[GitLab Sync] Fetching issues for project ${projectId}`);

        // Fetch all issues with pagination
        while (hasMoreIssues) {
          try {
            const issues = await auth.use(async (gitlab) => {
              return await gitlab.Issues.all({
                projectId,
                state,
                updatedAfter,
                perPage,
                page,
                orderBy: 'updated_at',
                sort: 'asc',
                pagination: 'offset',
              });
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

            // If we got fewer results than requested, we've reached the end
            if (issues.length < perPage) {
              hasMoreIssues = false;
            }
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

          // Fetch MRs with different states
          const mrStates = includeClosed
            ? ['opened', 'merged', 'closed']
            : ['opened'];

          for (const mrState of mrStates) {
            let page = 1;
            let hasMoreMRs = true;

            while (hasMoreMRs) {
              try {
                const mergeRequests = await auth.use(async (gitlab) => {
                  return await gitlab.MergeRequests.all({
                    projectId,
                    state: mrState as 'opened' | 'closed' | 'merged',
                    updatedAfter,
                    perPage,
                    page,
                    orderBy: 'updated_at',
                    sort: 'asc',
                    pagination: 'offset',
                  });
                });

                if (mergeRequests.length === 0) {
                  hasMoreMRs = false;
                  break;
                }

                this.log(
                  `[GitLab Sync] Fetched ${mergeRequests.length} ${mrState} merge requests on page ${page}`,
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

                // If we got fewer results than requested, we've reached the end
                if (mergeRequests.length < perPage) {
                  hasMoreMRs = false;
                }
              } catch (error) {
                console.error(
                  `[GitLab Sync] Error fetching ${mrState} merge requests for project ${projectId} on page ${page}:`,
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

            const commentIncrementalValue =
              targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_COMMENT];

            try {
              // Process issues and MRs sequentially
              for (const [issueIid, issueData] of issueMap.entries()) {
                try {
                  let page = 1;
                  let hasMoreComments = true;
                  const isMergeRequest = issueIid < 0;
                  const actualIid = isMergeRequest ? -issueIid : issueIid;

                  // Process all pages of comments for this issue or MR
                  while (hasMoreComments) {
                    const comments = await auth.use(async (gitlab) => {
                      return isMergeRequest
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

                      // Skip comments before incremental value if specified
                      if (
                        commentIncrementalValue &&
                        comment.created_at &&
                        new Date(comment.created_at as string) <=
                          new Date(commentIncrementalValue)
                      ) {
                        continue;
                      }

                      // Attach issue data to comment
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
                          commentWithIssue as NoteSchema & {
                            issue: { id: number; iid: number };
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
      | IssueSchema
      | MergeRequestSchema
      | UserSchema
      | MemberSchema
      | NoteSchema,
  ): {
    data: TicketingTicketRecord | TicketingUserRecord | TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return this.formatTicket(data as IssueSchema | MergeRequestSchema);
      case TARGET_TABLES.TICKETING_USER:
        return this.formatUser(data as UserSchema | MemberSchema);
      case TARGET_TABLES.TICKETING_COMMENT:
        return this.formatComment(
          data as NoteSchema & { issue: { id: number; iid: number } },
        );
      default:
        throw new Error(`Unsupported table: ${targetTable}`);
    }
  }

  private formatTicket(data: IssueSchema | MergeRequestSchema): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    // Determine if this is an issue or a merge request
    const isMR = 'merge_status' in data || 'merge_request' in data;

    const links: Record<string, SyncLinkValue> = {};

    // Add assignee links if present
    if (
      data.assignees &&
      Array.isArray(data.assignees) &&
      data.assignees.length > 0
    ) {
      links.Assignees = data.assignees
        .filter((assignee) => assignee.id)
        .map((assignee) => `${assignee.id}`);
    } else if (
      data.assignee &&
      typeof data.assignee === 'object' &&
      'id' in data.assignee &&
      data.assignee.id
    ) {
      links.Assignees = [`${data.assignee.id}`];
    }

    // Add author link if present
    if (data.author && data.author.id) {
      links.Creator = [`${data.author.id}`];
    }

    const ticketData: TicketingTicketRecord = {
      Name: data.title || null,
      Description: data.description || null,
      'Due Date': null,
      Priority: null,
      Status: this.mapIssueState(data.state || ''),
      Tags: data.labels ? data.labels.join(', ') : null,
      'Ticket Type': isMR ? 'Merge Request' : 'Issue',
      'Ticket Number': data.iid?.toString() || null,
      Url: data.web_url || null,
      'Is Active': data.state !== 'closed' && data.state !== 'merged',
      'Completed At':
        data.state === 'closed' || data.state === 'merged'
          ? data.closed_at || null
          : null,
      // System Fields
      RemoteCreatedAt: data.created_at,
      RemoteUpdatedAt: data.updated_at,
      RemoteRaw: JSON.stringify(data),
    };

    return {
      data: ticketData,
      links: Object.keys(links).length > 0 ? links : undefined,
    };
  }

  private formatUser(data: UserSchema | MemberSchema): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: data.name || data.username,
      Email: (data.email as string) || (data.public_email as string) || null,
      Url: data.web_url || null,
      // System Fields
      RemoteCreatedAt: null,
      RemoteUpdatedAt: null,
      RemoteRaw: JSON.stringify(data),
    };

    return {
      data: userData,
    };
  }

  private formatComment(
    data: NoteSchema & { issue: { id: number; iid: number } },
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const links: Record<string, SyncLinkValue> = {};

    // Link to ticket
    if (data.issue && data.issue.id) {
      links.Ticket = [`${data.issue.id}`];
    }

    // Link to author
    if (data.author && data.author.id) {
      links['Created By'] = [`${data.author.id}`];
    }

    const commentData: TicketingCommentRecord = {
      Title: data.author
        ? `${data.author.name || data.author.username || 'User'} commented on ${data.issue ? `#${data.issue.iid}` : 'issue'}`
        : `Comment on ${data.issue ? `#${data.issue.iid}` : 'issue'}`,
      Body: data.body || '',
      Url: data.web_url ? data.web_url.toString() : null,
      // System Fields
      RemoteCreatedAt: data.created_at,
      RemoteUpdatedAt: data.updated_at,
      RemoteRaw: JSON.stringify(data),
    };

    return {
      data: commentData,
      links: Object.keys(links).length > 0 ? links : undefined,
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
        return 'RemoteCreatedAt';
      default:
        return 'RemoteUpdatedAt';
    }
  }
}
