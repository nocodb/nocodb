import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  AuditV1OperationTypes,
  UITypes,
  viewTypeAlias,
} from 'nocodb-sdk';
import { AppHooksListenerService as AppHooksListenerServiceCE } from 'src/services/app-hooks-listener.service';
import type {
  APITokenCreatePayload,
  APITokenDeletePayload,
  BaseCreatePayload,
  BaseDeletePayload,
  BaseDuplicatePayload,
  BaseRenamePayload,
  BaseUpdatePayload,
  BaseUserRoleUpdatePayload,
  ColumnDuplicatePayload,
  ColumnRenamePayload,
  ColumnType,
  DataExportPayload,
  DataImportPayload,
  FilterCreatePayload,
  FilterDeletePayload,
  FilterPayload,
  FilterUpdatePayload,
  HookCreatePayload,
  HookDeletePayload,
  HookUpdatePayload,
  ModelRoleVisibilityPayload,
  NcContext,
  NcRequest,
  SharedBasePayload,
  SharedViewCreatePayload,
  SharedViewDeletePayload,
  SharedViewUpdatePayload,
  SnapshotPayload,
  SnapshotRestorePayload,
  SortCreatePayload,
  SortDeletePayload,
  SortUpdatePayload,
  SourceCreatePayload,
  SourceDeletePayload,
  SourceUpdatePayload,
  TableCreatePayload,
  TableDeletePayload,
  TableDuplicatePayload,
  TableRenamePayload,
  TableUpdatePayload,
  UpdatePayload,
  UserProfileUpdatePayload,
  ViewColumnUpdatePayload,
  ViewCreatePayload,
  ViewDeletePayload,
  ViewDuplicatePayload,
  ViewRenamePayload,
  ViewUpdatePayload,
  WorkspaceUserDeletePayload,
} from 'nocodb-sdk';
import type {
  BaseUserInvitePayload,
  BaseUserInviteResendPayload,
  ColumnCreatePayload,
  ColumnDeletePayload,
  ColumnUpdatePayload,
  IntegrationCreatePayload,
  IntegrationDeletePayload,
  IntegrationUpdatePayload,
  OrgUserInvitePayload,
  OrgUserInviteResendPayload,
  UserInvitePayload,
  WorkspaceCreatePayload,
  WorkspaceDeletePayload,
  WorkspaceInvitePayload,
  WorkspaceRenamePayload,
  WorkspaceUpdatePayload,
  WorkspaceUserUpdatePayload,
} from 'nocodb-sdk';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  ApiTokenCreateEvent,
  ApiTokenDeleteEvent,
  BaseDuplicateEvent,
  CalendarViewUpdateEvent,
  ColumnDuplicateEvent,
  ColumnEvent,
  ColumnUpdateEvent,
  DataExportEvent,
  DataImportEvent,
  FilterEvent,
  FilterUpdateEvent,
  FormColumnEvent,
  FormViewUpdateEvent,
  GalleryViewUpdateEvent,
  GridViewUpdateEvent,
  IntegrationEvent,
  KanbanViewUpdateEvent,
  MetaDiffEvent,
  ModelRoleVisibilityEvent,
  OrgUserInviteEvent,
  ProjectCreateEvent,
  ProjectDeleteEvent,
  ProjectInviteEvent,
  ProjectUpdateEvent,
  ProjectUserResendInviteEvent,
  SharedBaseEvent,
  SharedViewUpdateEvent,
  SnapshotDeleteEvent,
  SnapshotEvent,
  SnapshotRestoreEvent,
  SortEvent,
  SortUpdateEvent,
  SourceEvent,
  SourceUpdateEvent,
  TableDuplicateEvent,
  TableEvent,
  TableUpdateEvent,
  UserEmailVerificationEvent,
  UserInviteEvent,
  UserPasswordChangeEvent,
  UserPasswordForgotEvent,
  UserPasswordResetEvent,
  UserProfileUpdateEvent,
  UserSigninEvent,
  UserSignupEvent,
  ViewColumnUpdateEvent,
  ViewCreateEvent,
  ViewDeleteEvent,
  ViewDuplicateEvent,
  ViewEvent,
  ViewUpdateEvent,
  WebhookEvent,
  WebhookUpdateEvent,
  WorkspaceEvent,
  WorkspaceUpdateEvent,
  WorkspaceUserDeleteEvent,
  WorkspaceUserInviteEvent,
  WorkspaceUserUpdateEvent,
} from '~/services/app-hooks/interfaces';
import type { IntegrationUpdateEvent } from '~/services/app-hooks/interfaces';
import type { SelectOption } from '~/models';
import type { ProjectUserUpdateEvent } from '~/services/app-hooks/interfaces';
import { columnBuilder } from '~/utils/data-transformation.builder';
import { Audit, Column, User } from '~/models';
import { TelemetryService } from '~/services/telemetry.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  additionalExcludePropsForCol,
  extractAttachmentPropsAndFormat,
  extractNonSystemProps,
  extractRefColumnIfFound,
  extractViewRelatedProps,
  generateAuditV1Payload,
  mapAlias,
  parseMetaIfFound,
  populateUpdatePayloadDiff,
  transformToSnakeCase,
} from '~/utils';
import { extractProps } from '~/helpers/extractProps';

async function filterOutUnnecessaryMetas(
  column: ColumnType | Column,
  context: NcContext,
) {
  // if uidt is MultiSelect/SingleSelect, remove unnecessary props from options
  if (
    column?.uidt === UITypes.MultiSelect ||
    column?.uidt === UITypes.SingleSelect
  ) {
    if (!column.colOptions) {
      column = new Column(column);
      await (column as Column).getColOptions(context);
    }

    const options =
      (column?.colOptions as { options: SelectOption[] })?.options?.map((o) =>
        extractProps(o, ['order', 'title', 'color', 'id', 'index']),
      ) ?? [];
    return {
      ...column,
      grouped_options: options.reduce((acc, o) => {
        acc[o.id] = o;
        return acc;
      }, {}),
    };
  }

  return column;
}

function formatUpdatePayloadOfOptions({
  updatePayload,
  oldColumn,
  updatedColumn,
}: {
  updatePayload: UpdatePayload;
  oldColumn: { grouped_options?: Record<string, any> };
  updatedColumn: { grouped_options?: Record<string, any> };
}) {
  if (updatePayload?.grouped_options) {
    updatePayload.options = Object.keys(updatePayload?.grouped_options).map(
      (key) => {
        const option = updatedColumn.grouped_options[key];
        if (!option) return;

        return extractProps(option, ['order', 'title', 'color', 'id', 'index']);
      },
    );
    updatePayload.grouped_options = undefined;
  }
  if (updatePayload.previous_state?.grouped_options) {
    updatePayload.previous_state.options = Object.keys(
      updatePayload.previous_state?.grouped_options,
    ).map((key) => {
      const option = oldColumn.grouped_options[key];
      if (!option) return;

      return extractProps(option, ['order', 'title', 'color', 'id', 'index']);
    });
    updatePayload.previous_state.grouped_options = undefined;
  }

  oldColumn.grouped_options = undefined;
  updatedColumn.grouped_options = undefined;
}

@Injectable()
export class AppHooksListenerService
  extends AppHooksListenerServiceCE
  implements OnModuleInit, OnModuleDestroy
{
  protected unsubscribe: () => void;
  protected logger = new Logger(AppHooksListenerService.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly telemetryService: TelemetryService,
  ) {
    super(appHooksService, telemetryService);
  }

  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: any;
  }) {
    const { clientId, req = { user: {} } } = data;

    // skip audit if explicitly set, this is to bypass events for snapshot and any similar audits
    if ((<NcRequest>req)?.skipAudit) {
      return;
    }

    switch (event) {
      case AppEvents.USER_SIGNIN:
        {
          const param = data as UserSigninEvent;

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          await this.auditInsert(
            await generateAuditV1Payload(AuditV1OperationTypes.USER_SIGNIN, {
              context: param.context,
              req: param.req,
            }),
          );
        }
        break;
      case AppEvents.USER_PROFILE_UPDATE:
        {
          const param = data as UserProfileUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            next: param.user,
            prev: param.oldUser,
            exclude: ['password', 'salt'],
            aliasMap: {
              display_name: 'user_name',
              email: 'user_email',
            },
          });

          if (!updatePayload) break;

          await this.auditInsert(
            await generateAuditV1Payload<UserProfileUpdatePayload>(
              AuditV1OperationTypes.USER_PROFILE_UPDATE,
              {
                details: {
                  user_id: param.user.id,
                  user_email: param.user.email,
                  user_name: param.user.display_name ?? undefined,
                  ...updatePayload,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.USER_SIGNUP:
        {
          const param = data as UserSignupEvent;
          param.req = param.req || ({} as NcRequest);

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          await this.auditInsert(
            await generateAuditV1Payload(AuditV1OperationTypes.USER_SIGNUP, {
              context: param.context,
              req: param.req,
            }),
          );

          this.telemetryService.sendEvent({
            evt_type: 'a:signup',
            req,
            clientId,
            email: param.user?.email,
          });
        }
        break;
      case AppEvents.USER_SIGNOUT:
        {
          const param = data as UserSignupEvent;

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          await this.auditInsert(
            await generateAuditV1Payload(AuditV1OperationTypes.USER_SIGNOUT, {
              context: param.context,
              req: param.req,
            }),
          );
        }
        break;
      case AppEvents.USER_INVITE:
        {
          const param = data as UserInviteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<UserInvitePayload>(
              AuditV1OperationTypes.USER_INVITE,
              {
                details: {
                  user_id: param.user.id,
                  user_email: param.user.email,
                  user_name: param.user.display_name || undefined,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );

          this.telemetryService.sendEvent({
            evt_type: 'a:signup',
            req,
            clientId,
            email: param.user?.email,
          });
        }
        break;
      case AppEvents.USER_PASSWORD_CHANGE:
        {
          const param = data as UserPasswordChangeEvent;

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          await this.auditInsert(
            await generateAuditV1Payload(
              AuditV1OperationTypes.USER_PASSWORD_CHANGE,
              {
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.USER_PASSWORD_FORGOT:
        {
          const param = data as UserPasswordForgotEvent;

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          await this.auditInsert(
            await generateAuditV1Payload(
              AuditV1OperationTypes.USER_PASSWORD_FORGOT,
              {
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.USER_PASSWORD_RESET:
        {
          const param = data as UserPasswordResetEvent;

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          await this.auditInsert(
            await generateAuditV1Payload(
              AuditV1OperationTypes.USER_PASSWORD_RESET,
              {
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.USER_EMAIL_VERIFICATION:
        {
          const param = data as UserEmailVerificationEvent;

          // assign user to req (as this is self-event)
          param.req.user = param.user;

          await this.auditInsert(
            await generateAuditV1Payload(
              AuditV1OperationTypes.USER_EMAIL_VERIFY,
              {
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.PROJECT_INVITE:
        {
          const param = data as ProjectInviteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<BaseUserInvitePayload>(
              AuditV1OperationTypes.BASE_USER_INVITE,
              {
                details: {
                  user_id: param.user.id,
                  user_email: param.user.email,
                  user_name: param.user.display_name ?? undefined,
                  base_role: param.role,
                  base_title: param.base.title,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.PROJECT_USER_UPDATE:
        {
          const param = data as ProjectUserUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            next: param.baseUser,
            prev: param.oldBaseUser,
            aliasMap: {
              roles: 'base_role',
            },
            exclude: ['deleted', 'base_roles'],
          });

          if (!updatePayload) break;

          await this.auditInsert(
            await generateAuditV1Payload<BaseUserRoleUpdatePayload>(
              AuditV1OperationTypes.BASE_USER_UPDATE,
              {
                details: {
                  user_id: param.user.id,
                  user_email: param.user.email,
                  user_name: param.user.display_name ?? undefined,
                  base_title: param.base.title,
                  base_role: param.baseUser.roles,
                  ...updatePayload,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.PROJECT_USER_DELETE:
        {
          // const param = data as ProjectUserDeleteEvent;
          //
          // await this.auditInsert(
          //   await generateAuditV1Payload<BaseUserDeletePayload>(
          //     AuditV1OperationTypes.BASE_USER_DELETE,
          //     {
          //       details: {
          //         user_id: param.user.id,
          //         user_email: param.user.email,
          //         base_title: param.base.title,
          //         user_role:
          //       },
          //       context: param.context,
          //       req: param.req,
          //     },
          //   ),
          // );
        }
        break;
      case AppEvents.TABLE_CREATE:
        {
          const param = data as TableEvent;

          // update context with table & source
          Object.assign(param.context, {
            fk_model_id: param.table.id,
            source_id:
              param.source?.id ||
              param.table.source_id ||
              param.req?.ncSourceId,
          });

          await this.auditInsert(
            await generateAuditV1Payload<TableCreatePayload>(
              AuditV1OperationTypes.TABLE_CREATE,
              {
                details: {
                  table_title: param.table.title,
                  ...extractNonSystemProps(param.table, [
                    'title',
                    'table_name',
                    'columns',
                    'is_hybrid',
                    'meta',
                    'prefix',
                    'pgSerialLastVal',
                  ]),
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.TABLE_DELETE:
        {
          const param = data as TableEvent;

          // update context with table & source
          Object.assign(param.context, {
            fk_model_id: param.table.id,
          });

          await this.auditInsert(
            await generateAuditV1Payload<TableDeletePayload>(
              AuditV1OperationTypes.TABLE_DELETE,
              {
                details: {
                  table_title: param.table.title,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.TABLE_UPDATE:
        {
          const param = data as TableUpdateEvent;

          // update context with table & source
          Object.assign(param.context, {
            fk_model_id: param.prevTable.id,
          });

          // check if workspace rename
          if (
            param.table?.title &&
            param.prevTable?.title !== param.table?.title
          ) {
            await this.auditInsert(
              await generateAuditV1Payload<TableRenamePayload>(
                AuditV1OperationTypes.TABLE_RENAME,
                {
                  details: {
                    new_table_title: param.table.title,
                    old_table_title: param.prevTable.title,
                  },
                  context: param.context,
                  req: param.req,
                },
              ),
            );
          }

          const updateEventPayload = populateUpdatePayloadDiff({
            prev: param.prevTable,
            next: param.table,
            parseMeta: true,
            exclude: ['title', 'table_name'],
          });

          // check if any other update change (except title)
          if (updateEventPayload) {
            await this.auditInsert(
              await generateAuditV1Payload<TableUpdatePayload>(
                AuditV1OperationTypes.TABLE_UPDATE,
                {
                  details: {
                    table_title: param.table.title ?? param.prevTable.title,
                    ...updateEventPayload,
                  },
                  context: param.context,
                  req: param.req,
                },
              ),
            );
          }
        }
        break;
      case AppEvents.PROJECT_USER_RESEND_INVITE:
        {
          const param = data as ProjectUserResendInviteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<BaseUserInviteResendPayload>(
              AuditV1OperationTypes.BASE_USER_INVITE_RESEND,
              {
                details: {
                  user_id: param.user.id,
                  user_email: param.user.email,
                  user_name: param.user.display_name ?? undefined,
                  base_title: param.base.title,
                  base_role: param.baseUser.roles,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.COLUMN_CREATE:
        {
          const param = data as ColumnEvent;

          parseMetaIfFound({
            payloads: [param.column],
          });
          const columnBuilderRef = columnBuilder();

          const column = columnBuilderRef.build(
            param.columns.find((c) => c.id === param.column.id) ??
              param.column ??
              (await Column.get(param.context, { colId: param.column.id })),
          );

          // update context with table & source
          Object.assign(param.context, {
            fk_model_id: param.column.fk_model_id,
            source_id: param.column.source_id,
          });

          const options = Object.assign(
            {},
            (
              column as unknown as {
                options: Record<string, any>;
              }
            ).options,
            await extractRefColumnIfFound({
              column: param.column,
              columns: param.columns,
              context: param.context,
            }),
          );

          await this.auditInsert(
            await generateAuditV1Payload<ColumnCreatePayload>(
              AuditV1OperationTypes.COLUMN_CREATE,
              {
                details: {
                  field_id: param.column.id,
                  field_title: param.column.title,
                  field_type: param.column.uidt as UITypes,
                  uidt: undefined,
                  // ...(param.column.colOptions || {}),
                  // ...filterAndMapAliasToColProps(
                  //   extractNonSystemProps(
                  //     removeBlankPropsAndMask(param.column),
                  //     additionalExcludePropsForCol(param.column?.uidt),
                  //   ),
                  // ),
                  ...(column as Record<string, unknown>),
                  options: Object.keys(options).length ? options : undefined,
                  type: undefined,
                  id: undefined,
                  title: undefined,
                } as ColumnCreatePayload,
                fk_model_id: param.column.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );

          // if LTAR/Links insert audit for column created in ref table
        }
        break;
      case AppEvents.COLUMN_UPDATE:
        {
          const param = data as ColumnUpdateEvent;

          // filter out unnecessary metas from column
          let oldColumn = await filterOutUnnecessaryMetas(
            param.oldColumn,
            param.context,
          );
          let column = await filterOutUnnecessaryMetas(
            param.column,
            param.context,
          );

          // check if workspace rename
          if (column?.title && column?.title !== oldColumn?.title) {
            await this.auditInsert(
              await generateAuditV1Payload<ColumnRenamePayload>(
                AuditV1OperationTypes.COLUMN_RENAME,
                {
                  details: {
                    field_id: column.id ?? oldColumn.id,
                    new_field_title: column.title,
                    old_field_title: oldColumn.title,
                  },
                  fk_model_id: param.table.id,
                  context: param.context,
                  req: param.req,
                },
              ),
            );
          }

          const columnBuilderRef = columnBuilder();

          oldColumn = columnBuilderRef.build(oldColumn);
          column = columnBuilderRef.build(column);

          const updatePayload = populateUpdatePayloadDiff({
            prev: {
              primary_key: false,
              ...oldColumn,
              options: Object.assign(
                {},
                await extractRefColumnIfFound({
                  column: {
                    ...(param.oldColumn?.colOptions ?? {}),
                    ...param.oldColumn,
                  },
                  columns: param.columns,
                  context: param.context,
                }),
                (
                  oldColumn as unknown as {
                    options: Record<string, any>;
                  }
                ).options || {},
              ),
            },
            next: {
              ...column,
              options: Object.assign(
                {},
                await extractRefColumnIfFound({
                  column: {
                    ...(param.column?.colOptions ?? {}),
                    ...param.column,
                  },
                  columns: param.columns,
                  context: param.context,
                }),
                (
                  column as unknown as {
                    options: Record<string, any>;
                  }
                ).options || {},
              ),
            },
            aliasMap: {
              title: 'field_title',
              id: 'field_id',
              type: 'field_type',
            },
            parseMeta: true,
            exclude: additionalExcludePropsForCol(
              param.column?.uidt || param.oldColumn?.uidt,
            ),
            boolProps: ['required', 'primary_key', 'pk', 'pv', 'display_value'],
          });

          if (!updatePayload) break;

          // if multi/single select check for any changes in options and format it
          if (
            (column.uidt === UITypes.MultiSelect ||
              column.uidt === UITypes.SingleSelect) &&
            (column?.colOptions as any)?.options
          ) {
            formatUpdatePayloadOfOptions({
              updatePayload,
              oldColumn: oldColumn as { grouped_options?: Record<string, any> },
              updatedColumn: column as {
                grouped_options?: Record<string, any>;
              },
            });
          }

          await this.auditInsert(
            await generateAuditV1Payload<ColumnUpdatePayload>(
              AuditV1OperationTypes.COLUMN_UPDATE,
              {
                details: {
                  field_id: column.id,
                  field_title: column.title,
                  // ...filterAndMapAliasToColProps(
                  //   extractNonSystemProps(
                  //     removeBlankPropsAndMask({
                  //       ...(column?.colOptions ?? {}),
                  //       ...column,
                  //     }),
                  //     [
                  //       'title',
                  //       'column_name',
                  //       'altered',
                  //       'fk_qr_value_column_id',
                  //       'fk_barcode_value_column_id',
                  //       'fk_relation_column_id',
                  //       'fk_lookup_column_id',
                  //       'fk_rollup_column_id',
                  //       'lookup_column_title',
                  //       'colOptions',
                  //       'rollup_column_title',
                  //       'fk_child_column_id',
                  //       'fk_parent_column_id',
                  //       'fk_mm_model_id',
                  //       'fk_mm_child_column_id',
                  //       'fk_mm_parent_column_id',
                  //       'rollup_function',
                  //       'child_id',
                  //       'fk_column_id',
                  //       'related_model_id',
                  //     ],
                  //   ),
                  // ),
                  ...(column as object),
                  // ...(await extractRefColumnIfFound({
                  //   column: param.column,
                  //   columns: param.columns,
                  //   context: param.context,
                  // })),
                  options: Object.assign(
                    {},
                    await extractRefColumnIfFound({
                      column: param.column,
                      columns: param.columns,
                      context: param.context,
                    }),
                    (
                      column as unknown as {
                        options: Record<string, any>;
                      }
                    ).options || {},
                  ),
                  ...updatePayload,
                },
                fk_model_id: column.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.COLUMN_DELETE:
        {
          const param = data as ColumnEvent;

          const columnBuilderRef = columnBuilder();

          // update context with table & source
          Object.assign(param.context, {
            fk_model_id: param.column.fk_model_id,
            source_id: param.column.source_id,
          });

          await this.auditInsert(
            await generateAuditV1Payload<ColumnDeletePayload>(
              AuditV1OperationTypes.COLUMN_DELETE,
              {
                details: {
                  field_id: param.column.id,
                  field_title: param.column.title,
                  field_type: param.column.uidt as UITypes,
                  // ...filterAndMapAliasToColProps(
                  //   extractNonSystemProps(param.column, [
                  //     'fk_qr_value_column_id',
                  //     'fk_barcode_value_column_id',
                  //     'colOptions',
                  //   ]),
                  // ),
                  ...(columnBuilderRef.build(param.column) as object),
                  options: Object.assign(
                    {},
                    await extractRefColumnIfFound({
                      column: param.column,
                      columns: param.columns,
                      context: param.context,
                    }),
                    (
                      param.column as unknown as {
                        options: Record<string, any>;
                      }
                    ).options || {},
                  ),
                },
                fk_model_id: param.column.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
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
        {
          const param = data as OrgUserInviteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<OrgUserInvitePayload>(
              AuditV1OperationTypes.ORG_USER_INVITE,
              {
                details: {
                  fk_user_id: param.user.id,
                  email: param.user.email,
                  role: param.user.roles,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.ORG_USER_RESEND_INVITE:
        {
          const param = data as OrgUserInviteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<OrgUserInviteResendPayload>(
              AuditV1OperationTypes.ORG_USER_INVITE_RESEND,
              {
                details: {
                  fk_user_id: param.user.id,
                  email: param.user.email,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.VIEW_COLUMN_UPDATE:
        {
          const param = data as ViewColumnUpdateEvent;

          // if internal event or parent audit id is present, skip
          if (param.internal || param.req.ncParentAuditId) break;

          const updateEventPayload = populateUpdatePayloadDiff({
            prev: param.oldViewColumn,
            next: param.viewColumn,
            parseMeta: true,
            boolProps: ['show'],
          });

          if (!updateEventPayload) {
            break;
          }

          await this.auditInsert(
            await generateAuditV1Payload<ViewColumnUpdatePayload>(
              AuditV1OperationTypes.VIEW_COLUMN_UPDATE,
              {
                details: {
                  field_id: param.oldViewColumn.fk_column_id,
                  field_title: param.column.title,
                  view_id: param.oldViewColumn.fk_view_id,
                  view_type: viewTypeAlias[param.view.type],
                  view_title: param.view.title,
                  ...(extractNonSystemProps(param.viewColumn, [
                    'initialShow',
                  ]) as Pick<ViewColumnUpdatePayload, 'show' | 'system'>),
                  ...updateEventPayload,
                },
                fk_model_id: param.view.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.PROJECT_CREATE:
        {
          const param = data as ProjectCreateEvent;

          await this.auditInsert(
            await generateAuditV1Payload<BaseCreatePayload>(
              AuditV1OperationTypes.BASE_CREATE,
              {
                details: {
                  base_title: param.base.title,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.PROJECT_UPDATE:
        {
          const param = data as ProjectUpdateEvent;

          // check if workspace rename
          if (
            param.updateObj?.title &&
            param.oldBaseObj?.title !== param.updateObj.title
          ) {
            await this.auditInsert(
              await generateAuditV1Payload<BaseRenamePayload>(
                AuditV1OperationTypes.BASE_RENAME,
                {
                  details: {
                    new_base_title: param.updateObj.title,
                    old_base_title: param.oldBaseObj.title,
                  },
                  context: param.context,
                  req: param.req,
                },
              ),
            );
          }

          const updateEventPayload = populateUpdatePayloadDiff({
            prev: param.oldBaseObj,
            next: param.updateObj,
            parseMeta: true,
            boolProps: ['starred'],
            exclude: ['title'],
          });

          // check if any other update change (except title)
          if (updateEventPayload) {
            await this.auditInsert(
              await generateAuditV1Payload<BaseUpdatePayload>(
                AuditV1OperationTypes.BASE_UPDATE,
                {
                  details: {
                    base_title: param.base.title,
                    ...updateEventPayload,
                  },
                  context: param.context,
                  req: param.req,
                },
              ),
            );
          }
        }
        break;

      case AppEvents.PROJECT_DELETE:
        {
          const param = data as ProjectDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<BaseDeletePayload>(
              AuditV1OperationTypes.BASE_DELETE,
              {
                details: {
                  base_title: param.base.title,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.FORM_COLUMN_UPDATE:
        {
          const param = data as FormColumnEvent;
          // assign user to req (as this is self-event)
          await this.auditInsert(
            await generateAuditV1Payload(
              AuditV1OperationTypes.FORM_COLUMN_UPDATE,
              {
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.WORKSPACE_CREATE:
        {
          const param = data as WorkspaceEvent;

          await this.auditInsert(
            await generateAuditV1Payload<WorkspaceCreatePayload>(
              AuditV1OperationTypes.WORKSPACE_CREATE,
              {
                details: {
                  workspace_title: param.workspace.title,
                },
                context: param.context,
                req: param.req,
                fk_workspace_id: param.workspace.id,
              },
            ),
          );
        }
        break;
      case AppEvents.WORKSPACE_DELETE:
        {
          const param = data as WorkspaceEvent;

          await this.auditInsert(
            await generateAuditV1Payload<WorkspaceDeletePayload>(
              AuditV1OperationTypes.WORKSPACE_DELETE,
              {
                details: {
                  workspace_title: param.workspace.title,
                },
                fk_workspace_id: param.workspace.id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.WORKSPACE_UPDATE:
        {
          const param = data as WorkspaceUpdateEvent;

          // check if workspace rename
          if (
            param.workspace?.title &&
            param.oldWorkspace?.title !== param.workspace.title
          ) {
            await this.auditInsert(
              await generateAuditV1Payload<WorkspaceRenamePayload>(
                AuditV1OperationTypes.WORKSPACE_RENAME,
                {
                  details: {
                    new_workspace_title: param.workspace.title,
                    old_workspace_title: param.oldWorkspace.title,
                  },
                  fk_workspace_id: param.workspace.id,
                  context: param.context,
                  req: param.req,
                },
              ),
            );
          }

          const updatePayload = populateUpdatePayloadDiff({
            next: param.workspace,
            prev: param.oldWorkspace,
            parseMeta: true,
            exclude: ['title'],
          });

          if (!updatePayload) {
            break;
          }
          await this.auditInsert(
            await generateAuditV1Payload<WorkspaceUpdatePayload>(
              AuditV1OperationTypes.WORKSPACE_UPDATE,
              {
                details: {
                  workspace_title: param.workspace.title,
                  ...updatePayload,
                },
                fk_workspace_id: param.workspace.id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.WORKSPACE_USER_INVITE:
        {
          const param = data as WorkspaceUserInviteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<WorkspaceInvitePayload>(
              AuditV1OperationTypes.WORKSPACE_USER_INVITE,
              {
                details: {
                  workspace_title: param.workspace.title,
                  user_email: param.user.email,
                  user_name: param.user.display_name || undefined,
                  user_role: param.roles,
                  user_id: param.user.id,
                },
                fk_workspace_id: param.workspace.id,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.WORKSPACE_USER_DELETE:
        {
          const param = data as WorkspaceUserDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<WorkspaceUserDeletePayload>(
              AuditV1OperationTypes.WORKSPACE_USER_DELETE,
              {
                details: {
                  workspace_title: param.workspace.title,
                  user_email: param.user.email,
                  user_name: param.user.display_name ?? undefined,
                  user_id: param.user.id,
                  user_role: param.workspaceUser.roles,
                },
                fk_workspace_id: param.workspace.id,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.WORKSPACE_USER_UPDATE:
        {
          const param = data as WorkspaceUserUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            next: param.workspaceUser,
            prev: param.oldWorkspaceUser,
            aliasMap: {
              roles: 'user_role',
            },
          });

          if (!updatePayload) break;

          await this.auditInsert(
            await generateAuditV1Payload<WorkspaceUserUpdatePayload>(
              AuditV1OperationTypes.WORKSPACE_USER_UPDATE,
              {
                details: {
                  workspace_title: param.workspace.title,
                  user_email: param.user.email,
                  user_name: param.user.display_name ?? undefined,
                  user_id: param.user.id,
                  user_role: param.workspaceUser.roles,
                  ...updatePayload,
                },
                fk_workspace_id: param.workspace.id,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.INTEGRATION_CREATE:
        {
          const param = data as IntegrationEvent;

          await this.auditInsert(
            await generateAuditV1Payload<IntegrationCreatePayload>(
              AuditV1OperationTypes.INTEGRATION_CREATE,
              {
                details: {
                  integration_id: param.integration?.id,
                  integration_title: param.integration?.title,
                  integration_type: param.integration?.type,
                  ...extractNonSystemProps(param.integration, [
                    'config',
                    'title',
                    'type',
                    'is_private',
                    'is_default',
                    'is_encrypted',
                    'is_global',
                  ]),
                },

                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.INTEGRATION_UPDATE:
        {
          const param = data as IntegrationUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            next: param.integration,
            prev: param.oldIntegration,
            exclude: ['config'],
            aliasMap: {
              title: 'integration_title',
            },
          });

          const configChange = populateUpdatePayloadDiff({
            next: param.integration,
            prev: param.oldIntegration,
            aliasMap: {
              title: 'integration_title',
            },
          });

          if (!updatePayload && !configChange) break;

          await this.auditInsert(
            await generateAuditV1Payload<IntegrationUpdatePayload>(
              AuditV1OperationTypes.INTEGRATION_UPDATE,
              {
                details: {
                  integration_id: param.integration?.id,
                  integration_type: param.integration?.type,
                  integration_title: param.integration?.title,
                  ...(updatePayload || {
                    previous_state: {
                      config: {},
                    },
                  }),
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.INTEGRATION_DELETE:
        {
          const param = data as IntegrationEvent;

          await this.auditInsert(
            await generateAuditV1Payload<IntegrationDeletePayload>(
              AuditV1OperationTypes.INTEGRATION_DELETE,
              {
                details: {
                  integration_id: param.integration?.id,
                  integration_title: param.integration?.title,
                  integration_type: param.integration?.type,
                  ...extractNonSystemProps(param.integration, [
                    'config',
                    'config',
                    'title',
                    'type',
                    'is_private',
                    'is_default',
                    'is_encrypted',
                    'is_global',
                    'sources',
                  ]),
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SNAPSHOT_CREATE:
        {
          const param = data as SnapshotEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SnapshotPayload>(
              AuditV1OperationTypes.SNAPSHOT_CREATE,
              {
                details: {
                  snapshot_id: param.snapshot.id,
                  snapshot_title: param.snapshot.title,
                  base_title: param.base.title,
                  snapshot_base_id: param.snapshot.snapshot_base_id,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.SNAPSHOT_DELETE:
        {
          const param = data as SnapshotDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SnapshotPayload>(
              AuditV1OperationTypes.SNAPSHOT_DELETE,
              {
                details: {
                  snapshot_id: param.snapshot.id,
                  snapshot_title: param.snapshot.title,
                  base_title: param.base.title,
                  snapshot_base_id: param.snapshot.snapshot_base_id,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.SNAPSHOT_RESTORE:
        {
          const param = data as SnapshotRestoreEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SnapshotRestorePayload>(
              AuditV1OperationTypes.SNAPSHOT_RESTORE,
              {
                details: {
                  snapshot_id: param.snapshot.id,
                  snapshot_title: param.snapshot.title,
                  base_title: param.sourceBase.title,
                  target_base_id: param.targetBase.id,
                  target_base_title: param.targetBase.title,
                  snapshot_base_id: param.snapshot.snapshot_base_id,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.DATA_EXPORT:
        {
          const param = data as DataExportEvent;

          await this.auditInsert(
            await generateAuditV1Payload<DataExportPayload>(
              AuditV1OperationTypes.DATA_EXPORT,
              {
                details: {
                  export_type: param.type,
                  table_id: param.table.id,
                  table_title: param.table.title,
                  view_id: param.view.id,
                  view_title: param.view.title,
                },
                fk_model_id: param.view.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.DATA_IMPORT:
        {
          const param = data as DataImportEvent;

          await this.auditInsert(
            await generateAuditV1Payload<DataImportPayload>(
              AuditV1OperationTypes.DATA_IMPORT,
              {
                details: {
                  import_type: param.type,
                  table_id: param.table.id,
                  table_title: param.table.title,
                  view_id: param.view.id,
                  view_title: param.view.title,
                },
                context: param.context,
                req: param.req,
                fk_model_id: param.view.fk_model_id,
                id: param.id,
              },
            ),
          );
        }
        break;

      case AppEvents.GRID_CREATE:
        {
          const param = data as ViewCreateEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewCreatePayload>(
              AuditV1OperationTypes.VIEW_CREATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'grid',
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  ...extractNonSystemProps(param.view, [
                    'title',
                    'type',
                    'id',
                    'fk_mode_id',
                    'owned_by',
                    'show',
                    'filter',
                  ]),
                },
                context: param.context,
                req: param.req,
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
              },
            ),
          );
        }
        break;
      case AppEvents.GRID_COLUMN_UPDATE:
        break;
      case AppEvents.GRID_DELETE:
        {
          const param = data as ViewDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewDeletePayload>(
              AuditV1OperationTypes.VIEW_DELETE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  view_type: 'grid',
                  ...extractNonSystemProps(param.view, [
                    'title',
                    'type',
                    'id',
                    'fk_mode_id',
                    'owned_by',
                    'show',
                  ]),
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.FORM_CREATE:
        {
          const param = data as ViewCreateEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewCreatePayload>(
              AuditV1OperationTypes.VIEW_CREATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'form',
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  ...extractNonSystemProps(param.view, [
                    'title',
                    'type',
                    'id',
                    'fk_mode_id',
                    'owned_by',
                    'show',
                  ]),
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.FORM_UPDATE:
      case AppEvents.GRID_UPDATE:
      case AppEvents.CALENDAR_UPDATE:
      case AppEvents.GALLERY_UPDATE:
      case AppEvents.KANBAN_UPDATE:
      case AppEvents.VIEW_UPDATE:
        {
          const param = data as
            | FormViewUpdateEvent
            | GridViewUpdateEvent
            | GalleryViewUpdateEvent
            | CalendarViewUpdateEvent
            | KanbanViewUpdateEvent
            | ViewUpdateEvent;
          const type: string = viewTypeAlias[param.view.type];

          let next;
          let prev;
          let boolProps = ['show'];
          let metaProps = ['meta'];

          switch (event) {
            case AppEvents.FORM_UPDATE:
              next = (param as FormViewUpdateEvent).formView;
              prev = (param as FormViewUpdateEvent).oldFormView;
              boolProps = ['submit_another_form', 'show_blank_form', 'show'];
              metaProps = ['meta', 'email'];
              break;
            case AppEvents.GRID_UPDATE:
              next = await extractViewRelatedProps({
                view: (param as GridViewUpdateEvent).gridView,
                context: param.context,
              });
              prev = await extractViewRelatedProps({
                view: (param as GridViewUpdateEvent).oldGridView,
                context: param.context,
              });
              break;
            case AppEvents.CALENDAR_UPDATE:
              next = await extractViewRelatedProps({
                view: (param as CalendarViewUpdateEvent).calendarView,
                context: param.context,
              });
              prev = await extractViewRelatedProps({
                view: (param as CalendarViewUpdateEvent).oldCalendarView,
                context: param.context,
              });
              break;
            case AppEvents.GALLERY_UPDATE:
              next = await extractViewRelatedProps({
                view: (param as GalleryViewUpdateEvent).galleryView,
                context: param.context,
              });
              prev = await extractViewRelatedProps({
                view: (param as GalleryViewUpdateEvent).oldGalleryView,
                context: param.context,
              });
              break;
            case AppEvents.KANBAN_UPDATE:
              next = await extractViewRelatedProps({
                view: (param as KanbanViewUpdateEvent).kanbanView,
                context: param.context,
              });
              prev = await extractViewRelatedProps({
                view: (param as KanbanViewUpdateEvent).oldKanbanView,
                context: param.context,
              });
              break;
            case AppEvents.VIEW_UPDATE:
              next = (param as ViewUpdateEvent).view;
              prev = (param as ViewUpdateEvent).oldView;
              break;
          }

          next = extractAttachmentPropsAndFormat(next);
          prev = extractAttachmentPropsAndFormat(prev);

          // check if view rename
          if (next?.title && next?.title !== prev?.title) {
            await this.auditInsert(
              await generateAuditV1Payload<ViewRenamePayload>(
                AuditV1OperationTypes.VIEW_RENAME,
                {
                  details: {
                    new_view_title: next.title,
                    old_view_title: prev.title,
                    view_type: type,
                    view_id: param.view.id,
                  },
                  fk_model_id: param.view.fk_model_id,
                  context: param.context,
                  req: param.req,
                },
              ),
            );
          }

          parseMetaIfFound({ payloads: [next, prev], metaProps });

          const payloadDiff = populateUpdatePayloadDiff({
            next,
            prev,
            boolProps,
            parseMeta: true,
            exclude: [
              'title',
              'password',
              'uuid',
              'fk_cover_image_col_id',
              'fk_grp_col_id',
              'owned_by',
            ],
            aliasMap: {
              owned_by: 'view_owner_id',
            },
          });

          if (!payloadDiff) {
            break;
          }

          // if previous state include view_owner_id, then extract corresponding user details and include in payload
          if ('view_owner_id' in payloadDiff.previous_state) {
            const user = await User.get(
              payloadDiff.previous_state.view_owner_id,
            );
            payloadDiff.previous_state.view_owner_email = user?.email;
            payloadDiff.previous_state.view_owner_name =
              user?.display_name ?? undefined;
          }

          await this.auditInsert(
            await generateAuditV1Payload<ViewUpdatePayload>(
              AuditV1OperationTypes.VIEW_UPDATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: type,
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  view_owner_name: param.owner?.display_name ?? undefined,
                  ...extractAttachmentPropsAndFormat(
                    extractNonSystemProps(
                      {
                        ...param.view,
                        meta: param.view?.meta && {
                          ...((param.view.meta as any) || {}),
                          allowCSVDownload: undefined,
                        },
                        ...next,
                      },
                      ['title', 'type', 'id', 'fk_mode_id', 'owned_by', 'show'],
                    ),
                  ),
                  ...payloadDiff,
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.FORM_DELETE:
        {
          const param = data as ViewDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewDeletePayload>(
              AuditV1OperationTypes.VIEW_DELETE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'form',
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  ...extractAttachmentPropsAndFormat(
                    extractNonSystemProps(param.view, [
                      'title',
                      'type',
                      'id',
                      'fk_mode_id',
                      'owned_by',
                      'show',
                      ...((event as AppEvents) !== AppEvents.CALENDAR_UPDATE
                        ? ['calendar_range']
                        : []),
                    ]),
                  ),
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.KANBAN_CREATE:
        {
          const param = data as ViewCreateEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewCreatePayload>(
              AuditV1OperationTypes.VIEW_CREATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'kanban',
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  ...extractNonSystemProps(
                    await extractViewRelatedProps({
                      view: param.view,
                      context: param.context,
                    }),
                    [
                      'title',
                      'type',
                      'id',
                      'fk_mode_id',
                      'owned_by',
                      'show',
                      'calendar_range',
                      'filter',
                    ],
                  ),
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.KANBAN_DELETE:
        {
          const param = data as ViewDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewDeletePayload>(
              AuditV1OperationTypes.VIEW_DELETE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'kanban',
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  ...extractNonSystemProps(
                    await extractViewRelatedProps({
                      view: param.view,
                      context: param.context,
                    }),
                    [
                      'title',
                      'type',
                      'id',
                      'fk_mode_id',
                      'owned_by',
                      'show',
                      'calendar_range',
                    ],
                  ),
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.GALLERY_CREATE:
        {
          const param = data as ViewCreateEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewCreatePayload>(
              AuditV1OperationTypes.VIEW_CREATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'gallery',
                  ...extractNonSystemProps(
                    await extractViewRelatedProps({
                      view: param.view,
                      context: param.context,
                    }),
                    [
                      'title',
                      'type',
                      'id',
                      'fk_mode_id',
                      'owned_by',
                      'show',
                      'calendar_range',
                      'filter',
                    ],
                  ),
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.GALLERY_DELETE:
        {
          const param = data as ViewDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewDeletePayload>(
              AuditV1OperationTypes.VIEW_DELETE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'gallery',
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  ...extractNonSystemProps(
                    await extractViewRelatedProps({
                      view: param.view,
                      context: param.context,
                    }),
                    [
                      'title',
                      'type',
                      'id',
                      'fk_model_id',
                      'owned_by',
                      'show',
                      'calendar_range',
                    ],
                  ),
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.CALENDAR_CREATE:
        {
          const param = data as ViewCreateEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewCreatePayload>(
              AuditV1OperationTypes.VIEW_CREATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'calendar',
                  ...extractNonSystemProps(
                    await extractViewRelatedProps(param),
                    ['title', 'type', 'id', 'fk_mode_id', 'owned_by', 'show'],
                  ),
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                },
                fk_model_id: param.view.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.CALENDAR_DELETE:
        {
          const param = data as ViewDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ViewDeletePayload>(
              AuditV1OperationTypes.VIEW_DELETE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: 'calendar',
                  view_owner_id: param.owner?.id,
                  view_owner_email: param.owner?.email,
                  ...extractNonSystemProps(
                    await extractViewRelatedProps(param),
                    ['title', 'type', 'id', 'fk_mode_id', 'owned_by', 'show'],
                  ),
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.FILTER_CREATE:
        {
          const param = data as FilterEvent;

          let event = AuditV1OperationTypes.VIEW_FILTER_CREATE;
          let fk_model_id = param.column?.fk_model_id;
          let filterPayload: FilterPayload;

          if (param['hook'] || param.filter.fk_hook_id) {
            event = AuditV1OperationTypes.HOOK_FILTER_CREATE;
            fk_model_id = param['hook']?.fk_model_id;
            filterPayload = {
              hook_title: param['hook']?.title,
              hook_id: param['hook']?.id,
            };
          } else if (param['view'] || param.filter.fk_view_id) {
            event = AuditV1OperationTypes.VIEW_FILTER_CREATE;
            fk_model_id = param['view']?.fk_model_id;
            filterPayload = {
              view_title: param['view']?.title,
              view_id: param['view']?.id,
              view_type: viewTypeAlias[param['view'].type],
            };
          } else if (param.filter.fk_link_col_id) {
            event = AuditV1OperationTypes.LINK_FILTER_CREATE;
            filterPayload = {
              link_field_title:
                param['linkColumn']?.title ||
                (
                  await Column.get(param.context, {
                    colId: param.filter.fk_link_col_id,
                  })
                ).title,
              link_field_id:
                param['linkColumn']?.id ||
                (
                  await Column.get(param.context, {
                    colId: param.filter.fk_link_col_id,
                  })
                )?.id,
            };
          }

          await this.auditInsert(
            await generateAuditV1Payload<FilterCreatePayload>(event, {
              details: {
                ...(mapAlias(
                  extractNonSystemProps(param.filter, [
                    'fk_link_col_id',
                    'link_col_id',
                    'fk_column_id',
                  ]),
                ) as { filter_comparison_op: string }),
                filter_id: param.filter.id,
                ...(param.filter?.is_group
                  ? {}
                  : {
                      filter_field_id: param.filter.fk_column_id,
                      filter_field_title:
                        param.column?.title ||
                        (
                          await Column.get(param.context, {
                            colId: param.filter.fk_column_id,
                          })
                        ).title,
                    }),
                ...filterPayload,
              },
              context: param.context,
              req: param.req,
              fk_model_id: fk_model_id || param.column?.fk_model_id,
              source_id: param.filter.source_id,
            }),
          );
        }
        break;
      case AppEvents.FILTER_UPDATE:
        {
          const param = data as FilterUpdateEvent;

          let event = AuditV1OperationTypes.VIEW_FILTER_UPDATE;
          let filterPayload: FilterPayload;

          if ('hook' in param && param.hook) {
            event = AuditV1OperationTypes.HOOK_FILTER_UPDATE;
            filterPayload = {
              hook_title: param.hook.title,
              hook_id: param.hook.id,
            };
          } else if ('view' in param && param.view) {
            event = AuditV1OperationTypes.VIEW_FILTER_UPDATE;
            filterPayload = {
              view_title: param.view.title,
              view_id: param.view.id,
              view_type: viewTypeAlias[param.view.type],
            };
          } else if (param.filter.fk_link_col_id) {
            event = AuditV1OperationTypes.LINK_FILTER_UPDATE;
            filterPayload = {
              link_field_title:
                (param as unknown as { linkColumn: ColumnType }).linkColumn
                  ?.title ||
                (
                  await Column.get(param.context, {
                    colId: param.filter.fk_link_col_id,
                  })
                )?.title,
              link_field_id:
                (param as unknown as { linkColumn: ColumnType }).linkColumn
                  ?.id ||
                (
                  await Column.get(param.context, {
                    colId: param.filter.fk_link_col_id,
                  })
                )?.id,
            };
          }

          const payloadDiff = populateUpdatePayloadDiff({
            prev: param.oldFilter,
            next: param.filter,
            exclude: ['status', 'children'],
            replaceAlias: true,
          });

          if (!payloadDiff) {
            break;
          }

          await this.auditInsert(
            await generateAuditV1Payload<FilterUpdatePayload>(event, {
              details: {
                filter_id: param.filter.id,
                ...(param.filter?.is_group
                  ? {}
                  : {
                      filter_field_id: param.filter.fk_column_id,
                      filter_field_title:
                        param.column?.title ||
                        (
                          await Column.get(param.context, {
                            colId: param.filter.fk_column_id,
                          })
                        ).title,
                    }),
                ...mapAlias(
                  extractNonSystemProps(param.filter, [
                    'status',
                    'link_col_id',
                    'fk_link_col_id',
                    'fk_column_id',
                    'column_id',
                  ]),
                ),
                ...payloadDiff,
                ...filterPayload,
                children: undefined,
              } as unknown as FilterUpdatePayload,
              fk_model_id:
                ('hook' in param && param.hook?.fk_model_id) ||
                ('view' in param && param.view?.fk_model_id) ||
                ('linkColumn' in param && param.linkColumn?.fk_model_id) ||
                param.column?.fk_model_id,
              source_id: param.filter.source_id,
              context: param.context,
              req: param.req,
            }),
          );
        }
        break;
      case AppEvents.FILTER_DELETE:
        {
          const param = data as FilterEvent;

          let event = AuditV1OperationTypes.VIEW_FILTER_DELETE;

          let filterPayload: FilterPayload;

          if ('hook' in param && param.hook) {
            event = AuditV1OperationTypes.HOOK_FILTER_DELETE;
            filterPayload = {
              hook_title: param.hook.title,
              hook_id: param.hook.id,
            };
          } else if ('view' in param && param.view) {
            event = AuditV1OperationTypes.VIEW_FILTER_DELETE;
            filterPayload = {
              view_title: param.view?.title,
              view_id: param.view?.id,
              view_type: viewTypeAlias[param.view.type],
            };
          } else if (param.filter.fk_link_col_id) {
            event = AuditV1OperationTypes.LINK_FILTER_DELETE;
            filterPayload = {
              link_field_title:
                ('linkColumn' in param && param.linkColumn?.title) ||
                (
                  await Column.get(param.context, {
                    colId: param.filter.fk_link_col_id,
                  })
                )?.title,
              link_field_id:
                ('linkColumn' in param && param.linkColumn?.id) ||
                (
                  await Column.get(param.context, {
                    colId: param.filter.fk_link_col_id,
                  })
                )?.id,
            };
          }

          const filterField =
            param.column ||
            (await Column.get(param.context, {
              colId: param.filter.fk_column_id,
            }));

          await this.auditInsert(
            await generateAuditV1Payload<FilterDeletePayload>(event, {
              details: {
                ...mapAlias(
                  extractNonSystemProps(param.filter, [
                    'status',
                    'fk_column_id',
                    'link_col_id',
                    'fk_link_col_id',
                  ]),
                ),
                filter_id: param.filter.id,
                filter_field_title: filterField?.title,
                filter_field_id: param.filter.fk_column_id,
                ...filterPayload,
              },
              context: param.context,
              fk_model_id:
                param['hook']?.fk_model_id ||
                param['view']?.fk_model_id ||
                filterField?.fk_model_id,
              req: param.req,
            }),
          );
        }
        break;

      case AppEvents.WEBHOOK_CREATE:
        {
          const param = data as WebhookEvent;
          const hook = { ...param.hook };

          parseMetaIfFound({
            payloads: [hook],
            metaProps: ['notification'],
          });

          const notification = hook.notification as any;

          // exclude empty headers and parameters
          if (
            notification?.payload?.headers &&
            Array.isArray(notification.payload.headers)
          ) {
            notification.payload.headers = notification.payload.headers.filter(
              (header: any) => {
                return header.name || header.value;
              },
            );
          }
          if (
            notification?.payload?.parameters &&
            Array.isArray(notification.payload.parameters)
          ) {
            notification.payload.parameters =
              notification.payload.parameters.filter((param: any) => {
                return param.name || param.value;
              });
          }

          await this.auditInsert(
            await generateAuditV1Payload<HookCreatePayload>(
              AuditV1OperationTypes.HOOK_CREATE,
              {
                details: {
                  hook_title: param.hook.title,
                  hook_id: param.hook.id,
                  ...extractNonSystemProps(hook, [
                    'title',
                    'retries',
                    'retry_interval',
                    'timeout',
                    'async',
                    'condition',
                    'retry',
                    'retry_interval',
                    'timeout',
                    'env',
                    'event',
                    'payload',
                    'eventOperation',
                    'fk_model_id',
                  ]),
                },
                fk_model_id: param.hook.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.WEBHOOK_UPDATE:
        {
          const param = data as WebhookUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            prev: param.oldHook,
            next: param.hook,
            parseMeta: true,
            metaProps: ['notification'],
            exclude: ['eventOperation', 'condition'],
            aliasMap: {
              title: 'hook_title',
            },
          });

          if (!updatePayload) break;

          // todo: refactor and move to utils
          // if headers or parameters are updated, then keep the entire array as it is
          if (
            (updatePayload?.notification as any)?.payload?.parameters &&
            Object.keys((updatePayload.notification as any).payload.parameters)
              .length
          ) {
            (updatePayload.notification as any).payload.parameters = (
              param.hook?.notification as any
            )?.payload?.parameters;
            (
              updatePayload.previous_state.notification as any
            ).payload.parameters = (
              param.oldHook?.notification as any
            )?.payload?.parameters;
          }

          if (
            (updatePayload?.notification as any)?.payload?.headers &&
            Object.keys((updatePayload.notification as any).payload.headers)
              .length
          ) {
            (updatePayload.notification as any).payload.headers = (
              param.hook?.notification as any
            )?.payload?.headers;
            (updatePayload.previous_state.notification as any).payload.headers =
              (param.oldHook?.notification as any)?.payload?.headers;
          }

          await this.auditInsert(
            await generateAuditV1Payload<HookUpdatePayload>(
              AuditV1OperationTypes.HOOK_UPDATE,
              {
                details: {
                  hook_title: param.hook.title,
                  hook_id: param.hook.id,
                  ...updatePayload,
                },
                fk_model_id: param.tableId,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.WEBHOOK_DELETE:
        {
          const param = data as WebhookEvent;
          const hook = { ...param.hook };
          parseMetaIfFound({
            payloads: [hook],
            metaProps: ['notification'],
          });

          await this.auditInsert(
            await generateAuditV1Payload<HookDeletePayload>(
              AuditV1OperationTypes.HOOK_DELETE,
              {
                details: {
                  hook_id: param.hook.id,
                  hook_title: param.hook.title,
                  ...extractNonSystemProps(hook, [
                    'title',
                    'retries',
                    'retry_interval',
                    'timeout',
                    'async',
                    'condition',
                    'retry',
                    'retry_interval',
                    'timeout',
                    'env',
                    'event',
                    'eventOperation',
                    'fk_model_id',
                  ]),
                },
                fk_model_id: param.tableId,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SORT_CREATE:
        {
          const param = data as SortEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SortCreatePayload>(
              AuditV1OperationTypes.VIEW_SORT_CREATE,
              {
                details: {
                  sort_id: param.sort.id,
                  view_id: param.view.id,
                  view_title: param.view.title,
                  sort_field_id: param.sort.fk_column_id,
                  sort_field_title: param.column.title,
                  ...extractNonSystemProps(param.sort, ['fk_column_id']),
                },
                fk_model_id: param.view?.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.SORT_UPDATE:
        {
          // todo: add separate event for all update ad make oldSort required
          const param = data as SortUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            prev: param.oldSort,
            next: param.sort,
          });

          if (!updatePayload) break;

          await this.auditInsert(
            await generateAuditV1Payload<SortUpdatePayload>(
              AuditV1OperationTypes.VIEW_SORT_UPDATE,
              {
                details: {
                  sort_field_id: param.sort.fk_column_id,
                  sort_field_title: param.column.title,
                  sort_id: param.sort.id,
                  view_id: param.view.id,
                  view_title: param.view.title,
                  ...extractNonSystemProps(param.sort, [
                    'fk_view_id',
                    'id',
                    'fk_column_id',
                  ]),
                  ...updatePayload,
                },
                fk_model_id: param.view?.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.SORT_DELETE:
        {
          const param = data as SortEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SortDeletePayload>(
              AuditV1OperationTypes.VIEW_SORT_DELETE,
              {
                details: {
                  sort_id: param.sort.id,
                  view_id: param.view.id,
                  view_title: param.view.title,
                  sort_field_id: param.sort.fk_column_id,
                  sort_field_title: param.column.title,
                  ...extractNonSystemProps(param.sort, [
                    'fk_view_id',
                    'id',
                    'fk_column_id',
                  ]),
                },
                fk_model_id: param.view?.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.API_TOKEN_CREATE:
      case AppEvents.ORG_API_TOKEN_CREATE:
        {
          const param = data as ApiTokenCreateEvent;

          await this.auditInsert(
            await generateAuditV1Payload<APITokenCreatePayload>(
              AuditV1OperationTypes.API_TOKEN_CREATE,
              {
                details: {
                  token_title: param.tokenTitle,
                  token_id: param.tokenId + '',
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.API_TOKEN_DELETE:
      case AppEvents.ORG_API_TOKEN_DELETE:
        {
          const param = data as ApiTokenDeleteEvent;

          await this.auditInsert(
            await generateAuditV1Payload<APITokenDeletePayload>(
              AuditV1OperationTypes.API_TOKEN_DELETE,
              {
                details: {
                  token_title: param.tokenTitle,
                  token_id: param.tokenId + '',
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SHARED_VIEW_CREATE:
        {
          const param = data as ViewEvent;

          parseMetaIfFound({ payloads: [param.view] });

          await this.auditInsert(
            await generateAuditV1Payload<SharedViewCreatePayload>(
              AuditV1OperationTypes.SHARED_VIEW_CREATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: viewTypeAlias[param.view.type],
                  ...extractNonSystemProps(param.view, [
                    'type',
                    'order',
                    'is_default',
                    'description',
                    'created_by',
                    'title',
                    'lock_type',
                    'owned_by',
                    'show',
                    'model_id',
                  ]),
                },
                source_id: param.view.source_id,
                fk_model_id: param.view.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SHARED_VIEW_UPDATE:
        {
          const param = data as SharedViewUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            next: param.sharedView,
            prev: param.oldSharedView,
            parseMeta: true,
            exclude: [
              'description',
              'created_by',
              'title',
              'lock_type',
              'owned_by',
              'show',
              'model_id',
            ],
          });

          if (!updatePayload) break;

          await this.auditInsert(
            await generateAuditV1Payload<SharedViewUpdatePayload>(
              AuditV1OperationTypes.SHARED_VIEW_UPDATE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: viewTypeAlias[param.view.type],
                  ...mapAlias(
                    extractNonSystemProps(param.sharedView, [
                      'type',
                      'order',
                      'is_default',
                      'description',
                      'created_by',
                      'title',
                      'lock_type',
                      'owned_by',
                      'show',
                      'model_id',
                    ]),
                  ),
                  ...updatePayload,
                },
                source_id: param.view.source_id,
                fk_model_id: param.view.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }

        break;

      case AppEvents.SHARED_VIEW_DELETE:
        {
          const param = data as ViewEvent;

          parseMetaIfFound({ payloads: [param.view] });

          await this.auditInsert(
            await generateAuditV1Payload<SharedViewDeletePayload>(
              AuditV1OperationTypes.SHARED_VIEW_DELETE,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  view_type: viewTypeAlias[param.view.type],
                  ...extractNonSystemProps(param.view, [
                    'type',
                    'order',
                    'is_default',
                    'description',
                    'created_by',
                    'title',
                    'lock_type',
                    'owned_by',
                    'show',
                    'model_id',
                  ]),
                },
                source_id: param.view.source_id,
                fk_model_id: param.view.fk_model_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SHARED_BASE_GENERATE_LINK:
        {
          const param = data as SharedBaseEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SharedBasePayload>(
              AuditV1OperationTypes.SHARED_BASE_CREATE,
              {
                details: {
                  base_title: param.base.title,
                  uuid: param.uuid,
                  custom_url_id: param.customUrl?.id ?? undefined,
                  custom_url: param.customUrl?.original_path ?? undefined,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      case AppEvents.SHARED_BASE_DELETE_LINK:
        {
          const param = data as SharedBaseEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SharedBasePayload>(
              AuditV1OperationTypes.SHARED_BASE_DELETE,
              {
                details: {
                  base_title: param.base.title,
                  uuid: param.uuid,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SOURCE_CREATE:
        {
          const param = data as SourceEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SourceCreatePayload>(
              AuditV1OperationTypes.SOURCE_CREATE,
              {
                details: {
                  source_title: param.source.alias,
                  source_id: param.source.id,
                  is_data_readonly: !!param.source.is_data_readonly,
                  is_schema_readonly: !!param.source.is_schema_readonly,
                  source_integration_id: param.source.fk_integration_id,
                  source_integration_title: param.integration?.title,
                },
                source_id: param.source.id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SOURCE_UPDATE:
        {
          const param = data as SourceUpdateEvent;

          const updatePayload = populateUpdatePayloadDiff({
            prev: param.oldSource,
            next: param.source,
            exclude: ['config'],
            aliasMap: {
              alias: 'source_title',
            },
            boolProps: ['is_data_readonly', 'is_schema_readonly'],
          });

          if (!updatePayload) {
            break;
          }

          await this.auditInsert(
            await generateAuditV1Payload<SourceUpdatePayload>(
              AuditV1OperationTypes.SOURCE_UPDATE,
              {
                details: {
                  source_title: param.source.alias,
                  source_id: param.source.id,
                  source_integration_id: param.source.fk_integration_id,
                  source_integration_title: param.integration?.title,
                  is_data_readonly: !!param.source.is_data_readonly,
                  is_schema_readonly: !!param.source.is_schema_readonly,
                  ...updatePayload,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.SOURCE_DELETE:
        {
          const param = data as SourceEvent;

          await this.auditInsert(
            await generateAuditV1Payload<SourceDeletePayload>(
              AuditV1OperationTypes.SOURCE_DELETE,
              {
                details: {
                  source_title: param.source.alias,
                  source_id: param.source.id,
                  is_data_readonly: !!param.source.is_data_readonly,
                  is_schema_readonly: !!param.source.is_schema_readonly,
                  source_integration_id: param.source.fk_integration_id,
                  source_integration_title: param.integration?.title,
                },
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;

      case AppEvents.BASE_DUPLICATE_START:
      case AppEvents.BASE_DUPLICATE_FAIL:
        {
          const param = data as BaseDuplicateEvent;

          let auditEvent = AuditV1OperationTypes.BASE_DUPLICATE;
          if (event === AppEvents.BASE_DUPLICATE_FAIL) {
            auditEvent = AuditV1OperationTypes.BASE_DUPLICATE_ERROR;
          }

          await this.auditInsert(
            await generateAuditV1Payload<BaseDuplicatePayload>(auditEvent, {
              details: {
                source_base_title: param.sourceBase.title,
                source_base_id: param.sourceBase.id,
                duplicated_base_title: param.destBase?.title,
                duplicated_base_id: param.destBase?.id,
                error: param.error ?? undefined,
                options: param.options && transformToSnakeCase(param.options),
              },
              context: param.context,
              req: param.req,
              id: param.id,
            }),
          );
        }
        break;

      case AppEvents.TABLE_DUPLICATE_START:
      case AppEvents.TABLE_DUPLICATE_FAIL:
        {
          const param = data as TableDuplicateEvent;
          let auditEvent = AuditV1OperationTypes.TABLE_DUPLICATE;
          if (event === AppEvents.TABLE_DUPLICATE_FAIL) {
            auditEvent = AuditV1OperationTypes.TABLE_DUPLICATE_ERROR;
          }

          await this.auditInsert(
            await generateAuditV1Payload<TableDuplicatePayload>(auditEvent, {
              details: {
                source_table_title: param.sourceTable.title,
                source_table_id: param.sourceTable.id,
                duplicated_table_title: param.destTable?.title,
                duplicated_table_id: param.destTable?.id,
                error: param.error ?? undefined,
                options: param.options && transformToSnakeCase(param.options),
              },
              // todo: decide on target/source id
              fk_model_id: param.destTable?.id,
              source_id: param.sourceTable.source_id,
              context: param.context,
              req: param.req,
              id: param.id,
            }),
          );
        }
        break;
      case AppEvents.COLUMN_DUPLICATE_START:
      case AppEvents.COLUMN_DUPLICATE_FAIL:
        {
          const param = data as ColumnDuplicateEvent;

          let auditEvent = AuditV1OperationTypes.COLUMN_DUPLICATE;
          if (event === AppEvents.COLUMN_DUPLICATE_FAIL) {
            auditEvent = AuditV1OperationTypes.COLUMN_DUPLICATE_ERROR;
          }

          await this.auditInsert(
            await generateAuditV1Payload<ColumnDuplicatePayload>(auditEvent, {
              details: {
                source_field_title: param.sourceColumn.title,
                source_field_id: param.sourceColumn.id,
                duplicated_field_title: param.destColumn?.title,
                duplicated_field_id: param.destColumn?.id,
                error: param.error ?? undefined,
                options: param.options && transformToSnakeCase(param.options),
              },
              context: param.context,
              source_id: param.sourceColumn.source_id,
              fk_model_id: param.sourceColumn.fk_model_id,
              req: param.req,
              id: param.id,
            }),
          );
        }
        break;
      case AppEvents.VIEW_DUPLICATE_START:
      case AppEvents.VIEW_DUPLICATE_FAIL:
        {
          const param = data as ViewDuplicateEvent;

          let auditEvent = AuditV1OperationTypes.VIEW_DUPLICATE;
          if (event === AppEvents.VIEW_DUPLICATE_FAIL) {
            auditEvent = AuditV1OperationTypes.VIEW_DUPLICATE_ERROR;
          }

          await this.auditInsert(
            await generateAuditV1Payload<ViewDuplicatePayload>(auditEvent, {
              details: {
                duplicated_view_title: param.destView.title,
                duplicated_view_id: param.destView.id,
                source_view_title: param.sourceView.title,
                source_view_id: param.sourceView.id,
                view_type: viewTypeAlias[param.sourceView.type],
                error: param.error ?? undefined,
              },
              context: param.context,
              req: param.req,
              id: param.id,
            }),
          );
        }
        break;

      case AppEvents.UI_ACL:
        {
          const param = data as ModelRoleVisibilityEvent;

          await this.auditInsert(
            await generateAuditV1Payload<ModelRoleVisibilityPayload>(
              AuditV1OperationTypes.UI_ACL,
              {
                details: {
                  view_title: param.view.title,
                  view_id: param.view.id,
                  role: param.role,
                  disabled: param.disabled,
                },
                fk_model_id: param.view.fk_model_id,
                source_id: param.view.source_id,
                context: param.context,
                req: param.req,
              },
            ),
          );
        }
        break;
      default:
        {
          // if not handled, pass to parent
          return super.hookHandler({ event, data });
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

  async auditInsert(param: Partial<Audit>) {
    // if(NcConfig.isAuditEnabled)
    await Audit.insert(param);
  }
}
