import dayjs, { extend } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { ColumnType, FilterType, LinkToAnotherRecordType } from '~/lib/Api';
import { isDateMonthFormat } from '~/lib/dateTimeHelper';
import { buildFilterTree } from '~/lib/filterHelpers';
import { parseProp } from '~/lib/helperFunctions';
import UITypes from '~/lib/UITypes';
import { getLookupColumnType } from '~/lib/columnHelper/utils/get-lookup-column-type';
import { CURRENT_USER_TOKEN } from '~/lib';
import { ColumnHelper } from '~/lib';

extend(relativeTime);
extend(customParseFormat);
extend(isSameOrBefore);
extend(isSameOrAfter);
extend(isBetween);

export function validateRowFilters(params: {
  filters: FilterType[];
  data: any;
  columns: ColumnType[];
  client: any;
  metas: Record<string, any>;
  options?: {
    currentUser?: {
      id: string;
      email: string;
    };
  };
}) {
  const { filters: _filters, data, columns, client, metas } = params;
  if (!_filters.length) {
    return true;
  }

  const filters = buildFilterTree(_filters);

  let isValid: boolean | null = null;
  for (const filter of filters) {
    let res;
    if (filter.is_group && filter.children?.length) {
      res = validateRowFilters({
        filters: filter.children,
        data: data,
        columns: columns,
        client: client,
        metas: metas,
      });
    } else {
      const column = columns.find((c) => c.id === filter.fk_column_id);
      if (!column) {
        continue;
      }
      const field = column.title!;
      let val = data[field];
      if (
        [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.CreatedTime,
          UITypes.LastModifiedTime,
        ].includes(column.uidt! as UITypes) &&
        !['empty', 'blank', 'notempty', 'notblank'].includes(
          filter.comparison_op!
        )
      ) {
        const dateFormat =
          client === 'mysql2' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ';

        let now = dayjs(new Date());
        const dateFormatFromMeta = parseProp(column.meta)?.date_format;
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
            if (!filterVal) return null;
            filterVal = now.add(-filterVal, 'day');
            break;
          case 'daysFromNow':
            if (!filterVal) return null;
            filterVal = now.add(filterVal, 'day');
            break;
          case 'exactDate':
            if (!filterVal) return null;
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
            if (!filterVal) return null;
            filterVal = now.add(-filterVal, 'day');
            break;
          case 'nextNumberOfDays':
            if (!filterVal) return null;
            filterVal = now.add(filterVal, 'day');
            break;
        }

        if (dataVal) {
          switch (filter.comparison_op as any) {
            case 'eq':
            case 'gb_eq':
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
            column.uidt! as UITypes
          ) ||
          (column.uidt === UITypes.Lookup &&
            [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
              getLookupColumnType({
                col: column,
                meta: { columns },
                metas: metas,
              }) as UITypes
            ))
        ) {
          const userIds: string[] = Array.isArray(data[field])
            ? data[field].map((user) => user.id)
            : data[field]?.id
            ? [data[field].id]
            : [];

          const filterValues = (filter.value?.split(',') || []).map((v) => {
            let result = v.trim();
            if (result === CURRENT_USER_TOKEN) {
              result = params.options?.currentUser?.id ?? result;
            }
            return result;
          });

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
        } else if (column.uidt === UITypes.LinkToAnotherRecord) {
          let linkData = data[field];

          linkData = Array.isArray(linkData) ? linkData : [linkData];

          const colOptions = column.colOptions as LinkToAnotherRecordType;

          const relatedModelId = colOptions?.fk_related_model_id;

          const relatedMeta = metas[relatedModelId];

          if (!relatedMeta?.columns) {
            res = false;
          } else {
            // Find the child column in the related table
            const childColumn = relatedMeta.columns.find((col) => col.pv);
            if (!childColumn) {
              res = false;
            } else {
              const childFieldName = childColumn.title;
              const childValues = linkData
                .map((item) => {
                  return item[childFieldName]?.toString() || '';
                })
                .filter((val) => val !== '');

              switch (filter.comparison_op) {
                case 'eq':
                  res = childValues.includes(filter.value);
                  break;
                case 'neq':
                  res = !childValues.includes(filter.value);
                  break;
                case 'like':
                  res = childValues.some((val) =>
                    val
                      .toLowerCase()
                      .includes(filter.value?.toLowerCase() || '')
                  );
                  break;
                case 'nlike':
                  res = !childValues.some((val) =>
                    val
                      .toLowerCase()
                      .includes(filter.value?.toLowerCase() || '')
                  );
                  break;
                case 'anyof': {
                  const filterValues =
                    filter.value?.split(',').map((v) => v.trim()) || [];
                  res = childValues.some((val) => filterValues.includes(val));
                  break;
                }
                case 'nanyof': {
                  const filterValues2 =
                    filter.value?.split(',').map((v) => v.trim()) || [];
                  res = !childValues.some((val) => filterValues2.includes(val));
                  break;
                }
                case 'allof': {
                  const filterValues3 =
                    filter.value?.split(',').map((v) => v.trim()) || [];
                  res = filterValues3.every((filterVal) =>
                    childValues.includes(filterVal)
                  );
                  break;
                }
                case 'nallof': {
                  const filterValues4 =
                    filter.value?.split(',').map((v) => v.trim()) || [];
                  res = !filterValues4.every((filterVal) =>
                    childValues.includes(filterVal)
                  );
                  break;
                }
                case 'empty':
                case 'blank':
                  res = linkData.length === 0;
                  break;
                case 'notempty':
                case 'notblank':
                  res = linkData.length > 0;
                  break;
                default:
                  res = false;
              }
            }
          }
        } else if (
          [UITypes.JSON, UITypes.Time].includes(column.uidt as UITypes) &&
          ['eq'].includes(filter.comparison_op)
        ) {
          res = ColumnHelper.getColumn(
            column.uidt as UITypes
          ).equalityComparison(val, filter.value, {
            col: column,
          });
        } else {
          switch (filter.comparison_op as any) {
            case 'eq':
            case 'gb_eq':
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
