import { Injectable, Logger } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  MetaDiffEvent,
  UserInviteEvent,
  UserSignupEvent,
} from '~/services/app-hooks/interfaces';
import { T } from '~/utils';
import { Audit } from '~/models';
import { TelemetryService } from '~/services/telemetry.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class AppHooksListenerService implements OnModuleInit, OnModuleDestroy {
  protected unsubscribe: () => void;
  protected logger = new Logger(AppHooksListenerService.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly telemetryService: TelemetryService,
  ) {}

  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: any;
  }) {
    const { req, clientId } = data;
    switch (event) {
      case AppEvents.USER_SIGNIN:
        break;
      case AppEvents.USER_SIGNOUT:
        break;
      case AppEvents.USER_SIGNUP:
        {
          const param = data as UserSignupEvent;

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          this.telemetryService.sendEvent({
            evt_type: 'a:signup',
            req,
            clientId,
            email: param.user?.email,
          });
        }
        break;
      case AppEvents.USER_INVITE:
        {
          const param = data as UserInviteEvent;

          this.telemetryService.sendEvent({
            evt_type: 'a:signup',
            req,
            clientId,
            email: param.user?.email,
          });
        }
        break;
      case AppEvents.USER_UPDATE:
        break;
      case AppEvents.USER_PASSWORD_CHANGE:
        break;
      case AppEvents.USER_PASSWORD_FORGOT:
        break;
      case AppEvents.USER_DELETE:
        break;
      case AppEvents.USER_PASSWORD_RESET:
        break;
      case AppEvents.USER_EMAIL_VERIFICATION:
        break;
      case AppEvents.PROJECT_INVITE:
        break;
      case AppEvents.PROJECT_USER_UPDATE:
        break;
      case AppEvents.PROJECT_USER_RESEND_INVITE:
        break;
      case AppEvents.TABLE_CREATE:
        break;
      case AppEvents.TABLE_DELETE:
        break;
      case AppEvents.TABLE_UPDATE:
        break;
      case AppEvents.VIEW_CREATE:
        break;
      case AppEvents.VIEW_DELETE:
        break;
      case AppEvents.COLUMN_CREATE:
        break;
      case AppEvents.COLUMN_UPDATE:
        break;
      case AppEvents.DATA_CREATE:
        break;
      case AppEvents.DATA_DELETE:
        break;
      case AppEvents.DATA_UPDATE:
        break;
      case AppEvents.COLUMN_DELETE:
        break;
      case AppEvents.META_DIFF_SYNC:
        {
          const param = data as MetaDiffEvent;

          if (param.source) {
            this.telemetryService.sendEvent({
              evt_type: 'a:baseMetaDiff:synced',
              req,
              clientId,
            });
          } else {
            this.telemetryService.sendEvent({
              evt_type: 'a:metaDiff:synced',
              req,
              clientId,
            });
          }
        }
        break;
      case AppEvents.ORG_USER_INVITE:
        break;
      case AppEvents.ORG_USER_RESEND_INVITE:
        break;
      case AppEvents.VIEW_COLUMN_UPDATE:
        break;
      case AppEvents.IMAGE_UPLOAD:
        break;
      case AppEvents.FORM_COLUMN_UPDATE:
        break;

      case AppEvents.PROJECT_CREATE:
        break;

      case AppEvents.PROJECT_UPDATE:
        break;
      case AppEvents.PROJECT_CLONE:
        break;
      case AppEvents.WELCOME:
        break;
      case AppEvents.WORKSPACE_CREATE:
        break;
      case AppEvents.WORKSPACE_DELETE:
        break;
      case AppEvents.WORKSPACE_UPDATE:
        break;

      case AppEvents.PROJECT_DELETE:
        break;

      case AppEvents.GRID_CREATE:
        break;
      case AppEvents.GRID_COLUMN_UPDATE:
        break;
      case AppEvents.GRID_DELETE:
        break;
      case AppEvents.GRID_DUPLICATE:
        break;
      case AppEvents.FORM_CREATE:
        break;
      case AppEvents.FORM_UPDATE:
      case AppEvents.GRID_UPDATE:
      case AppEvents.CALENDAR_UPDATE:
      case AppEvents.GALLERY_UPDATE:
      case AppEvents.KANBAN_UPDATE:
      case AppEvents.VIEW_UPDATE:
        break;
      case AppEvents.FORM_DELETE:
        break;
      case AppEvents.KANBAN_CREATE:
        break;
      case AppEvents.KANBAN_DELETE:
        break;
      case AppEvents.GALLERY_CREATE:
        break;
      case AppEvents.GALLERY_DELETE:
        break;
      case AppEvents.CALENDAR_CREATE:
        break;
      case AppEvents.CALENDAR_DELETE:
        break;

      case AppEvents.FILTER_CREATE:
        break;
      case AppEvents.FILTER_UPDATE:
        break;
      case AppEvents.FILTER_DELETE:
        break;

      case AppEvents.WEBHOOK_CREATE:
        break;
      case AppEvents.WEBHOOK_UPDATE:
        break;

      case AppEvents.WEBHOOK_DELETE:
        break;

      case AppEvents.SORT_CREATE:
        break;

      case AppEvents.SORT_UPDATE:
        break;

      case AppEvents.SORT_DELETE:
        break;

      case AppEvents.API_TOKEN_CREATE:
      case AppEvents.ORG_API_TOKEN_CREATE:
        break;

      case AppEvents.PLUGIN_TEST:
        break;
      case AppEvents.PLUGIN_INSTALL:
        break;
      case AppEvents.PLUGIN_UNINSTALL:
        break;
      case AppEvents.SYNC_SOURCE_CREATE:
        break;
      case AppEvents.SYNC_SOURCE_UPDATE:
        break;
      case AppEvents.SYNC_SOURCE_DELETE:
        break;
      case AppEvents.RELATION_DELETE:
        break;
      case AppEvents.RELATION_CREATE:
        break;

      case AppEvents.API_TOKEN_DELETE:
      case AppEvents.ORG_API_TOKEN_DELETE:
        break;

      case AppEvents.SHARED_VIEW_CREATE:
        break;

      case AppEvents.SHARED_VIEW_UPDATE:
        break;

      case AppEvents.SHARED_VIEW_DELETE:
        break;

      case AppEvents.SHARED_BASE_GENERATE_LINK:
        break;
      case AppEvents.SHARED_BASE_DELETE_LINK:
        break;
      case AppEvents.ATTACHMENT_UPLOAD:
        break;
      case AppEvents.APIS_CREATED:
        break;
      case AppEvents.EXTENSION_CREATE:
        break;
      case AppEvents.EXTENSION_UPDATE:
        break;
      case AppEvents.EXTENSION_DELETE:
        break;
      case AppEvents.COMMENT_CREATE:
        break;
      case AppEvents.COMMENT_DELETE:
        break;
      case AppEvents.COMMENT_UPDATE:
        break;
      case AppEvents.INTEGRATION_DELETE:
        break;
      case AppEvents.INTEGRATION_CREATE:
        break;
      case AppEvents.INTEGRATION_UPDATE:
        break;
      case AppEvents.ROW_USER_MENTION:
        break;

      case AppEvents.SOURCE_CREATE:
        break;

      case AppEvents.SOURCE_UPDATE:
        break;

      case AppEvents.SOURCE_DELETE:
        break;

      case AppEvents.BASE_DUPLICATE_START:
      case AppEvents.BASE_DUPLICATE_FAIL:
        break;

      case AppEvents.TABLE_DUPLICATE_START:
      case AppEvents.TABLE_DUPLICATE_FAIL:
        break;
      case AppEvents.COLUMN_DUPLICATE_START:
      case AppEvents.COLUMN_DUPLICATE_FAIL:
        break;
      case AppEvents.VIEW_DUPLICATE_START:
      case AppEvents.VIEW_DUPLICATE_FAIL:
        break;

      case AppEvents.UI_ACL:
        break;
    }
  }

  onModuleDestroy(): any {
    this.unsubscribe?.();
  }

  onModuleInit(): any {
    this.unsubscribe = this.appHooksService.onAll(this.hookHandler.bind(this));
  }

  async auditInsert(param: Partial<Audit>) {
    try {
      await Audit.insert(param);
      T.event({ ...param, created_at: Date.now() });
    } catch (e) {
      this.logger.error(e);
    }
  }
}
