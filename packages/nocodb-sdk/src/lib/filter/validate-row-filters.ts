import dayjs, { extend } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { ColumnType, FilterType, LinkToAnotherRecordType } from '~/lib/Api';
import { isDateMonthFormat } from '~/lib/dateTimeHelper';
import { buildFilterTree } from '~/lib/filterHelpers';
import { parseProp } from '~/lib/helperFunctions';
import UITypes from '~/lib/UITypes';
import { FormulaDataTypes } from '~/lib/formula/enums';
import { getLookupColumnType } from '~/lib/columnHelper/utils/get-lookup-column-type';
import { getNodejsTimezone } from '~/lib/timezoneUtils';
import { ColumnHelper } from '~/lib/columnHelper/column-helper';
import { CURRENT_USER_TOKEN } from '~/lib/globals';
import { getMetaWithCompositeKey } from '~/lib/helpers/metaHelpers';

extend(utc);
extend(timezone);
extend(relativeTime);
extend(customParseFormat);
extend(isSameOrBefore);
extend(isSameOrAfter);
extend(isBetween);

const ncToString = (value: any) => {
  return value?.toString?.() || '';
};

const DATE_TYPES = [
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
];

const USER_TYPES = [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy];

// Ops that mean "no value" / "has value" — kept out of the date path (handled
// generically) and used for array (lookup/attachment) emptiness checks.
const BLANK_OPS = ['empty', 'blank', 'notempty', 'notblank', 'gb_null'];

// A value counts as blank when it is null/undefined/'' OR an empty array (e.g.
// an attachment cell with no files, or a lookup that resolved to nothing).
const isBlankValue = (value: any) =>
  value === '' ||
  value === null ||
  value === undefined ||
  (Array.isArray(value) && value.length === 0);

// "HH:mm[:ss]" (or a datetime carrying a time) → seconds since midnight, for
// ordered Time comparisons. Returns NaN when no time component is present.
const timeToSeconds = (value: any): number => {
  const match = ncToString(value).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return NaN;
  return +match[1] * 3600 + +match[2] * 60 + +(match[3] || 0);
};

export class RowFilterValidator {
  dateNow() {
    return new Date();
  }

  /**
   * Resolve the type a column should be *compared as*. Computed / relational
   * columns don't store a plain scalar of their own uidt, so mirror the backend
   * field-handler/dialect routing:
   *  - Formula  → its `parsed_tree.dataType` (numeric / date / boolean / string)
   *  - Lookup   → the leaf looked-up column type (recurses through nested lookups)
   *  - Rollup   → numeric, except min/max which inherit the rolled-up column type
   *  - Links / Count → numeric (a count)
   *  - Barcode / QrCode / Button → their string-ish display value
   */
  protected resolveComparisonType(params: {
    column: ColumnType;
    columns: ColumnType[];
    metas: Record<string, any>;
    baseId?: string;
  }): UITypes {
    const { column, columns, metas, baseId } = params;
    switch (column.uidt as UITypes) {
      case UITypes.Formula: {
        const dataType = parseProp(column.colOptions)?.parsed_tree?.dataType;
        switch (dataType) {
          case FormulaDataTypes.NUMERIC:
            return UITypes.Decimal;
          case FormulaDataTypes.DATE:
            return UITypes.DateTime;
          case FormulaDataTypes.BOOLEAN:
          case FormulaDataTypes.LOGICAL:
            return UITypes.Checkbox;
          default:
            return UITypes.SingleLineText;
        }
      }
      case UITypes.Lookup:
        return (
          (getLookupColumnType({
            col: column,
            meta: { columns, base_id: baseId },
            metas,
            baseId,
          }) as UITypes) ?? UITypes.SingleLineText
        );
      case UITypes.Rollup:
        return this.resolveRollupType({ column, columns, metas, baseId });
      case UITypes.Links:
      case UITypes.Count:
        return UITypes.Decimal;
      case UITypes.Deleted:
        return UITypes.Checkbox;
      case UITypes.Barcode:
      case UITypes.QrCode:
      case UITypes.Button:
        return UITypes.SingleLineText;
      default:
        return column.uidt as UITypes;
    }
  }

  /**
   * Most rollups are numeric (count/sum/avg/…). `min`/`max` inherit the
   * rolled-up column's type (e.g. min of a Date column is a date), so resolve
   * that from the already-loaded related metas; fall back to numeric.
   */
  protected resolveRollupType(params: {
    column: ColumnType;
    columns: ColumnType[];
    metas: Record<string, any>;
    baseId?: string;
  }): UITypes {
    const { column, columns, metas, baseId } = params;
    const colOptions = column.colOptions as any;
    const fn = colOptions?.rollup_function;
    if (!['min', 'max'].includes(fn)) return UITypes.Decimal;

    const relationCol = columns.find(
      (c) => c.id === colOptions?.fk_relation_column_id
    );
    const relatedModelId = (relationCol?.colOptions as any)
      ?.fk_related_model_id;
    const relatedMeta = getMetaWithCompositeKey(metas, baseId, relatedModelId);
    const rollupCol = relatedMeta?.columns?.find(
      (c: ColumnType) => c.id === colOptions?.fk_rollup_column_id
    );
    return (rollupCol?.uidt as UITypes) ?? UITypes.Decimal;
  }

  validateSync(params: {
    filters: (FilterType & { meta?: any })[];
    data: any;
    columns: ColumnType[];
    client: any;
    metas: Record<string, any>;
    baseId?: string;
    options?: {
      currentUser?: {
        id: string;
        email: string;
      };
      timezone?: string;
    };
  }) {
    const {
      filters: _filters,
      data = {},
      columns = [],
      client,
      metas,
      baseId,
    } = params;
    if (!_filters.length) {
      return true;
    }

    const filters: (FilterType & { meta?: any })[] = buildFilterTree(_filters);

    let isValid: boolean | null = null;
    for (const filter of filters) {
      let res;
      // if filter is disabled, it is valid
      if (filter.enabled === false || (filter.enabled as any) === 0) {
        res = true;
      } else if (filter.is_group && filter.children?.length) {
        res = validateRowFilters({
          filters: filter.children,
          data: data,
          columns: columns,
          client: client,
          metas: metas,
          baseId: baseId,
        });
      } else {
        const column = columns.find((c) => c.id === filter.fk_column_id);
        if (!column) {
          continue;
        }
        const field = column.title!;
        const rawVal = data[field];
        const effectiveUidt = this.resolveComparisonType({
          column,
          columns,
          metas,
          baseId,
        });

        if (USER_TYPES.includes(effectiveUidt)) {
          // User / CreatedBy / LastModifiedBy — and lookups that resolve to one
          // of them (effectiveUidt is already the leaf type).
          const userIds: string[] = Array.isArray(rawVal)
            ? rawVal.flat(Infinity).map((user) => user?.id)
            : rawVal?.id
            ? [rawVal.id]
            : [];

          const filterValues = (ncToString(filter.value).split(',') || []).map(
            (v) => {
              let result = v.trim();
              if (result === CURRENT_USER_TOKEN) {
                result = params.options?.currentUser?.id ?? result;
              }
              return result;
            }
          );

          switch (filter.comparison_op as any) {
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
            case 'gb_eq':
              res =
                userIds.length === filterValues.length &&
                filterValues.every((id) => userIds.includes(id));
              break;
            case 'gb_null':
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
          // LTAR holds the related records themselves (Links, by contrast, is a
          // numeric count and falls through to the scalar path).
          let linkData = rawVal;

          linkData = Array.isArray(linkData) ? linkData : [linkData];

          const colOptions = column.colOptions as LinkToAnotherRecordType;

          const relatedModelId = colOptions?.fk_related_model_id;

          const relatedMeta = getMetaWithCompositeKey(
            metas,
            baseId,
            relatedModelId
          );

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
                  return ncToString(item?.[childFieldName]);
                })
                .filter((val) => val !== '');

              switch (filter.comparison_op as any) {
                case 'eq':
                  res = childValues.includes(ncToString(filter.value));
                  break;
                case 'neq':
                  res = !childValues.includes(ncToString(filter.value));
                  break;
                case 'like':
                  res = childValues.some((val) =>
                    val
                      .toLowerCase()
                      .includes(ncToString(filter.value).toLowerCase())
                  );
                  break;
                case 'nlike':
                  res = !childValues.some((val) =>
                    val
                      .toLowerCase()
                      .includes(ncToString(filter.value).toLowerCase())
                  );
                  break;
                case 'anyof': {
                  const filterValues =
                    ncToString(filter.value)
                      .split(',')
                      .map((v) => v.trim()) || [];
                  res = childValues.some((val) => filterValues.includes(val));
                  break;
                }
                case 'nanyof': {
                  const filterValues2 =
                    ncToString(filter.value)
                      .split(',')
                      .map((v) => v.trim()) || [];
                  res = !childValues.some((val) => filterValues2.includes(val));
                  break;
                }
                case 'allof': {
                  const filterValues3 =
                    ncToString(filter.value)
                      .split(',')
                      .map((v) => v.trim()) || [];
                  res = filterValues3.every((filterVal) =>
                    childValues.includes(filterVal)
                  );
                  break;
                }
                case 'nallof': {
                  const filterValues4 =
                    ncToString(filter.value)
                      .split(',')
                      .map((v) => v.trim()) || [];
                  res = !filterValues4.every((filterVal) =>
                    childValues.includes(filterVal)
                  );
                  break;
                }
                case 'gb_null':
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
        } else if (column.uidt === UITypes.Lookup) {
          // Non-user lookup: the cell is an array of looked-up scalar values.
          res = this.compareLookupArray({
            value: rawVal,
            effectiveUidt,
            filter,
            column,
            client,
            options: params.options,
          });
        } else {
          res = this.compareScalar({
            value: rawVal,
            effectiveUidt,
            filter,
            column,
            client,
            options: params.options,
          });
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
   * Compare a single scalar cell value against a filter. Handles the date
   * family, JSON/Time equality, Time ranges, and all generic operators. Reused
   * per-element for lookups, so it must stay value-shape agnostic (no `data`).
   */
  protected compareScalar(args: {
    value: any;
    effectiveUidt: UITypes;
    filter: FilterType & { meta?: any };
    column: ColumnType;
    client: any;
    options?: {
      currentUser?: { id: string; email: string };
      timezone?: string;
    };
  }): boolean | null | undefined {
    const { value, effectiveUidt, filter, column, client, options } = args;
    const op = filter.comparison_op as any;
    let res: boolean | null | undefined;
    let val: any = value;

    // ----- Date family (Date/DateTime/CreatedTime/LastModifiedTime, incl.
    // Formula/Rollup that resolve to a date). Empty-style ops are handled in
    // the generic switch below. -----
    if (DATE_TYPES.includes(effectiveUidt) && !BLANK_OPS.includes(op)) {
      const getTimezone = () => {
        return getNodejsTimezone(
          parseProp(filter.meta).timezone,
          parseProp(column.meta).timezone,
          options?.timezone
        );
      };

      // dayjs.tz() resolves the zone offset via Intl.DateTimeFormat#formatToParts,
      // which throws ("date value is not finite" on Safari, "Invalid time value" in
      // V8) for a non-finite date. Build the tz value only for inputs that parse to a
      // valid date; otherwise return the (safe) Invalid dayjs so date comparisons
      // evaluate to no-match instead of crashing filter validation.
      const toTz = (value: any) =>
        dayjs(value).isValid() ? dayjs.tz(value, getTimezone()) : dayjs(value);
      const dateFormat =
        client === 'mysql2' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ';

      let now = dayjs.tz(this.dateNow(), getTimezone());
      const dateFormatFromMeta = parseProp(column.meta)?.date_format;
      const dataVal: any = val;
      let filterVal: any = filter.value;
      if (dateFormatFromMeta && isDateMonthFormat(dateFormatFromMeta)) {
        // reset to 1st
        now = now.date(1);
        if (val) val = toTz(val).date(1);
      }
      if (filterVal) res = toTz(filterVal).isSame(dataVal, 'day');

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
        const getDayjsDataVal = () => {
          if (effectiveUidt === UITypes.Date) {
            return toTz(dataVal);
          } else {
            return dayjs.utc(dataVal).tz(getTimezone());
          }
        };
        // Sub-ops (today, daysAgo, …) already produce a tz-aware dayjs in
        // `filterVal`; an `exactDate`/no-sub-op filter leaves it a raw
        // string that dayjs would parse in the host's local zone. Coerce
        // raw values through `toTz` so both sides compare in the filter's
        // timezone (matches the backend's parseFilterValue).
        const cmpFilterVal = dayjs.isDayjs(filterVal)
          ? filterVal
          : toTz(filterVal);
        switch (op) {
          case 'eq':
          case 'gb_eq':
            res = getDayjsDataVal().isSame(cmpFilterVal, 'day');
            break;
          case 'neq':
          case 'not':
            res = !getDayjsDataVal().isSame(cmpFilterVal, 'day');
            break;
          case 'gt':
            res = getDayjsDataVal().isAfter(cmpFilterVal, 'day');
            break;
          case 'lt':
            res = getDayjsDataVal().isBefore(cmpFilterVal, 'day');
            break;
          case 'lte':
          case 'le':
            res = getDayjsDataVal().isSameOrBefore(cmpFilterVal, 'day');
            break;
          case 'gte':
          case 'ge':
            res = getDayjsDataVal().isSameOrAfter(cmpFilterVal, 'day');
            break;
          // `btw`/`nbtw` use the raw two-value range in `filter.value`
          // ("from,to"), not the sub-op-derived `filterVal`.
          case 'btw':
          case 'nbtw': {
            const [from, to] = ncToString(filter.value).split(',');
            const dataValDayjs = getDayjsDataVal();
            const within =
              dataValDayjs.isSameOrAfter(toTz(from), 'day') &&
              dataValDayjs.isSameOrBefore(toTz(to), 'day');
            res = op === 'btw' ? within : !within;
            break;
          }
          case 'isWithin': {
            let now = dayjs
              .tz(this.dateNow(), getTimezone())
              .format(dateFormat)
              .toString();
            now = effectiveUidt === UITypes.Date ? now.substring(0, 10) : now;
            switch (filter.comparison_sub_op) {
              case 'pastWeek':
              case 'pastMonth':
              case 'pastYear':
              case 'pastNumberOfDays': {
                // the 'today' need to be included, hence we don't use isBetween
                const dataValDayjs = getDayjsDataVal();
                res =
                  dataValDayjs.isSameOrAfter(filterVal, 'day') &&
                  dataValDayjs.isSameOrBefore(now, 'day');
                break;
              }
              case 'nextWeek':
              case 'nextMonth':
              case 'nextYear':
              case 'nextNumberOfDays': {
                // the 'today' need to be included, hence we don't use isBetween
                const dataValDayjs = getDayjsDataVal();
                res =
                  dataValDayjs.isSameOrAfter(now, 'day') &&
                  dataValDayjs.isSameOrBefore(filterVal, 'day');
                break;
              }
            }
          }
        }
      } else if (op === 'neq' || op === 'not') {
        // A missing date value is "not equal to" any concrete date —
        // mirrors the backend `neq`/`not` clause that ORs in `IS NULL`,
        // so realtime updates don't drop rows whose date got cleared.
        res = true;
      }
      return res;
    }

    switch (typeof filter.value) {
      case 'boolean':
        val = !!value;
        break;
      case 'number':
        val = +value;
        break;
    }

    // JSON has full operator support (eq/neq/like/nlike/blank/is/…).
    if (effectiveUidt === UITypes.JSON) {
      return this.compareJson({ value, filter, column });
    }

    // Time equality delegates to the column helper's deep comparison.
    if (effectiveUidt === UITypes.Time && op === 'eq') {
      return ColumnHelper.getColumn(UITypes.Time).equalityComparison(
        val,
        filter.value,
        { col: column }
      );
    }

    // Time ordered comparisons — coerce "HH:mm:ss" to seconds (a plain `+`
    // would yield NaN).
    if (
      effectiveUidt === UITypes.Time &&
      ['gt', 'lt', 'gte', 'ge', 'lte', 'le', 'btw', 'nbtw'].includes(op)
    ) {
      const cell = timeToSeconds(value);
      if (op === 'btw' || op === 'nbtw') {
        const [from, to] = ncToString(filter.value).split(',');
        const within =
          !isNaN(cell) &&
          cell >= timeToSeconds(from) &&
          cell <= timeToSeconds(to);
        return op === 'btw' ? within : !isNaN(cell) && !within;
      }
      const other = timeToSeconds(filter.value);
      if (isNaN(cell) || isNaN(other)) return false;
      switch (op) {
        case 'gt':
          return cell > other;
        case 'lt':
          return cell < other;
        case 'gte':
        case 'ge':
          return cell >= other;
        case 'lte':
        case 'le':
          return cell <= other;
      }
    }

    switch (op) {
      case 'eq':
      case 'gb_eq':
        res = val == filter.value;
        break;
      case 'neq':
      case 'not':
        res = val != filter.value;
        break;
      case 'like':
        res =
          ncToString(value)
            .toLowerCase()
            .indexOf(ncToString(filter.value).toLowerCase()) > -1;
        break;
      case 'nlike':
        res =
          ncToString(value)
            .toLowerCase()
            .indexOf(ncToString(filter.value).toLowerCase()) === -1;
        break;
      case 'empty':
      case 'blank':
        res = isBlankValue(value);
        break;
      case 'notempty':
      case 'notblank':
        res = !isBlankValue(value);
        break;
      case 'checked':
        res = !!value;
        break;
      case 'notchecked':
        res = !value;
        break;
      case 'null':
      case 'gb_null':
        res = value === null || value === undefined || value === '';
        break;
      case 'notnull':
        res = value !== null;
        break;
      case 'allof':
        res = (
          ncToString(filter.value)
            .split(',')
            .map((item) => item.trim()) ?? []
        ).every((item) => (ncToString(value).split(',') ?? []).includes(item));
        break;
      case 'anyof':
        res = (
          ncToString(filter.value)
            .split(',')
            .map((item) => item.trim()) ?? []
        ).some((item) => (ncToString(value).split(',') ?? []).includes(item));
        break;
      case 'nallof':
        res = !(
          ncToString(filter.value)
            .split(',')
            .map((item) => item.trim()) ?? []
        ).every((item) => (ncToString(value).split(',') ?? []).includes(item));
        break;
      case 'nanyof':
        res = !(
          ncToString(filter.value)
            .split(',')
            .map((item) => item.trim()) ?? []
        ).some((item) => (ncToString(value).split(',') ?? []).includes(item));
        break;
      case 'lt':
        res = +value < +filter.value;
        break;
      case 'lte':
      case 'le':
        res = +value <= +filter.value;
        break;
      case 'gt':
        res = +value > +filter.value;
        break;
      case 'gte':
      case 'ge':
        res = +value >= +filter.value;
        break;
      case 'btw':
      case 'nbtw': {
        // value is "lower,upper" (inclusive). A missing/blank cell is
        // outside any range — like SQL `BETWEEN`/`NOT BETWEEN` over
        // NULL, neither matches — so both ops are false for it.
        const [lowerRaw, upperRaw] = ncToString(filter.value).split(',');
        const lower = +lowerRaw;
        const upper = +upperRaw;
        const hasVal = !(value === '' || value === null || value === undefined);
        const num = hasVal ? +value : NaN;
        const within =
          !isNaN(num) &&
          !isNaN(lower) &&
          !isNaN(upper) &&
          num >= lower &&
          num <= upper;
        res = op === 'btw' ? within : !isNaN(num) && !within;
        break;
      }
      case 'in': {
        const list = (
          Array.isArray(filter.value)
            ? filter.value
            : ncToString(filter.value).split(',')
        ).map((v) => ncToString(v).trim());
        res = list.includes(ncToString(value).trim());
        break;
      }
      case 'is':
        switch (filter.value) {
          case null:
          case 'null':
            res = value === null || value === undefined;
            break;
          case 'notnull':
            res = !(value === null || value === undefined);
            break;
          case 'empty':
            res = value === '' || value === null || value === undefined;
            break;
          case 'notempty':
            res = !(value === '' || value === null || value === undefined);
            break;
          case 'true':
            res = value === true || value === 1;
            break;
          case 'false':
            res = value === false || value === 0;
            break;
          default:
            res = val == filter.value;
        }
        break;
      case 'isnot':
        switch (filter.value) {
          case null:
          case 'null':
            res = !(value === null || value === undefined);
            break;
          case 'notnull':
            res = value === null || value === undefined;
            break;
          case 'empty':
            res = !(value === '' || value === null || value === undefined);
            break;
          case 'notempty':
            res = value === '' || value === null || value === undefined;
            break;
          case 'true':
            res = !(value === true || value === 1);
            break;
          case 'false':
            res = !(value === false || value === 0);
            break;
          default:
            res = val != filter.value;
        }
        break;
    }
    return res;
  }

  /**
   * Full JSON operator support, mirroring the backend JSON field handler. A JSON
   * cell counts as blank when it is null/'' OR an empty object/array (`{}`/`[]`),
   * matching the dialect's `IS NULL OR = '{}' OR = '[]'`.
   */
  protected compareJson(args: {
    value: any;
    filter: FilterType & { meta?: any };
    column: ColumnType;
  }): boolean {
    const { value, filter, column } = args;
    const op = filter.comparison_op as any;
    const jsonHelper = ColumnHelper.getColumn(UITypes.JSON);
    const hasFilterVal = !(
      filter.value === '' ||
      filter.value === null ||
      filter.value === undefined
    );

    const jsonToStr = (v: any): string | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'object') return JSON.stringify(v);
      return ncToString(v);
    };
    const isJsonBlank = (v: any): boolean => {
      const s = jsonToStr(v);
      return s === null || s === '' || s === '{}' || s === '[]';
    };
    const contains = () => {
      const s = jsonToStr(value);
      return (
        s !== null &&
        s.toLowerCase().includes(ncToString(filter.value).toLowerCase())
      );
    };

    switch (op) {
      case 'eq':
      case 'gb_eq':
        if (!hasFilterVal) return isJsonBlank(value);
        if (value === null || value === undefined) return false;
        return jsonHelper.equalityComparison(value, filter.value, {
          col: column,
        });
      case 'neq':
      case 'not':
        if (!hasFilterVal) return !isJsonBlank(value);
        // A null cell is "not equal" to any concrete value (dialect ORs IS NULL).
        if (value === null || value === undefined) return true;
        return !jsonHelper.equalityComparison(value, filter.value, {
          col: column,
        });
      case 'like':
        // empty needle → matches any non-null cell (mirrors backend whereNotNull)
        return hasFilterVal
          ? contains()
          : value !== null && value !== undefined;
      case 'nlike':
        return hasFilterVal
          ? !contains()
          : value !== null && value !== undefined;
      case 'blank':
      case 'empty':
      case 'null':
      case 'gb_null':
        return isJsonBlank(value);
      case 'notblank':
      case 'notempty':
      case 'notnull':
        return !isJsonBlank(value);
      case 'is':
        switch (filter.value) {
          case null:
          case 'null':
          case 'blank':
          case 'empty':
            return isJsonBlank(value);
          case 'notnull':
          case 'notblank':
          case 'notempty':
            return !isJsonBlank(value);
          default:
            return false;
        }
      case 'isnot':
        switch (filter.value) {
          case 'null':
          case 'blank':
          case 'empty':
            return !isJsonBlank(value);
          case 'notnull':
          case 'notblank':
          case 'notempty':
            return isJsonBlank(value);
          default:
            return false;
        }
      default:
        // Ordered/membership ops aren't meaningful for JSON (dialect rejects them).
        return false;
    }
  }

  /**
   * A non-user lookup cell is an array of looked-up scalar values. Match
   * semantics mirror the backend's EXISTS-subquery: emptiness ops check the
   * resolved count, membership ops (eq/like/anyof/…) compare against the set of
   * values, and ordered/typed ops (gt/lt/btw/date/…) match if ANY element
   * satisfies the per-value comparison.
   */
  protected compareLookupArray(args: {
    value: any;
    effectiveUidt: UITypes;
    filter: FilterType & { meta?: any };
    column: ColumnType;
    client: any;
    options?: {
      currentUser?: { id: string; email: string };
      timezone?: string;
    };
  }): boolean | null | undefined {
    const { value, effectiveUidt, filter, column, client, options } = args;
    const op = filter.comparison_op as any;

    const arr = (
      Array.isArray(value)
        ? value
        : value === null || value === undefined
        ? []
        : [value]
    ).flat(Infinity);
    const present = arr.filter(
      (v) => !(v === null || v === undefined || v === '')
    );

    if (['empty', 'blank', 'null', 'gb_null'].includes(op)) {
      return present.length === 0;
    }
    if (['notempty', 'notblank', 'notnull'].includes(op)) {
      return present.length > 0;
    }

    const childValues = present.map((v) => ncToString(v));
    const splitFilter = () =>
      ncToString(filter.value)
        .split(',')
        .map((v) => v.trim());

    switch (op) {
      case 'eq':
      case 'gb_eq':
        return childValues.includes(ncToString(filter.value));
      case 'neq':
      case 'not':
        return !childValues.includes(ncToString(filter.value));
      case 'like':
        return childValues.some((v) =>
          v.toLowerCase().includes(ncToString(filter.value).toLowerCase())
        );
      case 'nlike':
        return !childValues.some((v) =>
          v.toLowerCase().includes(ncToString(filter.value).toLowerCase())
        );
      case 'anyof':
        return childValues.some((v) => splitFilter().includes(v));
      case 'nanyof':
        return !childValues.some((v) => splitFilter().includes(v));
      case 'allof':
        return splitFilter().every((f) => childValues.includes(f));
      case 'nallof':
        return !splitFilter().every((f) => childValues.includes(f));
    }

    // Ordered / typed ops (numeric & date comparisons, btw, is/isnot, …):
    // a lookup matches if any of its values satisfies the scalar comparison.
    if (!present.length) return false;
    return present.some(
      (v) =>
        this.compareScalar({
          value: v,
          effectiveUidt,
          filter,
          column,
          client,
          options,
        }) === true
    );
  }
}

export function validateRowFilters(params: {
  filters: (FilterType & { meta?: any })[];
  data: any;
  columns: ColumnType[];
  client: any;
  metas: Record<string, any>;
  baseId?: string;
  options?: {
    currentUser?: {
      id: string;
      email: string;
    };
    timezone?: string;
  };
}) {
  return new RowFilterValidator().validateSync(params);
}
