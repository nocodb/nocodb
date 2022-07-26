import Filter from '../../../../models/Filter';
import LinkToAnotherRecordColumn from '../../../../models/LinkToAnotherRecordColumn';
import { Knex } from 'knex';
import { XKnex } from '../../index';
import Column from '../../../../models/Column';
import LookupColumn from '../../../../models/LookupColumn';
import genRollupSelectv2 from './genRollupSelectv2';
import RollupColumn from '../../../../models/RollupColumn';
import formulaQueryBuilderv2 from './formulav2/formulaQueryBuilderv2';
import FormulaColumn from '../../../../models/FormulaColumn';
import { RelationTypes, UITypes } from 'nocodb-sdk';
// import LookupColumn from '../../../models/LookupColumn';
import { sanitize } from './helpers/sanitize';

export default async function conditionV2(
  conditionObj: Filter | Filter[],
  qb: Knex.QueryBuilder,
  knex: XKnex
) {
  if (!conditionObj || typeof conditionObj !== 'object') {
    return;
  }
  (await parseConditionV2(conditionObj, knex))(qb);
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
  _filter: Filter | Filter[],
  knex: XKnex,
  aliasCount = { count: 0 },
  alias?,
  customWhereClause?
) => {
  let filter: Filter;
  if (!Array.isArray(_filter)) {
    if (!(_filter instanceof Filter)) filter = new Filter(_filter as Filter);
    else filter = _filter;
  }
  if (Array.isArray(_filter)) {
    const qbs = await Promise.all(
      _filter.map((child) => parseConditionV2(child, knex, aliasCount))
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
      (children || []).map((child) => parseConditionV2(child, knex, aliasCount))
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
    if (!column) return () => {};
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
          filter.comparison_op === 'empty' ||
          filter.comparison_op === 'notempty'
        ) {
          const selectHmCount = knex(childModel.table_name)
            .count(childColumn.column_name)
            .where(
              childColumn.column_name,
              knex.raw('??.??', [
                alias || parentModel.table_name,
                parentColumn.column_name,
              ])
            );

          return (qb) => {
            if (filter.comparison_op === 'empty') {
              qb.where(knex.raw('0'), selectHmCount);
            } else {
              qb.whereNot(knex.raw('0'), selectHmCount);
            }
          };
        }
        const selectQb = knex(childModel.table_name).select(
          childColumn.column_name
        );
        (
          await parseConditionV2(
            new Filter({
              ...filter,
              ...(filter.comparison_op in negatedMapping
                ? negatedMapping[filter.comparison_op]
                : {}),
              fk_model_id: childModel.id,
              fk_column_id: childModel?.primaryValue?.id,
            }),
            knex,
            aliasCount
          )
        )(selectQb);

        return (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.whereNotIn(parentColumn.column_name, selectQb);
          else qbP.whereIn(parentColumn.column_name, selectQb);
        };
      } else if (colOptions.type === RelationTypes.BELONGS_TO) {
        if (filter.comparison_op === 'null') {
          return (qb) => {
            qb.whereNull(childColumn.column_name);
          };
        }
        if (filter.comparison_op === 'notnull') {
          return (qb) => {
            qb.whereNotNull(childColumn.column_name);
          };
        }

        const selectQb = knex(parentModel.table_name).select(
          parentColumn.column_name
        );
        (
          await parseConditionV2(
            new Filter({
              ...filter,
              ...(filter.comparison_op in negatedMapping
                ? negatedMapping[filter.comparison_op]
                : {}),
              fk_model_id: parentModel.id,
              fk_column_id: parentModel?.primaryValue?.id,
            }),
            knex,
            aliasCount
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
          filter.comparison_op === 'empty' ||
          filter.comparison_op === 'notempty'
        ) {
          const selectMmCount = knex(mmModel.table_name)
            .count(mmChildColumn.column_name)
            .where(
              mmChildColumn.column_name,
              knex.raw('??.??', [
                alias || childModel.table_name,
                childColumn.column_name,
              ])
            );

          return (qb) => {
            if (filter.comparison_op === 'empty') {
              qb.where(knex.raw('0'), selectMmCount);
            } else {
              qb.whereNot(knex.raw('0'), selectMmCount);
            }
          };
        }

        const selectQb = knex(mmModel.table_name)
          .select(mmChildColumn.column_name)
          .join(
            parentModel.table_name,
            `${mmModel.table_name}.${mmParentColumn.column_name}`,
            `${parentModel.table_name}.${parentColumn.column_name}`
          );
        (
          await parseConditionV2(
            new Filter({
              ...filter,
              ...(filter.comparison_op in negatedMapping
                ? negatedMapping[filter.comparison_op]
                : {}),
              fk_model_id: parentModel.id,
              fk_column_id: parentModel?.primaryValue?.id,
            }),
            knex,
            aliasCount
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
      return await generateLookupCondition(column, filter, knex, aliasCount);
    } else if (column.uidt === UITypes.Rollup && !customWhereClause) {
      const builder = (
        await genRollupSelectv2({
          knex,
          alias,
          columnOptions: (await column.getColOptions()) as RollupColumn,
        })
      ).builder;
      return parseConditionV2(
        new Filter({ ...filter, value: knex.raw('?', [filter.value]) } as any),
        knex,
        aliasCount,
        alias,
        builder
      );
    } else if (column.uidt === UITypes.Formula && !customWhereClause) {
      const model = await column.getModel();
      const formula = await column.getColOptions<FormulaColumn>();
      const builder = (
        await formulaQueryBuilderv2(formula.formula, null, knex, model)
      ).builder;
      return parseConditionV2(
        new Filter({ ...filter, value: knex.raw('?', [filter.value]) } as any),
        knex,
        aliasCount,
        alias,
        builder
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
          : column.column_name
      );
      const _val = customWhereClause ? customWhereClause : filter.value;

      return (qb) => {
        let [field, val] = [_field, _val];
        switch (filter.comparison_op) {
          case 'eq':
            qb = qb.where(field, val);
            break;
          case 'neq':
          case 'not':
            qb = qb.whereNot(field, val);
            break;
          case 'like':
            if (column.uidt === UITypes.Formula) {
              [field, val] = [val, field];
              val = `%${val}%`.replace(/^%'([\s\S]*)'%$/, '%$1%');
            } else {
              val = `%${val}%`;
            }
            if (qb?.client?.config?.client === 'pg') {
              qb = qb.whereRaw('??::text ilike ?', [field, val]);
            } else {
              qb = qb.where(field, 'like', val);
            }
            break;
          case 'nlike':
            if (column.uidt === UITypes.Formula) {
              [field, val] = [val, field];
              val = `%${val}%`.replace(/^%'([\s\S]*)'%$/, '%$1%');
            } else {
              val = `%${val}%`;
            }
            qb = qb.whereNot(
              field,
              qb?.client?.config?.client === 'pg' ? 'ilike' : 'like',
              val
            );
            break;
          case 'gt':
            qb = qb.where(field, customWhereClause ? '<' : '>', val);
            break;
          case 'ge':
          case 'gte':
            qb = qb.where(field, customWhereClause ? '<=' : '>=', val);
            break;
          case 'in':
            qb = qb.whereIn(
              field,
              Array.isArray(val) ? val : val?.split?.(',')
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
              qb = qb.whereNot(customWhereClause || field, '');
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
            break;
          case 'lt':
            qb = qb.where(field, customWhereClause ? '>' : '<', val);
            break;
          case 'le':
          case 'lte':
            qb = qb.where(field, customWhereClause ? '>=' : '<=', val);
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
            qb = qb.whereNot(field, val);
            break;
          case 'null':
            qb = qb.whereNull(customWhereClause || field);
            break;
          case 'notnull':
            qb = qb.whereNotNull(customWhereClause || field);
            break;
          case 'btw':
            qb = qb.whereBetween(field, val.split(','));
            break;
          case 'nbtw':
            qb = qb.whereNotBetween(field, val.split(','));
            break;
        }
      };
    }
  }
};

const negatedMapping = {
  nlike: { comparison_op: 'like' },
  neq: { comparison_op: 'eq' },
};

function getAlias(aliasCount: { count: number }) {
  return `__nc${aliasCount.count++}`;
}

// todo: refactor child , parent in mm
async function generateLookupCondition(
  col: Column,
  filter: Filter,
  knex,
  aliasCount = { count: 0 }
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
      qb = knex(`${childModel.table_name} as ${alias}`);

      qb.select(`${alias}.${childColumn.column_name}`);

      await nestedConditionJoin(
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
        aliasCount
      );

      return (qbP: Knex.QueryBuilder) => {
        if (filter.comparison_op in negatedMapping)
          qbP.whereNotIn(parentColumn.column_name, qb);
        else qbP.whereIn(parentColumn.column_name, qb);
      };
    } else if (relationColumnOptions.type === RelationTypes.BELONGS_TO) {
      qb = knex(`${parentModel.table_name} as ${alias}`);
      qb.select(`${alias}.${parentColumn.column_name}`);

      await nestedConditionJoin(
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
        aliasCount
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

      qb = knex(`${mmModel.table_name} as ${alias}`)
        .select(`${alias}.${mmChildColumn.column_name}`)
        .join(
          `${parentModel.table_name} as ${childAlias}`,
          `${alias}.${mmParentColumn.column_name}`,
          `${childAlias}.${parentColumn.column_name}`
        );

      await nestedConditionJoin(
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
        aliasCount
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
  filter: Filter,
  lookupColumn: Column,
  qb: Knex.QueryBuilder,
  knex,
  alias: string,
  aliasCount: { count: number }
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
              `${childModel.table_name} as ${relAlias}`,
              `${alias}.${parentColumn.column_name}`,
              `${relAlias}.${childColumn.column_name}`
            );
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            qb.join(
              `${parentModel.table_name} as ${relAlias}`,
              `${alias}.${childColumn.column_name}`,
              `${relAlias}.${parentColumn.column_name}`
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
              `${mmModel.table_name} as ${assocAlias}`,
              `${assocAlias}.${mmChildColumn.column_name}`,
              `${alias}.${childColumn.column_name}`
            ).join(
              `${parentModel.table_name} as ${relAlias}`,
              `${relAlias}.${parentColumn.column_name}`,
              `${assocAlias}.${mmParentColumn.column_name}`
            );
          }
          break;
      }
    }

    if (lookupColumn.uidt === UITypes.Lookup) {
      await nestedConditionJoin(
        filter,
        await (
          await lookupColumn.getColOptions<LookupColumn>()
        ).getLookupColumn(),
        qb,
        knex,
        relAlias,
        aliasCount
      );
    } else {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY:
          {
            (
              await parseConditionV2(
                new Filter({
                  ...filter,
                  fk_model_id: childModel.id,
                  fk_column_id: childModel.primaryValue?.id,
                }),
                knex,
                aliasCount,
                relAlias
              )
            )(qb);
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            (
              await parseConditionV2(
                new Filter({
                  ...filter,
                  fk_model_id: parentModel.id,
                  fk_column_id: parentModel?.primaryValue?.id,
                }),
                knex,
                aliasCount,
                relAlias
              )
            )(qb);
          }
          break;
        case 'mm':
          {
            (
              await parseConditionV2(
                new Filter({
                  ...filter,
                  fk_model_id: parentModel.id,
                  fk_column_id: parentModel.primaryValue?.id,
                }),
                knex,
                aliasCount,
                relAlias
              )
            )(qb);
          }
          break;
      }
    }
  } else {
    (
      await parseConditionV2(
        new Filter({
          ...filter,
          fk_model_id: (await lookupColumn.getModel()).id,
          fk_column_id: lookupColumn?.id,
        }),
        knex,
        aliasCount,
        alias
      )
    )(qb);
  }
}
