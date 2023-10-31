import { isNumericCol, RelationTypes, UITypes } from 'nocodb-sdk';
import dayjs from 'dayjs';
// import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type { Knex } from 'knex';
import type Column from '~/models/Column';
import type LookupColumn from '~/models/LookupColumn';
import type RollupColumn from '~/models/RollupColumn';
import type FormulaColumn from '~/models/FormulaColumn';
import { NcError } from '~/helpers/catchError';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { sanitize } from '~/helpers/sqlSanitize';
import Filter from '~/models/Filter';

// tod: tobe fixed
// extend(customParseFormat);

export default async function conditionV2(
  baseModelSqlv2: BaseModelSqlv2,
  conditionObj: Filter | Filter[],
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
  _filter: Filter | Filter[],
  aliasCount = { count: 0 },
  alias?,
  customWhereClause?,
  throwErrorIfInvalid = false,
) => {
  const knex = baseModelSqlv2.dbDriver;

  let filter: Filter;
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
    const children = await filter.getChildren();

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
    const column = await filter.getColumn();
    if (!column) {
      if (throwErrorIfInvalid) {
        NcError.unprocessableEntity(
          `Invalid column id '${filter.fk_column_id}' in filter`,
        );
      }
      return;
    }
    if (column.uidt === UITypes.LinkToAnotherRecord) {
      const colOptions =
        (await column.getColOptions()) as LinkToAnotherRecordColumn;
      const childColumn = await colOptions.getChildColumn();
      const parentColumn = await colOptions.getParentColumn();
      const childModel = await childColumn.getModel();
      await childModel.getColumns();
      const parentModel = await parentColumn.getModel();
      await parentModel.getColumns();
      if (colOptions.type === RelationTypes.HAS_MANY) {
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

          const selectHmCount = knex(
            baseModelSqlv2.getTnPath(childModel.table_name),
          )
            .count(childColumn.column_name)
            .where(
              childColumn.column_name,
              knex.raw('??.??', [
                alias || baseModelSqlv2.getTnPath(parentModel.table_name),
                parentColumn.column_name,
              ]),
            );

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
      } else if (colOptions.type === RelationTypes.BELONGS_TO) {
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
          if (filter.comparison_op in negatedMapping)
            qbP.whereNotIn(childColumn.column_name, selectQb);
          else qbP.whereIn(childColumn.column_name, selectQb);
        };
      } else if (colOptions.type === RelationTypes.MANY_TO_MANY) {
        const mmModel = await colOptions.getMMModel();
        const mmParentColumn = await colOptions.getMMParentColumn();
        const mmChildColumn = await colOptions.getMMChildColumn();

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
            qbP.whereNotIn(childColumn.column_name, selectQb);
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
          columnOptions: (await column.getColOptions()) as RollupColumn,
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
      const model = await column.getModel();
      const formula = await column.getColOptions<FormulaColumn>();
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
        new Filter({ ...filter, value: knex.raw('?', [filter.value]) } as any),
        aliasCount,
        alias,
        builder,
      );
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

      return (qb: Knex.QueryBuilder) => {
        let [field, val] = [_field, _val];

        const dateFormat =
          qb?.client?.config?.client === 'mysql2'
            ? 'YYYY-MM-DD HH:mm:ss'
            : 'YYYY-MM-DD HH:mm:ssZ';

        if ([UITypes.Date, UITypes.DateTime].includes(column.uidt)) {
          const now = dayjs(new Date());
          // handle sub operation
          switch (filter.comparison_sub_op) {
            case 'today':
              val = now;
              break;
            case 'tomorrow':
              val = now.add(1, 'day');
              break;
            case 'yesterday':
              val = now.add(-1, 'day');
              break;
            case 'oneWeekAgo':
              val = now.add(-1, 'week');
              break;
            case 'oneWeekFromNow':
              val = now.add(1, 'week');
              break;
            case 'oneMonthAgo':
              val = now.add(-1, 'month');
              break;
            case 'oneMonthFromNow':
              val = now.add(1, 'month');
              break;
            case 'daysAgo':
              if (!val) return;
              val = now.add(-val, 'day');
              break;
            case 'daysFromNow':
              if (!val) return;
              val = now.add(val, 'day');
              break;
            case 'exactDate':
              if (!val) return;
              break;
            // sub-ops for `isWithin` comparison
            case 'pastWeek':
              val = now.add(-1, 'week');
              break;
            case 'pastMonth':
              val = now.add(-1, 'month');
              break;
            case 'pastYear':
              val = now.add(-1, 'year');
              break;
            case 'nextWeek':
              val = now.add(1, 'week');
              break;
            case 'nextMonth':
              val = now.add(1, 'month');
              break;
            case 'nextYear':
              val = now.add(1, 'year');
              break;
            case 'pastNumberOfDays':
              if (!val) return;
              val = now.add(-val, 'day');
              break;
            case 'nextNumberOfDays':
              if (!val) return;
              val = now.add(val, 'day');
              break;
          }

          if (dayjs.isDayjs(val)) {
            // turn `val` in dayjs object format to string
            val = val.format(dateFormat).toString();
            // keep YYYY-MM-DD only for date
            val = column.uidt === UITypes.Date ? val.substring(0, 10) : val;
          }
        }

        if (isNumericCol(column.uidt) && typeof val === 'string') {
          // convert to number
          val = +val;
        }

        switch (filter.comparison_op) {
          case 'eq':
            if (qb?.client?.config?.client === 'mysql2') {
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
                column.ct === 'timestamp' ||
                column.ct === 'date' ||
                column.ct === 'datetime'
              ) {
                qb = qb.where(knex.raw('DATE(??) = DATE(?)', [field, val]));
              } else {
                // mysql is case-insensitive for strings, turn to case-sensitive
                qb = qb.where(knex.raw('BINARY ?? = ?', [field, val]));
              }
            } else {
              qb = qb.where(field, val);
            }
            if (column.uidt === UITypes.Rating && val === 0) {
              // unset rating is considered as NULL
              qb = qb.orWhereNull(field);
            }
            break;
          case 'neq':
          case 'not':
            if (qb?.client?.config?.client === 'mysql2') {
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
              if (qb?.client?.config?.client === 'pg') {
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
                if (qb?.client?.config?.client === 'pg') {
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
                const items = val?.split(',').map((item) => item.trim());
                for (let i = 0; i < items?.length; i++) {
                  let sql;
                  const bindings = [field, `%,${items[i]},%`];
                  if (qb?.client?.config?.client === 'pg') {
                    sql = "(',' || ??::text || ',') ilike ?";
                  } else if (qb?.client?.config?.client === 'sqlite3') {
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
              qb = qb.where(field, gt_op, val);
              if (column.uidt === UITypes.Rating) {
                // unset rating is considered as NULL
                if (gt_op === '<' && val > 0) {
                  qb = qb.orWhereNull(field);
                }
              }
            }
            break;
          case 'ge':
          case 'gte':
            {
              const ge_op = customWhereClause ? '<=' : '>=';
              qb = qb.where(field, ge_op, val);
              if (column.uidt === UITypes.Rating) {
                // unset rating is considered as NULL
                if (ge_op === '<=' || (ge_op === '>=' && val === 0)) {
                  qb = qb.orWhereNull(field);
                }
              }
            }
            break;
          case 'lt':
            {
              const lt_op = customWhereClause ? '>' : '<';
              qb = qb.where(field, lt_op, val);
              if (column.uidt === UITypes.Rating) {
                // unset number is considered as NULL
                if (lt_op === '<' && val > 0) {
                  qb = qb.orWhereNull(field);
                }
              }
            }
            break;

          case 'le':
          case 'lte':
            {
              const le_op = customWhereClause ? '>=' : '<=';
              qb = qb.where(field, le_op, val);
              if (column.uidt === UITypes.Rating) {
                // unset number is considered as NULL
                if (le_op === '<=' || (le_op === '>=' && val === 0)) {
                  qb = qb.orWhereNull(field);
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
            } else {
              qb = qb.whereNull(customWhereClause || field);
              if (
                !isNumericCol(column.uidt) &&
                ![UITypes.Date, UITypes.DateTime, UITypes.Time].includes(
                  column.uidt,
                )
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
            } else {
              qb = qb.whereNotNull(customWhereClause || field);
              if (
                !isNumericCol(column.uidt) &&
                ![UITypes.Date, UITypes.DateTime, UITypes.Time].includes(
                  column.uidt,
                )
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
            let now = dayjs(new Date()).format(dateFormat).toString();
            now = column.uidt === UITypes.Date ? now.substring(0, 10) : now;
            switch (filter.comparison_sub_op) {
              case 'pastWeek':
              case 'pastMonth':
              case 'pastYear':
              case 'pastNumberOfDays':
                qb = qb.whereBetween(field, [val, now]);
                break;
              case 'nextWeek':
              case 'nextMonth':
              case 'nextYear':
              case 'nextNumberOfDays':
                qb = qb.whereBetween(field, [now, val]);
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
  const colOptions = await col.getColOptions<LookupColumn>();
  const relationColumn = await colOptions.getRelationColumn();
  const relationColumnOptions =
    await relationColumn.getColOptions<LinkToAnotherRecordColumn>();
  // const relationModel = await relationColumn.getModel();
  const lookupColumn = await colOptions.getLookupColumn();
  const alias = getAlias(aliasCount);
  let qb;
  {
    const childColumn = await relationColumnOptions.getChildColumn();
    const parentColumn = await relationColumnOptions.getParentColumn();
    const childModel = await childColumn.getModel();
    await childModel.getColumns();
    const parentModel = await parentColumn.getModel();
    await parentModel.getColumns();

    if (relationColumnOptions.type === RelationTypes.HAS_MANY) {
      qb = knex(
        `${baseModelSqlv2.getTnPath(childModel.table_name)} as ${alias}`,
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
    } else if (relationColumnOptions.type === RelationTypes.BELONGS_TO) {
      qb = knex(
        `${baseModelSqlv2.getTnPath(parentModel.table_name)} as ${alias}`,
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
          qbP.whereNotIn(childColumn.column_name, qb);
        else qbP.whereIn(childColumn.column_name, qb);
      };
    } else if (relationColumnOptions.type === RelationTypes.MANY_TO_MANY) {
      const mmModel = await relationColumnOptions.getMMModel();
      const mmParentColumn = await relationColumnOptions.getMMParentColumn();
      const mmChildColumn = await relationColumnOptions.getMMChildColumn();

      const childAlias = `__nc${aliasCount.count++}`;

      qb = knex(`${baseModelSqlv2.getTnPath(mmModel.table_name)} as ${alias}`)
        .select(`${alias}.${mmChildColumn.column_name}`)
        .join(
          `${baseModelSqlv2.getTnPath(
            parentModel.table_name,
          )} as ${childAlias}`,
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
          qbP.whereNotIn(childColumn.column_name, qb);
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
  if (
    lookupColumn.uidt === UITypes.Lookup ||
    lookupColumn.uidt === UITypes.LinkToAnotherRecord
  ) {
    const relationColumn =
      lookupColumn.uidt === UITypes.Lookup
        ? await (
            await lookupColumn.getColOptions<LookupColumn>()
          ).getRelationColumn()
        : lookupColumn;
    const relationColOptions =
      await relationColumn.getColOptions<LinkToAnotherRecordColumn>();
    const relAlias = `__nc${aliasCount.count++}`;

    const childColumn = await relationColOptions.getChildColumn();
    const parentColumn = await relationColOptions.getParentColumn();
    const childModel = await childColumn.getModel();
    await childModel.getColumns();
    const parentModel = await parentColumn.getModel();
    await parentModel.getColumns();
    {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY:
          {
            qb.join(
              `${baseModelSqlv2.getTnPath(
                childModel.table_name,
              )} as ${relAlias}`,
              `${alias}.${parentColumn.column_name}`,
              `${relAlias}.${childColumn.column_name}`,
            );
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            qb.join(
              `${baseModelSqlv2.getTnPath(
                parentModel.table_name,
              )} as ${relAlias}`,
              `${alias}.${childColumn.column_name}`,
              `${relAlias}.${parentColumn.column_name}`,
            );
          }
          break;
        case 'mm':
          {
            const mmModel = await relationColOptions.getMMModel();
            const mmParentColumn = await relationColOptions.getMMParentColumn();
            const mmChildColumn = await relationColOptions.getMMChildColumn();

            const assocAlias = `__nc${aliasCount.count++}`;

            qb.join(
              `${baseModelSqlv2.getTnPath(
                mmModel.table_name,
              )} as ${assocAlias}`,
              `${assocAlias}.${mmChildColumn.column_name}`,
              `${alias}.${childColumn.column_name}`,
            ).join(
              `${baseModelSqlv2.getTnPath(
                parentModel.table_name,
              )} as ${relAlias}`,
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
          await lookupColumn.getColOptions<LookupColumn>()
        ).getLookupColumn(),
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
          fk_model_id: (await lookupColumn.getModel()).id,
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
