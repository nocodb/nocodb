import { Logger } from '@nestjs/common';
import { hasInputCalls, NOCO_SERVICE_USERS } from 'nocodb-sdk';
import { useAgent } from 'request-filtering-agent';
import { v4 as uuidv4 } from 'uuid';
import type { AxiosResponse } from 'axios';
import type {
  HookLogType,
  HookType,
  NcContext,
  TableType,
  UserType,
  ViewType,
} from 'nocodb-sdk';
import type { Filter } from '~/models';
import { parseMetaProp } from '~/utils/modelUtils';
import { NcError } from '~/helpers/ncError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import {
  handleHttpWebHook,
  parseBody,
  sanitizeUserForHook,
  validateCondition,
} from '~/helpers/webhookHelpers';
import { JobTypes } from '~/interface/Jobs';
import {
  type Hook,
  HookLog,
  type Model,
  Script,
  Source,
  type View,
} from '~/models';
import Noco from '~/Noco';
import { genJwt } from '~/services/users/helpers';
import { addDummyRootAndNest } from '~/services/v3/filters-v3.service';
import { isEE, isOnPrem } from '~/utils';
import { filterBuilder } from '~/utils/api-v3-data-transformation.builder';

interface WebhookResponseLog {
  status: number;
  statusText: string;
  headers: Record<string, any>; // Changed to any to accommodate AxiosResponseHeaders
  data: any;
}

export type HookPayloadType = Omit<HookType, 'operation'> & {
  operation: string;
};

export class WebhookInvoker {
  protected logger = new Logger(WebhookInvoker.name);

  populateAxiosReq({
    apiMeta: _apiMeta,
    hook,
    model,
    view,
    prevData,
    newData,
    user,
  }: {
    apiMeta: any;
    user: UserType;
    hook: HookPayloadType;
    model: TableType;
    view?: ViewType;
    prevData: Record<string, unknown>;
    newData: Record<string, unknown>;
  }) {
    if (!_apiMeta) {
      _apiMeta = {};
    }

    const contentType = _apiMeta.headers?.find(
      (header) =>
        header.name?.toLowerCase() === 'content-type' && header.enabled,
    );

    if (!contentType) {
      if (!_apiMeta.headers) {
        _apiMeta.headers = [];
      }

      _apiMeta.headers.push({
        name: 'Content-Type',
        enabled: true,
        value: 'application/json',
      });
    }

    const webhookData = this.constructWebHookData(
      hook,
      model,
      view,
      prevData,
      newData,
      user,
    );

    const apiMeta = { ..._apiMeta };
    // if it's a string try to parse and apply handlebar
    // or if object then convert into JSON string and parse it
    if (apiMeta.body) {
      try {
        apiMeta.body = JSON.parse(
          typeof apiMeta.body === 'string'
            ? apiMeta.body
            : JSON.stringify(apiMeta.body),
          (_key, value) => {
            return typeof value === 'string'
              ? parseBody(value, webhookData)
              : value;
          },
        );
      } catch (e) {
        // if string parsing failed then directly apply the handlebar
        apiMeta.body = parseBody(apiMeta.body, webhookData);
      }
    }
    if (apiMeta.auth) {
      try {
        apiMeta.auth = JSON.parse(
          typeof apiMeta.auth === 'string'
            ? apiMeta.auth
            : JSON.stringify(apiMeta.auth),
          (_key, value) => {
            return typeof value === 'string'
              ? parseBody(value, webhookData)
              : value;
          },
        );
      } catch (e) {
        apiMeta.auth = parseBody(apiMeta.auth, webhookData);
      }
    }
    apiMeta.response = {};
    const url = parseBody(apiMeta.path, webhookData);

    const reqPayload = {
      params: apiMeta.parameters
        ? apiMeta.parameters.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = parseBody(param.value, webhookData);
            }
            return paramsObj;
          }, {})
        : {},
      url: url,
      method: apiMeta.method,
      data: apiMeta.body,
      headers: apiMeta.headers
        ? apiMeta.headers.reduce((headersObj, header) => {
            if (header.name && header.enabled) {
              headersObj[header.name] = parseBody(header.value, webhookData);
            }
            return headersObj;
          }, {})
        : {},
      withCredentials: true,
      ...(process.env.NC_ALLOW_LOCAL_HOOKS !== 'true'
        ? {
            httpAgent: useAgent(url, {
              stopPortScanningByUrlRedirection: true,
            }),
            httpsAgent: useAgent(url, {
              stopPortScanningByUrlRedirection: true,
            }),
          }
        : {}),
      timeout: 30 * 1000,
    };

    return reqPayload;
  }

  constructHookDataForNonURLHooks({
    newData,
    prevData,
    view,
    hook,
    model,
  }: {
    hook: HookPayloadType;
    model: Model;
    view: View;
    newData: Record<string, unknown>;
    prevData: Record<string, unknown>;
  }) {
    // for old webhooks keep the old data syntax for backward compatibility
    if (hook.version === 'v2' || hook.version === 'v1') {
      return newData;
    } else {
      return this.constructWebHookData(hook, model, view, prevData, newData);
    }
  }

  parseHrtimeToMilliSeconds(hrtime) {
    const milliseconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
    return milliseconds;
  }

  extractResPayloadForLog(response: AxiosResponse<any>): WebhookResponseLog {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    };
  }

  extractReqPayloadForLog(reqPayload, response?: AxiosResponse<any>) {
    return {
      ...reqPayload,
      headers: {
        ...(response?.config?.headers || {}),
        ...(reqPayload.headers || {}),
      },
      // exclude http/https agent filters
      httpAgent: undefined,
      httpsAgent: undefined,
      timeout: undefined,
      withCredentials: undefined,
    };
  }

  // flatten filter tree and id dummy id if no id is present
  flattenFilter(filters?: Filter[], flattenedFilters = [], parentId = null) {
    for (const filter of filters || []) {
      // if parent id is present then set it as fk_parent_id
      if (parentId && !filter.fk_parent_id) {
        filter.fk_parent_id = parentId;
      }

      if (filter.is_group) {
        flattenedFilters.push(filter);
        // this is to group the filters
        if (!filter.id) {
          filter.id = uuidv4();
        }
        this.flattenFilter(filter.children, flattenedFilters, filter.id);
      } else {
        flattenedFilters.push(filter);
      }
    }
    return flattenedFilters;
  }

  constructWebHookData(
    hook: HookPayloadType,
    model: Model | TableType,
    _view: View | ViewType,
    prevData: Record<string, unknown>,
    newData: Record<string, unknown>,
    user = null,
  ) {
    // TODO: construct webhook view data
    if (['v2', 'v3'].includes(hook.version)) {
      // extend in the future - currently only support records
      const scope = 'records';
      const isBulkInsert =
        hook.version === 'v2' && (hook.operation as any) === 'bulkInsert';

      // Check for include_user in notification object first, fall back to hook.include_user for backward compatibility
      const includeUser = parseMetaProp(hook, 'notification')?.include_user;

      return {
        type: `${scope}.${hook.event}.${hook.operation}`,
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
          ...(prevData && {
            previous_rows: Array.isArray(prevData)
              ? prevData.map((prev) => ({ ...prev, nc_order: undefined }))
              : [{ ...prevData, nc_order: undefined }],
          }),
          ...(!isBulkInsert &&
            newData && {
              rows: Array.isArray(newData)
                ? newData.map((each) => ({
                    ...each,
                    nc_order: undefined,
                  }))
                : [{ ...newData, nc_order: undefined }],
            }),
          ...(isBulkInsert && {
            rows_inserted: Array.isArray(newData)
              ? newData.length
              : newData
              ? 1
              : 0,
          }),
        },
      };
    }

    // for v1, keep it as it is
    return newData;
  }

  public async invoke(
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
  ): Promise<void> {
    const {
      hook,
      model,
      view,
      user,
      hookName,
      prevData,
      testFilters = null,
      throwErrorOnFailure = false,
      testHook = false,
      ncSiteUrl,
      addJob,
    } = param;

    let { newData } = param;
    if (hook.version === 'v3' && hookName) {
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
    const source = await Source.get(context, model.source_id);
    let notification, filters;
    let reqPayload;
    try {
      notification =
        typeof hook.notification === 'string'
          ? JSON.parse(hook.notification)
          : hook.notification;

      const isBulkOperation = Array.isArray(newData);

      if (
        isBulkOperation &&
        notification?.type !== 'URL' &&
        notification?.type !== 'Script'
      ) {
        // only URL & Script hooks are supported for bulk operations
        return;
      }

      if (hook.condition && !testHook) {
        filters = testFilters || (await hook.getFilters(context));

        if (isBulkOperation) {
          const filteredData = [];
          for (let i = 0; i < newData.length; i++) {
            const data = newData[i];

            const pData = prevData[i] ? prevData[i] : null;

            // if condition is satisfied for prevData then return
            // if filters are not defined then skip the check
            if (
              pData &&
              filters.length &&
              (await validateCondition(context, filters, pData, {
                client: source?.type,
              }))
            ) {
              continue;
            }

            if (
              await validateCondition(
                context,
                testFilters || (await hook.getFilters(context)),
                data,
                { client: source?.type },
              )
            ) {
              filteredData.push(data);
            }
          }
          if (!filteredData.length) {
            return;
          }
          newData = filteredData;
        } else {
          // if condition is satisfied for prevData then return
          // if filters are not defined then skip the check
          if (
            prevData &&
            filters.length &&
            (await validateCondition(context, filters, prevData, {
              client: source?.type,
            }))
          ) {
            return;
          }
          if (
            !(await validateCondition(
              context,
              testFilters || (await hook.getFilters(context)),
              newData,
              { client: source?.type },
            ))
          ) {
            return;
          }
        }
      }

      // check if form filter applied
      if (
        notification &&
        notification.trigger_form &&
        notification.trigger_form_id
      ) {
        const formId = notification.trigger_form_id;
        if (view && formId !== view.id) {
          return;
        }
      }

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
                operation: hookPayload.operation as any,
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
                operation: hookPayload.operation as any,
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
            const datas = Array.isArray(newData) ? newData : [newData];

            const script = await Script.get(
              context,
              notification?.payload?.scriptId,
            );

            if (!script.script || hasInputCalls(script.script)) {
              NcError.get(context).notImplemented(
                'Script with input calls is not supported',
              );
            }

            reqPayload = this.populateAxiosReq({
              apiMeta: {
                ...notification?.payload,
                headers: [
                  {
                    name: 'nc-script-id',
                    value: script.id,
                    enabled: true,
                  },
                  {
                    name: 'nc-script-title',
                    value: script.title,
                    enabled: true,
                  },
                ],
                body: '{{ json event }}',
              },
              user,
              hook: hookPayload,
              model,
              view,
              prevData,
              newData,
            });

            await addJob?.(JobTypes.ExecuteAction, {
              context,
              scriptId: notification?.payload?.scriptId,
              modelId: model.id,
              records: datas,
              hookPayload: {
                ...hook,
                operation: hookPayload.operation as any,
                fk_hook_id: hook.id,
                type: notification.type,
                payload: JSON.stringify(
                  this.extractReqPayloadForLog(reqPayload),
                ),
                triggered_by: user?.email,
                conditions: JSON.stringify(filters),
              },
              req: {
                user: NOCO_SERVICE_USERS.AUTOMATION_USER,
                headers: {
                  'xc-auth': genJwt(
                    {
                      ...NOCO_SERVICE_USERS.AUTOMATION_USER,
                      extra: {
                        context: {
                          ...context,
                          script_id: notification?.payload?.scriptId,
                        },
                      },
                    },
                    Noco.getConfig(),
                    {
                      expiresIn: '10m',
                    },
                  ),
                },
                ncSiteUrl,
              },
            });
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

        if (e?.code?.includes?.('ERR_INVALID_URL')) {
          throw new Error(`Invalid URL: ${reqPayload.url}`);
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
