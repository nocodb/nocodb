import {
  FormulaDataTypes,
  getEquivalentUIType,
  isNumericCol,
  isVirtualCol,
  UITypes,
} from 'nocodb-sdk';
import { FieldHandler } from './field-handler';
import type { FilterOperationResult } from './field-handler/field-handler.interface';
import type { FilterType, NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { BarcodeColumn, QrCodeColumn } from '~/models';
import { Column, Model } from '~/models';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import { getRefColumnIfAlias } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  _wherePk,
  getAliasedSoftDeleteFilter,
  getColumnName,
} from '~/helpers/dbHelpers';
import { sanitize } from '~/helpers/sqlSanitize';
import Filter from '~/models/Filter';
import { getAliasGenerator } from '~/utils';
import { handleCurrentUserFilter } from '~/helpers/conditionHelpers';

export default async function conditionV2(
  baseModelSqlv2: IBaseModelSqlV2,
  conditionObj: Filter | FilterType | FilterType[] | Filter[],
  qb: Knex.QueryBuilder,
  alias?: string,
  throwErrorIfInvalid = false,
) {
  if (!conditionObj || typeof conditionObj !== 'object') {
    return;
  }
  await FieldHandler.fromBaseModel(baseModelSqlv2).verifyFilters(
    Array.isArray(conditionObj)
      ? (conditionObj as Filter[])
      : ([conditionObj] as Filter[]),
  );
  const filterOperationResult = await parseConditionV2(
    baseModelSqlv2,
    conditionObj,
    { count: 0 },
    alias,
    undefined,
    throwErrorIfInvalid,
  );

  filterOperationResult.clause(qb);
  filterOperationResult.rootApply?.(qb);
}

// Cast a formula's compiled SQL expression to text so empty-string comparisons
// (`<> ''` / `= ''`) survive when the underlying type isn't text — JSON_EXTRACT
// returns jsonb on PG and JSON on MySQL, which would otherwise produce a type-
// mismatch error. SQLite is already typeless-text for these expressions, but
// the explicit cast is a no-op there. See nocodb/nocodb#12695.
function formulaToTextCast(knex: any, expr: any) {
  const client = knex.clientType();
  if (client === 'pg') {
    return knex.raw('(?)::text', [expr]);
  }
  if (client.startsWith('mysql')) {
    return knex.raw('CAST((?) AS CHAR)', [expr]);
  }
  if (client === 'mssql') {
    // T-SQL has no `CAST(x AS TEXT)` target — `text` is the deprecated
    // legacy type and isn't a valid CAST target. `NVARCHAR(MAX)` is the
    // documented replacement.
    return knex.raw('CAST((?) AS NVARCHAR(MAX))', [expr]);
  }
  return knex.raw('CAST((?) AS TEXT)', [expr]);
}

function getLogicalOpMethod(filter: Filter) {
  switch (filter.logical_op?.toLowerCase()) {
    case 'or':
      return 'orWhere';
    case 'and':
      return 'andWhere';
    case 'not':
      return 'whereNot';
    default:
      return 'where';
  }
}

const parseConditionV2 = async (
  baseModelSqlv2: IBaseModelSqlV2,
  _filter: Filter | FilterType | FilterType[] | Filter[],
  aliasCount = { count: 0 },
  alias?,
  customWhereClause?,
  throwErrorIfInvalid = false,
): Promise<FilterOperationResult> => {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  let filter: Filter & { groupby?: boolean };
  if (!Array.isArray(_filter)) {
    if (!(_filter instanceof Filter)) filter = new Filter(_filter as Filter);
    else filter = _filter;
  }
  const supportToggle = await Filter.supportToggle(baseModelSqlv2.context);
  if (Array.isArray(_filter)) {
    // Filter out disabled filters before processing
    const enabledFilters = supportToggle
      ? _filter.filter((f) => f.enabled !== false && f.enabled !== 0)
      : _filter;

    const qbs = await Promise.all(
      enabledFilters.map((child) =>
        parseConditionV2(
          baseModelSqlv2,
          child,
          aliasCount,
          alias,
          undefined,
          throwErrorIfInvalid,
        ),
      ),
    );

    return {
      rootApply: (qbP) => {
        for (const qb1 of qbs) {
          qb1.rootApply?.(qbP);
        }
      },
      clause: (qbP) => {
        qbP.where((qb) => {
          for (const [i, qb1] of Object.entries(qbs)) {
            qb[getLogicalOpMethod(enabledFilters[i])](qb1.clause);
          }
        });
      },
    };
  } else if (filter.is_group) {
    // Skip disabled filter groups entirely (cascade disable)
    if (supportToggle && (filter.enabled === false || filter.enabled === 0)) {
      return { clause: () => {}, rootApply: () => {} };
    }

    const children = await filter.getChildren(context);

    const qbs = await Promise.all(
      (children || []).map((child) =>
        parseConditionV2(
          baseModelSqlv2,
          child,
          aliasCount,
          undefined,
          undefined,
          throwErrorIfInvalid,
        ),
      ),
    );

    return {
      rootApply: (qbP) => {
        for (const qb1 of qbs) {
          qb1?.rootApply?.(qbP);
        }
      },
      clause: (qbP) => {
        qbP[getLogicalOpMethod(filter)]((qb) => {
          for (const [i, qb1] of Object.entries(qbs)) {
            if (qb1) {
              qb[getLogicalOpMethod(children[i])](qb1.clause);
            }
          }
        });
      },
    };
  } else {
    if (!filter.fk_column_id) return;

    // Skip disabled leaf filters
    if (supportToggle && (filter.enabled === false || filter.enabled === 0)) {
      return { clause: () => {}, rootApply: () => {} };
    }

    // handle group by filter separately,
    // `gb_eq` is equivalent to `eq` but for lookup it compares on aggregated value returns in group by api
    // aggregated value will be either json array or `___` separated string
    // `gb_null` is equivalent to `blank` but for lookup it compares on aggregated value is null
    if (
      (filter.comparison_op as any) === 'gb_eq' ||
      (filter.comparison_op as any) === 'gb_null'
    ) {
      filter.groupby = true;

      const column = await getRefColumnIfAlias(
        context,
        await filter.getColumn(context),
      );

      if (!column) {
        if (throwErrorIfInvalid) {
          NcError.get(context).fieldNotFound(filter.fk_column_id);
        }
        return { clause: () => {}, rootApply: () => {} };
      }

      if (
        column.uidt === UITypes.Lookup ||
        column.uidt === UITypes.LinkToAnotherRecord
      ) {
        const model = await column.getModel(context);
        const lkQb = await generateLookupSelectQuery({
          baseModelSqlv2,
          alias: alias,
          model,
          column,
          getAlias: getAliasGenerator('__gb_filter_lk'),
        });
        return {
          rootApply: undefined,
          clause: (qb) => {
            if ((filter.comparison_op as any) === 'gb_eq')
              qb.where(knex.raw('?', [filter.value]) as any, lkQb.builder);
            else qb.whereNull(knex.raw(lkQb.builder).wrap('(', ')') as any);
          },
        };
      } else {
        filter.comparison_op =
          (filter.comparison_op as any) === 'gb_eq' ? 'eq' : 'blank';
        // if qrCode or Barcode replace it with value column
        if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt))
          filter.fk_column_id = await column
            .getColOptions<BarcodeColumn | QrCodeColumn>(context)
            .then((col) => col.fk_column_id);
      }
    }

    if (!filter.fk_column_id) {
      return;
    }

    const filterColumn = await filter.getColumn(context);
    if (!filterColumn) {
      if (throwErrorIfInvalid) {
        NcError.get(context).fieldNotFound(filter.fk_column_id);
      }
      return { clause: () => {}, rootApply: () => {} };
    }
    const column = await getRefColumnIfAlias(context, filterColumn);
    if (!column) {
      if (throwErrorIfInvalid) {
        NcError.get(context).fieldNotFound(filter.fk_column_id);
      }
      return { clause: () => {}, rootApply: () => {} };
    }

    // Handle dynamic filters (field-to-field comparison):
    // resolve fk_value_col_id to a knex.ref() so the normal conditionV2
    // comparison logic compares column-to-column instead of column-to-literal.
    // Cross-table dynamic filters return a FilterOperationResult directly.
    if (filter.fk_value_col_id) {
      const resolved = await resolveDynamicFilterValue(
        context,
        knex,
        filter,
        column,
        alias,
        baseModelSqlv2,
        aliasCount,
      );
      if (resolved === false) {
        return { clause: () => {}, rootApply: () => {} };
      }
      // Cross-table dynamic filter — returns a complete FilterOperationResult
      if (typeof resolved === 'object') {
        return resolved;
      }
    }

    if (
      [
        UITypes.JSON,
        UITypes.LinkToAnotherRecord,
        UITypes.Lookup,
        UITypes.Decimal,
        UITypes.Number,
        UITypes.Rating,
        UITypes.Percent,
        UITypes.Currency,
        UITypes.Duration,
        UITypes.Year,
        UITypes.Time,
        UITypes.User,
        UITypes.CreatedBy,
        UITypes.LastModifiedBy,
        UITypes.DateTime,
        UITypes.Date,
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
        UITypes.UUID,
        UITypes.Checkbox,
        UITypes.Attachment,
        UITypes.MultiSelect,
        UITypes.SingleSelect,
        UITypes.LongText,
      ].includes(column.uidt) ||
      ([UITypes.Rollup, UITypes.Formula, UITypes.Links].includes(column.uidt) &&
        !customWhereClause)
    ) {
      return FieldHandler.fromBaseModel(baseModelSqlv2).applyFilter(
        filter,
        column,
        {
          alias,
          conditionParser: parseConditionV2,
          depth: aliasCount,
          context,
          throwErrorIfInvalid,
          customWhereClause,
        },
      );
    }
    if (
      [UITypes.Formula].includes(column.uidt) &&
      customWhereClause &&
      [UITypes.DateTime, UITypes.Date].includes(
        getEquivalentUIType({ formulaColumn: column }) as UITypes,
      )
    ) {
      return FieldHandler.fromBaseModel(baseModelSqlv2).applyFilter(
        filter,
        new Column({
          ...column,
          uidt: getEquivalentUIType({ formulaColumn: column }) as UITypes,
        }),
        {
          alias,
          conditionParser: parseConditionV2,
          depth: aliasCount,
          context,
          throwErrorIfInvalid,
          customWhereClause,
        },
      );
    }

    {
      if (
        filter.comparison_op === 'empty' ||
        filter.comparison_op === 'notempty'
      )
        filter.value = '';
      let _field = sanitize(
        customWhereClause
          ? filter.value
          : alias
          ? `${alias}.${column.column_name}`
          : column.column_name,
      );
      let _val = customWhereClause ? customWhereClause : filter.value;
      handleCurrentUserFilter(context, {
        column,
        filter,
        setVal: (val) => {
          if (customWhereClause) {
            _field = val;
          } else {
            _val = val;
          }
        },
      });

      // get column name for CreateTime, LastModifiedTime
      column.column_name = await getColumnName(context, column);

      return {
        rootApply: undefined,
        clause: (qb: Knex.QueryBuilder) => {
          let [field, val] = [_field, _val];

          // based on custom where clause(builder), we need to change the field and val
          // todo: refactor this to use a better approach to make it more readable and clean
          let genVal = customWhereClause ? field : val;

          if (
            isNumericCol(column.uidt) &&
            typeof genVal === 'string' &&
            !isNaN(+genVal)
          ) {
            // convert to number
            genVal = +genVal;
          }

          // if customWhereClause(builder) is provided, replace field with raw value
          // or assign value to val
          if (customWhereClause) {
            field = knex.raw('?', [genVal]);
          } else {
            val = genVal;
          }

          switch (filter.comparison_op) {
            case 'eq':
              // Date/DateTime/CreatedTime/LastModifiedTime + Formula-with-
              // DateTime-equivalent (when customWhereClause is set) all
              // route through FieldHandler above. MySQL's `column.ct` date
              // branch is dead too — those uidts route. What reaches here:
              //   - MySQL string columns → BINARY for case-sensitive compare
              //   - Rollup / Links with customWhereClause → plain eq
              //   - Everything else → generic plain eq
              if (
                knex.clientType() === 'mysql2' ||
                knex.clientType() === 'mysql'
              ) {
                if ([UITypes.Rollup, UITypes.Links].includes(column.uidt)) {
                  qb = qb.where(field, val);
                } else {
                  // mysql is case-insensitive for strings, turn to case-sensitive
                  qb = qb.where(knex.raw('BINARY ?? = ?', [field, val]));
                }
              } else {
                qb = qb.where(field, val);
              }
              break;
            case 'neq':
            case 'not':
              // JSON / Rating / Number / Decimal / Percent / User /
              // Currency / Duration / Year / Time route to FieldHandler —
              // only Rollup-CWC / Links-CWC reach here.
              if (knex.clientType() === 'mysql2') {
                if ([UITypes.Rollup, UITypes.Links].includes(column.uidt)) {
                  qb = qb.where((nestedQb) => {
                    nestedQb.whereNot(field, val);
                    if (column.uidt !== UITypes.Links)
                      nestedQb.orWhereNull(customWhereClause ? _val : _field);
                  });
                } else {
                  qb = qb.where((nestedQb) => {
                    nestedQb.where(knex.raw('BINARY ?? != ?', [field, val]));
                    nestedQb.orWhereNull(customWhereClause ? _val : _field);
                  });
                }
              } else {
                qb = qb.where((nestedQb) => {
                  nestedQb.whereNot(field, val);
                  if (column.uidt !== UITypes.Links)
                    nestedQb.orWhereNull(customWhereClause ? _val : _field);
                });
              }
              break;
            case 'like':
              // JSON / Attachment route to FieldHandler above.
              if (!val) {
                // val is empty -> all values including empty strings but NULL
                qb.where(field, '');
                qb.orWhereNotNull(field);
              } else {
                if (column.uidt === UITypes.Formula) {
                  [field, val] = [val, field];
                  val = `%${val}%`.replace(/^%'([\s\S]*)'%$/, '%$1%');
                } else {
                  val =
                    (val + '').startsWith('%') || (val + '').endsWith('%')
                      ? val
                      : `%${val}%`;
                }
                if (knex.clientType() === 'pg') {
                  qb = qb.where(knex.raw('??::text ilike ?', [field, val]));
                } else {
                  qb = qb.where(field, 'like', val);
                }
              }
              break;
            case 'nlike':
              // JSON / Attachment route to FieldHandler above.
              if (!val) {
                // val is empty -> all values including NULL but empty strings
                qb.whereNot(field, '');
                qb.orWhereNull(field);
              } else {
                if (column.uidt === UITypes.Formula) {
                  [field, val] = [val, field];
                  val = `%${val}%`.replace(/^%'([\s\S]*)'%$/, '%$1%');
                } else {
                  val =
                    val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;
                }
                qb.where((nestedQb) => {
                  if (knex.clientType() === 'pg') {
                    nestedQb.where(
                      knex.raw('??::text not ilike ?', [field, val]),
                    );
                  } else {
                    nestedQb.whereNot(field, 'like', val);
                  }
                  if (val !== '%%') {
                    // if value is not empty, empty or null should be included
                    nestedQb.orWhere(field, '');
                    nestedQb.orWhereNull(field);
                  } else {
                    // if value is empty, then only null is included
                    nestedQb.orWhereNull(field);
                  }
                });
              }
              break;
            // MultiSelect/SingleSelect handlers consume allof/anyof/nallof/
            // nanyof via FieldHandler (early-route above). Plain string columns
            // — SingleLineText/Email/URL/PhoneNumber/etc. — and other types
            // that are NOT in the early-route list still need the comma-CSV
            // membership check here, otherwise the filter falls through to
            // the end of the switch with no condition and silently returns
            // every row (or zero, depending on logical_op). RLS uses `anyof`
            // on a SingleLineText OwnedBy column with a CSV of allowed user
            // ids, so dropping these cases caused RLS to deny everything.
            case 'allof':
            case 'anyof':
            case 'nallof':
            case 'nanyof': {
              const condition = (builder: Knex.QueryBuilder) => {
                let items = val?.split(',') ?? [];
                if (
                  ['mysql2', 'mysql'].includes(knex.clientType()) &&
                  ['enum', 'set'].includes(column.dt?.toLowerCase())
                ) {
                  items = items.map((item) => item.trimEnd());
                }
                for (let i = 0; i < items?.length; i++) {
                  let sql: string;
                  const bindings = [
                    field,
                    `%,${items[i]},%`,
                    field,
                    `%, ${items[i]},%`,
                  ];
                  if (knex.clientType() === 'pg') {
                    sql =
                      "((',' || ??::text || ',') ilike ? OR (',' || ??::text || ',') ilike ?)";
                  } else if (knex.clientType() === 'sqlite3') {
                    sql =
                      "((',' || ?? || ',') like ? OR (',' || ?? || ',') like ?)";
                  } else if (knex.clientType() === 'mssql') {
                    // T-SQL: `+` is the string concat operator; CONCAT() also
                    // works but `+` keeps the cast contract identical to pg.
                    sql =
                      "((',' + CAST(?? AS NVARCHAR(MAX)) + ',') like ? OR (',' + CAST(?? AS NVARCHAR(MAX)) + ',') like ?)";
                  } else {
                    sql =
                      "(CONCAT(',', ??, ',') like ? OR CONCAT(',', ??, ',') like ?)";
                  }
                  if (i === 0) {
                    builder = builder.where(knex.raw(sql, bindings));
                  } else {
                    if (
                      filter.comparison_op === 'allof' ||
                      filter.comparison_op === 'nallof'
                    ) {
                      builder = builder.andWhere(knex.raw(sql, bindings));
                    } else {
                      builder = builder.orWhere(knex.raw(sql, bindings));
                    }
                  }
                }
              };
              if (
                filter.comparison_op === 'allof' ||
                filter.comparison_op === 'anyof'
              ) {
                qb = qb.where(condition);
              } else {
                qb = qb.whereNot(condition).orWhereNull(field);
              }
              break;
            }
            case 'gt':
              qb = qb.where(field, customWhereClause ? '<' : '>', val);
              break;
            case 'ge':
            case 'gte':
              qb = qb.where(field, customWhereClause ? '<=' : '>=', val);
              break;
            case 'lt':
              qb = qb.where(field, customWhereClause ? '>' : '<', val);
              break;
            case 'le':
            case 'lte':
              qb = qb.where(field, customWhereClause ? '>=' : '<=', val);
              break;
            case 'in':
              qb = qb.whereIn(
                field,
                Array.isArray(val) ? val : val?.split?.(','),
              );
              break;
            case 'is':
              if (filter.value === 'null' || filter.value === null)
                qb = qb.whereNull(customWhereClause || field);
              else if (filter.value === 'notnull')
                qb = qb.whereNotNull(customWhereClause || field);
              else if (filter.value === 'empty')
                qb = qb.where(customWhereClause || field, '');
              else if (filter.value === 'notempty')
                qb = qb
                  .whereNot(customWhereClause || field, '')
                  .orWhereNull(field);
              else if (filter.value === 'true')
                qb = qb.where(customWhereClause || field, true);
              else if (filter.value === 'false')
                qb = qb.where(customWhereClause || field, false);
              break;
            case 'isnot':
              if (filter.value === 'null')
                qb = qb.whereNotNull(customWhereClause || field);
              else if (filter.value === 'notnull')
                qb = qb.whereNull(customWhereClause || field);
              else if (filter.value === 'empty')
                qb = qb.whereNot(customWhereClause || field, '');
              else if (filter.value === 'notempty')
                qb = qb.where(customWhereClause || field, '');
              else if (filter.value === 'true')
                qb = qb.whereNot(customWhereClause || field, true);
              else if (filter.value === 'false')
                qb = qb.whereNot(customWhereClause || field, false);
              break;
            case 'empty':
              if (column.uidt === UITypes.Formula) {
                [field, val] = [val, field];
              }
              qb = qb.where(field, val);
              break;
            case 'notempty':
              if (column.uidt === UITypes.Formula) {
                [field, val] = [val, field];
              }
              qb = qb.whereNot(field, val).orWhereNull(field);
              break;
            case 'null':
              qb = qb.whereNull(customWhereClause || field);
              break;
            case 'notnull':
              qb = qb.whereNotNull(customWhereClause || field);
              break;
            case 'blank':
              // Attachment / JSON / Date-family / numerics route to
              // FieldHandler — only Formula-with-CWC and string-like
              // columns (SingleLineText, LongText, Email, PhoneNumber,
              // URL, Colour) reach here.
              if (column.uidt === UITypes.Formula) {
                qb = qb.whereNull(customWhereClause || field);
                if (
                  (column?.colOptions as any).parsed_tree?.dataType ===
                  FormulaDataTypes.STRING
                ) {
                  // The formula's compiled SQL may return non-text types — e.g.
                  // JSON_EXTRACT yields jsonb on PG and JSON on MySQL. A direct
                  // `<> ''` then errors with a type mismatch. Cast to text so
                  // the empty-string check is type-safe regardless of the
                  // underlying SQL type. Cf. nocodb/nocodb#12695.
                  qb = qb.orWhere(
                    formulaToTextCast(knex, customWhereClause || field),
                    '',
                  );
                }
              } else {
                qb = qb.whereNull(customWhereClause || field);
                if (
                  !isNumericCol(column.uidt) &&
                  ![
                    UITypes.Date,
                    UITypes.CreatedTime,
                    UITypes.LastModifiedTime,
                    UITypes.DateTime,
                    UITypes.Time,
                  ].includes(column.uidt)
                ) {
                  qb = qb.orWhere(field, '');
                }
              }
              break;
            case 'notblank':
              // Attachment / JSON / Date-family route to FieldHandler.
              if (column.uidt === UITypes.Formula) {
                qb = qb.whereNotNull(customWhereClause || field);
                if (
                  (column?.colOptions as any).parsed_tree?.dataType ===
                  FormulaDataTypes.STRING
                ) {
                  // See `blank` branch above for the rationale.
                  qb = qb.whereNot(
                    formulaToTextCast(knex, customWhereClause || field),
                    '',
                  );
                }
              } else {
                qb = qb.whereNotNull(customWhereClause || field);
                if (
                  !isNumericCol(column.uidt) &&
                  ![
                    UITypes.Date,
                    UITypes.DateTime,
                    UITypes.CreatedTime,
                    UITypes.LastModifiedTime,
                    UITypes.Time,
                  ].includes(column.uidt)
                ) {
                  qb = qb.whereNot(field, '');
                }
              }
              break;
            case 'checked':
              qb = qb.where(customWhereClause || field, true);
              break;
            case 'notchecked':
              qb = qb.where((grpdQb) => {
                grpdQb
                  .whereNull(customWhereClause || field)
                  .orWhere(customWhereClause || field, false);
              });
              break;
            case 'btw':
              qb = qb.whereBetween(field, val.split(','));
              break;
            case 'nbtw':
              qb = qb.whereNotBetween(field, val.split(','));
              break;
            // `isWithin` is date-only (pastWeek/Month/Year/NumberOfDays and
            // nextWeek/Month/Year/NumberOfDays). DateTime/Date/CreatedTime/
            // LastModifiedTime all route through DateTimeGeneralHandler.filter
            // which implements isWithin via comparisonBetween, so this case
            // is unreachable here.
          }
        },
      };
    }
  }
};

/**
 * Resolve dynamic filter value column reference.
 * When fk_value_col_id is set, replaces filter.value with a knex.ref()
 * pointing to the target column, so the normal conditionV2 comparison
 * logic produces column-to-column SQL (e.g. "FieldA" = "FieldB").
 *
 * Returns:
 *  - true: same-table — filter.value replaced with knex.ref(), caller continues normal flow
 *  - false: cannot resolve — caller should skip (empty clause)
 *  - FilterOperationResult: cross-table — caller returns this directly
 *
 * Virtual columns (Lookup, Rollup, Formula, etc.) are not supported.
 */
async function resolveDynamicFilterValue(
  context: NcContext,
  knex: Knex,
  filter: Filter,
  filterColumn: Column,
  alias?: string,
  baseModelSqlv2?: IBaseModelSqlV2,
  aliasCount?: { count: number },
): Promise<boolean | FilterOperationResult> {
  const valueColumn = await Column.get(context, {
    colId: filter.fk_value_col_id,
  });
  if (!valueColumn) {
    return false;
  }

  // Virtual columns (Lookup, Rollup, Formula, etc.) don't have a physical
  // DB column — skip so the filter is silently ignored rather than producing
  // invalid SQL.
  if (isVirtualCol(valueColumn)) {
    return false;
  }

  // Same-table: simple column ref
  // Skip when _crossTableRowId is set — self-referencing links need the
  // cross-table EXISTS path to pin the comparison to a specific linked row.
  if (
    valueColumn.fk_model_id === filterColumn.fk_model_id &&
    !filter._crossTableRowId
  ) {
    const valueField = alias
      ? `${alias}.${valueColumn.column_name}`
      : valueColumn.column_name;

    filter.value = knex.ref(valueField) as any;
    return true;
  }

  // Cross-table: need baseModelSqlv2 to build subquery
  if (!baseModelSqlv2 || !aliasCount) {
    return false;
  }

  return resolveCrossTableDynamicFilter(
    context,
    knex,
    filter,
    filterColumn,
    valueColumn,
    alias,
    baseModelSqlv2,
    aliasCount,
  );
}

/**
 * Build a cross-table dynamic filter.
 * Generates an EXISTS subquery on the value column's table and delegates
 * the comparison to parseConditionV2 so all operators are supported.
 *
 * No LTAR join is needed — the value column's table is known from
 * valueColumn.fk_model_id. The EXISTS simply checks whether any record
 * in the related table satisfies: relatedTable.valueCol <op> sourceTable.filterCol.
 */
async function resolveCrossTableDynamicFilter(
  context: NcContext,
  knex: Knex,
  filter: Filter,
  filterColumn: Column,
  valueColumn: Column,
  alias: string | undefined,
  baseModelSqlv2: IBaseModelSqlV2,
  aliasCount: { count: number },
): Promise<false | FilterOperationResult> {
  const relatedModel = await valueColumn.getModel(context);
  if (!relatedModel) {
    return false;
  }
  await relatedModel.getColumns(context);

  const relatedBaseModel = await Model.getBaseModelSQL(context, {
    model: relatedModel,
    dbDriver: baseModelSqlv2.dbDriver,
  });

  const relatedAlias = `__nc_df${aliasCount.count++}`;

  // EXISTS (SELECT 1 FROM relatedTable WHERE pk = rowId AND <comparison> AND <soft-delete>)
  const existsQb = knex(
    relatedBaseModel.getTnPath(relatedModel.table_name, relatedAlias),
  ).select(knex.raw('1'));

  // Filter to the specific source row when rowId is available
  // (set by replaceDynamicFieldWithValue in EE for cross-table filters)
  //
  // crossTableRowId is the parent/reference row's PK.
  // relatedModel is always the parent/reference table here because:
  // - fk_value_col_id can only point to source or reference table columns
  // - same-table columns are resolved inline by replaceDynamicFieldWithValue
  // - so cross-table always means the value column is in the reference table
  const crossTableRowId = filter._crossTableRowId;

  // Without a row context or primary keys the EXISTS would match ANY row in
  // the related table, producing meaningless results. Silently skip.
  if (!crossTableRowId || !relatedModel.primaryKeys?.length) {
    return false;
  }

  const pkWhere = _wherePk(relatedModel.primaryKeys, crossTableRowId);
  if (typeof pkWhere === 'function') {
    existsQb.where(pkWhere);
  } else {
    // Qualify PK columns with the alias
    for (const [col, val] of Object.entries(pkWhere)) {
      existsQb.where(`${relatedAlias}.${col}`, val);
    }
  }

  const softDeleteFilter = await getAliasedSoftDeleteFilter(
    relatedBaseModel,
    relatedAlias,
  );
  if (softDeleteFilter) {
    existsQb.where(softDeleteFilter);
  }

  // Delegate comparison to parseConditionV2 — supports all operators/types.
  // Keep the original filterColumn as fk_column_id and reference the value
  // column (in the related table) as the literal value. This preserves the
  // original operator direction so asymmetric ops (gt, lt, gte, lte, like)
  // are not accidentally inverted.
  const valueColumnRef = knex.raw('??.??', [
    relatedAlias,
    valueColumn.column_name,
  ]) as any;

  const comparisonFilter = new Filter({
    ...filter,
    fk_column_id: filterColumn.id,
    fk_model_id: filterColumn.fk_model_id,
    fk_value_col_id: null,
  });
  comparisonFilter.value = valueColumnRef;

  // Always qualify the source column — when alias is undefined, unqualified
  // column names inside the EXISTS resolve to the inner table first, which
  // produces wrong results if both tables share a column name.
  const sourceAlias =
    alias || baseModelSqlv2.getTnPath(baseModelSqlv2.model.table_name);

  const compResult = await parseConditionV2(
    baseModelSqlv2,
    comparisonFilter,
    aliasCount,
    sourceAlias,
  );
  compResult.clause(existsQb);

  return {
    clause: (qb: Knex.QueryBuilder) => {
      qb.whereExists(existsQb);
    },
    rootApply: (qb: Knex.QueryBuilder) => {
      compResult.rootApply?.(qb);
    },
  };
}

export async function extractLinkRelFiltersAndApply(_: {
  qb: Knex.QueryBuilder & Knex.QueryInterface;
  column: Column<any>;
  alias?: string;
  table: Model;
  context: NcContext;
  baseModel: IBaseModelSqlV2;
}) {
  // do nothing, it's just a placeholder
}
