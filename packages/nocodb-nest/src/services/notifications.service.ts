import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { Notification } from '../models';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { MetaService } from '../meta/meta.service';
import { AppHooksService } from './app-hooks/app-hooks.service';
import { ClickhouseService } from './clickhouse/clickhouse.service';
import type {
  ColumnEvent,
  FilterEvent,
  ProjectInviteEvent,
  SortEvent,
  TableEvent,
  ViewEvent,
  WelcomeEvent,
  WorkspaceEvent,
  WorkspaceInviteEvent,
} from './app-hooks/interfaces';
import type { Project } from '../models';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { NotificationType, UserType } from 'nocodb-sdk';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly appHooks: AppHooksService,
    private clickhouseService: ClickhouseService,
    private metaService: MetaService,
  ) {}

  private async insertNotification(insertData: NotificationType) {
    this.appHooks.emit('notification', insertData);
    // await Notification.insert(insertData as Notification);

    // Define the values to insert
    const id = this.metaService.genNanoid('');
    const body = JSON.stringify(insertData.body);
    const type = insertData.type;
    const isRead = false;
    const isDeleted = false;
    const fkUserId = insertData.fk_user_id;

    // Define the SQL query to insert the row
    const query = `
  INSERT INTO database.notification (id, body, type, is_read, is_deleted, fk_user_id)
  VALUES ('${id}', '${body}', '${type}', ${isRead}, ${isDeleted}, '${fkUserId}')
`;

    await this.clickhouseService.execute(query, true);
  }

  private async hookHandler(event: AppEvents, data: any) {
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
      case AppEvents.PROJECT_CREATE:
      case AppEvents.PROJECT_UPDATE:
      case AppEvents.PROJECT_DELETE:
        {
          const { project, user, invitedBy } = data as ProjectInviteEvent;

          await this.insertNotification({
            fk_user_id: user.id,
            type: event,
            body: {
              id: project.id,
              title: project.title,
              type: project.type,
              workspace_id: (project as Project).fk_workspace_id,
            },
          });
        }
        break;
      case AppEvents.WORKSPACE_CREATE:
      case AppEvents.WORKSPACE_UPDATE:
      case AppEvents.WORKSPACE_DELETE:
        {
          const { workspace, user } = data as WorkspaceEvent;

          await this.insertNotification({
            fk_user_id: user.id,
            type: event,
            body: {
              id: workspace.id,
              title: workspace.title,
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
      case AppEvents.FILTER_CREATE:
      case AppEvents.FILTER_UPDATE:
      case AppEvents.FILTER_DELETE:
        {
          // const { filter, user } = data as FilterEvent;
          //
          // await this.insertNotification({
          //   fk_user_id: user.id,
          //   type: event,
          //   body: {
          //     id: filter.id,
          //   },
          // });
        }
        break;
      case AppEvents.SORT_CREATE:
      case AppEvents.SORT_UPDATE:
      case AppEvents.SORT_DELETE:
        {
          // const { user, sort } = data as SortEvent;
          //
          // await this.insertNotification({
          //   fk_user_id: user.id,
          //   type: event,
          //   body: {
          //     id: sort.id,
          //   },
          // });
        }
        break;
      case AppEvents.TABLE_CREATE:
      case AppEvents.TABLE_UPDATE:
      case AppEvents.TABLE_DELETE:
        {
          const { user, table } = data as TableEvent;

          await this.insertNotification({
            fk_user_id: user.id,
            type: event,
            body: {
              title: table.title,
              project_id: table.project_id,
              base_id: table.base_id,
              id: table.id,
            },
          });
        }
        break;
      case AppEvents.VIEW_CREATE:
      case AppEvents.VIEW_UPDATE:
      case AppEvents.VIEW_DELETE:
      case AppEvents.SHARED_VIEW_CREATE:
      case AppEvents.SHARED_VIEW_UPDATE:
      case AppEvents.SHARED_VIEW_DELETE:
        {
          const { user, view } = data as ViewEvent;
          const insertData = {
            fk_user_id: user.id,
            type: event,
            body: {
              title: view.title,
              project_id: view.project_id,
              base_id: view.base_id,
              id: view.id,
              fk_model_id: view.fk_model_id,
            },
          };
          this.insertNotification(insertData);
        }
        break;
      case AppEvents.COLUMN_CREATE:
      case AppEvents.COLUMN_UPDATE:
      case AppEvents.COLUMN_DELETE:
        {
          const { user, column } = data as ColumnEvent;

          await this.insertNotification({
            fk_user_id: user.id,
            type: event,
            body: {
              title: column.title,
              // todo: update in swagger
              project_id: column['project_id'],
              base_id: column.base_id,
              id: column.id,
              fk_model_id: column.fk_model_id,
            },
          });
        }
        break;
    }
  }

  // todo: verify if this is the right way to do it, since we are binding this context to the handler
  onModuleDestroy() {
    this.appHooks.removeAllListener(this.hookHandler);
  }

  onModuleInit() {
    this.appHooks.onAll(this.hookHandler.bind(this));
  }

  async notificationList(param: {
    user: UserType;
    limit?: number;
    offset?: number;
    is_read?: boolean;
    is_deleted?: boolean;
  }) {
    // Define the pagination parameters
    const { limit = 10, offset = 0 } = param; // Number of rows to skip before returning results

    // Define the SQL query with pagination parameters
    const query = `
  SELECT *
  FROM database.notification
  WHERE fk_user_id = '${param.user.id}'
  ORDER BY created_at DESC
  LIMIT ${limit}
  OFFSET ${offset}`;

    const list = await this.clickhouseService.execute(query);

    // const list = await Notification.list({
    //   fk_user_id: param.user.id,
    //   limit: param.limit,
    //   offset: param.offset,
    //   // is_read: param.is_read,
    //   is_deleted: param.is_deleted,
    // });

    const countQuery = `
  SELECT count(id) as count
  FROM database.notification        
  WHERE fk_user_id = '${param.user.id}'
  AND is_deleted = false    
    `;
    const count = (await this.clickhouseService.execute(countQuery))?.[0]?.count;

    //
    // const count = await Notification.count({
    //   fk_user_id: param.user.id,
    //   limit: param.limit,
    //   offset: param.offset,
    //   // is_read: param.is_read,
    //   is_deleted: param.is_deleted,
    // });

    const unreadCountQuery = `
  SELECT count(id) as count
  FROM database.notification
  WHERE fk_user_id = '${param.user.id}'
  AND is_read = false
  AND is_deleted = false    
    `;

    // const unreadCount = await Notification.count({
    //   fk_user_id: param.user.id,
    //   limit: param.limit,
    //   offset: param.offset,
    //   is_read: false,
    //   is_deleted: param.is_deleted,
    // });

    const unreadCount =( await this.clickhouseService.execute(unreadCountQuery))?.[0]?.count;

    return new PagedResponseImpl(
      list,
      {
        limit: param.limit,
        offset: param.offset,
        count,
      },
      { unreadCount },
    );
  }

 async notificationUpdate(param: { notificationId: string; body; user: any }) {
    // return Notification.update(
    //   {
    //     id: param.notificationId,
    //     fk_user_id: param.user.id,
    //   },
    //   param.body,
    // );

    const existingRecord = await this.clickhouseService.execute(`
    SELECT *
    FROM database.notification
    WHERE id = '${param.notificationId}'
    AND fk_user_id = '${param.user.id}'
    `);

    if (existingRecord) {
      return this.clickhouseService.execute(`
        INSERT INTO database.notification
        (id, fk_user_id, type, body, is_read, is_deleted, created_at, updated_at)
        VALUES (
          '${param.notificationId}',
          '${param.user.id}',
          '${existingRecord.type}',
          '${param.body}',
          ${existingRecord.is_read},
          ${existingRecord.is_deleted},
          '${existingRecord.created_at}',
          '${existingRecord.updated_at}'
        )`);
    }
  }

  // // soft delete
  // notificationDelete(param: { notificationId: string; user: UserType }) {
  //   return Notification.update(param.notificationId, {
  //     is_deleted: true,
  //   });
  // }

  //   // todo: validation
  //   notificationDelete(param: { notificationId: string; user: UserType }) {
  //     return;
  //   }
  markAllRead(param: { user: any }) {
    return Notification.update(
      {
        fk_user_id: param.user.id,
      },
      {
        is_read: true,
      },
    );
  }
}
