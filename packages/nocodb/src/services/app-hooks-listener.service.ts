import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import {
  AppEvents,
  AuditOperationSubTypes,
  AuditOperationTypes,
} from 'nocodb-sdk';
import { Audit, User } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  ApiCreatedEvent,
  ColumnEvent,
  FilterEvent,
  MetaDiffEvent,
  OrgUserInviteEvent,
  PluginEvent,
  ProjectCreateEvent,
  ProjectInviteEvent,
  ProjectUserResendInviteEvent,
  ProjectUserUpdateEvent,
  TableEvent,
  UserEmailVerificationEvent,
  UserPasswordChangeEvent,
  UserPasswordForgotEvent,
  UserPasswordResetEvent,
  UserSigninEvent,
  UserSignupEvent,
  ViewEvent,
} from './app-hooks/interfaces';

@Injectable()
export class AppHooksListenerService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: () => void;

  constructor(private appHooksService: AppHooksService) {}

  private async hookHandler({ event, data }: { event: AppEvents; data: any }) {
    switch (event) {
      case AppEvents.PROJECT_INVITE:
        {
          const param = data as ProjectInviteEvent;

          await Audit.insert({
            project_id: param.project.id,
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.INVITE,
            user: param.invitedBy.email,
            description: `invited ${param.user.email} to ${param.project.id} project `,
            ip: param.ip,
          });

          const count = await User.count();

          T.emit('evt', { evt_type: 'project:invite', count });
        }
        break;
      case AppEvents.PROJECT_USER_UPDATE:
        {
          const param = data as ProjectUserUpdateEvent;

          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.ROLES_MANAGEMENT,
            user: param.updatedBy.email,
            description: `Roles for ${param.user.email} with has been updated to ${param.projectUser.roles}`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.PROJECT_USER_RESEND_INVITE:
        {
          const param = data as ProjectUserResendInviteEvent;

          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.RESEND_INVITE,
            user: param.user.email,
            description: `${param.user.email} has been re-invited`,
            ip: param.ip,
            project_id: param.project.id,
          });
        }
        break;
      case AppEvents.USER_PASSWORD_CHANGE:
        {
          const param = data as UserPasswordChangeEvent;

          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.PASSWORD_CHANGE,
            user: param.user.email,
            description: `Password has been changed`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.USER_PASSWORD_FORGOT:
        {
          const param = data as UserPasswordForgotEvent;
          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.PASSWORD_FORGOT,
            user: param.user.email,
            description: `Password Reset has been requested`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.USER_PASSWORD_RESET:
        {
          const param = data as UserPasswordResetEvent;

          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.PASSWORD_RESET,
            user: param.user.email,
            description: `Password has been reset`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.USER_EMAIL_VERIFICATION:
        {
          const param = data as UserEmailVerificationEvent;

          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.EMAIL_VERIFICATION,
            user: param.user.email,
            description: `Email has been verified`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.SHARED_VIEW_DELETE:
        T.emit('evt', { evt_type: 'sharedView:deleted' });
        break;
      case AppEvents.SHARED_VIEW_CREATE:
        T.emit('evt', { evt_type: 'sharedView:generated-link' });
        break;
      case AppEvents.SHARED_VIEW_UPDATE:
        T.emit('evt', { evt_type: 'sharedView:updated' });
        break;
      case AppEvents.VIEW_UPDATE:
        {
          const param = data as ViewEvent;

          T.emit('evt', {
            evt_type: 'vtable:updated',
            show_as: param.view.type ?? param.showAs,
          });
        }
        break;
      case AppEvents.VIEW_DELETE:
        T.emit('evt', { evt_type: 'vtable:deleted' });
        break;
      case AppEvents.TABLE_UPDATE:
        T.emit('evt', { evt_type: 'table:updated' });
        break;
      case AppEvents.TABLE_CREATE:
        {
          const param = data as TableEvent;
          await Audit.insert({
            project_id: param.table.project_id,
            base_id: param.table.base_id,
            op_type: AuditOperationTypes.TABLE,
            op_sub_type: AuditOperationSubTypes.CREATE,
            user: param.user?.email,
            description: `Table ${param.table.table_name} with alias ${param.table.title} has been created`,
            ip: param.ip,
          });

          T.emit('evt', { evt_type: 'table:created' });
        }
        break;

      case AppEvents.TABLE_DELETE:
        {
          const { table, ip, user } = data as TableEvent;

          await Audit.insert({
            project_id: table.project_id,
            base_id: table.base_id,
            op_type: AuditOperationTypes.TABLE,
            op_sub_type: AuditOperationSubTypes.DELETE,
            user: user?.email,
            description: `Deleted ${table.type} ${table.table_name} with alias ${table.title}  `,
            ip,
          });

          T.emit('evt', { evt_type: 'table:deleted' });
        }
        break;
      case AppEvents.COLUMN_UPDATE:
        {
          const { column, ip, user, table } = data as ColumnEvent;

          await Audit.insert({
            // todo: type correction
            project_id: (column as any).project_id,
            op_type: AuditOperationTypes.TABLE_COLUMN,
            op_sub_type: AuditOperationSubTypes.UPDATE,
            user: user?.email,
            description: `The column ${column.column_name} with alias ${column.title} from table ${table.table_name} has been updated`,
            ip,
          });

          T.emit('evt', { evt_type: 'column:updated' });
        }
        break;
      case AppEvents.COLUMN_CREATE:
        {
          const { column, ip, user, table } = data as ColumnEvent;
          await Audit.insert({
            project_id: table.project_id,
            op_type: AuditOperationTypes.TABLE_COLUMN,
            op_sub_type: AuditOperationSubTypes.CREATE,
            user: user?.email,
            description: `The column ${column.column_name} with alias ${column.title} from table ${table.table_name} has been created`,
            ip,
          });

          T.emit('evt', { evt_type: 'column:created' });
        }
        break;
      case AppEvents.COLUMN_DELETE:
        {
          const { column, ip, user, table } = data as ColumnEvent;

          await Audit.insert({
            project_id: (column as any).project_id,
            op_type: AuditOperationTypes.TABLE_COLUMN,
            op_sub_type: AuditOperationSubTypes.DELETE,
            user: user?.email,
            description: `The column ${column.column_name} with alias ${column.title} from table ${table.table_name} has been deleted`,
            ip,
          });
          T.emit('evt', { evt_type: 'column:deleted' });
        }
        break;

      case AppEvents.USER_SIGNIN:
        {
          const param = data as UserSigninEvent;
          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.SIGNIN,
            user: param.user.email,
            ip: param.ip,
            description: param.auditDescription,
          });
        }
        break;
      case AppEvents.USER_SIGNUP:
        {
          const param = data as UserSignupEvent;
          await Audit.insert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.SIGNUP,
            user: param.user.email,
            description: `User has signed up`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.ORG_USER_INVITE:
        {
          const param = data as OrgUserInviteEvent;
          T.emit('evt', { evt_type: 'org:user:invite', count: param.count });

          await Audit.insert({
            op_type: AuditOperationTypes.ORG_USER,
            op_sub_type: AuditOperationSubTypes.INVITE,
            user: param.invitedBy.email,
            description: `${param.user.email} has been invited to the organisation`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.ORG_USER_RESEND_INVITE:
        {
          const param = data as OrgUserInviteEvent;
          await Audit.insert({
            op_type: AuditOperationTypes.ORG_USER,
            op_sub_type: AuditOperationSubTypes.RESEND_INVITE,
            user: param.invitedBy.email,
            description: `${param.user.email} has been re-invited`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.FILTER_CREATE:
        {
          const param = data as FilterEvent;
          T.emit('evt', {
            evt_type: param.hook ? 'hookFilter:created' : 'filter:created',
          });
        }
        break;
      case AppEvents.FILTER_DELETE:
        {
          T.emit('evt', { evt_type: 'filter:deleted' });
        }
        break;
      case AppEvents.FILTER_UPDATE:
        {
          T.emit('evt', { evt_type: 'filter:updated' });
        }
        break;
      case AppEvents.SORT_CREATE:
        {
          T.emit('evt', { evt_type: 'sort:created' });
        }
        break;
      case AppEvents.SORT_DELETE:
        {
          T.emit('evt', { evt_type: 'sort:deleted' });
        }
        break;
      case AppEvents.SORT_UPDATE:
        {
          T.emit('evt', { evt_type: 'sort:updated' });
        }
        break;
      case AppEvents.VIEW_COLUMN_CREATE:
        {
          T.emit('evt', { evt_type: 'viewColumn:inserted' });
        }
        break;
      case AppEvents.VIEW_COLUMN_UPDATE:
        {
          T.emit('evt', { evt_type: 'viewColumn:updated' });
        }
        break;
      case AppEvents.RELATION_CREATE:
        {
          T.emit('evt', { evt_type: 'relation:created' });
        }
        break;
      case AppEvents.RELATION_DELETE:
        {
          T.emit('evt', { evt_type: 'relation:deleted' });
        }
        break;
      case AppEvents.API_TOKEN_CREATE:
        {
          T.emit('evt', { evt_type: 'apiToken:created' });
        }
        break;
      case AppEvents.API_TOKEN_DELETE:
        {
          T.emit('evt', { evt_type: 'apiToken:deleted' });
        }
        break;
      case AppEvents.PLUGIN_TEST:
        {
          T.emit('evt', { evt_type: 'plugin:tested' });
        }
        break;
      case AppEvents.PLUGIN_INSTALL:
        {
          const { plugin } = data as PluginEvent;
          T.emit('evt', {
            evt_type: 'plugin:installed',
            title: plugin.title,
          });
        }
        break;
      case AppEvents.PLUGIN_UNINSTALL:
        {
          const { plugin } = data as PluginEvent;
          T.emit('evt', {
            evt_type: 'plugin:uninstalled',
            title: plugin.title,
          });
        }
        break;

      case AppEvents.SHARED_BASE_GENERATE_LINK:
        {
          T.emit('evt', { evt_type: 'sharedBase:generated-link' });
        }
        break;
      case AppEvents.SHARED_BASE_DELETE_LINK:
        {
          T.emit('evt', { evt_type: 'sharedBase:generated-link' });
        }
        break;
      case AppEvents.BASE_UPDATE:
        {
          T.emit('evt', {
            evt_type: 'base:updated',
          });
        }
        break;
      case AppEvents.BASE_DELETE:
        {
          T.emit('evt', { evt_type: 'base:deleted' });
        }
        break;
      case AppEvents.BASE_CREATE:
        {
          T.emit('evt', {
            evt_type: 'base:created',
          });
        }
        break;
      case AppEvents.ATTACHMENT_UPLOAD:
        {
          T.emit('evt', { evt_type: 'image:uploaded', type: data?.type });
        }
        break;
      case AppEvents.WEBHOOK_CREATE:
        T.emit('evt', { evt_type: 'webhooks:created' });
        break;
      case AppEvents.WEBHOOK_DELETE:
        T.emit('evt', { evt_type: 'webhooks:deleted' });
        break;
      case AppEvents.WEBHOOK_UPDATE:
        T.emit('evt', { evt_type: 'webhooks:updated' });
        break;
      case AppEvents.FORM_COLUMN_UPDATE:
        T.emit('evt', { evt_type: 'formViewColumn:updated' });
        break;
      case AppEvents.SYNC_SOURCE_CREATE:
        T.emit('evt', { evt_type: 'syncSource:created' });
        break;
      case AppEvents.SYNC_SOURCE_DELETE:
        T.emit('evt', { evt_type: 'syncSource:deleted' });
        break;
      case AppEvents.VIEW_CREATE:
        {
          const param = data as ViewEvent;
          T.emit('evt', { evt_type: 'vtable:created', show_as: param.showAs });
        }
        break;
      case AppEvents.GRID_COLUMN_UPDATE:
        T.emit('evt', { evt_type: 'gridViewColumn:updated' });
        break;
      case AppEvents.WEBHOOK_TEST:
        T.emit('evt', { evt_type: 'webhooks:tested' });
        break;
      case AppEvents.PROJECT_CREATE:
        {
          const { xcdb } = data as ProjectCreateEvent;
          T.emit('evt', {
            evt_type: 'project:created',
            xcdb,
          });

          T.emit('evt', { evt_type: 'project:rest' });
        }
        break;
      case AppEvents.PROJECT_DELETE:
        T.emit('evt', { evt_type: 'project:deleted' });
        break;
      case AppEvents.PROJECT_UPDATE:
        T.emit('evt', { evt_type: 'project:update' });
        break;
      case AppEvents.UI_ACL_UPDATE:
        T.emit('evt', { evt_type: 'uiAcl:updated' });
        break;
      case AppEvents.META_DIFF_SYNC:
        {
          const param = data as MetaDiffEvent;

          if (param.base) {
            T.emit('evt', { evt_type: 'baseMetaDiff:synced' });
          } else {
            T.emit('evt', { evt_type: 'metaDiff:synced' });
          }
        }
        break;

      case AppEvents.ORG_API_TOKEN_DELETE:
        T.emit('evt', { evt_type: 'org:apiToken:deleted' });
        break;
      case AppEvents.ORG_API_TOKEN_CREATE:
        T.emit('evt', { evt_type: 'org:apiToken:created' });
        break;
      case AppEvents.APIS_CREATED:
        {
          const param = data as ApiCreatedEvent;
          T.emit('evt_api_created', param.info);
        }
        break;
    }
  }

  onModuleDestroy(): any {
    this.unsubscribe?.();
  }

  onModuleInit(): any {
    this.unsubscribe = this.appHooksService.onAll(this.hookHandler.bind(this));
  }
}
