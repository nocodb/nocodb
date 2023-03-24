import Handlebars from 'handlebars';
import Filter from '../../models/Filter';
import HookLog from '../../models/HookLog';
import NcPluginMgrv2 from './NcPluginMgrv2';
import type Model from '../../models/Model';
import type View from '../../models/View';
import type Hook from '../../models/Hook';
import type Column from '../../models/Column';
import type { HookLogType } from 'nocodb-sdk';
import type FormView from '../../models/FormView';

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
          (item) => (data[field]?.split(',') ?? []).includes(item)
        );
        break;
      case 'anyof':
        res = (filter.value?.split(',').map((item) => item.trim()) ?? []).some(
          (item) => (data[field]?.split(',') ?? []).includes(item)
        );
        break;
      case 'nallof':
        res = !(
          filter.value?.split(',').map((item) => item.trim()) ?? []
        ).every((item) => (data[field]?.split(',') ?? []).includes(item));
        break;
      case 'nanyof':
        res = !(filter.value?.split(',').map((item) => item.trim()) ?? []).some(
          (item) => (data[field]?.split(',') ?? []).includes(item)
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
  // extend in the future - currently only support records
  const scope = 'records';

  return {
    type: `${scope}.${hook.event}.${hook.operation}`,
    id: 'TBC',
    data: {
      table_id: model.id,
      table_name: model.title,
      view_id: view.id,
      view_name: view.title,
      ...(prevData && {
        [hook.operation === 'delete' ? 'deleted_rows' : 'previous_rows']: [
          prevData,
        ],
      }),
      ...(newData && { rows: [newData] }),
    },
  };
}

export async function handleHttpWebHook(
  hook,
  model,
  view,
  apiMeta,
  user,
  prevData,
  newData
) {
  const req = axiosRequestMake(
    apiMeta,
    user,
    constructWebHookData(hook, model, view, prevData, newData)
  );
  return require('axios')(req);
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
        }
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
        }
      );
    } catch (e) {
      apiMeta.auth = parseBody(apiMeta.auth, data);
    }
  }
  apiMeta.response = {};
  const req = {
    params: apiMeta.parameters
      ? apiMeta.parameters.reduce((paramsObj, param) => {
          if (param.name && param.enabled) {
            paramsObj[param.name] = parseBody(param.value, data);
          }
          return paramsObj;
        }, {})
      : {},
    url: parseBody(apiMeta.path, data),
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
  throwErrorOnFailure = false
) {
  let hookLog: HookLogType;
  const startTime = process.hrtime();
  try {
    const notification =
      typeof hook.notification === 'string'
        ? JSON.parse(hook.notification)
        : hook.notification;

    const isBulkOperation = Array.isArray(newData);

    if (isBulkOperation && notification?.type !== 'URL') {
      // only URL hook is supported for bulk operations
      return;
    }

    if (hook.condition) {
      if (isBulkOperation) {
        const filteredData = [];
        for (const data of newData) {
          if (
            await validateCondition(
              testFilters || (await hook.getFilters()),
              data
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
            newData
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
            await NcPluginMgrv2.emailAdapter()
          )?.mailSend({
            to: parseBody(notification?.payload?.to, newData),
            subject: parseBody(notification?.payload?.subject, newData),
            html: parseBody(notification?.payload?.body, newData),
          });
          hookLog = {
            ...hook,
            type: notification.type,
            payload: JSON.stringify(notification?.payload),
            response: JSON.stringify(res),
            triggered_by: user?.email,
          };
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
            newData
          );

          hookLog = {
            ...hook,
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
            })
          );

          hookLog = {
            ...hook,
            type: notification.type,
            payload: JSON.stringify(notification?.payload),
            response: JSON.stringify(res),
            triggered_by: user?.email,
          };
        }
        break;
    }
  } catch (e) {
    console.log(e);
    hookLog = {
      ...hook,
      error_code: e.error_code,
      error_message: e.message,
      error: JSON.stringify(e),
    };
    if (throwErrorOnFailure) throw e;
  } finally {
    if (hookLog) {
      hookLog.execution_time = parseHrtimeToMilliSeconds(
        process.hrtime(startTime)
      );
      HookLog.insert({ ...hookLog, test_call: !!testFilters });
    }
  }
}

export function _transformSubmittedFormDataForEmail(
  data,
  // @ts-ignore
  formView,
  // @ts-ignore
  columns: (Column<any> & FormView<any>)[]
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
              attachment.title.split('.').pop()
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
