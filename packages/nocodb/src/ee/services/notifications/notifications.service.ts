import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { NotificationsService as NotificationsServiceCE } from 'src/services/notifications/notifications.service';
import { TeamUserRoles } from 'nocodb-sdk';
import type { BaseType } from 'nocodb-sdk';
import type {
  ProjectInviteEvent,
  RowCommentEvent,
  RowMentionEvent,
  TeamMemberAddEvent,
  WelcomeEvent,
  WorkspaceRequestUpgradeEvent,
  WorkspaceUserInviteEvent,
} from '~/services/app-hooks/interfaces';
import type {
  BaseTeamInviteEvent,
  WorkspaceTeamInviteEvent,
} from '~/services/app-hooks/interfaces';
import { extractMentions } from '~/utils/richTextHelper';
import { DatasService } from '~/services/datas.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  Base,
  BaseUser,
  Column,
  PrincipalAssignment,
  User,
  Workspace,
} from '~/models';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { PrincipalType, ResourceType } from '~/utils/globals';

@Injectable()
export class NotificationsService extends NotificationsServiceCE {
  constructor(
    protected readonly appHooks: AppHooksService,
    protected readonly datasService: DatasService,
    protected readonly mailService: MailService,
  ) {
    super(appHooks);
  }

  onModuleInit() {
    super.onModuleInit();
    // Explicitly set up PROJECT_INVITE to ensure it uses EE's hookHandler
    this.appHooks.on(AppEvents.PROJECT_INVITE, (data) =>
      this.hookHandler({ event: AppEvents.PROJECT_INVITE, data }),
    );
    this.appHooks.on(AppEvents.WORKSPACE_USER_INVITE, (data) =>
      this.hookHandler({ event: AppEvents.WORKSPACE_USER_INVITE, data }),
    );
    this.appHooks.on(AppEvents.COMMENT_CREATE, (data) =>
      this.hookHandler({ event: AppEvents.COMMENT_CREATE, data }),
    );
    this.appHooks.on(AppEvents.COMMENT_UPDATE, (data) =>
      this.hookHandler({ event: AppEvents.COMMENT_UPDATE, data }),
    );

    this.appHooks.on(AppEvents.ROW_USER_MENTION, (data) => {
      this.hookHandler({ event: AppEvents.ROW_USER_MENTION, data });
      // I cant call this in BaseModelSqlV2. So for now, I am keeping it here.
      this.mailService.sendMail({
        mailEvent: MailEvent.ROW_USER_MENTION,
        payload: data,
      });
    });

    this.appHooks.on(AppEvents.WORKSPACE_UPGRADE_REQUEST, (data) => {
      this.hookHandler({ event: AppEvents.WORKSPACE_UPGRADE_REQUEST, data });

      /*
        workspace: WorkspaceType;
        user: UserType;
        requester: UserType;
        req: NcRequest;
        limitOrFeature: string;
      */

      this.mailService.sendMail({
        mailEvent: MailEvent.WORKSPACE_REQUEST_UPGRADE,
        payload: data,
      });
    });

    this.appHooks.on(AppEvents.WORKSPACE_TEAM_INVITE, (data) =>
      this.hookHandler({ event: AppEvents.WORKSPACE_TEAM_INVITE, data }),
    );

    this.appHooks.on(AppEvents.PROJECT_TEAM_INVITE, (data) =>
      this.hookHandler({ event: AppEvents.PROJECT_TEAM_INVITE, data }),
    );

    this.appHooks.on(AppEvents.TEAM_MEMBER_ADD, (data) =>
      this.hookHandler({ event: AppEvents.TEAM_MEMBER_ADD, data }),
    );
  }

  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: any;
  }) {
    switch (event) {
      case AppEvents.PROJECT_INVITE:
        {
          const { base, user, invitedBy, req } = data as ProjectInviteEvent;

          const ws = await Workspace.get(base.fk_workspace_id);

          await this.insertNotification(
            {
              fk_user_id: user.id,
              type: AppEvents.PROJECT_INVITE,
              body: {
                base: {
                  id: base.id,
                  title: base.title,
                  type: base.type,
                },
                user: {
                  id: invitedBy.id,
                  email: invitedBy.email,
                  displayName: invitedBy.display_name,
                  meta: invitedBy.meta,
                },
                workspace: {
                  id: ws.id,
                  title: ws.title,
                },
              },
            },
            req,
          );
        }
        break;
      case AppEvents.WORKSPACE_USER_INVITE:
        {
          const { workspace, user, invitedBy, req } =
            data as WorkspaceUserInviteEvent;

          await this.insertNotification(
            {
              fk_user_id: user.id,
              type: AppEvents.WORKSPACE_USER_INVITE,
              body: {
                user: {
                  id: invitedBy.id,
                  email: invitedBy.email,
                  displayName: invitedBy.display_name,
                },
                workspace: {
                  id: workspace.id,
                  title: workspace.title,
                },
              },
            },
            req,
          );
        }
        break;
      case AppEvents.WELCOME:
        {
          const { user, req } = data as WelcomeEvent;

          await this.insertNotification(
            {
              fk_user_id: user.id,
              type: AppEvents.WELCOME,
              body: {},
            },
            req,
          );
        }
        break;
      case AppEvents.COMMENT_UPDATE:
      case AppEvents.COMMENT_CREATE: {
        const {
          user,
          base,
          comment,
          rowId,
          model: table,
          req,
        } = data as RowCommentEvent;
        const mentions = extractMentions(comment.comment);

        if (!mentions || !mentions.length) break;

        try {
          const row = await this.datasService.dataRead(req.context, {
            rowId: rowId,
            baseName: base.id,
            tableName: table.id,
            query: {},
          });

          const cols = await Column.list(req.context, {
            fk_model_id: table.id,
          });

          const pvc = cols.find((c) => c.pv);

          const displayValue = row[pvc?.title ?? ''] ?? '';

          const baseUsers = await BaseUser.getUsersList(req.context, {
            base_id: base.id,
          });

          const ws = await Workspace.get(base.fk_workspace_id);

          for (const mention of mentions) {
            const mentionedUser = baseUsers.find((b) => b.id === mention);
            if (!mentionedUser) continue; // Do not send notification if user is not in the base
            // If user is the same as the one who commented, do not send notification?
            // if (mentionedUser.id === user.id) continue;

            await this.insertNotification(
              {
                fk_user_id: mentionedUser.id,
                type: 'mention' as any,
                body: {
                  workspace: {
                    id: ws.id,
                    title: ws.title,
                  },
                  base: {
                    id: base.id,
                    title: base.title,
                    type: base.type,
                  },
                  table: {
                    id: table.id,
                    title: table.title,
                  },
                  row: {
                    id: rowId,
                    value: displayValue,
                    column: pvc,
                  },
                  comment: {
                    id: comment.id,
                    comment: comment.comment,
                  },
                  user: {
                    id: user.id,
                    email: user.email,
                    display_name: user.display_name,
                    meta: user.meta,
                  },
                },
              },
              req,
            );
          }
        } catch (e) {
          this.logger.error({
            error: e,
            details: 'Error while sending notifications',
            comment: comment.id,
          });
        }

        break;
      }
      case AppEvents.ROW_USER_MENTION: {
        const { user, model, column, rowId, mentions, req } =
          data as RowMentionEvent;

        const base = (await Base.get(req.context, model.base_id)) as BaseType;

        const row = await this.datasService.dataRead(req.context, {
          rowId: rowId,
          baseName: base.id,
          tableName: model.id,
          query: {},
        });

        const cols = await Column.list(req.context, {
          fk_model_id: model.id,
        });

        const pvc = cols.find((c) => c.pv);

        const displayValue = row[pvc?.title ?? ''] ?? '';

        const baseUsers = await BaseUser.getUsersList(req.context, {
          base_id: base.id,
        });

        const ws = await Workspace.get(base.fk_workspace_id);

        for (const mention of mentions) {
          const mentionedUser = baseUsers.find((u) => u.id === mention);
          if (!mentionedUser) continue;

          await this.insertNotification(
            {
              fk_user_id: mentionedUser.id,
              type: AppEvents.ROW_USER_MENTION,
              body: {
                base: {
                  id: base.id,
                  title: base.title,
                  type: base.type,
                },
                user: {
                  id: user.id,
                  email: user.email,
                  display_name: user.display_name,
                  meta: user.meta,
                },
                table: {
                  id: model.id,
                  title: model.title,
                },
                workspace: {
                  id: ws.id,
                  title: ws.title,
                },
                column: {
                  id: column.id,
                  title: column.title,
                },
                row: {
                  id: rowId,
                  value: displayValue,
                  column: pvc,
                },
              },
            },
            req,
          );
        }

        break;
      }
      case AppEvents.WORKSPACE_UPGRADE_REQUEST: {
        const { workspace, user, requester, req, limitOrFeature } =
          data as WorkspaceRequestUpgradeEvent;

        await this.insertNotification(
          {
            fk_user_id: user.id,
            type: AppEvents.WORKSPACE_UPGRADE_REQUEST,
            body: {
              workspace: {
                id: workspace.id,
                title: workspace.title,
              },
              requester: {
                email: requester.email,
                display_name: requester.display_name,
              },
              limitOrFeature,
            },
          },
          req,
        );
        break;
      }
      case AppEvents.WORKSPACE_TEAM_INVITE: {
        const { workspace, team, role, req, context } =
          data as WorkspaceTeamInviteEvent;

        // Get all team owners
        const teamAssignments = await PrincipalAssignment.list(context, {
          resource_type: ResourceType.TEAM,
          resource_id: team.id,
          principal_type: PrincipalType.USER,
        });
        const ownerAssignments = teamAssignments.filter(
          (assignment) => assignment.roles === TeamUserRoles.OWNER,
        );

        const inviter = req.user;

        // Create notifications for each team owner
        for (const ownerAssignment of ownerAssignments) {
          const owner = await User.get(ownerAssignment.principal_ref_id);
          if (owner) {
            await this.insertNotification(
              {
                fk_user_id: owner.id,
                type: AppEvents.WORKSPACE_TEAM_INVITE,
                body: {
                  workspace: {
                    id: workspace.id,
                    title: workspace.title,
                  },
                  team: {
                    id: team.id,
                    title: team.title,
                  },
                  role,
                  user: {
                    id: inviter.id,
                    email: inviter.email,
                    displayName: inviter.display_name,
                    meta: inviter.meta,
                  },
                },
              },
              req,
            );
          }
        }
        break;
      }
      case AppEvents.PROJECT_TEAM_INVITE: {
        const { base, team, role, req, context } = data as BaseTeamInviteEvent;

        // Get all team owners
        const teamAssignments = await PrincipalAssignment.list(context, {
          resource_type: ResourceType.TEAM,
          resource_id: team.id,
          principal_type: PrincipalType.USER,
        });
        const ownerAssignments = teamAssignments.filter(
          (assignment) => assignment.roles === TeamUserRoles.OWNER,
        );

        const inviter = req.user;
        const ws = await Workspace.get(base.fk_workspace_id);

        // Create notifications for each team owner
        for (const ownerAssignment of ownerAssignments) {
          const owner = await User.get(ownerAssignment.principal_ref_id);
          if (owner) {
            await this.insertNotification(
              {
                fk_user_id: owner.id,
                type: AppEvents.PROJECT_TEAM_INVITE,
                body: {
                  base: {
                    id: base.id,
                    title: base.title,
                    type: base.type,
                  },
                  workspace: {
                    id: ws.id,
                    title: ws.title,
                  },
                  team: {
                    id: team.id,
                    title: team.title,
                  },
                  role,
                  user: {
                    id: inviter.id,
                    email: inviter.email,
                    displayName: inviter.display_name,
                    meta: inviter.meta,
                  },
                },
              },
              req,
            );
          }
        }
        break;
      }
      case AppEvents.TEAM_MEMBER_ADD: {
        const { team, user, teamRole, workspace, base, req } =
          data as TeamMemberAddEvent;

        const inviter = req.user;

        // Create notification for the user who was added to the team
        await this.insertNotification(
          {
            fk_user_id: user.id,
            type: AppEvents.TEAM_MEMBER_ADD,
            body: {
              team: {
                id: team.id,
                title: team.title,
              },
              teamRole,
              workspace: workspace
                ? {
                    id: workspace.id,
                    title: workspace.title,
                  }
                : undefined,
              base: base
                ? {
                    id: base.id,
                    title: base.title,
                    type: base.type,
                  }
                : undefined,
              user: {
                id: inviter.id,
                email: inviter.email,
                displayName: inviter.display_name,
                meta: inviter.meta,
              },
            },
          },
          req,
        );
        break;
      }
    }
  }
}
