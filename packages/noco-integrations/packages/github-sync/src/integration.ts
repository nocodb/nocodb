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
import type { Octokit } from 'octokit';

export interface GithubSyncPayload {
  owner: string;
  repo: string;
  includeClosed: boolean;
  includePRs: boolean;
}

export default class GithubSyncIntegration extends SyncIntegration<GithubSyncPayload> {
  public getTitle() {
    return `${this.config.owner}/${this.config.repo}`;
  }

  public async getDestinationSchema(_auth: AuthResponse<Octokit>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<Octokit>,
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
    const octokit = auth.custom as Octokit;
    const { owner, repo, includeClosed, includePRs = false } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();
    const issueMap = new Map<number, { id: number; number: number }>();
    const teamMap = new Map<number, boolean>();

    (async () => {
      try {
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        const fetchAfter = ticketIncrementalValue;

        // Fetch teams if they're in the target tables
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          this.log(`[GitHub Sync] Fetching teams for organization ${owner}`);

          try {
            // Get all teams from the organization
            const teamsIterator = octokit.paginate.iterator(
              octokit.rest.teams.list,
              {
                org: owner,
                per_page: 100,
              },
            );

            for await (const { data: teams } of teamsIterator) {
              this.log(`[GitHub Sync] Fetched ${teams.length} teams`);

              for (const team of teams) {
                if (!teamMap.has(team.id)) {
                  teamMap.set(team.id, true);

                  // Add team to stream
                  stream.push({
                    recordId: `${team.id}`,
                    targetTable: TARGET_TABLES.TICKETING_TEAM,
                    ...this.formatData(TARGET_TABLES.TICKETING_TEAM, team),
                  });

                  // Fetch team members and add them to users if not already added
                  try {
                    const membersIterator = octokit.paginate.iterator(
                      octokit.rest.teams.listMembersInOrg,
                      {
                        org: owner,
                        team_slug: team.slug,
                        per_page: 100,
                      },
                    );

                    for await (const { data: members } of membersIterator) {
                      for (const member of members) {
                        if (!userMap.has(member.login)) {
                          userMap.set(member.login, true);

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
                          recordId: `${team.id}`,
                          targetTable: TARGET_TABLES.TICKETING_TEAM,
                          links: {
                            Members: [`${member.id}`],
                          },
                        });
                      }
                    }
                  } catch (error) {
                    console.error(
                      `[GitHub Sync] Error fetching members for team ${team.name}:`,
                      error,
                    );
                  }
                }
              }
            }
          } catch (error) {
            console.error(
              '[GitHub Sync] Error fetching teams for organization:',
              error,
            );
          }
        }

        this.log(
          `[GitHub Sync] Fetching issues for repository ${owner}/${repo}`,
        );

        const iterator = octokit.paginate.iterator(
          octokit.rest.issues.listForRepo,
          {
            owner,
            repo,
            per_page: 100,
            since: fetchAfter ? `${fetchAfter}` : undefined,
            ...(!includeClosed ? {} : { state: 'all' }),
          },
        );

        for await (const { data } of iterator) {
          this.log(`[GitHub Sync] Fetched ${data.length} issues`);

          for (const issue of data) {
            // Skip pull requests if includePRs is false
            if (!includePRs && issue.pull_request) {
              continue;
            }
            
            // Store issue ID and number for later comment fetching
            issueMap.set(issue.number, { id: issue.id, number: issue.number });

            stream.push({
              recordId: `${issue.id}`,
              targetTable: TARGET_TABLES.TICKETING_TICKET,
              ...this.formatData(TARGET_TABLES.TICKETING_TICKET, issue),
            });

            // extract users and stream
            const users = [...(issue.assignees || [])];

            if (issue.user) {
              users.push(issue.user);
            }

            for (const user of users) {
              if (!userMap.has(user.login)) {
                userMap.set(user.login, true);

                /*
                // TODO: enable for email sync
                try {
                  // Fetch user details to get public email
                  const { data: userData } =
                    await octokit.rest.users.getByUsername({
                      username: user.login,
                    });

                  email = userData.email || null;
                } catch (error) {
                  console.error(
                    `Error fetching details for user ${user.login}:`,
                    error,
                  );
                } */

                stream.push({
                  recordId: `${user.id}`,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  ...this.formatData(TARGET_TABLES.TICKETING_USER, user),
                });
              }
            }
          }
        }

        if (issueMap.size > 0) {
          if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
            this.log(
              `[GitHub Sync] Fetching comments for repository ${owner}/${repo}`,
            );

            try {
              // Fetch issue comments for the repository
              const commentsIterator = octokit.paginate.iterator(
                octokit.rest.issues.listCommentsForRepo,
                {
                  owner,
                  repo,
                  per_page: 100,
                  // TODO incremental comments
                },
              );

              for await (const { data: comments } of commentsIterator) {
                for (const comment of comments) {
                  // Extract issue number from the issue_url
                  // Format: https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}
                  const issueUrlParts = comment.issue_url.split('/');
                  const issueNumber = parseInt(
                    issueUrlParts[issueUrlParts.length - 1],
                    10,
                  );

                  const issue = issueMap.get(issueNumber);

                  if (issue) {
                    Object.assign(comment, {
                      issue,
                    });

                    // Add comment to stream
                    stream.push({
                      recordId: `${comment.id}`,
                      targetTable: TARGET_TABLES.TICKETING_COMMENT,
                      ...this.formatData(
                        TARGET_TABLES.TICKETING_COMMENT,
                        comment,
                      ),
                    });

                    // Add comment author to users if not already added
                    if (comment.user && !userMap.has(comment.user.login)) {
                      userMap.set(comment.user.login, true);

                      stream.push({
                        recordId: `${comment.user.id}`,
                        targetTable: TARGET_TABLES.TICKETING_USER,
                        ...this.formatData(
                          TARGET_TABLES.TICKETING_USER,
                          comment.user,
                        ),
                      });
                    }
                  }
                }
              }
            } catch (error) {
              console.error(
                '[GitHub Sync] Error fetching comments for repository:',
                error,
              );
            }
          }
        }

        stream.push(null);
      } catch (error) {
        console.error('[GitHub Sync] Error fetching data:', error);
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
        const issue = data as Awaited<
          ReturnType<Octokit['rest']['issues']['listForRepo']>
        >['data'][0];
        return {
          data: {
            Name: issue.title,
            Status: issue.state,
            Description: issue.body || null,
            'Ticket Type': issue.pull_request ? 'Pull Request' : 'Issue',
            'Ticket Number': issue.number,
            Tags:
              issue.labels
                ?.map((label) =>
                  typeof label === 'string' ? label : label.name || '',
                )
                .join(', ') || '',
            'Completed At': issue.closed_at,
            'Ticket Url': issue.html_url,
            'Due Date': null,
            Priority: '',
            'Is Active': issue.state === 'open',
            // System Fields
            RemoteCreatedAt: issue.created_at,
            RemoteUpdatedAt: issue.updated_at,
            RemoteRaw: JSON.stringify(issue),
          },
          // Link values
          links: {
            Assignees:
              issue.assignees?.map((assignee) => `${assignee.id}`) || [],
            Creator: issue.user?.id ? [`${issue.user.id}`] : [],
          },
        };
      }
      case TARGET_TABLES.TICKETING_USER: {
        const user = data as Awaited<
          ReturnType<Octokit['rest']['users']['getByUsername']>
        >['data'];
        return {
          data: {
            Name: user.login,
            Email: user.email || null,
            Url: user.html_url,
            // System Fields
            RemoteRaw: JSON.stringify(user),
          },
        };
      }
      case TARGET_TABLES.TICKETING_COMMENT: {
        const comment = data as Awaited<
          ReturnType<Octokit['rest']['issues']['listCommentsForRepo']>
        >['data'][0] & { issue: { id: number; number: number } };
        return {
          data: {
            Title: `${comment.user?.login} commented on issue #${comment.issue.number}`,
            Body: comment.body || '',
            Url: comment.html_url,
            // System Fields
            RemoteCreatedAt: comment.created_at,
            RemoteUpdatedAt: comment.updated_at,
            RemoteRaw: JSON.stringify(comment),
          },
          // Link values
          links: {
            Ticket: [`${comment.issue.id}`],
            'Created By': comment.user?.id ? [`${comment.user.id}`] : [],
          },
        };
      }
      case TARGET_TABLES.TICKETING_TEAM: {
        const team = data as Awaited<
          ReturnType<Octokit['rest']['teams']['list']>
        >['data'][0];
        return {
          data: {
            Name: team.name,
            Description: team.description || '',
            // System Fields
            RemoteRaw: JSON.stringify(team),
          },
        };
      }
      default:
        return data;
    }
  }

  public getIncrementalKey(targetTable: TARGET_TABLES) {
    switch (targetTable) {
      case TARGET_TABLES.TICKETING_TICKET:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_USER:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_COMMENT:
        return 'RemoteUpdatedAt';
      case TARGET_TABLES.TICKETING_TEAM:
        return 'RemoteUpdatedAt';
      default:
        return 'RemoteUpdatedAt';
    }
  }
}
