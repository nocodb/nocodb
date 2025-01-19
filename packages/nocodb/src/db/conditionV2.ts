import {
  FormulaDataTypes,
  getEquivalentUIType,
  isAIPromptCol,
  isDateMonthFormat,
  isNumericCol,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import dayjs from 'dayjs';
import type { FilterType } from 'nocodb-sdk';
// import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type { Knex } from 'knex';
import type Column from '~/models/Column';
import type LookupColumn from '~/models/LookupColumn';
import type RollupColumn from '~/models/RollupColumn';
import type FormulaColumn from '~/models/FormulaColumn';
import { getColumnName } from '~/db/BaseModelSqlv2';
import { NcError } from '~/helpers/catchError';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { sanitize } from '~/helpers/sqlSanitize';
import Filter from '~/models/Filter';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import { getAliasGenerator } from '~/utils';
import { getRefColumnIfAlias } from '~/helpers';
import { type BarcodeColumn, BaseUser, type QrCodeColumn } from '~/models';

// tod: tobe fixed
// extend(customParseFormat);

export default async function conditionV2(
  baseModelSqlv2: BaseModelSqlv2,
  conditionObj: Filter | FilterType | FilterType[] | Filter[],
  qb: Knex.QueryBuilder,
  alias?: string,
  throwErrorIfInvalid = false,
) {
  if (!conditionObj || typeof conditionObj !== 'object') {
    return;
  }
  (
    await parseConditionV2(
      baseModelSqlv2,
      conditionObj,
      { count: 0 },
      alias,
      undefined,
      throwErrorIfInvalid,
    )
  )(qb);
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
  baseModelSqlv2: BaseModelSqlv2,
  _filter: Filter | FilterType | FilterType[] | Filter[],
  aliasCount = { count: 0 },
  alias?,
  customWhereClause?,
  throwErrorIfInvalid = false,
) => {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  let filter: Filter & { groupby?: boolean };
  if (!Array.isArray(_filter)) {
    if (!(_filter instanceof Filter)) filter = new Filter(_filter as Filter);
    else filter = _filter;
  }
  if (Array.isArray(_filter)) {
    const qbs = await Promise.all(
      _filter.map((child) =>
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

    return (qbP) => {
      qbP.where((qb) => {
        for (const [i, qb1] of Object.entries(qbs)) {
          qb[getLogicalOpMethod(_filter[i])](qb1);
        }
      });
    };
  } else if (filter.is_group) {
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

    return (qbP) => {
      qbP[getLogicalOpMethod(filter)]((qb) => {
        for (const [i, qb1] of Object.entries(qbs)) {
          qb[getLogicalOpMethod(children[i])](qb1);
        }
      });
    };
  } else {
    if (!filter.fk_column_id) return;

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
        return (qb) => {
          if ((filter.comparison_op as any) === 'gb_eq')
            qb.where(knex.raw('?', [filter.value]), lkQb.builder);
          else qb.whereNull(knex.raw(lkQb.builder).wrap('(', ')'));
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
        NcError.fieldNotFound(filter.fk_column_id);
      }
    }
    const column = await getRefColumnIfAlias(context, filterColumn);
    if (!column) {
      if (throwErrorIfInvalid) {
        NcError.fieldNotFound(filter.fk_column_id);
      }
    }
    if (column.uidt === UITypes.LinkToAnotherRecord) {
      const colOptions = (await column.getColOptions(
        context,
      )) as LinkToAnotherRecordColumn;
      const childColumn = await colOptions.getChildColumn(context);
      const parentColumn = await colOptions.getParentColumn(context);
      const childModel = await childColumn.getModel(context);
      await childModel.getColumns(context);
      const parentModel = await parentColumn.getModel(context);
      await parentModel.getColumns(context);

      let relationType = colOptions.type;

      if (relationType === RelationTypes.ONE_TO_ONE) {
        relationType = column.meta?.bt
          ? RelationTypes.BELONGS_TO
          : RelationTypes.HAS_MANY;
      }

      if (relationType === RelationTypes.HAS_MANY) {
        if (
          ['blank', 'notblank', 'checked', 'notchecked'].includes(
            filter.comparison_op,
          )
        ) {
          const childTableAlias = getAlias(aliasCount);

          const selectHmCount = knex(
            baseModelSqlv2.getTnPath(childModel.table_name, childTableAlias),
          )
            .count(childColumn.column_name)
            .whereRaw('??.?? = ??.??', [
              childTableAlias,
              childColumn.column_name,
              alias || baseModelSqlv2.getTnPath(parentModel.table_name),
              parentColumn.column_name,
            ]);

          return (qb) => {
            if (filter.comparison_op === 'blank') {
              qb.where(knex.raw('0'), selectHmCount);
            } else {
              qb.whereNot(knex.raw('0'), selectHmCount);
            }
          };
        }
        const selectQb = knex(
          baseModelSqlv2.getTnPath(childModel.table_name),
        ).select(childColumn.column_name);
        (
          await parseConditionV2(
            baseModelSqlv2,
            new Filter({
              ...filter,
              ...(filter.comparison_op in negatedMapping
                ? negatedMapping[filter.comparison_op]
                : {}),
              fk_model_id: childModel.id,
              fk_column_id: childModel?.displayValue?.id,
            }),
            aliasCount,
            undefined,
            undefined,
            throwErrorIfInvalid,
          )
        )(selectQb);

        return (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.whereNotIn(parentColumn.column_name, selectQb);
          else qbP.whereIn(parentColumn.column_name, selectQb);
        };
      } else if (relationType === RelationTypes.BELONGS_TO) {
        if (
          ['blank', 'notblank', 'checked', 'notchecked'].includes(
            filter.comparison_op,
          )
        ) {
          // handle self reference
          if (parentModel.id === childModel.id) {
            if (filter.comparison_op === 'blank') {
              return (qb) => {
                qb.whereNull(childColumn.column_name);
              };
            } else {
              return (qb) => {
                qb.whereNotNull(childColumn.column_name);
              };
            }
          }

          const selectBtCount = knex(
            baseModelSqlv2.getTnPath(parentModel.table_name),
          )
            .count(parentColumn.column_name)
            .where(
              parentColumn.column_name,
              knex.raw('??.??', [
                alias || baseModelSqlv2.getTnPath(childModel.table_name),
                childColumn.column_name,
              ]),
            );

          return (qb) => {
            if (filter.comparison_op === 'blank') {
              qb.where(knex.raw('0'), selectBtCount);
            } else {
              qb.whereNot(knex.raw('0'), selectBtCount);
            }
          };
        }

        const selectQb = knex(
          baseModelSqlv2.getTnPath(parentModel.table_name),
        ).select(parentColumn.column_name);
        (
          await parseConditionV2(
            baseModelSqlv2,
            new Filter({
              ...filter,
              ...(filter.comparison_op in negatedMapping
                ? negatedMapping[filter.comparison_op]
                : {}),
              fk_model_id: parentModel.id,
              fk_column_id: parentModel?.displayValue?.id,
            }),
            aliasCount,
            undefined,
            undefined,
            throwErrorIfInvalid,
          )
        )(selectQb);

        return (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping) {
            qbP.where((qb) =>
              qb
                .whereNotIn(childColumn.column_name, selectQb)
                .orWhereNull(childColumn.column_name),
            );
          } else qbP.whereIn(childColumn.column_name, selectQb);
        };
      } else if (relationType === RelationTypes.MANY_TO_MANY) {
        const mmModel = await colOptions.getMMModel(context);
        const mmParentColumn = await colOptions.getMMParentColumn(context);
        const mmChildColumn = await colOptions.getMMChildColumn(context);

        if (
          ['blank', 'notblank', 'checked', 'notchecked'].includes(
            filter.comparison_op,
          )
        ) {
          // handle self reference
          if (mmModel.id === childModel.id) {
            if (filter.comparison_op === 'blank') {
              return (qb) => {
                qb.whereNull(childColumn.column_name);
              };
            } else {
              return (qb) => {
                qb.whereNotNull(childColumn.column_name);
              };
            }
          }

          const selectMmCount = knex(
            baseModelSqlv2.getTnPath(mmModel.table_name),
          )
            .count(mmChildColumn.column_name)
            .where(
              mmChildColumn.column_name,
              knex.raw('??.??', [
                alias || baseModelSqlv2.getTnPath(childModel.table_name),
                childColumn.column_name,
              ]),
            );

          return (qb) => {
            if (filter.comparison_op === 'blank') {
              qb.where(knex.raw('0'), selectMmCount);
            } else {
              qb.whereNot(knex.raw('0'), selectMmCount);
            }
          };
        }

        const selectQb = knex(baseModelSqlv2.getTnPath(mmModel.table_name))
          .select(mmChildColumn.column_name)
          .join(
            baseModelSqlv2.getTnPath(parentModel.table_name),
            `${baseModelSqlv2.getTnPath(mmModel.table_name)}.${
              mmParentColumn.column_name
            }`,
            `${baseModelSqlv2.getTnPath(parentModel.table_name)}.${
              parentColumn.column_name
            }`,
          );

        (
          await parseConditionV2(
            baseModelSqlv2,
            new Filter({
              ...filter,
              ...(filter.comparison_op in negatedMapping
                ? negatedMapping[filter.comparison_op]
                : {}),
              fk_model_id: parentModel.id,
              fk_column_id: parentModel?.displayValue?.id,
            }),
            aliasCount,
            undefined,
            undefined,
            throwErrorIfInvalid,
          )
        )(selectQb);

        return (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.where((qb) =>
              qb
                .whereNotIn(childColumn.column_name, selectQb)
                .orWhereNull(childColumn.column_name),
            );
          else qbP.whereIn(childColumn.column_name, selectQb);
        };
      }

      return (_qb) => {};
    } else if (column.uidt === UITypes.Lookup) {
      return await generateLookupCondition(
        baseModelSqlv2,
        column,
        filter,
        knex,
        aliasCount,
        throwErrorIfInvalid,
      );
    } else if (
      [UITypes.Rollup, UITypes.Links].includes(column.uidt) &&
      !customWhereClause
    ) {
      const builder = (
        await genRollupSelectv2({
          baseModelSqlv2,
          knex,
          alias,
          columnOptions: (await column.getColOptions(context)) as RollupColumn,
        })
      ).builder;
      return parseConditionV2(
        baseModelSqlv2,
        new Filter({
          ...filter,
          value: knex.raw('?', [
            // convert value to number for rollup since rollup is always number
            isNaN(+filter.value) ? filter.value : +filter.value,
          ]),
        } as any),
        aliasCount,
        alias,
        builder,
      );
    } else if (column.uidt === UITypes.Formula && !customWhereClause) {
      const model = await column.getModel(context);
      const formula = await column.getColOptions<FormulaColumn>(context);
      const builder = (
        await formulaQueryBuilderv2(
          baseModelSqlv2,
          formula.formula,
          null,
          model,
          column,
        )
      ).builder;
      return parseConditionV2(
        baseModelSqlv2,
        new Filter({
          ...filter,
          value: knex.raw('?', [
            // convert value to number if formulaDataType if numeric
            formula.getParsedTree()?.dataType === FormulaDataTypes.NUMERIC &&
            !isNaN(+filter.value)
              ? +filter.value
              : filter.value ?? null, // in gp_null value is undefined
          ]),
        } as any),
        aliasCount,
        alias,
        builder,
      );
    } else if (
      [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
        column.uidt,
      ) &&
      ['like', 'nlike'].includes(filter.comparison_op)
    ) {
      // get column name for CreatedBy, LastModifiedBy
      column.column_name = await getColumnName(context, column);

      const baseUsers = await BaseUser.getUsersList(context, {
        base_id: column.base_id,
      });
      return (qb: Knex.QueryBuilder) => {
        const users = baseUsers.filter((user) => {
          const filterVal = filter.value.toLowerCase();

          if (filterVal.startsWith('%') && filterVal.endsWith('%')) {
            return (user.display_name || user.email)
              .toLowerCase()
              .includes(filterVal.substring(1, filterVal.length - 1));
          } else if (filterVal.startsWith('%')) {
            return (user.display_name || user.email)
              .toLowerCase()
              .endsWith(filterVal.substring(1));
          } else if (filterVal.endsWith('%')) {
            return (user.display_name || user.email)
              .toLowerCase()
              .startsWith(filterVal.substring(0, filterVal.length - 1));
          }

          return (user.display_name || user.email)
            .toLowerCase()
            .includes(filterVal.toLowerCase());
        });

        // create nested replace statement for each user
        const finalStatement = users.reduce((acc, user) => {
          const qb = knex.raw(`REPLACE(${acc}, ?, ?)`, [
            user.id,
            user.display_name || user.email,
          ]);
          return qb.toQuery();
        }, knex.raw(`??`, [column.column_name]).toQuery());

        let val = filter.value;
        if (filter.comparison_op === 'like') {
          val =
            (val + '').startsWith('%') || (val + '').endsWith('%')
              ? val
              : `%${val}%`;
          if (knex.clientType() === 'pg') {
            qb = qb.where(knex.raw(`(${finalStatement}) ilike ?`, [val]));
          } else {
            qb = qb.where(knex.raw(`(${finalStatement}) like ?`, [val]));
          }
        } else {
          if (!val) {
            // val is empty -> all values including NULL but empty strings
            qb.whereNot(column.column_name, '');
            qb.orWhereNull(column.column_name);
          } else {
            val = val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;

            qb.where((nestedQb) => {
              if (knex.clientType() === 'pg') {
                nestedQb.whereNot(
                  knex.raw(`(${finalStatement}) ilike ?`, [val]),
                );
              } else {
                nestedQb.whereNot(
                  knex.raw(`(${finalStatement}) like ?`, [val]),
                );
              }
              if (val !== '%%') {
                // if value is not empty, empty or null should be included
                nestedQb.orWhere(column.column_name, '');
                nestedQb.orWhereNull(column.column_name);
              } else {
                // if value is empty, then only null is included
                nestedQb.orWhereNull(column.column_name);
              }
            });
          }
        }
      };
    } else {
      if (
        filter.comparison_op === 'empty' ||
        filter.comparison_op === 'notempty'
      )
        filter.value = '';
      const _field = sanitize(
        customWhereClause
          ? filter.value
          : alias
          ? `${alias}.${column.column_name}`
          : column.column_name,
      );
      const _val = customWhereClause ? customWhereClause : filter.value;

      // get column name for CreateTime, LastModifiedTime
      column.column_name = await getColumnName(context, column);

      return (qb: Knex.QueryBuilder) => {
        let [field, val] = [_field, _val];

        // based on custom where clause(builder), we need to change the field and val
        // todo: refactor this to use a better approach to make it more readable and clean
        let genVal = customWhereClause ? field : val;
        const dateFormat = 'YYYY-MM-DD';

        if (isAIPromptCol(column)) {
          if (knex.clientType() === 'pg') {
            field = knex.raw(`TRIM('"' FROM (??::jsonb->>'value'))`, [
              column.column_name,
            ]);
          } else if (knex.clientType().startsWith('mysql')) {
            field = knex.raw(`JSON_UNQUOTE(JSON_EXTRACT(??, '$.value'))`, [
              column.column_name,
            ]);
          } else if (knex.clientType() === 'sqlite3') {
            field = knex.raw(`json_extract(??, '$.value')`, [
              column.column_name,
            ]);
          } else if (knex.clientType() === 'mssql') {
            field = knex.raw(`JSON_VALUE(??, '$.value')`, [column.column_name]);
          }
        }

        if (
          (column.uidt === UITypes.Formula &&
            getEquivalentUIType({ formulaColumn: column }) ==
              UITypes.DateTime) ||
          [
            UITypes.Date,
            UITypes.DateTime,
            UITypes.CreatedTime,
            UITypes.LastModifiedTime,
          ].includes(column.uidt)
        ) {
          let now = dayjs(new Date()).utc();
          const dateFormatFromMeta = column?.meta?.date_format;
          if (dateFormatFromMeta && isDateMonthFormat(dateFormatFromMeta)) {
            // reset to 1st
            now = dayjs(now).date(1);
            if (val) genVal = dayjs(val).date(1);
          }
          // handle sub operation
          switch (filter.comparison_sub_op) {
            case 'today':
              genVal = now;
              break;
            case 'tomorrow':
              genVal = now.add(1, 'day');
              break;
            case 'yesterday':
              genVal = now.add(-1, 'day');
              break;
            case 'oneWeekAgo':
              genVal = now.add(-1, 'week');
              break;
            case 'oneWeekFromNow':
              genVal = now.add(1, 'week');
              break;
            case 'oneMonthAgo':
              genVal = now.add(-1, 'month');
              break;
            case 'oneMonthFromNow':
              genVal = now.add(1, 'month');
              break;
            case 'daysAgo':
              if (!val) return;
              genVal = now.add(-genVal, 'day');
              break;
            case 'daysFromNow':
              if (!val) return;
              genVal = now.add(genVal, 'day');
              break;
            case 'exactDate':
              if (!genVal) return;
              break;
            // sub-ops for `isWithin` comparison
            case 'pastWeek':
              genVal = now.add(-1, 'week');
              break;
            case 'pastMonth':
              genVal = now.add(-1, 'month');
              break;
            case 'pastYear':
              genVal = now.add(-1, 'year');
              break;
            case 'nextWeek':
              genVal = now.add(1, 'week');
              break;
            case 'nextMonth':
              genVal = now.add(1, 'month');
              break;
            case 'nextYear':
              genVal = now.add(1, 'year');
              break;
            case 'pastNumberOfDays':
              if (!val) return;
              genVal = now.add(-genVal, 'day');
              break;
            case 'nextNumberOfDays':
              if (!genVal) return;
              genVal = now.add(genVal, 'day');
              break;
          }

          if (dayjs.isDayjs(genVal)) {
            // turn `val` in dayjs object format to string
            genVal = genVal.format(dateFormat).toString();
            // keep YYYY-MM-DD only for date
            genVal =
              column.uidt === UITypes.Date ? genVal.substring(0, 10) : genVal;
          }
        }

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
            if (
              knex.clientType() === 'mysql2' ||
              knex.clientType() === 'mysql'
            ) {
              if (
                [
                  UITypes.Duration,
                  UITypes.Currency,
                  UITypes.Percent,
                  UITypes.Number,
                  UITypes.Decimal,
                  UITypes.Rating,
                  UITypes.Rollup,
                  UITypes.Links,
                ].includes(column.uidt)
              ) {
                qb = qb.where(field, val);
              } else if (
                (column.uidt === UITypes.Formula &&
                  getEquivalentUIType({ formulaColumn: column }) ==
                    UITypes.DateTime) ||
                column.ct === 'timestamp' ||
                column.ct === 'date' ||
                column.ct === 'datetime'
              ) {
                // ignore seconds part in datetime and filter when using it for group by
                if (filter.groupby && column.ct !== 'date') {
                  const valWithoutTz = val.replace(/[+-]\d+:\d+$/, '');
                  qb = qb.where(
                    knex.raw(
                      "CONVERT_TZ(DATE_SUB(??, INTERVAL SECOND(??) SECOND), @@GLOBAL.time_zone, '+00:00') = DATE_SUB(?, INTERVAL SECOND(?) SECOND)",
                      [field, field, valWithoutTz, valWithoutTz],
                    ),
                  );
                } else
                  qb = qb.where(knex.raw('DATE(??) = DATE(?)', [field, val]));
              } else {
                // mysql is case-insensitive for strings, turn to case-sensitive
                qb = qb.where(knex.raw('BINARY ?? = ?', [field, val]));
              }
            } else {
              if (
                (column.uidt === UITypes.Formula &&
                  getEquivalentUIType({ formulaColumn: column }) ==
                    UITypes.DateTime) ||
                [
                  UITypes.DateTime,
                  UITypes.CreatedTime,
                  UITypes.LastModifiedTime,
                ].includes(column.uidt)
              ) {
                if (qb.client.config.client === 'pg') {
                  // ignore seconds part in datetime and filter when using it for group by
                  if (filter.groupby)
                    qb = qb.where(
                      knex.raw(
                        "date_trunc('minute', ??) + interval '0 seconds' = ?",
                        [field, val],
                      ),
                    );
                  else qb = qb.where(knex.raw('??::date = ?', [field, val]));
                } else {
                  // ignore seconds part in datetime and filter when using it for group by
                  if (filter.groupby) {
                    if (knex.clientType() === 'sqlite3')
                      qb = qb.where(
                        knex.raw(
                          `Datetime(strftime ('%Y-%m-%d %H:%M:00',:column:) ||
  (
   CASE WHEN substr(:column:, 20, 1) = '+' THEN
    printf ('+%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   WHEN substr(:column:, 20, 1) = '-' THEN
    printf ('-%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   ELSE
    '+00:00'
   END)) = Datetime(:val)`,
                          { column: field, val },
                        ),
                      );
                    else qb = qb.where(knex.raw('?? = ?', [field, val]));
                  } else
                    qb = qb.where(knex.raw('DATE(??) = DATE(?)', [field, val]));
                }
              } else {
                qb = qb.where(field, val);
              }
            }
            if (column.uidt === UITypes.Rating && val === 0) {
              // unset rating is considered as NULL
              qb = qb.orWhereNull(field);
            }
            break;
          case 'neq':
          case 'not':
            if (knex.clientType() === 'mysql2') {
              if (
                [
                  UITypes.Duration,
                  UITypes.Currency,
                  UITypes.Percent,
                  UITypes.Number,
                  UITypes.Decimal,
                  UITypes.Rollup,
                  UITypes.Links,
                ].includes(column.uidt)
              ) {
                qb = qb.where((nestedQb) => {
                  nestedQb.whereNot(field, val);

                  if (column.uidt !== UITypes.Links)
                    nestedQb.orWhereNull(customWhereClause ? _val : _field);
                });
              } else if (column.uidt === UITypes.Rating) {
                // unset rating is considered as NULL
                if (val === 0) {
                  qb = qb.whereNot(field, val).whereNotNull(field);
                } else {
                  qb = qb.whereNot(field, val).orWhereNull(field);
                }
              } else {
                // mysql is case-insensitive for strings, turn to case-sensitive
                qb = qb.where((nestedQb) => {
                  nestedQb.where(knex.raw('BINARY ?? != ?', [field, val]));
                  if (column.uidt !== UITypes.Rating) {
                    nestedQb.orWhereNull(customWhereClause ? _val : _field);
                  }
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
            if (!val) {
              if (column.uidt === UITypes.Attachment) {
                qb = qb
                  .orWhereNull(field)
                  .orWhere(field, '[]')
                  .orWhere(field, 'null');
              } else {
                // val is empty -> all values including empty strings but NULL
                qb.where(field, '');
                qb.orWhereNotNull(field);
              }
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
            if (!val) {
              if (column.uidt === UITypes.Attachment) {
                qb.whereNot(field, '')
                  .whereNot(field, 'null')
                  .whereNot(field, '[]');
              } else {
                // val is empty -> all values including NULL but empty strings
                qb.whereNot(field, '');
                qb.orWhereNull(field);
              }
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
          case 'allof':
          case 'anyof':
          case 'nallof':
          case 'nanyof':
            {
              // Condition for filter, without negation
              const condition = (builder: Knex.QueryBuilder) => {
                let items = val?.split(',');
                // remove trailing space if database is MySQL and datatype is enum/set
                if (
                  ['mysql2', 'mysql'].includes(knex.clientType()) &&
                  ['enum', 'set'].includes(column.dt?.toLowerCase())
                ) {
                  items = items.map((item) => item.trimEnd());
                }
                for (let i = 0; i < items?.length; i++) {
                  let sql;
                  const bindings = [field, `%,${items[i]},%`];
                  if (knex.clientType() === 'pg') {
                    sql = "(',' || ??::text || ',') ilike ?";
                  } else if (knex.clientType() === 'sqlite3') {
                    sql = "(',' || ?? || ',') like ?";
                  } else {
                    sql = "CONCAT(',', ??, ',') like ?";
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
            }
            break;
          case 'gt':
            {
              const gt_op = customWhereClause ? '<' : '>';
              // If the column is a datetime and the client is pg and the value has a timezone offset at the end
              // then we need to convert the value to timestamptz before comparing
              if (
                (column.uidt === UITypes.DateTime ||
                  column.uidt === UITypes.Date ||
                  column.uidt === UITypes.CreatedTime ||
                  column.uidt === UITypes.LastModifiedTime) &&
                val.match(/[+-]\d{2}:\d{2}$/)
              ) {
                if (qb.client.config.client === 'pg') {
                  qb.where(field, gt_op, knex.raw('?::timestamptz', [val]));
                } else if (qb.client.config.client === 'sqlite3') {
                  qb.where(
                    field,
                    gt_op,
                    knex.raw('datetime(?)', [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else if (qb.client.config.client === 'mysql2') {
                  qb.where(
                    field,
                    gt_op,
                    knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else {
                  qb.where(field, gt_op, val);
                }
              } else {
                qb = qb.where(field, gt_op, val);
                if (column.uidt === UITypes.Rating) {
                  // unset rating is considered as NULL
                  if (gt_op === '<' && val > 0) {
                    qb = qb.orWhereNull(field);
                  }
                }
              }
            }
            break;
          case 'ge':
          case 'gte':
            {
              const ge_op = customWhereClause ? '<=' : '>=';
              // If the column is a datetime and the client is pg and the value has a timezone offset at the end
              // then we need to convert the value to timestamptz before comparing
              if (
                (column.uidt === UITypes.DateTime ||
                  column.uidt === UITypes.Date ||
                  column.uidt === UITypes.CreatedTime ||
                  column.uidt === UITypes.LastModifiedTime) &&
                val.match(/[+-]\d{2}:\d{2}$/)
              ) {
                if (qb.client.config.client === 'pg') {
                  qb.where(field, ge_op, knex.raw('?::timestamptz', [val]));
                } else if (qb.client.config.client === 'sqlite3') {
                  qb.where(
                    field,
                    ge_op,
                    knex.raw('datetime(?)', [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else if (qb.client.config.client === 'mysql2') {
                  qb.where(
                    field,
                    ge_op,
                    knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else {
                  qb.where(field, ge_op, val);
                }
              } else {
                qb = qb.where(field, ge_op, val);
                if (column.uidt === UITypes.Rating) {
                  // unset rating is considered as NULL
                  if (ge_op === '<=' || (ge_op === '>=' && val === 0)) {
                    qb = qb.orWhereNull(field);
                  }
                }
              }
            }
            break;
          case 'lt':
            {
              const lt_op = customWhereClause ? '>' : '<';
              // If the column is a datetime and the client is pg and the value has a timezone offset at the end
              // then we need to convert the value to timestamptz before comparing
              if (
                (column.uidt === UITypes.DateTime ||
                  column.uidt === UITypes.Date ||
                  column.uidt === UITypes.CreatedTime ||
                  column.uidt === UITypes.LastModifiedTime) &&
                val.match(/[+-]\d{2}:\d{2}$/)
              ) {
                if (qb.client.config.client === 'pg') {
                  qb.where(field, lt_op, knex.raw('?::timestamptz', [val]));
                } else if (qb.client.config.client === 'sqlite3') {
                  qb.where(
                    field,
                    lt_op,
                    knex.raw('datetime(?)', [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else if (qb.client.config.client === 'mysql2') {
                  qb.where(
                    field,
                    lt_op,
                    knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else {
                  qb.where(field, lt_op, val);
                }
              } else {
                qb = qb.where(field, lt_op, val);
                if (column.uidt === UITypes.Rating) {
                  // unset number is considered as NULL
                  if (lt_op === '<' && val > 0) {
                    qb = qb.orWhereNull(field);
                  }
                }
              }
            }
            break;

          case 'le':
          case 'lte':
            {
              const le_op = customWhereClause ? '>=' : '<=';
              // If the column is a datetime and the client is pg and the value has a timezone offset at the end
              // then we need to convert the value to timestamptz before comparing
              if (
                (column.uidt === UITypes.DateTime ||
                  column.uidt === UITypes.Date ||
                  column.uidt === UITypes.CreatedTime ||
                  column.uidt === UITypes.LastModifiedTime) &&
                val.match(/[+-]\d{2}:\d{2}$/)
              ) {
                if (qb.client.config.client === 'pg') {
                  qb.where(field, le_op, knex.raw('?::timestamptz', [val]));
                } else if (qb.client.config.client === 'sqlite3') {
                  qb.where(
                    field,
                    le_op,
                    knex.raw('datetime(?)', [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else if (qb.client.config.client === 'mysql2') {
                  qb.where(
                    field,
                    le_op,
                    knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
                      dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
                    ]),
                  );
                } else {
                  qb.where(field, le_op, val);
                }
              } else {
                qb = qb.where(field, le_op, val);
                if (column.uidt === UITypes.Rating) {
                  // unset number is considered as NULL
                  if (le_op === '<=' || (le_op === '>=' && val === 0)) {
                    qb = qb.orWhereNull(field);
                  }
                }
              }
            }
            break;
          case 'in':
            qb = qb.whereIn(
              field,
              Array.isArray(val) ? val : val?.split?.(','),
            );
            break;
          case 'is':
            if (filter.value === 'null')
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
            if (column.uidt === UITypes.Attachment) {
              qb = qb
                .whereNull(customWhereClause || field)
                .orWhere(field, '[]')
                .orWhere(field, 'null');
            } else if (column.uidt === UITypes.Formula) {
              qb = qb.whereNull(customWhereClause || field);
              if (
                (column?.colOptions as any).parsed_tree?.dataType ===
                FormulaDataTypes.STRING
              ) {
                qb = qb.orWhere(field, '');
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
            if (column.uidt === UITypes.Attachment) {
              qb = qb
                .whereNotNull(customWhereClause || field)
                .whereNot(field, '[]')
                .whereNot(field, 'null');
            } else if (column.uidt === UITypes.Formula) {
              qb = qb.whereNotNull(customWhereClause || field);
              if (
                (column?.colOptions as any).parsed_tree?.dataType ===
                FormulaDataTypes.STRING
              ) {
                qb = qb.whereNot(customWhereClause || field, '');
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
          case 'isWithin': {
            let now = dayjs(new Date()).utc().format(dateFormat).toString();
            now = column.uidt === UITypes.Date ? now.substring(0, 10) : now;

            // switch between arg based on customWhereClause(builder)
            const [firstArg, rangeArg] = [
              customWhereClause ? val : field,
              customWhereClause ? field : val,
            ];
            switch (filter.comparison_sub_op) {
              case 'pastWeek':
              case 'pastMonth':
              case 'pastYear':
              case 'pastNumberOfDays':
                qb = qb.whereBetween(firstArg, [rangeArg, now]);
                break;
              case 'nextWeek':
              case 'nextMonth':
              case 'nextYear':
              case 'nextNumberOfDays':
                qb = qb.whereBetween(firstArg, [now, rangeArg]);
                break;
            }
          }
        }
      };
    }
  }
};

const negatedMapping = {
  nlike: { comparison_op: 'like' },
  neq: { comparison_op: 'eq' },
  blank: { comparison_op: 'notblank' },
  notchecked: { comparison_op: 'checked' },
};

function getAlias(aliasCount: { count: number }) {
  return `__nc${aliasCount.count++}`;
}

// todo: refactor child , parent in mm
async function generateLookupCondition(
  baseModelSqlv2: BaseModelSqlv2,
  col: Column,
  filter: Filter,
  knex,
  aliasCount = { count: 0 },
  throwErrorIfInvalid = false,
): Promise<any> {
  const context = baseModelSqlv2.context;

  const colOptions = await col.getColOptions<LookupColumn>(context);
  const relationColumn = await colOptions.getRelationColumn(context);
  const relationColumnOptions =
    await relationColumn.getColOptions<LinkToAnotherRecordColumn>(context);
  // const relationModel = await relationColumn.getModel();
  const lookupColumn = await colOptions.getLookupColumn(context);
  const alias = getAlias(aliasCount);
  let qb;
  {
    const childColumn = await relationColumnOptions.getChildColumn(context);
    const parentColumn = await relationColumnOptions.getParentColumn(context);
    const childModel = await childColumn.getModel(context);
    await childModel.getColumns(context);
    const parentModel = await parentColumn.getModel(context);
    await parentModel.getColumns(context);

    let relationType = relationColumnOptions.type;

    if (relationType === RelationTypes.ONE_TO_ONE) {
      relationType = relationColumn.meta?.bt
        ? RelationTypes.BELONGS_TO
        : RelationTypes.HAS_MANY;
    }

    if (relationType === RelationTypes.HAS_MANY) {
      qb = knex(
        knex.raw(`?? as ??`, [
          baseModelSqlv2.getTnPath(childModel.table_name),
          alias,
        ]),
      );

      qb.select(`${alias}.${childColumn.column_name}`);

      await nestedConditionJoin(
        baseModelSqlv2,
        {
          ...filter,
          ...(filter.comparison_op in negatedMapping
            ? negatedMapping[filter.comparison_op]
            : {}),
        },
        lookupColumn,
        qb,
        knex,
        alias,
        aliasCount,
        throwErrorIfInvalid,
      );

      return (qbP: Knex.QueryBuilder) => {
        if (filter.comparison_op in negatedMapping)
          qbP.whereNotIn(parentColumn.column_name, qb);
        else qbP.whereIn(parentColumn.column_name, qb);
      };
    } else if (relationType === RelationTypes.BELONGS_TO) {
      qb = knex(
        knex.raw(`?? as ??`, [
          baseModelSqlv2.getTnPath(parentModel.table_name),
          alias,
        ]),
      );
      qb.select(`${alias}.${parentColumn.column_name}`);

      await nestedConditionJoin(
        baseModelSqlv2,
        {
          ...filter,
          ...(filter.comparison_op in negatedMapping
            ? negatedMapping[filter.comparison_op]
            : {}),
        },
        lookupColumn,
        qb,
        knex,
        alias,
        aliasCount,
        throwErrorIfInvalid,
      );

      return (qbP: Knex.QueryBuilder) => {
        if (filter.comparison_op in negatedMapping)
          qbP.where((qb1) =>
            qb1
              .whereNotIn(childColumn.column_name, qb)
              .orWhereNull(childColumn.column_name),
          );
        else qbP.whereIn(childColumn.column_name, qb);
      };
    } else if (relationType === RelationTypes.MANY_TO_MANY) {
      const mmModel = await relationColumnOptions.getMMModel(context);
      const mmParentColumn = await relationColumnOptions.getMMParentColumn(
        context,
      );
      const mmChildColumn = await relationColumnOptions.getMMChildColumn(
        context,
      );

      const childAlias = `__nc${aliasCount.count++}`;

      qb = knex(
        knex.raw(`?? as ??`, [
          baseModelSqlv2.getTnPath(mmModel.table_name),
          alias,
        ]),
      )
        .select(`${alias}.${mmChildColumn.column_name}`)
        .join(
          knex.raw(`?? as ??`, [
            baseModelSqlv2.getTnPath(parentModel.table_name),
            childAlias,
          ]),
          `${alias}.${mmParentColumn.column_name}`,
          `${childAlias}.${parentColumn.column_name}`,
        );

      await nestedConditionJoin(
        baseModelSqlv2,
        {
          ...filter,
          ...(filter.comparison_op in negatedMapping
            ? negatedMapping[filter.comparison_op]
            : {}),
        },
        lookupColumn,
        qb,
        knex,
        childAlias,
        aliasCount,
        throwErrorIfInvalid,
      );

      return (qbP: Knex.QueryBuilder) => {
        if (filter.comparison_op in negatedMapping)
          qbP.where((qb1) =>
            qb1
              .whereNotIn(childColumn.column_name, qb)
              .orWhereNull(childColumn.column_name),
          );
        else qbP.whereIn(childColumn.column_name, qb);
      };
    }
  }
}

async function nestedConditionJoin(
  baseModelSqlv2: BaseModelSqlv2,
  filter: Filter,
  lookupColumn: Column,
  qb: Knex.QueryBuilder,
  knex,
  alias: string,
  aliasCount: { count: number },
  throwErrorIfInvalid = false,
) {
  const context = baseModelSqlv2.context;

  if (
    lookupColumn.uidt === UITypes.Lookup ||
    lookupColumn.uidt === UITypes.LinkToAnotherRecord
  ) {
    const relationColumn =
      lookupColumn.uidt === UITypes.Lookup
        ? await (
            await lookupColumn.getColOptions<LookupColumn>(context)
          ).getRelationColumn(context)
        : lookupColumn;
    const relationColOptions =
      await relationColumn.getColOptions<LinkToAnotherRecordColumn>(context);
    const relAlias = `__nc${aliasCount.count++}`;

    const childColumn = await relationColOptions.getChildColumn(context);
    const parentColumn = await relationColOptions.getParentColumn(context);
    const childModel = await childColumn.getModel(context);
    await childModel.getColumns(context);
    const parentModel = await parentColumn.getModel(context);
    await parentModel.getColumns(context);
    {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY:
          {
            qb.join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(childModel.table_name),
                relAlias,
              ]),
              `${alias}.${parentColumn.column_name}`,
              `${relAlias}.${childColumn.column_name}`,
            );
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            qb.join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(parentModel.table_name),
                relAlias,
              ]),
              `${alias}.${childColumn.column_name}`,
              `${relAlias}.${parentColumn.column_name}`,
            );
          }
          break;
        case 'mm':
          {
            const mmModel = await relationColOptions.getMMModel(context);
            const mmParentColumn = await relationColOptions.getMMParentColumn(
              context,
            );
            const mmChildColumn = await relationColOptions.getMMChildColumn(
              context,
            );

            const assocAlias = `__nc${aliasCount.count++}`;

            qb.join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(mmModel.table_name),
                assocAlias,
              ]),
              `${assocAlias}.${mmChildColumn.column_name}`,
              `${alias}.${childColumn.column_name}`,
            ).join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(parentModel.table_name),
                relAlias,
              ]),
              `${relAlias}.${parentColumn.column_name}`,
              `${assocAlias}.${mmParentColumn.column_name}`,
            );
          }
          break;
      }
    }

    if (lookupColumn.uidt === UITypes.Lookup) {
      await nestedConditionJoin(
        baseModelSqlv2,
        filter,
        await (
          await lookupColumn.getColOptions<LookupColumn>(context)
        ).getLookupColumn(context),
        qb,
        knex,
        relAlias,
        aliasCount,
        throwErrorIfInvalid,
      );
    } else {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY:
          {
            (
              await parseConditionV2(
                baseModelSqlv2,
                new Filter({
                  ...filter,
                  fk_model_id: childModel.id,
                  fk_column_id: childModel.displayValue?.id,
                }),
                aliasCount,
                relAlias,
                undefined,
                throwErrorIfInvalid,
              )
            )(qb);
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            (
              await parseConditionV2(
                baseModelSqlv2,
                new Filter({
                  ...filter,
                  fk_model_id: parentModel.id,
                  fk_column_id: parentModel?.displayValue?.id,
                }),
                aliasCount,
                relAlias,
                undefined,
                throwErrorIfInvalid,
              )
            )(qb);
          }
          break;
        case 'mm':
          {
            (
              await parseConditionV2(
                baseModelSqlv2,
                new Filter({
                  ...filter,
                  fk_model_id: parentModel.id,
                  fk_column_id: parentModel.displayValue?.id,
                }),
                aliasCount,
                relAlias,
                undefined,
                throwErrorIfInvalid,
              )
            )(qb);
          }
          break;
      }
    }
  } else {
    (
      await parseConditionV2(
        baseModelSqlv2,
        new Filter({
          ...filter,
          fk_model_id: (await lookupColumn.getModel(context)).id,
          fk_column_id: lookupColumn?.id,
        }),
        aliasCount,
        alias,
        undefined,
        throwErrorIfInvalid,
      )
    )(qb);
  }
}
