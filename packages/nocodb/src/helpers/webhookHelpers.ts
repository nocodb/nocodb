import Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { Logger } from '@nestjs/common';
import NcPluginMgrv2 from './NcPluginMgrv2';
import type { Column, FormView, Hook, Model, View } from '~/models';
import type { HookLogType } from 'nocodb-sdk';
import { Filter, HookLog } from '~/models';

Handlebars.registerHelper('json', function (context) {
  return JSON.stringify(context);
});

const logger = new Logger('webhookHelpers');

export function parseBody(template: string, data: any): string {
  if (!template) {
    return template;
  }

  return Handlebars.compile(template, { noEscape: true })({
    data,
  });
}

export async function validateCondition(filters: Filter[], data: any) {
  if (!filters.length) {
    return true;
  }

  let isValid = true;
  for (const _filter of filters) {
    const filter = _filter instanceof Filter ? _filter : new Filter(_filter);
    let res;
    const field = await filter.getColumn().then((c) => c.title);
    let val = data[field];
    switch (typeof filter.value) {
      case 'boolean':
        val = !!data[field];
        break;
      case 'number':
        val = +data[field];
        break;
    }
    switch (filter.comparison_op) {
      case 'eq':
        res = val == filter.value;
        break;
      case 'neq':
        res = val != filter.value;
        break;
      case 'like':
        res =
          data[field]?.toLowerCase()?.indexOf(filter.value?.toLowerCase()) > -1;
        break;
      case 'nlike':
        res =
          data[field]?.toLowerCase()?.indexOf(filter.value?.toLowerCase()) ===
          -1;
        break;
      case 'empty':
      case 'blank':
        res =
          data[field] === '' ||
          data[field] === null ||
          data[field] === undefined;
        break;
      case 'notempty':
      case 'notblank':
        res = !(
          data[field] === '' ||
          data[field] === null ||
          data[field] === undefined
        );
        break;
      case 'checked':
        res = !!data[field];
        break;
      case 'notchecked':
        res = !data[field];
        break;
      case 'null':
        res = res = data[field] === null;
        break;
      case 'notnull':
        res = data[field] !== null;
        break;
      case 'allof':
        res = (filter.value?.split(',').map((item) => item.trim()) ?? []).every(
          (item) => (data[field]?.split(',') ?? []).includes(item),
        );
        break;
      case 'anyof':
        res = (filter.value?.split(',').map((item) => item.trim()) ?? []).some(
          (item) => (data[field]?.split(',') ?? []).includes(item),
        );
        break;
      case 'nallof':
        res = !(
          filter.value?.split(',').map((item) => item.trim()) ?? []
        ).every((item) => (data[field]?.split(',') ?? []).includes(item));
        break;
      case 'nanyof':
        res = !(filter.value?.split(',').map((item) => item.trim()) ?? []).some(
          (item) => (data[field]?.split(',') ?? []).includes(item),
        );
        break;
      case 'lt':
        res = +data[field] < +filter.value;
        break;
      case 'lte':
      case 'le':
        res = +data[field] <= +filter.value;
        break;
      case 'gt':
        res = +data[field] > +filter.value;
        break;
      case 'gte':
      case 'ge':
        res = +data[field] >= +filter.value;
        break;
    }

    switch (filter.logical_op) {
      case 'or':
        isValid = isValid || res;
        break;
      case 'not':
        isValid = isValid && !res;
        break;
      case 'and':
      default:
        isValid = isValid && res;
        break;
    }
  }

  return isValid;
}

export function constructWebHookData(hook, model, view, prevData, newData) {
  if (hook.version === 'v2') {
    // extend in the future - currently only support records
    const scope = 'records';

    return {
      type: `${scope}.${hook.event}.${hook.operation}`,
      id: uuidv4(),
      data: {
        table_id: model.id,
        table_name: model.title,
        // webhook are table specific, so no need to send view_id and view_name
        // view_id: view?.id,
        // view_name: view?.title,
        ...(prevData && {
          previous_rows: Array.isArray(prevData) ? prevData : [prevData],
        }),
        ...(hook.operation !== 'bulkInsert' &&
          newData && { rows: Array.isArray(newData) ? newData : [newData] }),
        ...(hook.operation === 'bulkInsert' && {
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

export async function handleHttpWebHook(
  hook,
  model,
  view,
  apiMeta,
  user,
  prevData,
  newData,
): Promise<any> {
  const req = axiosRequestMake(
    apiMeta,
    user,
    constructWebHookData(hook, model, view, prevData, newData),
  );
  return axios(req);
}

export function axiosRequestMake(_apiMeta, _user, data) {
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
          return typeof value === 'string' ? parseBody(value, data) : value;
        },
      );
    } catch (e) {
      // if string parsing failed then directly apply the handlebar
      apiMeta.body = parseBody(apiMeta.body, data);
    }
  }
  if (apiMeta.auth) {
    try {
      apiMeta.auth = JSON.parse(
        typeof apiMeta.auth === 'string'
          ? apiMeta.auth
          : JSON.stringify(apiMeta.auth),
        (_key, value) => {
          return typeof value === 'string' ? parseBody(value, data) : value;
        },
      );
    } catch (e) {
      apiMeta.auth = parseBody(apiMeta.auth, data);
    }
  }
  apiMeta.response = {};
  const url = parseBody(apiMeta.path, data);

  const req = {
    params: apiMeta.parameters
      ? apiMeta.parameters.reduce((paramsObj, param) => {
          if (param.name && param.enabled) {
            paramsObj[param.name] = parseBody(param.value, data);
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
            headersObj[header.name] = parseBody(header.value, data);
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
  };
  return req;
}

export async function invokeWebhook(
  hook: Hook,
  model: Model,
  view: View,
  prevData,
  newData,
  user,
  testFilters = null,
  throwErrorOnFailure = false,
  testHook = false,
) {
  let hookLog: HookLogType;
  const startTime = process.hrtime();
  let notification;
  try {
    notification =
      typeof hook.notification === 'string'
        ? JSON.parse(hook.notification)
        : hook.notification;

    const isBulkOperation = Array.isArray(newData);

    if (isBulkOperation && notification?.type !== 'URL') {
      // only URL hook is supported for bulk operations
      return;
    }

    if (hook.condition && !testHook) {
      if (isBulkOperation) {
        const filteredData = [];
        for (const data of newData) {
          if (
            await validateCondition(
              testFilters || (await hook.getFilters()),
              data,
            )
          ) {
            filteredData.push(data);
          }
          if (!filteredData.length) {
            return;
          }
          newData = filteredData;
        }
      } else {
        if (
          !(await validateCondition(
            testFilters || (await hook.getFilters()),
            newData,
          ))
        ) {
          return;
        }
      }
    }

    switch (notification?.type) {
      case 'Email':
        {
          const res = await (
            await NcPluginMgrv2.emailAdapter(false)
          )?.mailSend({
            to: parseBody(notification?.payload?.to, newData),
            subject: parseBody(notification?.payload?.subject, newData),
            html: parseBody(notification?.payload?.body, newData),
          });
          if (process.env.NC_AUTOMATION_LOG_LEVEL === 'ALL') {
            hookLog = {
              ...hook,
              fk_hook_id: hook.id,
              type: notification.type,
              payload: JSON.stringify(notification?.payload),
              response: JSON.stringify(res),
              triggered_by: user?.email,
            };
          }
        }
        break;
      case 'URL':
        {
          const res = await handleHttpWebHook(
            hook,
            model,
            view,
            notification?.payload,
            user,
            prevData,
            newData,
          );

          if (process.env.NC_AUTOMATION_LOG_LEVEL === 'ALL') {
            hookLog = {
              ...hook,
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
            };
          }
        }
        break;
      default:
        {
          const res = await (
            await NcPluginMgrv2.webhookNotificationAdapters(notification.type)
          ).sendMessage(
            parseBody(notification?.payload?.body, newData),
            JSON.parse(JSON.stringify(notification?.payload), (_key, value) => {
              return typeof value === 'string'
                ? parseBody(value, newData)
                : value;
            }),
          );

          if (process.env.NC_AUTOMATION_LOG_LEVEL === 'ALL') {
            hookLog = {
              ...hook,
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
            };
          }
        }
        break;
    }
  } catch (e) {
    if (e.response) {
      logger.error({
        data: e.response.data,
        status: e.response.status,
        url: e.response.config?.url,
        message: e.message,
      });
    } else {
      logger.error(e.message, e.stack);
    }
    if (['ERROR', 'ALL'].includes(process.env.NC_AUTOMATION_LOG_LEVEL)) {
      hookLog = {
        ...hook,
        type: notification.type,
        payload: JSON.stringify(notification?.payload),
        fk_hook_id: hook.id,
        error_code: e.error_code,
        error_message: e.message,
        error: JSON.stringify(e),
        triggered_by: user?.email,
      };
    }
    if (throwErrorOnFailure) throw e;
  } finally {
    if (hookLog) {
      hookLog.execution_time = parseHrtimeToMilliSeconds(
        process.hrtime(startTime),
      );
      HookLog.insert({ ...hookLog, test_call: testHook });
    }
  }
}

export function _transformSubmittedFormDataForEmail(
  data,
  // @ts-ignore
  formView,
  // @ts-ignore
  columns: (Column<any> & FormView<any>)[],
) {
  const transformedData = { ...data };

  for (const col of columns) {
    if (col.uidt === 'Attachment') {
      if (typeof transformedData[col.title] === 'string') {
        transformedData[col.title] = JSON.parse(transformedData[col.title]);
      }
      transformedData[col.title] = (transformedData[col.title] || [])
        .map((attachment) => {
          if (
            ['jpeg', 'gif', 'png', 'apng', 'svg', 'bmp', 'ico', 'jpg'].includes(
              attachment.title.split('.').pop(),
            )
          ) {
            return `<a href="${attachment.url}" target="_blank"><img height="50px" src="${attachment.url}"/></a>`;
          }
          return `<a href="${attachment.url}" target="_blank">${attachment.title}</a>`;
        })
        .join('&nbsp;');
    } else if (
      transformedData[col.title] &&
      typeof transformedData[col.title] === 'object'
    ) {
      transformedData[col.title] = JSON.stringify(transformedData[col.title]);
    }
  }
  return transformedData;
}

function parseHrtimeToMilliSeconds(hrtime) {
  const milliseconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
  return milliseconds;
}
