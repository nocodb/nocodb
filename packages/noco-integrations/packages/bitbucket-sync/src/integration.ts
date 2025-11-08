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
  TicketingTicketRecord,
  TicketingUserRecord,
} from '@noco-integrations/core';
import type { AxiosInstance } from 'axios';

export interface BitbucketSyncPayload {
  repos: string[];
  includeClosed: boolean;
  includePRs: boolean;
}

export default class BitbucketSyncIntegration extends SyncIntegration<BitbucketSyncPayload> {
  public getTitle() {
    return `${this.config.repos[0]}${this.config.repos.length > 1 ? ` + ${this.config.repos.length - 1} more` : ''}`;
  }

  public async getDestinationSchema(_auth: AuthResponse<AxiosInstance>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<AxiosInstance>,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: {
        [key: string]: Record<TARGET_TABLES, string>;
      };
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const axiosInstance = auth;
    const { repos, includeClosed, includePRs = false } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<SyncRecord>();

    const userMap = new Map<string, boolean>();
    const issueMap = new Map<number, { id: number; number: number; type: 'issue' | 'pr' }>();

    (async () => {
      try {
        for (const repo of repos) {
          const [workspace, repository] = repo.split('/');

          const ticketIncrementalValue =
            targetTableIncrementalValues?.[repo]?.[
              TARGET_TABLES.TICKETING_TICKET
            ];

          this.log(
            `[Bitbucket Sync] Fetching issues for repository ${workspace}/${repository}`,
          );

          // Fetch issues
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            try {
              const params: any = {
                page,
                pagelen: 50,
                sort: '-updated_on',
              };

              // Build query filter using Bitbucket query language
              const queryParts: string[] = [];

              // Add state filter
              if (!includeClosed) {
                queryParts.push('(state = "new" OR state = "open")');
              }

              // Add incremental sync filter (server-side)
              if (ticketIncrementalValue) {
                const incrementalDate = new Date(ticketIncrementalValue).toISOString();
                queryParts.push(`updated_on > ${incrementalDate}`);
              }

              // Combine query parts with AND
              if (queryParts.length > 0) {
                params.q = queryParts.join(' AND ');
              }

              const { data: issuesResponse } = await axiosInstance.get(
                `/repositories/${workspace}/${repository}/issues`,
                { params },
              );

              const issues = issuesResponse.values || [];
              
              if (issues.length === 0) {
                hasMore = false;
                break;
              }

              this.log(`[Bitbucket Sync] Fetched ${issues.length} issues (page ${page})`);

              for (const issue of issues) {

                // Store issue for later comment fetching
                issueMap.set(issue.id, {
                  id: issue.id,
                  number: issue.id,
                  type: 'issue',
                });

                stream.push({
                  recordId: `${issue.id}`,
                  targetTable: TARGET_TABLES.TICKETING_TICKET,
                  ...this.formatData(TARGET_TABLES.TICKETING_TICKET, issue, repo),
                });

                // Extract users
                const users = [...(issue.assignee ? [issue.assignee] : [])];

                if (issue.reporter) {
                  users.push(issue.reporter);
                }

                for (const user of users) {
                  if (user.uuid && !userMap.has(user.uuid)) {
                    userMap.set(user.uuid, true);

                    stream.push({
                      recordId: user.uuid,
                      targetTable: TARGET_TABLES.TICKETING_USER,
                      ...this.formatData(
                        TARGET_TABLES.TICKETING_USER,
                        user,
                        repo,
                      ),
                    });
                  }
                }
              }

              // Check if there are more pages
              if (!issuesResponse.next) {
                hasMore = false;
              } else {
                page++;
              }
            } catch (error: any) {
              // Handle 404 errors gracefully (issue tracker not enabled)
              if (error?.response?.status === 404) {
                this.log(
                  `[Bitbucket Sync] Skipping repository ${workspace}/${repository}: Issue tracker not enabled (404)`,
                );
              } else {
                console.error(
                  `[Bitbucket Sync] Error fetching issues for ${workspace}/${repository}:`,
                  error,
                );
              }
              hasMore = false;
            }
          }

          // Fetch pull requests if enabled
          if (includePRs) {
            this.log(
              `[Bitbucket Sync] Fetching pull requests for repository ${workspace}/${repository}`,
            );

            page = 1;
            hasMore = true;

            while (hasMore) {
              try {
                const params: any = {
                  page,
                  pagelen: 50,
                  sort: '-updated_on',
                };

                // Build query filter using Bitbucket query language
                const queryParts: string[] = [];

                // Add state filter
                if (!includeClosed) {
                  queryParts.push('state = "OPEN"');
                }

                // Add incremental sync filter (server-side)
                if (ticketIncrementalValue) {
                  const incrementalDate = new Date(ticketIncrementalValue).toISOString();
                  queryParts.push(`updated_on > ${incrementalDate}`);
                }

                // Combine query parts with AND
                if (queryParts.length > 0) {
                  params.q = queryParts.join(' AND ');
                }

                const { data: prsResponse } = await axiosInstance.get(
                  `/repositories/${workspace}/${repository}/pullrequests`,
                  { params },
                );

                const prs = prsResponse.values || [];
                this.log(`[Bitbucket Sync] Fetched ${prs.length} pull requests (page ${page})`);

                if (prs.length === 0) {
                  hasMore = false;
                  break;
                }

                for (const pr of prs) {

                  // Store PR for later comment fetching
                  issueMap.set(pr.id, {
                    id: pr.id,
                    number: pr.id,
                    type: 'pr',
                  });

                  stream.push({
                    recordId: `${pr.id}`,
                    targetTable: TARGET_TABLES.TICKETING_TICKET,
                    ...this.formatData(TARGET_TABLES.TICKETING_TICKET, pr, repo, true),
                  });

                  // Extract users
                  const users = [];

                  if (pr.author) {
                    users.push(pr.author);
                  }

                  if (pr.reviewers) {
                    users.push(...pr.reviewers);
                  }

                  for (const user of users) {
                    if (user.uuid && !userMap.has(user.uuid)) {
                      userMap.set(user.uuid, true);

                      stream.push({
                        recordId: user.uuid,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_USER,
                          user,
                          repo,
                        ),
                      });
                    }
                  }
                }

                // Check if there are more pages
                if (!prsResponse.next) {
                  hasMore = false;
                } else {
                  page++;
                }
              } catch (error) {
                console.error(
                  `[Bitbucket Sync] Error fetching pull requests for ${workspace}/${repository}:`,
                  error,
                );
                hasMore = false;
              }
            }
          }

          // Fetch comments if needed
          if (issueMap.size > 0 && args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
            this.log(
              `[Bitbucket Sync] Fetching comments for repository ${workspace}/${repository}`,
            );

            const commentIncrementalValue =
              targetTableIncrementalValues?.[repo]?.[
                TARGET_TABLES.TICKETING_COMMENT
              ];

            for (const [issueId, issueInfo] of issueMap) {
              try {
                page = 1;
                hasMore = true;

                // Use correct endpoint based on type
                const commentsEndpoint = issueInfo.type === 'pr'
                  ? `/repositories/${workspace}/${repository}/pullrequests/${issueId}/comments`
                  : `/repositories/${workspace}/${repository}/issues/${issueId}/comments`;

                while (hasMore) {
                  const params: any = {
                    page,
                    pagelen: 50,
                    sort: '-created_on',
                  };

                  // Add incremental sync filter
                  if (commentIncrementalValue) {
                    const incrementalDate = new Date(commentIncrementalValue).toISOString();
                    params.q = `created_on > ${incrementalDate}`;
                  }

                  const { data: commentsResponse } = await axiosInstance.get(
                    commentsEndpoint,
                    { params },
                  );

                  const comments = commentsResponse.values || [];

                  if (comments.length === 0) {
                    hasMore = false;
                    break;
                  }

                  for (const comment of comments) {

                    // Add issue info to comment
                    Object.assign(comment, {
                      issue: issueInfo,
                    });

                    stream.push({
                      recordId: `${comment.id}`,
                      targetTable: TARGET_TABLES.TICKETING_COMMENT,
                      ...this.formatData(
                        TARGET_TABLES.TICKETING_COMMENT,
                        comment,
                        repo,
                        issueInfo.type,
                      ),
                    });

                    // Add comment author to users
                    if (comment.user && comment.user.uuid && !userMap.has(comment.user.uuid)) {
                      userMap.set(comment.user.uuid, true);

                      stream.push({
                        recordId: comment.user.uuid,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_USER,
                          comment.user,
                          repo,
                        ),
                      });
                    }
                  }

                  // Check if there are more pages
                  if (!commentsResponse.next) {
                    hasMore = false;
                  } else {
                    page++;
                  }
                }
              } catch (error: any) {
                // Handle 403 errors gracefully (insufficient permissions)
                if (error?.response?.status === 403) {
                  this.log(
                    `[Bitbucket Sync] Skipping comments for issue ${issueId}: Insufficient permissions (403). Ensure your token has 'issue' scope.`,
                  );
                } else {
                  console.error(
                    `[Bitbucket Sync] Error fetching comments for issue ${issueId}:`,
                    error,
                  );
                }
              }
            }
          }
        }

        stream.push(null);
      } catch (error) {
        console.error('[Bitbucket Sync] Error fetching data:', error);
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return stream;
  }

  public formatData(
    targetTable: TARGET_TABLES,
    data: any,
    namespace?: string,
    typeOrIsPR: boolean | 'issue' | 'pr' = false,
  ): {
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        // For tickets, typeOrIsPR is a boolean (isPR)
        return this.formatTicket(data, namespace, typeOrIsPR === true);
      case TARGET_TABLES.TICKETING_USER:
        return this.formatUser(data, namespace);
      case TARGET_TABLES.TICKETING_COMMENT:
        // For comments, typeOrIsPR is the type string ('issue' | 'pr')
        return this.formatComment(data, namespace, typeOrIsPR as 'issue' | 'pr');
      default: {
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
            RemoteNamespace: namespace,
          },
        };
      }
    }
  }

  private formatTicket(
    issue: any,
    namespace?: string,
    isPR = false,
  ): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const ticketData: TicketingTicketRecord = {
      Name: issue.title,
      Description: issue.content?.raw || issue.description || null,
      'Due Date': null,
      Priority: issue.priority || '',
      Status: isPR ? issue.state : issue.state,
      Tags: null,
      'Ticket Type': isPR ? 'Pull Request' : 'Issue',
      'Ticket Number': `${issue.id}`,
      Url: issue.links?.html?.href || null,
      'Is Active': isPR 
        ? issue.state === 'OPEN' 
        : (issue.state === 'new' || issue.state === 'open'),
      'Completed At': isPR 
        ? (issue.state === 'MERGED' || issue.state === 'DECLINED' ? issue.updated_on : null)
        : (issue.state === 'resolved' || issue.state === 'closed' ? issue.updated_on : null),
      // System Fields
      RemoteCreatedAt: issue.created_on,
      RemoteUpdatedAt: issue.updated_on,
      RemoteRaw: JSON.stringify(issue),
      RemoteNamespace: namespace,
    };

    const links: Record<string, SyncLinkValue> = {};

    if (isPR) {
      // Pull request links
      if (issue.author?.uuid) {
        links.Creator = [issue.author.uuid];
      }
      if (issue.reviewers && issue.reviewers.length > 0) {
        links.Assignees = issue.reviewers
          .filter((r: any) => r.uuid)
          .map((r: any) => r.uuid);
      }
    } else {
      // Issue links
      if (issue.assignee?.uuid) {
        links.Assignees = [issue.assignee.uuid];
      }
      if (issue.reporter?.uuid) {
        links.Creator = [issue.reporter.uuid];
      }
    }

    return {
      data: ticketData,
      links: Object.keys(links).length > 0 ? links : undefined,
    };
  }

  private formatUser(
    user: any,
    namespace?: string,
  ): {
    data: TicketingUserRecord;
  } {
    const userData: TicketingUserRecord = {
      Name: user.display_name || user.username || user.nickname || 'Unknown',
      Email: null,
      Url: user.links?.html?.href || user.links?.self?.href || null,
      // System Fields
      RemoteCreatedAt: null,
      RemoteUpdatedAt: null,
      RemoteRaw: JSON.stringify(user),
      RemoteNamespace: namespace,
    };

    return {
      data: userData,
    };
  }

  private formatComment(
    comment: any,
    namespace?: string,
    type: 'issue' | 'pr' = 'issue',
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const itemType = type === 'pr' ? 'PR' : 'issue';
    const commentData: TicketingCommentRecord = {
      Title: `${comment.user?.display_name || 'User'} commented on ${itemType} #${comment.issue.number}`,
      Body: comment.content?.raw || '',
      Url: comment.links?.html?.href || null,
      // System Fields
      RemoteCreatedAt: comment.created_on,
      RemoteUpdatedAt: comment.updated_on,
      RemoteRaw: JSON.stringify(comment),
      RemoteNamespace: namespace,
    };

    return {
      data: commentData,
      links: {
        Ticket: [`${comment.issue.id}`],
        'Created By': comment.user?.uuid ? [comment.user.uuid] : null,
      },
    };
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
        return 'RemoteUpdatedAt';
    }
  }

  public getNamespaces(): string[] {
    return this.config.repos;
  }

  public async fetchOptions(auth: AuthResponse<AxiosInstance>, key: string) {
    const axiosInstance = auth;

    if (key === 'repos') {
      try {
        const options: { label: string; value: string }[] = [];

        // Fetch user's repositories
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const { data: reposResponse } = await axiosInstance.get(
            '/repositories',
            {
              params: {
                role: 'member',
                page,
                pagelen: 100,
                sort: '-updated_on',
              },
            },
          );

          const repos = reposResponse.values || [];

          for (const repo of repos) {
            options.push({
              label: repo.full_name,
              value: repo.full_name,
            });
          }

          if (!reposResponse.next || repos.length === 0) {
            hasMore = false;
          } else {
            page++;
          }
        }

        return options;
      } catch (error) {
        console.error('[Bitbucket Sync] Error fetching repositories:', error);
        return [];
      }
    }

    return [];
  }
}
