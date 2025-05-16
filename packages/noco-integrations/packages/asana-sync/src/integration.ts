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
import type * as asana from 'asana';

export interface AsanaSyncPayload {
  projectId: string;
  includeCompleted: boolean;
  includeSubtasks: boolean;
}

interface AsanaTask {
  gid: string;
  name: string;
  resource_type: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  modified_at: string;
  due_on?: string;
  notes?: string;
  assignee?: AsanaUser;
  tags?: AsanaTag[];
  memberships?: AsanaMembership[];
  parent?: { gid: string };
  subtasks?: AsanaTask[];
}

interface AsanaUser {
  gid: string;
  resource_type: string;
  name: string;
  email?: string;
}

interface AsanaComment {
  gid: string;
  resource_type: string;
  created_at: string;
  text: string;
  html_text?: string;
  created_by: AsanaUser;
}

interface AsanaTag {
  gid: string;
  name: string;
}

interface AsanaProject {
  gid: string;
  name: string;
  resource_type: string;
  notes?: string;
  created_at: string;
  modified_at: string;
  team?: AsanaTeam;
}

interface AsanaTeam {
  gid: string;
  name: string;
  resource_type: string;
}

interface AsanaMembership {
  project: AsanaProject;
  section?: {
    gid: string;
    name: string;
  };
}

export default class AsanaSyncIntegration extends SyncIntegration<AsanaSyncPayload> {
  public getTitle() {
    return `${this.config.projectId}`;
  }

  public async getDestinationSchema(_auth: AuthResponse<asana.Client>) {
    return SCHEMA_TICKETING;
  }

  public async fetchData(
    auth: AuthResponse<asana.Client>,
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
    const client = auth.custom as asana.Client;
    const { projectId, includeCompleted, includeSubtasks } = this.config;
    const { targetTableIncrementalValues } = args;

    const stream = new DataObjectStream<
      | TicketingTicketRecord
      | TicketingUserRecord
      | TicketingCommentRecord
      | TicketingTeamRecord
    >();

    const userMap = new Map<string, boolean>();
    const taskMap = new Map<string, AsanaTask>();

    (async () => {
      try {
        // Get the incremental sync value if available
        const ticketIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        // Fetch project details
        this.log(`[Asana Sync] Fetching project with ID ${projectId}`);

        const project = (await client.projects.findById(projectId, {
          opt_fields: 'gid,name,notes,created_at,modified_at,team,team.name',
        })) as unknown as AsanaProject;

        this.log(`[Asana Sync] Found project: ${project.name}`);

        // Add project as team if requested
        if (args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM)) {
          if (project.team) {
            const teamData = this.formatTeam(project.team);
            stream.push({
              recordId: project.team.gid,
              targetTable: TARGET_TABLES.TICKETING_TEAM,
              data: teamData.data as TicketingTeamRecord,
            });
          }

          // Also add the project itself as a team
          const projectTeamData = this.formatTeam({
            gid: project.gid,
            name: project.name,
            resource_type: 'team', // Using 'team' for consistent processing
          });

          stream.push({
            recordId: project.gid,
            targetTable: TARGET_TABLES.TICKETING_TEAM,
            data: projectTeamData.data as TicketingTeamRecord,
          });
        }

        // Build the query parameters for tasks
        const taskParams: any = {
          project: projectId,
          opt_fields:
            'gid,name,completed,completed_at,created_at,modified_at,due_on,notes,assignee,tags,memberships,parent,subtasks',
        };

        // Apply filters
        if (!includeCompleted) {
          taskParams.completed = false;
        }

        // Apply incremental sync if available
        if (ticketIncrementalValue) {
          taskParams.modified_since = new Date(
            ticketIncrementalValue,
          ).toISOString();
        }

        // Fetch tasks for the project
        this.log(`[Asana Sync] Fetching tasks for project ${projectId}`);

        const tasks = (await client.tasks.findByProject(
          projectId,
          taskParams,
        )) as unknown as { data: AsanaTask[] };

        this.log(`[Asana Sync] Fetched ${tasks.data.length} tasks`);

        // Process each task
        for (const task of tasks.data) {
          // Skip subtasks if not requested and this is a subtask
          if (!includeSubtasks && task.parent) {
            continue;
          }

          // Store task for later reference (e.g., for comments)
          taskMap.set(task.gid, task);

          // Process and add task
          const taskData = this.formatTicket(task);
          stream.push({
            recordId: task.gid,
            targetTable: TARGET_TABLES.TICKETING_TICKET,
            data: taskData.data as TicketingTicketRecord,
            links: taskData.links,
          });

          // Process assignee if available
          if (task.assignee && !userMap.has(task.assignee.gid)) {
            userMap.set(task.assignee.gid, true);

            const userData = this.formatUser(task.assignee);
            stream.push({
              recordId: task.assignee.gid,
              targetTable: TARGET_TABLES.TICKETING_USER,
              data: userData.data as TicketingUserRecord,
            });
          }

          // Fetch and process comments if needed
          if (args.targetTables?.includes(TARGET_TABLES.TICKETING_COMMENT)) {
            try {
              const stories = (await client.tasks.stories(task.gid, {
                opt_fields:
                  'gid,resource_type,created_at,text,html_text,created_by',
              })) as unknown as { data: AsanaComment[] };

              this.log(
                `[Asana Sync] Fetched ${stories.data.length} comments for task ${task.gid}`,
              );

              // Filter for comment-type stories only
              const comments = stories.data.filter(
                (story) => story.resource_type === 'story' && story.text,
              );

              for (const comment of comments) {
                const commentData = this.formatComment(comment, task.gid);
                stream.push({
                  recordId: comment.gid,
                  targetTable: TARGET_TABLES.TICKETING_COMMENT,
                  data: commentData.data as TicketingCommentRecord,
                  links: commentData.links,
                });

                // Process comment author
                if (
                  comment.created_by &&
                  !userMap.has(comment.created_by.gid)
                ) {
                  userMap.set(comment.created_by.gid, true);

                  const userData = this.formatUser(comment.created_by);
                  stream.push({
                    recordId: comment.created_by.gid,
                    targetTable: TARGET_TABLES.TICKETING_USER,
                    data: userData.data as TicketingUserRecord,
                  });
                }
              }
            } catch (error) {
              this.log(
                `[Asana Sync] Error fetching comments for task ${task.gid}: ${error}`,
              );
            }
          }

          // Process subtasks if requested
          if (includeSubtasks && task.subtasks && task.subtasks.length > 0) {
            for (const subtaskRef of task.subtasks) {
              try {
                // Fetch full subtask details
                const subtask = (await client.tasks.findById(subtaskRef.gid, {
                  opt_fields:
                    'gid,name,completed,completed_at,created_at,modified_at,due_on,notes,assignee,tags,memberships,parent',
                })) as unknown as AsanaTask;

                // Store subtask for later reference
                taskMap.set(subtask.gid, subtask);

                // Process and add subtask
                const subtaskData = this.formatTicket(subtask);
                stream.push({
                  recordId: subtask.gid,
                  targetTable: TARGET_TABLES.TICKETING_TICKET,
                  data: subtaskData.data as TicketingTicketRecord,
                  links: subtaskData.links,
                });

                // Process assignee if available
                if (subtask.assignee && !userMap.has(subtask.assignee.gid)) {
                  userMap.set(subtask.assignee.gid, true);

                  const userData = this.formatUser(subtask.assignee);
                  stream.push({
                    recordId: subtask.assignee.gid,
                    targetTable: TARGET_TABLES.TICKETING_USER,
                    data: userData.data as TicketingUserRecord,
                  });
                }
              } catch (error) {
                this.log(
                  `[Asana Sync] Error fetching subtask ${subtaskRef.gid}: ${error}`,
                );
              }
            }
          }
        }

        // Fetch project members if needed
        if (
          args.targetTables?.includes(TARGET_TABLES.TICKETING_TEAM) &&
          args.targetTables?.includes(TARGET_TABLES.TICKETING_USER)
        ) {
          try {
            const members = (await client.projects.memberships(projectId, {
              opt_fields: 'user,user.name,user.email',
            })) as unknown as { data: { user: AsanaUser }[] };

            this.log(
              `[Asana Sync] Fetched ${members.data.length} members for project ${projectId}`,
            );

            for (const membership of members.data) {
              const member = membership.user;

              if (!userMap.has(member.gid)) {
                userMap.set(member.gid, true);

                const userData = this.formatUser(member);
                stream.push({
                  recordId: member.gid,
                  targetTable: TARGET_TABLES.TICKETING_USER,
                  data: userData.data as TicketingUserRecord,
                });
              }

              // Link member to project team
              stream.push({
                recordId: project.gid,
                targetTable: TARGET_TABLES.TICKETING_TEAM,
                links: {
                  Members: [member.gid],
                },
              });
            }
          } catch (error) {
            this.log(`[Asana Sync] Error fetching project members: ${error}`);
          }
        }

        stream.push(null); // End the stream
      } catch (error) {
        this.log(`[Asana Sync] Error fetching data: ${error}`);
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
        return this.formatComment(data, '');
      case TARGET_TABLES.TICKETING_TEAM:
        return this.formatTeam(data);
      default: {
        // Default case should return a valid SyncRecord
        const now = new Date().toISOString();
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
            RemoteSyncedAt: now,
          },
        };
      }
    }
  }

  private formatTicket(task: AsanaTask): {
    data: TicketingTicketRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const now = new Date().toISOString();

    // Extract status from memberships if available
    let status = task.completed ? 'Completed' : 'Open';
    if (
      task.memberships &&
      task.memberships.length > 0 &&
      task.memberships[0].section
    ) {
      status = task.memberships[0].section.name;
    }

    // Format tags
    let tags = null;
    if (task.tags && task.tags.length > 0) {
      tags = task.tags.map((tag) => tag.name).join(', ');
    }

    // Determine if task is a subtask
    const isSubtask = !!task.parent;

    const ticket: TicketingTicketRecord = {
      Name: task.name,
      Description: task.notes || null,
      'Due Date': task.due_on || null,
      Priority: null, // Asana doesn't have built-in priorities
      Status: status,
      Tags: tags,
      'Ticket Type': isSubtask ? 'Subtask' : 'Task',
      Url: `https://app.asana.com/0/${task.memberships?.[0]?.project.gid || this.config.projectId}/${task.gid}`,
      'Is Active': !task.completed,
      'Completed At': task.completed_at || null,
      'Ticket Number': task.gid,
      RemoteCreatedAt: task.created_at,
      RemoteUpdatedAt: task.modified_at,
      RemoteRaw: JSON.stringify(task),
      RemoteSyncedAt: now,
    };

    const links: Record<string, string[]> = {};

    if (task.assignee) {
      links.Assignees = [task.assignee.gid];
    }

    // Link parent task if this is a subtask
    if (task.parent) {
      links.Parent = [task.parent.gid];
    }

    return {
      data: ticket,
      links,
    };
  }

  private formatUser(user: AsanaUser): {
    data: TicketingUserRecord;
  } {
    const now = new Date().toISOString();

    const userData: TicketingUserRecord = {
      Name: user.name || null,
      Email: user.email || null,
      Url: `https://app.asana.com/0/users/${user.gid}`,
      RemoteCreatedAt: null, // Asana API doesn't provide this
      RemoteUpdatedAt: null, // Asana API doesn't provide this
      RemoteRaw: JSON.stringify(user),
      RemoteSyncedAt: now,
    };

    return {
      data: userData,
    };
  }

  private formatComment(
    comment: AsanaComment,
    taskId: string,
  ): {
    data: TicketingCommentRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const now = new Date().toISOString();

    const commentData: TicketingCommentRecord = {
      Title: `${comment.created_by?.name || 'User'} commented on task #${taskId}`,
      Body: comment.html_text || comment.text || null,
      Url: null, // Asana API doesn't provide direct comment URLs
      RemoteCreatedAt: comment.created_at,
      RemoteUpdatedAt: null, // Asana API doesn't provide this for comments
      RemoteRaw: JSON.stringify(comment),
      RemoteSyncedAt: now,
    };

    const links: Record<string, string[]> = {};

    if (taskId) {
      links.Ticket = [taskId];
    }

    if (comment.created_by) {
      links['Created By'] = [comment.created_by.gid];
    }

    return {
      data: commentData,
      links,
    };
  }

  private formatTeam(team: AsanaTeam): {
    data: TicketingTeamRecord;
  } {
    const now = new Date().toISOString();

    const teamData: TicketingTeamRecord = {
      Name: team.name || null,
      Description: null, // Asana API doesn't provide this for teams
      RemoteCreatedAt: null, // Asana API doesn't provide this for teams
      RemoteUpdatedAt: null, // Asana API doesn't provide this for teams
      RemoteRaw: JSON.stringify(team),
      RemoteSyncedAt: now,
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
        return 'RemoteCreatedAt'; // Comments don't have updated_at in Asana
      case TARGET_TABLES.TICKETING_USER:
      case TARGET_TABLES.TICKETING_TEAM:
      default:
        return '';
    }
  }
}
