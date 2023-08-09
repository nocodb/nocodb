import { NotificationsService as NotificationsServiceCE } from 'src/services/notifications.service';
import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type {
  ProjectInviteEvent,
  WelcomeEvent,
  WorkspaceInviteEvent,
} from '~/services/app-hooks/interfaces';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Project } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class NotificationsService
  extends NotificationsServiceCE
  implements OnModuleInit, OnModuleDestroy
{
  constructor(protected readonly appHooks: AppHooksService) {
    super(appHooks);
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
          const { project, user, invitedBy } = data as ProjectInviteEvent;

          await this.insertNotification({
            fk_user_id: user.id,
            type: AppEvents.PROJECT_INVITE,
            body: {
              id: project.id,
              title: project.title,
              type: project.type,
              invited_by: invitedBy.email,
              workspace_id: (project as Project).fk_workspace_id,
            },
          });
        }
        break;
      case AppEvents.WORKSPACE_INVITE:
        {
          const { workspace, user, invitedBy } = data as WorkspaceInviteEvent;

          await this.insertNotification({
            fk_user_id: user.id,
            type: AppEvents.WORKSPACE_INVITE,
            body: {
              id: workspace.id,
              invited_by: invitedBy.email,
              title: workspace.title,
            },
          });
        }
        break;
      case AppEvents.WELCOME:
        {
          const { user } = data as WelcomeEvent;

          await this.insertNotification({
            fk_user_id: user.id,
            type: AppEvents.WELCOME,
            body: {},
          });
        }
        break;
    }
  }
}
