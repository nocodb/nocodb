import { WebhookEvents } from 'nocodb-sdk';
import { WebhookInvoker as WebhookInvokerCE } from 'src/utils/webhook-invoker';
import { v4 as uuidv4 } from 'uuid';
import type { HookPayloadType } from 'src/utils/webhook-invoker';
import type { HookLogType, NcContext, TableType, ViewType } from 'nocodb-sdk';
import type { Filter } from '~/models';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/ncError';
import { addDummyRootAndNest } from '~/services/v3/filters-v3.service';
import { filterBuilder } from '~/utils/api-v3-data-transformation.builder';
import { type Hook, HookLog, type Model, type View } from '~/models';
import {
  handleHttpWebHook,
  parseBody,
  sanitizeUserForHook,
} from '~/helpers/webhookHelpers';
import { isEE, isOnPrem } from '~/utils';
import { parseMetaProp } from '~/utils/modelUtils';

export class WebhookInvoker extends WebhookInvokerCE {
  override async invoke(
    context: NcContext,
    param: {
      hook: Hook;
      model: Model;
      view: View;
      hookName: string;
      prevData;
      newData;
      user;
      testFilters?;
      throwErrorOnFailure?: boolean;
      testHook?: boolean;
      ncSiteUrl?: string;
      addJob?: (name: string, data: any) => Promise<void>;
    },
  ) {
    const { hookName } = param;

    if (hookName) {
      const [event, _operation] = hookName.split('.');
      if ([WebhookEvents.VIEW, WebhookEvents.FIELD].includes(event)) {
        return this.invokeMetaEvent(context, param);
      }
    }
    return super.invoke(context, param);
  }

  override constructWebHookData(
    hook: HookPayloadType,
    model: Model | TableType,
    _view: View | ViewType,
    prevData: any,
    newData: any,
    user = null,
  ) {
    if ((hook.event as any) === WebhookEvents.VIEW) {
      return this.constructViewWebHookData(
        hook,
        model,
        _view,
        prevData,
        newData,
        user,
      );
    } else if ((hook.event as any) === WebhookEvents.FIELD) {
      return this.constructColumnWebHookData(
        hook,
        model,
        _view,
        prevData,
        newData,
        user,
      );
    }
    return super.constructWebHookData(
      hook,
      model,
      _view,
      prevData,
      newData,
      user,
    );
  }
  constructViewWebHookData(
    hook: HookPayloadType,
    model: Model | TableType,
    _view: View | ViewType,
    prevData: any,
    newData: any,
    user = null,
  ) {
    // Check for include_user in notification object first, fall back to hook.include_user for backward compatibility
    const includeUser = parseMetaProp(hook, 'notification')?.include_user;

    return {
      type: `${hook.event}.after.${
        hook.operation === 'insert' ? 'create' : hook.operation
      }`,
      id: uuidv4(),
      base_id: model.base_id,
      ...(includeUser && isEE && user
        ? { user: sanitizeUserForHook(user) }
        : {}),
      version: hook.version,
      data: {
        table_id: model.id,
        table_name: model.title,
        // webhook are table specific, so no need to send view_id and view_name
        // view_id: view?.id,
        // view_name: view?.title,
        ...(prevData &&
          (hook.operation as any) !== 'delete' && {
            previous_views: Array.isArray(prevData) ? prevData : [prevData],
          }),
        ...(prevData &&
          (hook.operation as any) === 'delete' && {
            views: Array.isArray(prevData) ? prevData : [prevData],
          }),
        ...(newData && {
          views: Array.isArray(newData) ? newData : [newData],
        }),
      },
    };
  }

  constructColumnWebHookData(
    hook: HookPayloadType,
    model: Model | TableType,
    _view: View | ViewType,
    prevData: any,
    newData: any,
    user = null,
  ) {
    // Check for include_user in notification object first, fall back to hook.include_user for backward compatibility
    const includeUser = parseMetaProp(hook, 'notification')?.include_user;

    return {
      type: `${hook.event}.after.${
        hook.operation === 'insert' ? 'create' : hook.operation
      }`,
      id: uuidv4(),
      ...(includeUser && isEE && user
        ? { user: sanitizeUserForHook(user) }
        : {}),
      version: hook.version,
      data: {
        table_id: model.id,
        table_name: model.title,
        // webhook are table specific, so no need to send view_id and view_name
        ...(prevData?.length &&
          (hook.operation as any) !== 'delete' && {
            previous_fields: prevData,
          }),
        ...(prevData?.length &&
          (hook.operation as any) === 'delete' && {
            fields: prevData,
          }),
        ...(newData?.length && {
          fields: newData,
        }),
      },
    };
  }

  async invokeMetaEvent(
    context: NcContext,
    param: {
      hook: Hook;
      model: Model;
      view: View;
      hookName: string;
      prevData;
      newData;
      user;
      testFilters?;
      throwErrorOnFailure?: boolean;
      testHook?: boolean;
      ncSiteUrl?: string;
      addJob?: (name: string, data: any) => Promise<void>;
    },
  ) {
    const {
      hook,
      model,
      view,
      user,
      hookName,
      prevData,
      throwErrorOnFailure = false,
      testHook = false,
    } = param;

    const { newData } = param;

    if (hook.version === 'v3') {
      // since we already verified the operation in v3,
      // we'll assign the event and operation back to v2 format
      // for it to further be referenced during payload building
      const [event, operation] = hookName.split('.');
      hook.event = event as any;
      hook.operation = (operation as any as string)
        .replace('bulk', '')
        .toLowerCase() as any;
    }

    const hookPayload: HookPayloadType = {
      ...hook,
      operation: hook.operation as any as string,
    };

    let hookLog: HookLogType;
    const startTime = process.hrtime();
    let notification, filters;
    let reqPayload;
    try {
      notification =
        typeof hook.notification === 'string'
          ? JSON.parse(hook.notification)
          : hook.notification;

      switch (notification?.type) {
        case 'Email':
          {
            const webhookData = this.constructHookDataForNonURLHooks({
              hook: hookPayload,
              model,
              view,
              prevData,
              newData,
            });

            const parsedPayload = {
              to: parseBody(notification?.payload?.to, webhookData),
              subject: parseBody(notification?.payload?.subject, webhookData),
              html: parseBody(notification?.payload?.body, webhookData),
            };
            const res = await (
              await NcPluginMgrv2.emailAdapter(false)
            )?.mailSend(parsedPayload);
            if (
              process.env.NC_AUTOMATION_LOG_LEVEL === 'ALL' ||
              (isEE && !process.env.NC_AUTOMATION_LOG_LEVEL)
            ) {
              hookLog = {
                ...hook,
                operation: hookName?.split('.')?.[1] as any,
                fk_hook_id: hook.id,
                type: notification.type,
                payload: JSON.stringify(parsedPayload),
                response: JSON.stringify(res),
                triggered_by: user?.email,
                conditions: JSON.stringify(filters),
              };
            }
          }
          break;
        case 'URL':
          {
            reqPayload = this.populateAxiosReq({
              apiMeta: notification?.payload,
              user,
              hook: hookPayload,
              model,
              view,
              prevData,
              newData,
            });

            const { requestPayload, responsePayload } = await handleHttpWebHook(
              {
                reqPayload,
              },
            );

            if (
              process.env.NC_AUTOMATION_LOG_LEVEL === 'ALL' ||
              (isEE && !process.env.NC_AUTOMATION_LOG_LEVEL)
            ) {
              hookLog = {
                ...hook,
                operation: hookName?.split('.')?.[1] as any,
                fk_hook_id: hook.id,
                type: notification.type,
                payload: JSON.stringify(requestPayload),
                response: JSON.stringify(responsePayload),
                triggered_by: user?.email,
                conditions: JSON.stringify(filters),
              };
            }
          }
          break;
        case 'Script':
          {
            NcError.get(context).notImplemented('Not yet implemented');
          }
          break;
        default:
          {
            const webhookData = this.constructHookDataForNonURLHooks({
              hook: hookPayload,
              model,
              view,
              prevData,
              newData,
            });

            const res = await (
              await NcPluginMgrv2.webhookNotificationAdapters(notification.type)
            ).sendMessage(
              parseBody(notification?.payload?.body, webhookData),
              JSON.parse(
                JSON.stringify(notification?.payload),
                (_key, value) => {
                  return typeof value === 'string'
                    ? parseBody(value, webhookData)
                    : value;
                },
              ),
            );

            if (
              process.env.NC_AUTOMATION_LOG_LEVEL === 'ALL' ||
              (isEE && !process.env.NC_AUTOMATION_LOG_LEVEL)
            ) {
              hookLog = {
                ...hook,
                operation: hookName?.split('.')?.[1] as any,
                fk_hook_id: hook.id,
                type: notification.type,
                payload: JSON.stringify(notification?.payload),
                response: JSON.stringify({
                  status: res.status,
                  statusText: res.statusText,
                  headers: res.headers,
                  config: {
                    url: res.config.url,
                    method: res.config.method,
                    data: res.config.data,
                    headers: res.config.headers,
                    params: res.config.params,
                  },
                }),
                triggered_by: user?.email,
                conditions: JSON.stringify(filters),
              };
            }
          }
          break;
      }
    } catch (e) {
      if (e.response) {
        this.logger.error({
          data: e.response.data,
          status: e.response.status,
          url: e.response.config?.url,
          message: e.message,
        });
      } else {
        this.logger.error(e.message, e.stack);
      }
      if (
        ['ERROR', 'ALL'].includes(process.env.NC_AUTOMATION_LOG_LEVEL) ||
        isEE
      ) {
        hookLog = {
          ...hook,
          operation: hookName?.split('.')?.[1] as any,
          type: notification.type,
          payload: JSON.stringify(
            reqPayload
              ? this.extractReqPayloadForLog(reqPayload, e.response)
              : notification?.payload,
          ),
          fk_hook_id: hook.id,
          error_code: e.error_code ?? e.code,
          error_message: e.message,
          error: JSON.stringify(e),
          triggered_by: user?.email,
          conditions: filters
            ? JSON.stringify(
                addDummyRootAndNest(
                  filterBuilder().build(
                    this.flattenFilter(filters),
                  ) as Filter[],
                ),
              )
            : null,
          response: e.response
            ? JSON.stringify(this.extractResPayloadForLog(e.response))
            : null,
        };
      }
      if (throwErrorOnFailure) {
        if (e.isAxiosError) {
          if (
            e.message.includes('private IP address') ||
            e.response?.data?.message?.includes('private IP address')
          ) {
            throw new Error(
              `Connection to a private network IP is blocked for security reasons.` +
                // shoe env var only if it's not EE or it's on-prem
                (!isEE || isOnPrem
                  ? `If this is intentional, set NC_ALLOW_LOCAL_HOOKS=true to allow local network webhooks.`
                  : ''),
            );
          }
        }

        throw e;
      }
    } finally {
      if (hookLog) {
        hookLog.execution_time = this.parseHrtimeToMilliSeconds(
          process.hrtime(startTime),
        );
        HookLog.insert(context, { ...hookLog, test_call: testHook }).catch(
          (e) => {
            this.logger.error(e.message, e.stack);
          },
        );
      }
    }
  }
}
