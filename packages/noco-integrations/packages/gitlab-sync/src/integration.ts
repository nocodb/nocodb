import {
  DataObjectStream,
  SCHEMA_TICKETING,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type {
  AuthResponse,
  TicketingCommentRecord,
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';
import type { Gitlab } from '@gitbeaker/rest';

export interface GitlabSyncPayload {
  projectId: string;
  includeClosed: boolean;
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
      TicketingTicketRecord | TicketingUserRecord | TicketingCommentRecord
    >
  > {
    const gitlab = auth.custom as InstanceType<typeof Gitlab>;
    const { projectId, includeClosed } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      TicketingTicketRecord | TicketingUserRecord | TicketingCommentRecord
    >();

    const userMap = new Map<number, boolean>();
    const issueMap = new Map<number, { id: number; iid: number }>();

    (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Configure issue state based on includeClosed settings
        const state = includeClosed ? 'all' : 'opened';

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
          this.log(`Fetching issues for ${projectId}`);

          try {
            const issues = await gitlab.Issues.all({
              projectId,
              state,
              updatedAfter,
              perPage,
              page,
              orderBy: 'updated_at',
              sort: 'asc',
            });

            if (issues.length === 0) {
              hasMoreIssues = false;
              break;
            }

            this.log(`Fetched ${issues.length} issues`);

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
              `Error fetching GitLab issues for page ${page}:`,
              error,
            );
            hasMoreIssues = false;
          }
        }

        // Fetch comments (notes) for each issue
        if (issueMap.size > 0) {
          if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
            this.log(`Fetching comments for ${projectId}`);

            try {
              // Process issues sequentially to be more cautious with API rate limits
              for (const [issueIid, issueData] of issueMap.entries()) {
                try {
                  let page = 1;
                  let hasMoreNotes = true;
                  
                  // Process all pages of notes for this issue
                  while (hasMoreNotes) {
                    const notes = await gitlab.IssueNotes.all(
                      projectId,
                      issueIid,
                      {
                        perPage,
                        page,
                        sort: 'asc',
                        orderBy: 'created_at',
                      }
                    );
                    
                    // If we got no notes, we've reached the end of pagination
                    if (notes.length === 0) {
                      hasMoreNotes = false;
                      break;
                    }
                    
                    // Process each note
                    for (const note of notes) {
                      // Skip system notes
                      if (note.system) {
                        continue;
                      }
                      
                      // Add issue data to the note
                      const noteWithIssue = {
                        ...note,
                        issue: issueData,
                      };
                      
                      // Add comment to stream
                      stream.push({
                        recordId: `${note.id}`,
                        targetTable: TARGET_TABLES.TICKETING_COMMENT,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_COMMENT,
                          noteWithIssue,
                        ),
                      });
                      
                      // Add comment author to users if not already added
                      if (note.author && !userMap.has(note.author.id)) {
                        userMap.set(note.author.id, true);
                        
                        stream.push({
                          recordId: `${note.author.id}`,
                          targetTable: TARGET_TABLES.TICKETING_USER,
                          ...this.formatData(
                            TARGET_TABLES.TICKETING_USER,
                            note.author,
                          ),
                        });
                      }
                    }
                    
                    // Move to the next page
                    page++;
                  }
                } catch (noteError) {
                  console.error(`Error fetching notes for issue #${issueIid}:`, noteError);
                  // Continue with the next issue even if this one fails
                }
              }
            } catch (error) {
              console.error('Error in GitLab notes fetching process:', error);
            }
          }
        }

        // All data has been processed
        stream.push(null);
      } catch (error) {
        console.error('Error fetching GitLab data:', error);
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
          'Ticket Type': null, // GitLab doesn't have built-in issue types
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
          Title: null, // GitLab notes don't have titles
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
      default:
        throw new Error(`Unsupported target table: ${targetTable}`);
    }
  }
}
