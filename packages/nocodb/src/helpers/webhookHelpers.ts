import { Logger } from '@nestjs/common';
import axios from 'axios';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import Handlebars from 'handlebars';
import handlebarsHelpers from 'handlebars-helpers-v2';
import {
  ColumnHelper,
  HookOperationCode,
  isDateMonthFormat,
  UITypes,
} from 'nocodb-sdk';
import type {
  ColumnType,
  FormColumnType,
  HookType,
  TableType,
  UpdatePayload,
  ViewType,
} from 'nocodb-sdk';
import type { AxiosResponse } from 'axios';
import type { NcContext } from '~/interface/config';
import type { Column, FormView, Hook, Model, Source, View } from '~/models';
import { Filter } from '~/models';
import { populateUpdatePayloadDiff } from '~/utils';
import { WebhookInvoker } from '~/utils/webhook-invoker';

handlebarsHelpers({ handlebars: Handlebars });

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

Handlebars.registerHelper('json', function (context, pretty = false) {
  if (pretty === true || pretty === 'true') {
    // Pretty print with 2-space indentation
    return JSON.stringify(context, null, 2);
  }
  return JSON.stringify(context);
});

const logger = new Logger('webhookHelpers');

export function parseBody(template: string, data: any): string {
  if (!template) {
    return template;
  }

  try {
    return Handlebars.compile(template, { noEscape: true })({
      data,
      event: data,
    });
  } catch (e) {
    // if parsing fails then return the original template
    return template;
  }
}

export async function validateCondition(
  context: NcContext,
  filters: Filter[],
  data: any = {},
  {
    client,
  }: {
    client: string;
  },
) {
  if (!filters.length) {
    return true;
  }

  let isValid = null;
  for (const _filter of filters) {
    const filter = _filter instanceof Filter ? _filter : new Filter(_filter);
    let res;
    if (filter.is_group) {
      filter.children = filter.children || (await filter.getChildren(context));
      res = await validateCondition(context, filter.children, data, {
        client,
      });
    } else {
      const column = await filter.getColumn(context);
      const field = column.title;
      let val = data[field];
      if (
        [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.CreatedTime,
          UITypes.LastModifiedTime,
        ].includes(column.uidt) &&
        !['empty', 'blank', 'notempty', 'notblank'].includes(
          filter.comparison_op,
        )
      ) {
        const dateFormat =
          client === 'mysql2' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ';

        let now = dayjs(new Date());
        const dateFormatFromMeta = column?.meta?.date_format;
        const dataVal: any = val;
        let filterVal: any = filter.value;
        if (dateFormatFromMeta && isDateMonthFormat(dateFormatFromMeta)) {
          // reset to 1st
          now = dayjs(now).date(1);
          if (val) val = dayjs(val).date(1);
        }
        if (filterVal) res = dayjs(filterVal).isSame(dataVal, 'day');

        // handle sub operation
        switch (filter.comparison_sub_op) {
          case 'today':
            filterVal = now;
            break;
          case 'tomorrow':
            filterVal = now.add(1, 'day');
            break;
          case 'yesterday':
            filterVal = now.add(-1, 'day');
            break;
          case 'oneWeekAgo':
            filterVal = now.add(-1, 'week');
            break;
          case 'oneWeekFromNow':
            filterVal = now.add(1, 'week');
            break;
          case 'oneMonthAgo':
            filterVal = now.add(-1, 'month');
            break;
          case 'oneMonthFromNow':
            filterVal = now.add(1, 'month');
            break;
          case 'daysAgo':
            if (!filterVal) return;
            filterVal = now.add(-filterVal, 'day');
            break;
          case 'daysFromNow':
            if (!filterVal) return;
            filterVal = now.add(filterVal, 'day');
            break;
          case 'exactDate':
            if (!filterVal) return;
            break;
          // sub-ops for `isWithin` comparison
          case 'pastWeek':
            filterVal = now.add(-1, 'week');
            break;
          case 'pastMonth':
            filterVal = now.add(-1, 'month');
            break;
          case 'pastYear':
            filterVal = now.add(-1, 'year');
            break;
          case 'nextWeek':
            filterVal = now.add(1, 'week');
            break;
          case 'nextMonth':
            filterVal = now.add(1, 'month');
            break;
          case 'nextYear':
            filterVal = now.add(1, 'year');
            break;
          case 'pastNumberOfDays':
            if (!filterVal) return;
            filterVal = now.add(-filterVal, 'day');
            break;
          case 'nextNumberOfDays':
            if (!filterVal) return;
            filterVal = now.add(filterVal, 'day');
            break;
        }

        if (dataVal) {
          switch (filter.comparison_op) {
            case 'eq':
              res = dayjs(dataVal).isSame(filterVal, 'day');
              break;
            case 'neq':
              res = !dayjs(dataVal).isSame(filterVal, 'day');
              break;
            case 'gt':
              res = dayjs(dataVal).isAfter(filterVal, 'day');
              break;
            case 'lt':
              res = dayjs(dataVal).isBefore(filterVal, 'day');
              break;
            case 'lte':
            case 'le':
              res = dayjs(dataVal).isSameOrBefore(filterVal, 'day');
              break;
            case 'gte':
            case 'ge':
              res = dayjs(dataVal).isSameOrAfter(filterVal, 'day');
              break;
            case 'empty':
            case 'blank':
              res = dataVal === '' || dataVal === null || dataVal === undefined;
              break;
            case 'notempty':
            case 'notblank':
              res = !(
                dataVal === '' ||
                dataVal === null ||
                dataVal === undefined
              );
              break;
            case 'isWithin': {
              let now = dayjs(new Date()).format(dateFormat).toString();
              now = column.uidt === UITypes.Date ? now.substring(0, 10) : now;
              switch (filter.comparison_sub_op) {
                case 'pastWeek':
                case 'pastMonth':
                case 'pastYear':
                case 'pastNumberOfDays':
                  res = dayjs(dataVal).isBetween(filterVal, now, 'day');
                  break;
                case 'nextWeek':
                case 'nextMonth':
                case 'nextYear':
                case 'nextNumberOfDays':
                  res = dayjs(dataVal).isBetween(now, filterVal, 'day');
                  break;
              }
            }
          }
        }
      } else {
        switch (typeof filter.value) {
          case 'boolean':
            val = !!data[field];
            break;
          case 'number':
            val = +data[field];
            break;
        }

        if (
          [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
            column.uidt,
          )
        ) {
          const userIds = Array.isArray(data[field])
            ? data[field].map((user) => user.id)
            : data[field]?.id
            ? [data[field].id]
            : [];

          const filterValues =
            filter.value?.split(',').map((v) => v.trim()) ?? [];
          switch (filter.comparison_op) {
            case 'anyof':
              res = userIds.some((id) => filterValues.includes(id));
              break;
            case 'nanyof':
              res = !userIds.some((id) => filterValues.includes(id));
              break;
            case 'allof':
              res = filterValues.every((id) => userIds.includes(id));
              break;
            case 'nallof':
              res = !filterValues.every((id) => userIds.includes(id));
              break;
            case 'empty':
            case 'blank':
              res = userIds.length === 0;
              break;
            case 'notempty':
            case 'notblank':
              res = userIds.length > 0;
              break;
            default:
              res = false; // Unsupported operation for User fields
          }
        } else {
          switch (filter.comparison_op) {
            case 'eq':
              res = val == filter.value;
              break;
            case 'neq':
              res = val != filter.value;
              break;
            case 'like':
              res =
                data[field]
                  ?.toString?.()
                  ?.toLowerCase()
                  ?.indexOf(filter.value?.toLowerCase()) > -1;
              break;
            case 'nlike':
              res =
                data[field]
                  ?.toString?.()
                  ?.toLowerCase()
                  ?.indexOf(filter.value?.toLowerCase()) === -1;
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
              res = (
                filter.value?.split(',').map((item) => item.trim()) ?? []
              ).every((item) => (data[field]?.split(',') ?? []).includes(item));
              break;
            case 'anyof':
              res = (
                filter.value?.split(',').map((item) => item.trim()) ?? []
              ).some((item) => (data[field]?.split(',') ?? []).includes(item));
              break;
            case 'nallof':
              res = !(
                filter.value?.split(',').map((item) => item.trim()) ?? []
              ).every((item) => (data[field]?.split(',') ?? []).includes(item));
              break;
            case 'nanyof':
              res = !(
                filter.value?.split(',').map((item) => item.trim()) ?? []
              ).some((item) => (data[field]?.split(',') ?? []).includes(item));
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
        }
      }
    }

    switch (filter.logical_op) {
      case 'or':
        isValid = isValid || !!res;
        break;
      case 'not':
        isValid = isValid && !res;
        break;
      case 'and':
      default:
        isValid = (isValid ?? true) && res;
        break;
    }
  }
  return isValid;
}

/**
 * Sanitizes user object to include only safe, non-sensitive information
 */
export function sanitizeUserForHook(user: any) {
  if (!user || !user.id || !user.email) return null;

  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    // Explicitly exclude sensitive fields like:
    // - tokens
    // - password hashes
    // - api tokens
    // - personal information not needed in webhooks
  };
}

function extractReqPayloadForLog(reqPayload, response?: AxiosResponse<any>) {
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

function extractResPayloadForLog(response: AxiosResponse<any>) {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data,
  };
}

export async function handleHttpWebHook({
  reqPayload,
}: {
  reqPayload: any;
}): Promise<any> {
  const response = await axios(reqPayload);
  return {
    response,
    requestPayload: extractReqPayloadForLog(reqPayload, response),
    responsePayload: extractResPayloadForLog(response),
  };
}

export async function invokeWebhook(
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
  // backward compatibility
  return new WebhookInvoker().invoke(context, param);
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
          return attachment.title;
        })
        .join('<br/>');
    } else if (
      transformedData[col.title] &&
      typeof transformedData[col.title] === 'object'
    ) {
      transformedData[col.title] = JSON.stringify(transformedData[col.title]);
    }
  }
  return transformedData;
}

export function transformDataForMailRendering(
  data: Record<string, any>,
  columns: (ColumnType & FormColumnType)[],
  source: Source,
  model: Model,
  models: Record<string, TableType>,
) {
  const transformedData: Array<{
    parsedValue?: any;
    columnTitle: string;
    uidt: UITypes | string;
  }> = [];

  columns.map((col) => {
    let serializedValue: string | undefined;

    try {
      serializedValue = ColumnHelper.serializeValue(data[col.title], {
        col,
        isMysql: () => source.type.startsWith('mysql'),
        isPg: () => source.type === 'pg',
        isXcdbBase: () => !!source.isMeta(),
        meta: model,
        metas: models,
      });

      if (col.uidt === 'Attachment') {
        let attachments = data[col.title] || [];
        if (typeof data[col.title] === 'string') {
          try {
            attachments = JSON.parse(data[col.title]);
          } catch (e) {
            attachments = [];
          }
        }
        serializedValue = Array.isArray(attachments)
          ? attachments
              .map((attachment) => attachment?.title || '')
              .filter(Boolean)
              .join(', ')
          : '';
      }
    } catch (error) {
      logger.error(`Error processing column ${col.title}:`, error);
      serializedValue = data[col.title]?.toString() || '';
    }

    transformedData.push({
      parsedValue: serializedValue,
      uidt: col.uidt,
      columnTitle: col.title,
    });
  });

  return transformedData;
}

export function operationArrToCode(value: HookType['operation']) {
  let result = 0;
  for (const operation of value) {
    result += HookOperationCode[operation];
  }
  return result.toString();
}
export function operationCodeToArr(code: number | string) {
  const numberCode = typeof code === 'number' ? code : Number(code);
  const result: HookType['operation'] = [];
  for (const operation of Object.keys(HookOperationCode)) {
    const operationCode = HookOperationCode[operation];
    if ((numberCode & operationCode) === operationCode) {
      result.push(operation as any);
    }
  }
  return result;
}
export function compareOperationCode(param: {
  code: string | number;
  operation: string;
}) {
  const numberCode =
    typeof param.code === 'number' ? param.code : Number(param.code);
  return (
    (HookOperationCode[param.operation] & numberCode) ===
    HookOperationCode[param.operation]
  );
}

export async function getAffectedColumns(
  context: NcContext,
  {
    hookName,
    prevData,
    newData,
    model,
  }: {
    hookName: string;
    prevData: any;
    newData: any;
    model: Model;
  },
) {
  if (hookName !== 'after.update' && hookName !== 'after.bulkUpdate') {
    return undefined;
  }
  let affectedCols = [];
  if (typeof prevData === 'undefined' || prevData === null) {
    return undefined;
  }
  const compareSingle = (prev, next) => {
    const updatePayload = populateUpdatePayloadDiff({
      prev,
      next,
      keepUnderModified: true,
    }) as UpdatePayload;
    if (updatePayload) {
      affectedCols = affectedCols.concat(
        Object.keys(updatePayload.modifications),
      );
    }
  };
  if (Array.isArray(prevData)) {
    for (let i = 0; i < prevData.length; i++) {
      compareSingle(prevData[i], newData[i]);
    }
  } else {
    compareSingle(prevData, newData);
  }
  if (affectedCols.length) {
    affectedCols = [...new Set(affectedCols)];
    const columns = await model.getColumns(context);
    return affectedCols.map(
      (title) => columns.find((col) => col.title === title).id,
    );
  } else {
    return undefined;
  }
}
