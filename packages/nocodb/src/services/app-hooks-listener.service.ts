import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  AuditOperationSubTypes,
  AuditOperationTypes,
} from 'nocodb-sdk';
import { T } from 'nc-help';
import type { AuditType } from 'nocodb-sdk';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  ColumnEvent,
  OrgUserInviteEvent,
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
} from '~/services/app-hooks/interfaces';
import { Audit } from '~/models';
import { TelemetryService } from '~/services/telemetry.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { User } from '~/models';

@Injectable()
export class AppHooksListenerService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: () => void;
  private logger = new Logger(AppHooksListenerService.name);

  constructor(
    private readonly appHooksService: AppHooksService,
    private readonly telemetryService: TelemetryService, // @Inject(Producer) private readonly producer: Producer,
  ) {}

  private async hookHandler({ event, data }: { event: AppEvents; data: any }) {
    switch (event) {
      case AppEvents.PROJECT_INVITE:
        {
          const param = data as ProjectInviteEvent;

          await this.auditInsert({
            base_id: param.base.id,
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.INVITE,
            user: param.invitedBy.email,
            description: `invited ${param.user.email} to ${param.base.id} base `,
            ip: param.ip,
          });

          const count = await User.count();

          this.telemetryService.sendEvent({
            evt_type: 'base:invite',
            count,
          });
        }
        break;
      case AppEvents.PROJECT_USER_UPDATE:
        {
          const param = data as ProjectUserUpdateEvent;

          await this.auditInsert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.ROLES_MANAGEMENT,
            user: param.updatedBy.email,
            description: `Roles for ${param.user.email} with has been updated to ${param.baseUser.roles}`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.PROJECT_USER_RESEND_INVITE:
        {
          const param = data as ProjectUserResendInviteEvent;

          await this.auditInsert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.RESEND_INVITE,
            user: param.user.email,
            description: `${param.user.email} has been re-invited`,
            ip: param.ip,
            base_id: param.base.id,
          });
        }
        break;
      case AppEvents.USER_PASSWORD_CHANGE:
        {
          const param = data as UserPasswordChangeEvent;

          await this.auditInsert({
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
          await this.auditInsert({
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

          await this.auditInsert({
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

          await this.auditInsert({
            op_type: AuditOperationTypes.AUTHENTICATION,
            op_sub_type: AuditOperationSubTypes.EMAIL_VERIFICATION,
            user: param.user.email,
            description: `Email has been verified`,
            ip: param.ip,
          });
        }
        break;
      case AppEvents.TABLE_CREATE:
        {
          const param = data as TableEvent;
          await this.auditInsert({
            base_id: param.table.base_id,
            source_id: param.table.source_id,
            op_type: AuditOperationTypes.TABLE,
            op_sub_type: AuditOperationSubTypes.CREATE,
            user: param.user?.email,
            description: `Table ${param.table.table_name} with alias ${param.table.title} has been created`,
            ip: param.ip,
          });
        }
        break;

      case AppEvents.TABLE_DELETE:
        {
          const { table, ip, user } = data as TableEvent;

          await this.auditInsert({
            base_id: table.base_id,
            source_id: table.source_id,
            op_type: AuditOperationTypes.TABLE,
            op_sub_type: AuditOperationSubTypes.DELETE,
            user: user?.email,
            description: `Deleted ${table.type} ${table.table_name} with alias ${table.title}  `,
            ip,
          });
        }
        break;
      case AppEvents.COLUMN_UPDATE:
        {
          const { column, ip, user, table } = data as ColumnEvent;

          await this.auditInsert({
            // todo: type correction
            base_id: (column as any).base_id,
            op_type: AuditOperationTypes.TABLE_COLUMN,
            op_sub_type: AuditOperationSubTypes.UPDATE,
            user: user?.email,
            description: `The column ${column.column_name} with alias ${column.title} from table ${table.table_name} has been updated`,
            ip,
          });
        }
        break;
      case AppEvents.COLUMN_CREATE:
        {
          const { column, ip, user, table } = data as ColumnEvent;
          await this.auditInsert({
            base_id: table.base_id,
            op_type: AuditOperationTypes.TABLE_COLUMN,
            op_sub_type: AuditOperationSubTypes.CREATE,
            user: user?.email,
            description: `The column ${column.column_name} with alias ${column.title} from table ${table.table_name} has been created`,
            ip,
          });
        }
        break;
      case AppEvents.COLUMN_DELETE:
        {
          const { column, ip, user, table } = data as ColumnEvent;

          await this.auditInsert({
            base_id: (column as any).base_id,
            op_type: AuditOperationTypes.TABLE_COLUMN,
            op_sub_type: AuditOperationSubTypes.DELETE,
            user: user?.email,
            description: `The column ${column.column_name} with alias ${column.title} from table ${table.table_name} has been deleted`,
            ip,
          });
        }
        break;

      case AppEvents.USER_SIGNIN:
        {
          const param = data as UserSigninEvent;
          await this.auditInsert({
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
          await this.auditInsert({
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
          this.telemetryService.sendEvent({
            evt_type: 'org:user:invite',
            count: param.count,
          });

          await this.auditInsert({
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
          await this.auditInsert({
            op_type: AuditOperationTypes.ORG_USER,
            op_sub_type: AuditOperationSubTypes.RESEND_INVITE,
            user: param.invitedBy.email,
            description: `${param.user.email} has been re-invited`,
            ip: param.ip,
          });
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

  async auditInsert(param: Partial<Audit | AuditType>) {
    await Audit.insert(param);
    try {
      T.event({ ...param, created_at: Date.now() });
    } catch (e) {
      this.logger.error(e);
    }
  }
}
