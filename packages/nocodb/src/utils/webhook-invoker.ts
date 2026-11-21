import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';
import {
  hasInputCalls,
  NOCO_SERVICE_USERS,
  OperationSource,
  ServiceUserType,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import { ncIsNullOrUndefined } from 'nocodb-sdk';
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
import type {
  RetryWebhookJobData,
  WebhookAddJob,
  WebhookRetryState,
} from '~/interface/Jobs';
import { getFilteredAgents } from '~/utils/ssrf';
import { parseMetaProp } from '~/utils/modelUtils';
import { getWebhookMaxBodySize } from '~/utils/nc-config/constants';
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
  BaseVariable,
  type Hook,
  HookLog,
  type Model,
  Script,
  Source,
  type View,
} from '~/models';
import Noco from '~/Noco';
import { genJwt } from '~/services/users/helpers';
import { addDummyRootAndNest } from '~/services/v3/filters-v3.helper';
import { isEE, isOnPrem } from '~/utils';
import { filterBuilder } from '~/utils/api-v3-data-transformation.builder';

const webhookLogLevel =
  process.env.NC_WEBHOOK_LOG_LEVEL || process.env.NC_AUTOMATION_LOG_LEVEL;

interface WebhookResponseLog {
  status: number;
  statusText: string;
  headers: Record<string, any>; // Changed to any to accommodate AxiosResponseHeaders
  data: any;
}

export type HookPayloadType = Omit<HookType, 'operation'> & {
  operation: string;
};

// Limits the saved hook delivery settings are clamped to. The timeout cap
// stays at 30 s while the form doesn't expose timeout: every hook row holds
// the column default of 60000, which nobody chose.
export const WEBHOOK_TIMEOUT_DEFAULT_MS = 30_000;
export const WEBHOOK_TIMEOUT_MIN_MS = 1_000;
export const WEBHOOK_TIMEOUT_MAX_MS = 30_000;
export const WEBHOOK_MAX_RETRIES = 10;
export const WEBHOOK_RETRY_INTERVAL_DEFAULT_MS = 60_000;
export const WEBHOOK_RETRY_INTERVAL_MIN_MS = 1_000;
export const WEBHOOK_RETRY_INTERVAL_MAX_MS = 60 * 60_000;

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'ERR_NETWORK',
]);

function clampMs(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (ncIsNullOrUndefined(value) || !Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function getWebhookDeliveryPolicy(
  hook: Pick<HookType, 'timeout' | 'retries' | 'retry_interval'>,
) {
  const retries = Number(hook?.retries);
  return {
    timeout: clampMs(
      hook?.timeout,
      WEBHOOK_TIMEOUT_MIN_MS,
      WEBHOOK_TIMEOUT_MAX_MS,
      WEBHOOK_TIMEOUT_DEFAULT_MS,
    ),
    retries:
      Number.isFinite(retries) && retries > 0
        ? Math.min(WEBHOOK_MAX_RETRIES, Math.floor(retries))
        : 0,
    retryInterval: clampMs(
      hook?.retry_interval,
      WEBHOOK_RETRY_INTERVAL_MIN_MS,
      WEBHOOK_RETRY_INTERVAL_MAX_MS,
      WEBHOOK_RETRY_INTERVAL_DEFAULT_MS,
    ),
  };
}

// Network failures, timeouts, 408, 429 and 5xx; never other 4xx.
export function isRetryableWebhookError(e: any) {
  const status = e?.response?.status;
  if (status) return status >= 500 || status === 429 || status === 408;
  if (e?.message?.includes?.('private IP address')) return false;
  return (
    RETRYABLE_ERROR_CODES.has(e?.code) ||
    !!e?.message?.includes?.('socket hang up')
  );
}

// Retry-After (seconds or HTTP date) can only lengthen the saved interval.
export function getWebhookRetryDelay(e: any, retryInterval: number) {
  const header = e?.response?.headers?.['retry-after'];
  let retryAfterMs = 0;
  if (!ncIsNullOrUndefined(header) && header !== '') {
    const seconds = Number(header);
    retryAfterMs = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(header) - Date.now();
  }
  return Math.min(
    WEBHOOK_RETRY_INTERVAL_MAX_MS,
    Math.max(retryInterval, Number.isFinite(retryAfterMs) ? retryAfterMs : 0),
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// Fingerprint of what a URL delivery is built from; a queued retry is dropped
// when it changes, so an edited URL or rotated header never gets the old request.
export function getWebhookDeliveryConfigHash(
  hook: Pick<Hook, 'notification' | 'url' | 'headers'>,
) {
  let notification = hook?.notification;
  if (typeof notification === 'string') {
    try {
      notification = JSON.parse(notification);
    } catch {
      // hash the raw string
    }
  }
  return createHash('sha256')
    .update(
      stableStringify({
        notification: notification ?? null,
        url: hook?.url ?? null,
        headers: hook?.headers ?? null,
      }),
    )
    .digest('hex');
}

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
    vars,
  }: {
    apiMeta: any;
    user: UserType;
    hook: HookPayloadType;
    model: TableType;
    view?: ViewType;
    prevData: Record<string, unknown>;
    newData: Record<string, unknown>;
    vars?: Record<string, string>;
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
              ? parseBody(value, webhookData, vars)
              : value;
          },
        );
      } catch (e) {
        // if string parsing failed then directly apply the handlebar
        apiMeta.body = parseBody(apiMeta.body, webhookData, vars);
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
              ? parseBody(value, webhookData, vars)
              : value;
          },
        );
      } catch (e) {
        apiMeta.auth = parseBody(apiMeta.auth, webhookData, vars);
      }
    }
    apiMeta.response = {};
    const url = parseBody(apiMeta.path, webhookData, vars);

    const reqPayload = {
      params: apiMeta.parameters
        ? apiMeta.parameters.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = parseBody(param.value, webhookData, vars);
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
              headersObj[header.name] = parseBody(
                header.value,
                webhookData,
                vars,
              );
            }
            return headersObj;
          }, {})
        : {},
    };

    return this.withTransportOptions(reqPayload, hook);
  }

  withTransportOptions<T extends { url?: string }>(
    req: T,
    hook: Pick<HookType, 'timeout'>,
  ) {
    return {
      ...req,
      withCredentials: true,
      ...(!ncIsNullOrUndefined(req.url)
        ? getFilteredAgents({ url: req.url, source: OperationSource.HOOKS })
        : {}),
      timeout: getWebhookDeliveryPolicy(hook).timeout,
      // Bound the request/response body so axios can't buffer an unbounded
      // native Buffer (default maxContentLength is -1 = unlimited). A webhook
      // flood at full worker concurrency previously OOM-killed the worker.
      // Overflow surfaces as a friendly error via the maxContentLength /
      // maxBodyLength handlers in invoke().
      maxContentLength: getWebhookMaxBodySize(),
      maxBodyLength: getWebhookMaxBodySize(),
    };
  }

  /**
   * Queues the next attempt of a failed URL delivery as a delayed job, when
   * the hook has retries left and the failure is retryable. Returns a note
   * for the attempt's hook log, or null when the hook has no retries.
   */
  async scheduleUrlRetry(
    context: NcContext,
    {
      hook,
      error,
      reqPayload,
      attempt,
      addJob,
      log,
      ncSiteUrl,
    }: {
      hook: Pick<
        Hook,
        | 'id'
        | 'timeout'
        | 'retries'
        | 'retry_interval'
        | 'notification'
        | 'url'
        | 'headers'
      >;
      error: any;
      reqPayload: WebhookRetryState['request'];
      attempt: number;
      addJob?: WebhookAddJob;
      log: WebhookRetryState['log'];
      ncSiteUrl?: string;
    },
  ): Promise<string | null> {
    const { retries, retryInterval } = getWebhookDeliveryPolicy(hook);
    if (!retries) return null;

    const total = retries + 1;
    if (!addJob || attempt >= total || !isRetryableWebhookError(error)) {
      return `attempt ${attempt} of ${total}, not retried`;
    }

    const delay = getWebhookRetryDelay(error, retryInterval);
    const retry: WebhookRetryState = {
      attempt: attempt + 1,
      request: {
        url: reqPayload.url,
        method: reqPayload.method,
        params: reqPayload.params,
        headers: reqPayload.headers,
        data: reqPayload.data,
      },
      configHash: getWebhookDeliveryConfigHash(hook),
      log,
    };

    try {
      const data: Omit<RetryWebhookJobData, 'jobName' | 'user'> = {
        context,
        hookId: hook.id,
        ncSiteUrl,
        retry,
      };
      await addJob(JobTypes.RetryWebhook, data, { delay });
    } catch (e) {
      this.logger.error(e.message, e.stack);
      return `attempt ${attempt} of ${total}, retry could not be queued`;
    }

    return `attempt ${attempt} of ${total}, retrying in ${Math.ceil(
      delay / 1000,
    )}s`;
  }

  /** Sends a queued redelivery of a URL hook and logs it like invoke(). */
  async retryUrlDelivery(
    context: NcContext,
    {
      hook,
      retry,
      addJob,
      ncSiteUrl,
    }: {
      hook: Hook;
      retry: WebhookRetryState;
      addJob?: WebhookAddJob;
      ncSiteUrl?: string;
    },
  ) {
    if (retry.configHash !== getWebhookDeliveryConfigHash(hook)) {
      if (['ERROR', 'ALL'].includes(webhookLogLevel) || isEE) {
        // no `error`, so the error-notification digest doesn't count it
        const droppedLog = {
          ...hook,
          ...retry.log,
          fk_hook_id: hook.id,
          type: 'URL',
          payload: JSON.stringify(this.extractReqPayloadForLog(retry.request)),
          error_code: 'HOOK_CHANGED',
          error_message: `Attempt ${retry.attempt} not sent: the webhook's URL, headers or body changed since the first attempt, so the remaining retries were dropped`,
          execution_time: '0',
        } as HookLogType;
        await HookLog.insert(context, {
          ...droppedLog,
          test_call: false,
        }).catch((e) => {
          this.logger.error(e.message, e.stack);
        });
      }
      return;
    }

    const startTime = process.hrtime();
    const reqPayload = this.withTransportOptions(retry.request, hook);
    let hookLog: HookLogType;

    try {
      const { requestPayload, responsePayload } = await handleHttpWebHook({
        reqPayload,
      });
      if (webhookLogLevel === 'ALL' || (isEE && !webhookLogLevel)) {
        hookLog = {
          ...hook,
          ...retry.log,
          fk_hook_id: hook.id,
          type: 'URL',
          payload: JSON.stringify(requestPayload),
          response: JSON.stringify(responsePayload),
        } as HookLogType;
      }
    } catch (e) {
      this.logger.debug(e.message, e.stack);
      const note = await this.scheduleUrlRetry(context, {
        hook,
        error: e,
        reqPayload,
        attempt: retry.attempt,
        addJob,
        log: retry.log,
        ncSiteUrl,
      });
      if (['ERROR', 'ALL'].includes(webhookLogLevel) || isEE) {
        hookLog = {
          ...hook,
          ...retry.log,
          fk_hook_id: hook.id,
          type: 'URL',
          payload: JSON.stringify(
            this.extractReqPayloadForLog(reqPayload, e.response),
          ),
          error_code: e.error_code ?? e.code,
          error_message: note ? `${e.message} (${note})` : e.message,
          error: JSON.stringify(e),
          response: e.response
            ? JSON.stringify(this.extractResPayloadForLog(e.response))
            : null,
        } as HookLogType;
      }
    } finally {
      if (hookLog) {
        hookLog.execution_time = this.parseHrtimeToMilliSeconds(
          process.hrtime(startTime),
        );
        await HookLog.insert(context, { ...hookLog, test_call: false }).catch(
          (e) => {
            this.logger.error(e.message, e.stack);
          },
        );
      }
    }
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
      addJob?: WebhookAddJob;
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

    // Load base variables for template resolution
    const vars = await BaseVariable.listAsMap(context, model.base_id);

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

      // Comment webhooks evaluate their condition against the *parent record*
      // upstream in CommentHookHandlerService (this `newData` is the comment
      // payload, not a record row), so skip the record-condition check here.
      if (hook.condition && !testHook && (hook.event as any) !== 'comment') {
        filters = testFilters || (await hook.getFilters());

        if (isBulkOperation) {
          const filteredData = [];
          for (let i = 0; i < newData.length; i++) {
            const data = newData[i];

            const pData = prevData?.[i] ? prevData[i] : null;

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
                testFilters || (await hook.getFilters()),
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
              testFilters || (await hook.getFilters()),
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
              to: parseBody(notification?.payload?.to, webhookData, vars),
              subject: parseBody(
                notification?.payload?.subject,
                webhookData,
                vars,
              ),
              html: parseBody(notification?.payload?.body, webhookData, vars),
            };
            const res = await (
              await NcPluginMgrv2.emailAdapter(false)
            )?.mailSend(parsedPayload);
            if (webhookLogLevel === 'ALL' || (isEE && !webhookLogLevel)) {
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
              vars,
            });

            const isBodyEmpty =
              !reqPayload.data &&
              ['POST', 'PUT', 'PATCH'].includes(
                reqPayload.method?.toUpperCase(),
              );

            const { requestPayload, responsePayload } = await handleHttpWebHook(
              {
                reqPayload,
              },
            );

            if (
              webhookLogLevel === 'ALL' ||
              (isEE && !webhookLogLevel) ||
              (webhookLogLevel === 'ERROR' && isBodyEmpty)
            ) {
              const emptyBodyError = isBodyEmpty
                ? {
                    error_code: 'EMPTY_BODY',
                    error_message: `Webhook body is empty for ${reqPayload.method?.toUpperCase()} request — custom payload may be misconfigured.`,
                    error: JSON.stringify({
                      code: 'EMPTY_BODY',
                      message: `Custom payload body is empty for a ${reqPayload.method?.toUpperCase()} request.`,
                    }),
                  }
                : {};

              hookLog = {
                ...hook,
                operation: hookPayload.operation as any,
                fk_hook_id: hook.id,
                type: notification.type,
                payload: JSON.stringify(requestPayload),
                response: JSON.stringify(responsePayload),
                triggered_by: user?.email,
                conditions: JSON.stringify(filters),
                ...emptyBodyError,
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
                user: NOCO_SERVICE_USERS[ServiceUserType.AUTOMATION_USER],
                headers: {
                  'xc-auth': genJwt(
                    {
                      ...NOCO_SERVICE_USERS[ServiceUserType.AUTOMATION_USER],
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
              parseBody(notification?.payload?.body, webhookData, vars),
              JSON.parse(
                JSON.stringify(notification?.payload),
                (_key, value) => {
                  return typeof value === 'string'
                    ? parseBody(value, webhookData, vars)
                    : value;
                },
              ),
            );

            if (webhookLogLevel === 'ALL' || (isEE && !webhookLogLevel)) {
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
        this.logger.debug({
          data: e.response.data,
          status: e.response.status,
          url: e.response.config?.url,
          message: e.message,
        });
      } else {
        this.logger.debug(e.message, e.stack);
      }
      const conditions = filters
        ? JSON.stringify(
            addDummyRootAndNest(
              filterBuilder().build(this.flattenFilter(filters)) as Filter[],
            ),
          )
        : null;
      const attemptNote =
        notification?.type === 'URL' && reqPayload && !testHook
          ? await this.scheduleUrlRetry(context, {
              hook,
              error: e,
              reqPayload,
              attempt: 1,
              addJob,
              log: {
                event: hook.event as string,
                operation: hookName?.split('.')?.[1],
                triggered_by: user?.email,
                conditions,
              },
              ncSiteUrl,
            })
          : null;
      if (['ERROR', 'ALL'].includes(webhookLogLevel) || isEE) {
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
          error_message: attemptNote
            ? `${e.message} (${attemptNote})`
            : e.message,
          error: JSON.stringify(e),
          triggered_by: user?.email,
          conditions,
          response: e.response
            ? JSON.stringify(this.extractResPayloadForLog(e.response))
            : null,
        };
      }
      if (throwErrorOnFailure) {
        let errorMessage: string;

        // Check for private IP address blocking
        if (e.isAxiosError) {
          if (
            e.message.includes('private IP address') ||
            e.response?.data?.message?.includes('private IP address')
          ) {
            errorMessage = `Connection to a private network IP is blocked for security reasons.`;
            if (!isEE || isOnPrem) {
              errorMessage += ` If this is intentional, set NC_ALLOW_LOCAL_HOOKS=true to allow local network webhooks.`;
            }
            throw new Error(errorMessage);
          }

          // Check for Axios-specific errors
          if (e.response) {
            // Server responded with error status
            const status = e.response.status;
            const statusText = e.response.statusText;
            const responseMessage =
              e.response.data?.message || e.response.data?.error;

            if (status === 401 || status === 403) {
              errorMessage = `Authentication failed: ${
                responseMessage || 'Unauthorized access'
              }`;
            } else if (status === 404) {
              errorMessage = `Endpoint not found: ${reqPayload.url}`;
            } else if (status === 429) {
              errorMessage = `Rate limit exceeded: ${
                responseMessage || 'Too many requests'
              }`;
            } else if (status >= 500) {
              errorMessage = `Server error (${status}): ${
                responseMessage || statusText || 'Internal server error'
              }`;
            } else if (status >= 400) {
              errorMessage = `Client error (${status}): ${
                responseMessage || statusText || 'Bad request'
              }`;
            } else {
              errorMessage = `Request failed with status ${status}: ${
                responseMessage || statusText || 'Unknown error'
              }`;
            }
            throw new Error(errorMessage);
          } else if (e.request) {
            // Request was made but no response received
            errorMessage = `No response received from ${reqPayload.url}: ${
              e.message || 'Network error'
            }`;
            throw new Error(errorMessage);
          }
        }

        // Check for invalid URL
        if (
          e?.code?.includes?.('ERR_INVALID_URL') ||
          e?.message?.includes?.('Invalid URL')
        ) {
          throw new Error(`Invalid URL: ${reqPayload.url}`);
        }

        // Check for DNS resolution errors
        if (e?.code === 'ENOTFOUND' || e?.code === 'EAI_AGAIN') {
          throw new Error(
            `Unable to resolve hostname: ${reqPayload.url} (DNS lookup failed)`,
          );
        }

        // Check for connection errors
        if (e?.code === 'ECONNREFUSED') {
          throw new Error(
            `Connection refused by ${reqPayload.url} (server not reachable)`,
          );
        }

        if (e?.code === 'ECONNRESET') {
          throw new Error(
            `Connection was reset by ${reqPayload.url} (network interruption)`,
          );
        }

        if (e?.code === 'ECONNABORTED') {
          throw new Error(`Connection to ${reqPayload.url} was aborted`);
        }

        // Check for timeout errors
        if (e?.code === 'ETIMEDOUT' || e?.message?.includes?.('timeout')) {
          throw new Error(
            `Request to ${reqPayload.url} timed out (no response within time limit)`,
          );
        }

        // Check for SSL/TLS certificate errors
        if (
          e?.code === 'CERT_HAS_EXPIRED' ||
          e?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
          e?.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
          e?.message?.includes?.('certificate')
        ) {
          throw new Error(
            `SSL/TLS certificate error for ${reqPayload.url}: ${
              e.message || 'Invalid certificate'
            }`,
          );
        }

        // Check for protocol errors
        if (
          e?.code === 'ERR_INVALID_PROTOCOL' ||
          e?.message?.includes?.('Protocol')
        ) {
          throw new Error(
            `Invalid protocol in URL: ${reqPayload.url} (use http:// or https://)`,
          );
        }

        // Check for proxy errors
        if (e?.code === 'EPROTO' || e?.message?.includes?.('proxy')) {
          throw new Error(`Proxy error when connecting to ${reqPayload.url}`);
        }

        // Check for network unreachable
        if (e?.code === 'ENETUNREACH' || e?.code === 'EHOSTUNREACH') {
          throw new Error(
            `Network unreachable: Cannot connect to ${reqPayload.url}`,
          );
        }

        // Check for too many redirects
        if (
          e?.message?.includes?.('Maximum redirect') ||
          e?.message?.includes?.('too many redirects')
        ) {
          throw new Error(
            `Too many redirects when accessing ${reqPayload.url}`,
          );
        }

        // Check for request size errors
        if (
          e?.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' ||
          e?.message?.includes?.('maxBodyLength')
        ) {
          throw new Error(`Request body too large for ${reqPayload.url}`);
        }

        // Check for invalid header content (CRLF injection guard — axios >=1.15.0
        // rejects header values containing \r or \n. Webhook header templates can
        // resolve to multi-line values when bound to free-form record fields.)
        if (e?.message?.includes?.('Invalid character in header content')) {
          throw new Error(
            `Webhook header contains invalid characters (CR/LF) for ${reqPayload.url} — check header templates`,
          );
        }

        // Check for response size errors (axios >=1.15.1 enforces maxContentLength
        // on streamed responses, which was previously silently ignored.)
        if (
          e?.code === 'ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED' ||
          e?.message?.includes?.('maxContentLength')
        ) {
          throw new Error(`Response body too large for ${reqPayload.url}`);
        }

        // Check for cancelled requests
        if (e?.code === 'ERR_CANCELED' || e?.message?.includes?.('cancel')) {
          throw new Error(`Request to ${reqPayload.url} was cancelled`);
        }

        // Check for socket hang up
        if (e?.message?.includes?.('socket hang up')) {
          throw new Error(
            `Connection lost to ${reqPayload.url} (socket hang up)`,
          );
        }

        // Check for address in use
        if (e?.code === 'EADDRINUSE') {
          throw new Error(
            `Address already in use when connecting to ${reqPayload.url}`,
          );
        }

        // Check for pipe errors
        if (e?.code === 'EPIPE') {
          throw new Error(`Broken pipe when writing to ${reqPayload.url}`);
        }

        // Fallback: No specific error pattern matched
        errorMessage = e?.message || e?.code || 'Unknown error occurred';

        // Add the URL context if not already in the message
        if (!errorMessage.includes(reqPayload.url)) {
          errorMessage = `Request to ${reqPayload.url} failed: ${errorMessage}`;
        }

        // Include error code if available for debugging
        if (e?.code && !errorMessage.includes(e.code)) {
          errorMessage += ` (Error code: ${e.code})`;
        }

        throw new Error(errorMessage);
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
