import Handlebars from 'handlebars';
import Model from '../../models/Model';
import NcPluginMgrv2 from './NcPluginMgrv2';
import Column from '../../models/Column';
import Hook from '../../models/Hook';
import Filter from '../../models/Filter';
import HookLog from '../../models/HookLog';
import { HookLogType } from 'nocodb-sdk';

export function parseBody(
  template: string,
  user: any,
  data: any,
  payload: any
): string {
  if (!template) {
    return template;
  }

  return Handlebars.compile(template, { noEscape: true })({
    data,
    user,
    payload,
    env: process.env
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
    const field = await filter.getColumn().then(c => c.title);
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
        res =
          data[field] === '' ||
          data[field] === null ||
          data[field] === undefined;
        break;
      case 'notempty':
        res = !(
          data[field] === '' ||
          data[field] === null ||
          data[field] === undefined
        );
        break;
      case 'null':
        res = res = data[field] === null;
        break;
      case 'notnull':
        res = data[field] !== null;
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

export async function handleHttpWebHook(apiMeta, user, data) {
  // try {
  const req = axiosRequestMake(apiMeta, user, data);
  await require('axios')(req);
  // } catch (e) {
  //   console.log(e);
  // }
}

export function axiosRequestMake(_apiMeta, user, data) {
  const apiMeta = { ..._apiMeta };
  if (apiMeta.body) {
    try {
      apiMeta.body = JSON.parse(apiMeta.body, (_key, value) => {
        return typeof value === 'string'
          ? parseBody(value, user, data, apiMeta)
          : value;
      });
    } catch (e) {
      apiMeta.body = parseBody(apiMeta.body, user, data, apiMeta);
    }
  }
  if (apiMeta.auth) {
    try {
      apiMeta.auth = JSON.parse(apiMeta.auth, (_key, value) => {
        return typeof value === 'string'
          ? parseBody(value, user, data, apiMeta)
          : value;
      });
    } catch (e) {
      apiMeta.auth = parseBody(apiMeta.auth, user, data, apiMeta);
    }
  }
  apiMeta.response = {};
  const req = {
    params: apiMeta.parameters
      ? apiMeta.parameters.reduce((paramsObj, param) => {
          if (param.name && param.enabled) {
            paramsObj[param.name] = parseBody(param.value, user, data, apiMeta);
          }
          return paramsObj;
        }, {})
      : {},
    url: parseBody(apiMeta.path, user, data, apiMeta),
    method: apiMeta.method,
    data: apiMeta.body,
    headers: apiMeta.headers
      ? apiMeta.headers.reduce((headersObj, header) => {
          if (header.name && header.enabled) {
            headersObj[header.name] = parseBody(
              header.value,
              user,
              data,
              apiMeta
            );
          }
          return headersObj;
        }, {})
      : {},
    withCredentials: true
  };
  return req;
}

export async function invokeWebhook(
  hook: Hook,
  _model: Model,
  data,
  user,
  testFilters = null,
  throwErrorOnFailure = false
) {
  let hookLog: HookLogType;
  const startTime = process.hrtime();
  try {
    // for (const hook of hooks) {
    const notification =
      typeof hook.notification === 'string'
        ? JSON.parse(hook.notification)
        : hook.notification;

    if (hook.condition) {
      if (
        !(await validateCondition(
          testFilters || (await hook.getFilters()),
          data
        ))
      ) {
        return;
      }
    }

    switch (notification?.type) {
      case 'Email':
        {
          const res = await (await NcPluginMgrv2.emailAdapter())?.mailSend({
            to: parseBody(
              notification?.payload?.to,
              user,
              data,
              notification?.payload
            ),
            subject: parseBody(
              notification?.payload?.subject,
              user,
              data,
              notification?.payload
            ),
            html: parseBody(
              notification?.payload?.body,
              user,
              data,
              notification?.payload
            )
          });
          hookLog = {
            ...hook,
            type: notification.type,
            payload: JSON.stringify(notification?.payload),
            response: JSON.stringify(res),
            triggered_by: user?.email
          };
        }
        break;
      case 'URL':
        {
          const res = await handleHttpWebHook(
            notification?.payload,
            user,
            data
          );

          hookLog = {
            ...hook,
            type: notification.type,
            payload: JSON.stringify(notification?.payload),
            response: JSON.stringify(res),
            triggered_by: user?.email
          };
        }
        break;
      default:
        {
          const res = await (
            await NcPluginMgrv2.webhookNotificationAdapters(notification.type)
          ).sendMessage(
            parseBody(
              notification?.payload?.body,
              user,
              data,
              notification?.payload
            ),
            JSON.parse(JSON.stringify(notification?.payload), (_key, value) => {
              return typeof value === 'string'
                ? parseBody(value, user, data, notification?.payload)
                : value;
            })
          );

          hookLog = {
            ...hook,
            type: notification.type,
            payload: JSON.stringify(notification?.payload),
            response: JSON.stringify(res),
            triggered_by: user?.email
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
      error: JSON.stringify(e)
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
  columns: Column[]
) {
  const transformedData = { ...data };

  for (const col of columns) {
    if (!formView.query_params?.showFields?.[col.title]) {
      delete transformedData[col.title];
      continue;
    }

    if (col.uidt === 'Attachment') {
      if (typeof transformedData[col.title] === 'string') {
        transformedData[col.title] = JSON.parse(transformedData[col.title]);
      }
      transformedData[col.title] = (transformedData[col.title] || [])
        .map(attachment => {
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
}

function parseHrtimeToMilliSeconds(hrtime) {
  const milliseconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
  return milliseconds;
}
