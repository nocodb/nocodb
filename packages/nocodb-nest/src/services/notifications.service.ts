import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { MetaService } from '../meta/meta.service';
import { parseMetaProp } from '../utils/modelUtils';
import { AppHooksService } from './app-hooks/app-hooks.service';
import { ClickhouseService } from './clickhouse/clickhouse.service';
import type {
  ProjectInviteEvent,
  WelcomeEvent,
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
    // Define the values to insert
    const id = this.metaService.genNanoid('');
    const body = JSON.stringify(insertData.body);
    const type = insertData.type;
    const isRead = false;
    const isDeleted = false;
    const fkUserId = insertData.fk_user_id;

    // Define the SQL query to insert the row
    const query = `
  INSERT INTO notification (id, body, type, is_read, is_deleted, fk_user_id)
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
    try {
      // Define the pagination parameters
      const { limit = 10, offset = 0 } = param; // Number of rows to skip before returning results

      // Define the SQL query with pagination parameters
      const query = `
  SELECT  *
  FROM notification FINAL
  WHERE fk_user_id = '${param.user.id}'
  ORDER BY created_at DESC
  LIMIT ${limit}
  OFFSET ${offset}  
  `;

      const list = ((await this.clickhouseService.execute(query)) ?? []).map(
        (row) => {
          row.body = parseMetaProp(row, 'body');
          return row;
        },
      );

      const countQuery = `
  SELECT count(id) as count
  FROM notification  FINAL       
  WHERE fk_user_id = '${param.user.id}'
  AND is_deleted = false 
    `;
      const count =
        (await this.clickhouseService.execute(countQuery))?.[0]?.count ?? 0;

      const unreadCountQuery = `
  SELECT count(id) as count
  FROM notification FINAL
  WHERE fk_user_id = '${param.user.id}'
  AND is_read = false
  AND is_deleted = false   
   
    `;

      const unreadCount = (
        await this.clickhouseService.execute(unreadCountQuery)
      )?.[0]?.count;

      return new PagedResponseImpl(
        list,
        {
          limit: param.limit,
          offset: param.offset,
          count,
        },
        { unreadCount },
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async notificationUpdate(param: { notificationId: string; body; user: any }) {
    const existingRecord = (
      await this.clickhouseService.execute(`
      SELECT  *
  FROM notification FINAL
    WHERE id = '${param.notificationId}'
    AND fk_user_id = '${param.user.id}'    `)
    )?.[0];

    if (existingRecord) {
      Object.assign(existingRecord, param.body);
      return this.clickhouseService.execute(`
        INSERT INTO notification
        (id, fk_user_id, type, body, is_read, is_deleted, created_at, updated_at)
        VALUES (
          '${param.notificationId}',
          '${param.user.id}',
          '${existingRecord.type}',
          '${existingRecord.body}',
          ${existingRecord.is_read},
          ${existingRecord.is_deleted},
          '${existingRecord.created_at}',
          '${existingRecord.updated_at}'
        )`);
    }
  }

  async markAllRead(param: { user: any }) {
    try {
      // get all unread notifications
      const query = `
  SELECT *
  FROM notification FINAL
  WHERE fk_user_id = '${param.user.id}'
  AND is_read = false
 
  `;

      const list = await this.clickhouseService.execute(query);

      const updateQueries = [];

      for (const not of list) {
        updateQueries.push(`(
        '${not.id}',
        '${not.fk_user_id}',
        '${not.type}',
        '${not.body}',
        true,
        ${not.is_deleted},
        '${not.created_at}',
        '${not.updated_at}'
      )`);
      }

      return await this.clickhouseService
        .execute(`INSERT INTO notification
      (id, fk_user_id, type, body, is_read, is_deleted, created_at, updated_at)
      VALUES ${updateQueries.join(',')}`);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}
