import { Knex, knex } from 'knex';
import { defaults, types } from 'pg';
import dayjs from 'dayjs';
import type { FilterType } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import Filter from '~/models/Filter';
import { NcError } from '~/helpers/catchError';

// refer : https://github.com/brianc/node-pg-types/blob/master/lib/builtins.js
const pgTypes = {
  FLOAT4: 700,
  FLOAT8: 701,
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  NUMERIC: 1700,
};

// override parsing date column to Date()
types.setTypeParser(pgTypes.DATE, (val) => val);
// override timestamp
types.setTypeParser(pgTypes.TIMESTAMP, (val) => {
  return dayjs.utc(val).format('YYYY-MM-DD HH:mm:ssZ');
});
// override timestampz
types.setTypeParser(pgTypes.TIMESTAMPTZ, (val) => {
  return dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
});

const parseFloatVal = (val: string) => {
  return parseFloat(val);
};

// parse integer values
defaults.parseInt8 = true;

// parse float values
types.setTypeParser(pgTypes.FLOAT8, parseFloatVal);
types.setTypeParser(pgTypes.NUMERIC, parseFloatVal);

const opMappingGen = {
  eq: '=',
  lt: '<',
  gt: '>',
  le: '<=',
  ge: '>=',
  not: '!=',
  like: 'like',
};

/**
 * Converts a condition string to conditions array
 *
 * @param {String} str - Condition string
 * @returns {Array}
 */
function toArrayOfConditions(str) {
  if (!str) {
    return [];
  }

  let nestedArrayConditions = [];

  let openIndex = str.indexOf('((');

  if (openIndex === -1) openIndex = str.indexOf('(~');

  let nextOpenIndex = openIndex;
  let closingIndex = str.indexOf('))');

  // if it's a simple query simply return array of conditions
  if (openIndex === -1) {
    if (str && str != '~not')
      nestedArrayConditions = str.split(
        /(?=~(?:or(?:not)?|and(?:not)?|not)\()/,
      );
    return nestedArrayConditions || [];
  }

  // iterate until finding right closing
  while (
    (nextOpenIndex = str
      .substring(0, closingIndex)
      .indexOf('((', nextOpenIndex + 1)) != -1
  ) {
    closingIndex = str.indexOf('))', closingIndex + 1);
  }

  if (closingIndex === -1)
    throw new Error(
      `${str
        .substring(0, openIndex + 1)
        .slice(-10)} : Closing bracket not found`,
    );

  // getting operand starting index
  const operandStartIndex = str.lastIndexOf('~', openIndex);
  const operator =
    operandStartIndex != -1
      ? str.substring(operandStartIndex + 1, openIndex)
      : '';
  const lhsOfNestedQuery = str.substring(0, openIndex);

  nestedArrayConditions.push(
    ...toArrayOfConditions(lhsOfNestedQuery),
    // calling recursively for nested query
    {
      operator,
      conditions: toArrayOfConditions(
        str.substring(openIndex + 1, closingIndex + 1),
      ),
    },
    // RHS of nested query(recursion)
    ...toArrayOfConditions(str.substring(closingIndex + 2)),
  );
  return nestedArrayConditions;
}

const appendWhereCondition = function (
  conditions,
  columnAliases: {
    [columnAlias: string]: string;
  },
  knexRef,
  isHaving = false,
) {
  const clientType = knexRef?.client?.config?.client;
  const opMapping = {
    ...opMappingGen,
    ...(clientType === 'pg' ? { like: 'ilike' } : {}),
  };
  const camKey = isHaving ? 'Having' : 'Where';
  const key = isHaving ? 'having' : 'where';

  conditions.forEach((condition) => {
    if (Array.isArray(condition)) {
      knexRef[key](function () {
        appendWhereCondition(condition, columnAliases, this);
      });
    } else if (typeof condition === 'object') {
      switch (condition.operator) {
        case 'or':
          knexRef[`or${camKey}`](function () {
            appendWhereCondition(condition.conditions, columnAliases, this);
          });
          break;
        case 'and':
          knexRef[`and${camKey}`](function () {
            appendWhereCondition(condition.conditions, columnAliases, this);
          });
          break;
        case 'andnot':
          knexRef[`and${camKey}Not`](function () {
            appendWhereCondition(condition.conditions, columnAliases, this);
          });
          break;
        case 'ornot':
          knexRef[`or${camKey}Not`](function () {
            appendWhereCondition(condition.conditions, columnAliases, this);
          });
          break;
        case 'not':
          knexRef[`${key}Not`](function () {
            appendWhereCondition(condition.conditions, columnAliases, this);
          });
          break;
        default:
          knexRef[`${key}`](function () {
            appendWhereCondition(condition.conditions, columnAliases, this);
          });
          break;
      }
    } else if (typeof condition === 'string') {
      const matches: any[] = condition.match(
        /^(?:~(\w+))?\(([\w ]+),(\w+),(.*?)\)(?:~(?:or|and|not))?$/,
      );

      if (!matches) throw new Error(`${condition} : not a valid syntax`);
      switch (matches[3]) {
        case 'in':
          switch (matches[1] || '') {
            case 'or':
              knexRef[`or${camKey}`]((builder) =>
                builder[`${key}In`](
                  columnAliases[matches[2]] || matches[2],
                  matches[4].split(','),
                ),
              );
              break;
            case 'and':
              knexRef[`${key}In`](
                columnAliases[matches[2]] || matches[2],
                matches[4].split(','),
              );
              break;
            case 'andnot':
              knexRef[`${key}NotIn`](
                columnAliases[matches[2]] || matches[2],
                matches[4].split(','),
              );
              break;
            case 'ornot':
              knexRef[`or${camKey}`]((builder) =>
                builder[`${key}NotIn`](
                  columnAliases[matches[2]] || matches[2],
                  matches[4].split(','),
                ),
              );
              break;
            case 'not':
              knexRef[`${key}NotIn`](
                columnAliases[matches[2]] || matches[2],
                matches[4].split(','),
              );
              break;
            case '':
              knexRef[`${key}In`](
                columnAliases[matches[2]] || matches[2],
                matches[4].split(','),
              );
              break;
            default:
              throw new Error(`${matches[1]} : Invalid operation.`);
              break;
          }
          break;
        case 'is':
          if (matches[4] != 'null')
            throw new Error(
              `${matches[4]} : not a valid value since 'is' & 'isnot' only supports value null`,
            );
          switch (matches[1] || '') {
            case 'or':
              knexRef[`or${camKey}`]((builder) =>
                builder[`${key}Null`](columnAliases[matches[2]] || matches[2]),
              );
              break;
            case 'and':
              knexRef[`${key}Null`](columnAliases[matches[2]] || matches[2]);
              break;
            case 'andnot':
              knexRef[`${key}NotNull`](columnAliases[matches[2]] || matches[2]);
              break;
            case 'ornot':
              knexRef[`or${camKey}`]((builder) =>
                builder[`${key}NotNull`](
                  columnAliases[matches[2]] || matches[2],
                ),
              );
              break;
            case 'not':
              knexRef[`${key}NotNull`](columnAliases[matches[2]] || matches[2]);
              break;
            case '':
              knexRef[`${key}Null`](columnAliases[matches[2]] || matches[2]);
              break;
            default:
              throw new Error(`${matches[1]} : Invalid operation.`);
              break;
          }
          break;
        case 'isnot':
          if (matches[4] != 'null')
            throw new Error(
              `${matches[4]} : not a valid value since 'is' & 'isnot' only supports value null`,
            );
          switch (matches[1] || '') {
            case 'or':
              knexRef[`or${camKey}`]((builder) =>
                builder[`${key}NotNull`](
                  columnAliases[matches[2]] || matches[2],
                ),
              );
              break;
            case 'and':
              knexRef[`${key}NotNull`](columnAliases[matches[2]] || matches[2]);
              break;
            case 'andnot':
              knexRef[`${key}NotNull`](columnAliases[matches[2]] || matches[2]);
              break;
            case 'ornot':
              knexRef[`or${camKey}`]((builder) =>
                builder[`${key}NotNull`](
                  columnAliases[matches[2]] || matches[2],
                ),
              );
              break;
            case 'not':
              knexRef[`${key}Null`](columnAliases[matches[2]] || matches[2]);
              break;
            case '':
              knexRef[`${key}NotNull`](columnAliases[matches[2]] || matches[2]);
              break;
            default:
              throw new Error(`${matches[1]} : Invalid operation.`);
              break;
          }
          break;
        case 'btw':
          {
            const range = matches[4].split(',');
            if (range.length !== 2)
              throw new Error(
                `${matches[4]} : not a valid value.${
                  range.length > 2
                    ? ' Between accepts only 2 values'
                    : ' Between requires 2 values'
                }`,
              );
            switch (matches[1] || '') {
              case 'or':
                knexRef[`or${camKey}`]((builder) =>
                  builder[`${key}Between`](
                    columnAliases[matches[2]] || matches[2],
                    range,
                  ),
                );
                break;
              case 'and':
                knexRef[`${key}Between`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              case 'andnot':
                knexRef[`${key}NotBetween`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              case 'ornot':
                knexRef[`or${camKey}`]((builder) =>
                  builder[`${key}NotBetween`](
                    columnAliases[matches[2]] || matches[2],
                    range,
                  ),
                );
                break;
              case 'not':
                knexRef[`${key}NotBetween`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              case '':
                knexRef[`${key}Between`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              default:
                throw new Error(`${matches[1]} : Invalid operation.`);
                break;
            }
          }
          break;
        case 'nbtw':
          {
            const range = matches[4].split(',');
            if (range.length !== 2)
              throw new Error(
                `${matches[4]} : not a valid value.${
                  range.length > 2
                    ? ' Between accepts only 2 values'
                    : ' Between requires 2 values'
                }`,
              );
            switch (matches[1] || '') {
              case 'or':
                knexRef[`or${camKey}`]((builder) =>
                  builder[`${key}NotBetween`](
                    columnAliases[matches[2]] || matches[2],
                    range,
                  ),
                );
                break;
              case 'and':
                knexRef[`${key}NotBetween`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              case 'andnot':
                knexRef[`${key}Between`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              case 'ornot':
                knexRef[`or${camKey}`]((builder) =>
                  builder[`${key}Between`](
                    columnAliases[matches[2]] || matches[2],
                    range,
                  ),
                );
                break;
              case 'not':
                knexRef[`${key}Between`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              case '':
                knexRef[`${key}NotBetween`](
                  columnAliases[matches[2]] || matches[2],
                  range,
                );
                break;
              default:
                throw new Error(
                  `${
                    columnAliases[matches[2]] || matches[2]
                  } : Invalid operation.`,
                );
                break;
            }
          }
          break;
        default:
          if (!(matches[3] in opMapping))
            throw new Error(`${matches[3]} : Invalid comparison operator`);

          if (
            opMapping[matches[3]] === '=' &&
            ['true', 'false'].includes(matches[4])
          ) {
            matches[4] = matches[4] === 'true';
          }

          switch (matches[1] || '') {
            case 'or':
              knexRef[`or${camKey}`](
                columnAliases[matches[2]] || matches[2],
                opMapping[matches[3]],
                matches[4],
              );
              break;
            case 'and':
              knexRef[`and${camKey}`](
                columnAliases[matches[2]] || matches[2],
                opMapping[matches[3]],
                matches[4],
              );
              break;
            case 'andnot':
              knexRef[`and${camKey}Not`](
                columnAliases[matches[2]] || matches[2],
                opMapping[matches[3]],
                matches[4],
              );
              break;
            case 'ornot':
              knexRef[`or${camKey}Not`](
                columnAliases[matches[2]] || matches[2],
                opMapping[matches[3]],
                matches[4],
              );
              break;
            case 'not':
              knexRef[`${key}Not`](
                columnAliases[matches[2]] || matches[2],
                opMapping[matches[3]],
                matches[4],
              );
              break;
            case '':
              {
                const column = columnAliases[matches[2]] || matches[2];
                const operator = opMapping[matches[3]];
                const target = matches[4];
                if (matches[3] == 'like' && clientType === 'pg') {
                  // handle uuid case
                  knexRef[`${key}`](
                    knexRef?.client.raw(`??::TEXT ${operator} '${target}'`, [
                      column,
                    ]),
                  );
                } else {
                  knexRef[`${key}`](column, operator, target);
                }
              }
              break;
            default:
              throw new Error(`${matches[1] || ''} Invalid operation.`);
              break;
          }
          break;
      }
    } else {
      throw new Error('appendWhereCondition : grammar error ' + conditions);
    }
  });

  return knexRef;
};

type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> &
  U[keyof U];

export type ConditionVal = AtLeastOne<{
  eq: string | number | boolean | Date;
  neq: string | number | boolean | Date;
  lt: number | string | Date;
  gt: number | string | Date;
  ge: number | string | Date;
  le: number | string | Date;
  like: string;
  nlike: string;
  in: (number | string | Date)[];
  nin: (number | string | Date)[];
}>;

export interface Condition {
  _or?: Condition[];
  _and?: Condition[];
  _not?: Condition;

  [key: string]: ConditionVal | Condition | Condition[];
}

declare module 'knex' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Knex {
    interface QueryInterface {
      clientType(): string;
    }

    interface QueryBuilder {
      xwhere<TRecord, TResult>(
        value: string,
        columnAliases?: {
          [columnAlias: string]: string;
        },
      ): Knex.QueryBuilder<TRecord, TResult>;

      condition<TRecord, TResult>(
        conditionObj: Condition,
        columnAliases?: {
          [columnAlias: string]: string;
        },
      ): Knex.QueryBuilder<TRecord, TResult>;

      conditionv2<TRecord, TResult>(
        conditionObj: Filter,
      ): Knex.QueryBuilder<TRecord, TResult>;

      concat<TRecord, TResult>(
        cn: string | any,
      ): Knex.QueryBuilder<TRecord, TResult>;

      conditionGraph<TRecord, TResult>(condition: {
        condition: Condition;
        models: { [key: string]: BaseModelSqlv2 };
      }): Knex.QueryBuilder<TRecord, TResult>;

      xhaving<TRecord, TResult>(
        value: string,
        columnAliases?: {
          [columnAlias: string]: string;
        },
      ): Knex.QueryBuilder<TRecord, TResult>;

      hasWhere(): boolean;
    }
  }
}

/**
 * Append xwhere to knex query builder
 */
knex.QueryBuilder.extend(
  'xwhere',
  function (
    conditionString,
    columnAliases?: {
      [columnAlias: string]: string | any;
    },
  ) {
    const conditions = toArrayOfConditions(conditionString);
    return appendWhereCondition(conditions, columnAliases || {}, this);
  },
);
/**
 * Append concat to knex query builder
 */
knex.QueryBuilder.extend('concat', function (cn: any) {
  switch (this?.client?.config?.client) {
    case 'pg':
      this.select(
        this.client.raw(`STRING_AGG(??::character varying , ',')`, [cn]),
      );
      break;
    case 'mysql':
    case 'mysql2':
      this.select(this.client.raw(`GROUP_CONCAT(?? SEPARATOR ',')`, [cn]));
      break;
    case 'mssql':
      this.select(this.client.raw(`STRING_AGG(??, ',')`, [cn]));
      break;
    case 'sqlite3':
      this.select(this.client.raw(`GROUP_CONCAT(?? , ',')`, [cn]));
      break;
  }
  return this;
});

/**
 * Append xhaving to knex query builder
 */
knex.QueryBuilder.extend(
  'xhaving',
  function (
    conditionString,
    columnAliases?: {
      [columnAlias: string]: string;
    },
  ) {
    const conditions = toArrayOfConditions(conditionString);
    return appendWhereCondition(conditions, columnAliases || {}, this, true);
  },
);

/**
 * Append custom where condition(nested object) to knex query builder
 */
knex.QueryBuilder.extend('condition', function (conditionObj, columnAliases) {
  if (!conditionObj || typeof conditionObj !== 'object') {
    return this;
  }
  return parseCondition(conditionObj, columnAliases || {}, this);
});

const parseCondition = (obj, columnAliases, qb, pKey?) => {
  const conditions = Object.entries(obj);

  for (const [key, val] of conditions) {
    switch (key) {
      case '_or':
        qb = qb.where(function () {
          for (const condition of val as any[]) {
            this.orWhere(function () {
              return parseCondition(condition, columnAliases, this);
            });
          }
        });
        break;
      case '_and':
        qb = qb.where(function () {
          for (const condition of val as any[]) {
            this.andWhere(function () {
              return parseCondition(condition, columnAliases, this);
            });
          }
        });
        break;
      case '_not':
        qb = qb.whereNot(function () {
          return parseCondition(val, columnAliases, this);
        });
        break;
      default:
        if (
          val &&
          typeof val === 'object' &&
          !(val instanceof Date) &&
          !Array.isArray(val)
        ) {
          qb = parseCondition(val, columnAliases, qb, key);
        } else {
          const fieldName = columnAliases[pKey] || pKey;
          switch (key) {
            case 'eq':
              qb = qb.where(fieldName, val);
              break;
            case 'neq':
              qb = qb.whereNot(fieldName, val);
              break;
            case 'like':
              qb = qb.where(fieldName, 'like', val);
              break;
            case 'nlike':
              qb = qb.whereNot(fieldName, 'like', val);
              break;
            case 'gt':
              qb = qb.where(fieldName, '>', val);
              break;
            case 'ge':
              qb = qb.where(fieldName, '>=', val);
              break;
            case 'lt':
              qb = qb.where(fieldName, '<', val);
              break;
            case 'le':
              qb = qb.where(fieldName, '<=', val);
              break;
            case 'in':
              qb = qb.whereIn(fieldName, val);
              break;
            case 'nin':
              qb = qb.whereNotIn(fieldName, val);
              break;
            default:
              NcError.metaError({
                message: `Found invalid conditional operator "${key}" in expression`,
                sql: '',
              });
          }
        }
        break;
    }
  }

  return qb;
};

// todo: optimize
knex.QueryBuilder.extend(
  'conditionGraph',
  function (args: { condition; models }) {
    if (!args) {
      return this;
    }
    const { condition, models } = args;
    if (!condition || typeof condition !== 'object') {
      return this;
    }

    const conditionCopy = JSON.parse(JSON.stringify(condition));

    // parse and do all the joins
    const qb = parseNestedConditionAndJoin.call(
      { models },
      conditionCopy,
      this,
    );
    // parse and define all where conditions
    return parseNestedCondition.call({ models }, conditionCopy, qb);
  },
);

// @ts-ignore
function parseNestedConditionAndJoin(obj, qb, pKey?, table?, tableAlias?) {
  this._tn = this._tn || {};
  const self = this;
  let conditions = Object.entries(obj);
  let tn = table || qb._single.table;
  tableAlias = tableAlias || tn;

  // check for relation
  if (typeof obj === 'object' && 'relationType' in obj) {
    switch (obj.relationType) {
      case 'hm':
        {
          // const model = Object.entries(models).find(([name]) => {
          //   // todo: name comparison
          //   return pKey.toLowerCase().startsWith(name.toLowerCase());
          // })?.[1];

          // todo: get tablename from model
          const relation = this?.models?.[
            table || qb._single.table
          ]?.hasManyRelations?.find(
            ({ tn }) => pKey.toLowerCase() === tn.toLowerCase(),
          );

          // if (model) {
          //   console.log(model)
          // }
          if (relation) {
            this._tn[relation.tn] = (this._tn[relation.tn] || 0) + 1;

            obj.relationType = {
              alias: `${
                this._tn[relation.tn] ? this._tn[relation.tn] + '___' : ''
              }${relation.tn}`,
              type: obj.relationType,
            };

            qb = qb.join(
              `${relation.tn} as ${obj.relationType._tn}`,
              `${obj.relationType._tn}.${relation.cn}`,
              '=',
              `${tableAlias}.${relation.rcn}`,
            );
            // delete obj.relationType;
            // return parseNestedConditionAndJoin.call(this, Object.entries(obj).find(([k]) => k !== 'relationType')?.[1], qb, Object.keys(obj).find(k => k !== 'relationType'), relation.tn)
            tn = relation.tn;
            conditions = conditions.filter((c) => c[0] !== 'relationType');

            tableAlias = obj.relationType._tn;
          }
        }
        break;
      case 'bt':
        {
          // todo: get tablename from model
          const relation = this?.models?.[
            table || qb._single.table
          ]?.belongsToRelations?.find(
            ({ rtn }) => pKey.toLowerCase() === rtn.toLowerCase(),
          );

          // if (model) {
          //   console.log(model)
          // }
          if (relation) {
            this._tn[relation.rtn] = (this._tn[relation.rtn] || 0) + 1;
            obj.relationType = {
              alias: `${this._tn[relation.rtn]}___${relation.rtn}`,
              type: obj.relationType,
            };
            qb = qb.join(
              `${relation.rtn} as ${obj.relationType._tn}`,
              `${tableAlias}.${relation.cn}`,
              '=',
              `${obj.relationType._tn}.${relation.rcn}`,
            );
            // delete obj.relationType;
            // return parseNestedConditionAndJoin.call(self, Object.entries(obj).find(([k]) => k !== 'relationType')?.[1], qb, Object.keys(obj).find(k => k !== 'relationType'), relation.rtn)
            tn = relation.rtn;
            conditions = conditions.filter((c) => c[0] !== 'relationType');
            tableAlias = obj.relationType._tn;
          }
        }
        break;
      default:
        break;
    }
  }

  // handle logical operators recursively
  for (const [key, val] of conditions) {
    switch (key) {
      case '_or':
      case '_and':
        for (const condition of val as any[]) {
          qb = parseNestedConditionAndJoin.call(
            self,
            condition,
            qb,
            null,
            tn,
            tableAlias,
          );
        }
        break;
      case '_not':
        qb = parseNestedConditionAndJoin.call(
          self,
          val,
          qb,
          null,
          tn,
          tableAlias,
        );
        break;
      default:
        if (typeof val === 'object' && !Array.isArray(val)) {
          qb = parseNestedConditionAndJoin.call(
            self,
            val,
            qb,
            key,
            tn,
            tableAlias,
          );
        }
    }
  }
  return qb;
}

function parseNestedCondition(obj, qb, pKey?, table?, tableAlias?) {
  // this.alias = {...(this.alias || {})};
  // this.globalAlias = this.globalAlias || {};
  const self = this;
  let tn = table || qb._single.table;
  tableAlias = tableAlias || tn;
  // let alias;

  // check for relation and update t
  if ('relationType' in obj) {
    // alias = {...self.alias};
    switch (obj.relationType.type) {
      case 'hm':
        {
          // const model = Object.entries(models).find(([name]) => {
          //   // todo: name comparison
          //   return pKey.toLowerCase().startsWith(name.toLowerCase());
          // })?.[1];

          // todo: get tablename from model
          const relation = this?.models?.[
            table || qb._single.table
          ]?.hasManyRelations?.find(
            ({ tn }) => pKey.toLowerCase() === tn.toLowerCase(),
          );

          // if (model) {
          //   console.log(model)
          // }

          if (relation) {
            // alias[relation.tn] = this.globalAlias[relation.tn] = (this.globalAlias[relation.tn] || 0) + 1;
            // qb = qb.join(relation.tn, `${relation.tn}.${relation.cn}`, '=', `${relation.rtn}.${relation.rcn}`)
            // delete obj.relationType;
            // return parseNestedCondition.call(this, Object.values(obj)[0], qb, Object.keys(obj)[0],
            tn = relation.tn;
            tableAlias = obj.relationType._tn;
          }
        }
        break;
      case 'bt':
        {
          // todo: get tablename from model
          const relation = this?.models?.[
            table || qb._single.table
          ]?.belongsToRelations?.find(
            ({ rtn }) => pKey.toLowerCase() === rtn.toLowerCase(),
          );

          // if (model) {
          //   console.log(model)
          // }
          if (relation) {
            // alias[relation.rtn] = this.globalAlias[relation.rtn] = (this.globalAlias[relation.rtn] || 0) + 1;
            // qb = qb.join(relation.rtn, `${relation.tn}.${relation.cn}`, '=', `${relation.rtn}.${relation.rcn}`)
            // delete obj.relationType;
            // return parseNestedCondition.call(self, Object.values(obj)[0], qb, Object.keys(obj)[0],
            tn = relation.rtn;
            tableAlias = obj.relationType._tn;
          }
        }
        break;
      default:
        break;
    }
  } else {
    // alias = self.alias;
  }

  const conditions = Object.entries(obj).filter((c) => c[0] !== 'relationType');
  // const colPrefix = `${alias[tn] ? alias[tn] + '___' : ''}${tn}.`;
  const colPrefix = `${tableAlias}.`;

  for (const [key, val] of conditions) {
    // handle logical operators recursively
    switch (key) {
      case '_or':
        qb = qb.where(function () {
          for (const condition of val as any[]) {
            this.orWhere(function () {
              return parseNestedCondition.call(
                self,
                condition,
                this,
                null,
                tn,
                tableAlias,
              );
            });
          }
        });
        break;
      case '_and':
        qb = qb.where(function () {
          for (const condition of val as any[]) {
            this.andWhere(function () {
              parseNestedCondition.call(
                self,
                condition,
                this,
                null,
                tn,
                tableAlias,
              );
            });
          }
        });
        break;
      case '_not':
        qb = qb.whereNot(function () {
          return parseNestedCondition.call(
            self,
            val,
            this,
            null,
            tn,
            tableAlias,
          );
        });
        break;
      default:
        // if object handle recursively
        if (
          val &&
          typeof val === 'object' &&
          !(val instanceof Date) &&
          !Array.isArray(val)
        ) {
          qb = parseNestedCondition.call(self, val, qb, key, tn, tableAlias);
        } else {
          // handle based on operator
          switch (key) {
            case 'eq':
              qb = qb.where(colPrefix + pKey, val);
              break;
            case 'neq':
              qb = qb.whereNot(colPrefix + pKey, val);
              break;
            case 'like':
              qb = qb.where(colPrefix + pKey, 'like', val);
              break;
            case 'nlike':
              qb = qb.whereNot(colPrefix + pKey, 'like', val);
              break;
            case 'gt':
              qb = qb.where(colPrefix + pKey, '>', val);
              break;
            case 'ge':
              qb = qb.where(pKey, '>=', val);
              break;
            case 'lt':
              qb = qb.where(pKey, '<', val);
              break;
            case 'le':
              qb = qb.where(pKey, '<=', val);
              break;
            case 'in':
              qb = qb.whereIn(pKey, val);
              break;
            case 'nin':
              qb = qb.whereNotIn(pKey, val);
              break;
          }
        }
        break;
    }
  }

  return qb;
}

type CustomKnex = Knex;

function CustomKnex(
  arg: string | Knex.Config<any> | any,
  extDb?: any,
): CustomKnex {
  // sqlite does not support inserting default values and knex fires a warning without this flag
  if (arg?.client === 'sqlite3') {
    arg.useNullAsDefault = true;
  }

  const kn: any = knex(arg);

  const knexRaw = kn.raw;

  /**
   * Wrapper for knex.raw
   *
   * @param args1
   * @returns {Knex.Raw<any>}
   */
  // knex.raw = function (...args) {
  //   return knexRaw.apply(knex, args);
  // };

  Object.defineProperties(kn, {
    raw: {
      enumerable: true,
      value: (...args) => {
        return knexRaw.apply(kn, args);
      },
    },
    clientType: {
      enumerable: true,
      value: () => {
        return typeof arg === 'string'
          ? arg.match(/^(\w+):/) ?? [1]
          : typeof arg.client === 'string'
          ? arg.client
          : arg.client?.prototype?.dialect || arg.client?.prototype?.driverName;
      },
    },
    searchPath: {
      enumerable: true,
      value: () => {
        return arg?.searchPath?.[0];
      },
    },
    extDb: {
      enumerable: true,
      value: extDb,
    },
    isExternal: {
      enumerable: false,
      value: !!extDb && process.env.NC_DISABLE_MUX !== 'true',
    },
  });

  /**
   * Returns database type
   *
   * @returns {*|string}
   */
  // knex.clientType = function () {
  //   return typeof arg === 'string' ? arg.match(/^(\w+):/) ?? [1] : arg.client;
  // };

  return kn;
}

// todo: optimize
knex.QueryBuilder.extend(
  'conditionGraphv2',
  function (args: { condition; models }) {
    if (!args) {
      return this;
    }
    const { condition, models } = args;
    if (!condition || typeof condition !== 'object') {
      return this;
    }

    const conditionCopy = JSON.parse(JSON.stringify(condition));

    // parse and do all the joins
    // const qb = parseNestedConditionAndJoin.call({ models }, conditionCopy, this);
    // parse and define all where conditions
    return parseNestedConditionv2.call({ models }, conditionCopy);
  },
);

function parseNestedConditionv2(obj, qb, pKey?, table?, tableAlias?) {
  // this.alias = {...(this.alias || {})};
  // this.globalAlias = this.globalAlias || {};
  const self = this;
  let tn = table || qb._single.table;
  tableAlias = tableAlias || tn;
  // let alias;

  // check for relation and update t
  if ('relationType' in obj) {
    // alias = {...self.alias};
    switch (obj.relationType.type) {
      case 'hm':
        {
          // const model = Object.entries(models).find(([name]) => {
          //   // todo: name comparison
          //   return pKey.toLowerCase().startsWith(name.toLowerCase());
          // })?.[1];

          // todo: get tablename from model
          const relation = this?.models?.[
            table || qb._single.table
          ]?.hasManyRelations?.find(
            ({ tn }) => pKey.toLowerCase() === tn.toLowerCase(),
          );

          // if (model) {
          //   console.log(model)
          // }

          if (relation) {
            // alias[relation.tn] = this.globalAlias[relation.tn] = (this.globalAlias[relation.tn] || 0) + 1;
            // qb = qb.join(relation.tn, `${relation.tn}.${relation.cn}`, '=', `${relation.rtn}.${relation.rcn}`)
            // delete obj.relationType;
            // return parseNestedCondition.call(this, Object.values(obj)[0], qb, Object.keys(obj)[0],
            tn = relation.tn;
            tableAlias = obj.relationType._tn;
          }
        }
        break;
      case 'bt':
        {
          // todo: get tablename from model
          const relation = this?.models?.[
            table || qb._single.table
          ]?.belongsToRelations?.find(
            ({ rtn }) => pKey.toLowerCase() === rtn.toLowerCase(),
          );

          // if (model) {
          //   console.log(model)
          // }
          if (relation) {
            // alias[relation.rtn] = this.globalAlias[relation.rtn] = (this.globalAlias[relation.rtn] || 0) + 1;
            // qb = qb.join(relation.rtn, `${relation.tn}.${relation.cn}`, '=', `${relation.rtn}.${relation.rcn}`)
            // delete obj.relationType;
            // return parseNestedCondition.call(self, Object.values(obj)[0], qb, Object.keys(obj)[0],
            tn = relation.rtn;
            tableAlias = obj.relationType._tn;
          }
        }
        break;
      default:
        break;
    }
  } else {
    // alias = self.alias;
  }

  const conditions = Object.entries(obj).filter((c) => c[0] !== 'relationType');
  // const colPrefix = `${alias[tn] ? alias[tn] + '___' : ''}${tn}.`;
  const colPrefix = `${tableAlias}.`;

  for (const [key, val] of conditions) {
    // handle logical operators recursively
    switch (key) {
      case '_or':
        qb = qb.where(function () {
          for (const condition of val as any[]) {
            this.orWhere(function () {
              return parseNestedCondition.call(
                self,
                condition,
                this,
                null,
                tn,
                tableAlias,
              );
            });
          }
        });
        break;
      case '_and':
        qb = qb.where(function () {
          for (const condition of val as any[]) {
            this.andWhere(function () {
              parseNestedCondition.call(
                self,
                condition,
                this,
                null,
                tn,
                tableAlias,
              );
            });
          }
        });
        break;
      case '_not':
        qb = qb.whereNot(function () {
          return parseNestedCondition.call(
            self,
            val,
            this,
            null,
            tn,
            tableAlias,
          );
        });
        break;
      default:
        // if object handle recursively
        if (
          val &&
          typeof val === 'object' &&
          !(val instanceof Date) &&
          !Array.isArray(val)
        ) {
          qb = parseNestedCondition.call(self, val, qb, key, tn, tableAlias);
        } else {
          // handle based on operator
          switch (key) {
            case 'eq':
              qb = qb.where(colPrefix + pKey, val);
              break;
            case 'neq':
              qb = qb.whereNot(colPrefix + pKey, val);
              break;
            case 'like':
              qb = qb.where(colPrefix + pKey, 'like', val);
              break;
            case 'nlike':
              qb = qb.whereNot(colPrefix + pKey, 'like', val);
              break;
            case 'gt':
              qb = qb.where(colPrefix + pKey, '>', val);
              break;
            case 'ge':
              qb = qb.where(pKey, '>=', val);
              break;
            case 'lt':
              qb = qb.where(pKey, '<', val);
              break;
            case 'le':
              qb = qb.where(pKey, '<=', val);
              break;
            case 'in':
              qb = qb.whereIn(pKey, val);
              break;
            case 'nin':
              qb = qb.whereNotIn(pKey, val);
              break;
          }
        }
        break;
    }
  }

  return qb;
}

// extend the knex query builder with a method to check if a where clause exists
knex.QueryBuilder.extend('hasWhere', function () {
  // Inspect the _statements array for 'where' clauses
  return (
    this as unknown as { _statements: { grouping: string }[] }
  )._statements.some((statement) => statement.grouping === 'where') as any;
});

// Conditionv2
/**
 * Append custom where condition(nested object) to knex query builder
 */
knex.QueryBuilder.extend('conditionv2', function (conditionObj: Filter) {
  if (!conditionObj || typeof conditionObj !== 'object') {
    return this;
  }
  return parseConditionv2(conditionObj, this);
} as any);

const parseConditionv2 = (_obj: Filter | FilterType, qb: Knex.QueryBuilder) => {
  let obj: Filter;
  if (_obj instanceof Filter) {
    obj = _obj;
  } else {
    obj = new Filter(_obj);
  }
  if (obj.is_group) {
    qb = qb.where(function () {
      const children = obj.children;
      if (obj.logical_op?.toLowerCase() === 'or') {
        for (const filter of children || []) {
          this.orWhere(function () {
            return parseConditionv2(filter, this);
          });
        }
      } else {
        for (const filter of children || []) {
          this.andWhere(function () {
            return parseConditionv2(filter, this);
          });
        }
      }
    });
  } else {
    const col = obj.column;
    const fieldName = col.column_name;
    const val = obj.value;
    switch (obj.comparison_op) {
      case 'eq':
        qb = qb.where(fieldName, val);
        break;
      case 'neq':
        qb = qb.whereNot(fieldName, val);
        break;
      case 'like':
        qb = qb.where(fieldName, 'like', val);
        break;
      case 'nlike':
        qb = qb.whereNot(fieldName, 'like', val);
        break;
      case 'gt':
        qb = qb.where(fieldName, '>', val);
        break;
      case 'ge':
        qb = qb.where(fieldName, '>=', val);
        break;
      case 'lt':
        qb = qb.where(fieldName, '<', val);
        break;
      case 'le':
        qb = qb.where(fieldName, '<=', val);
        break;
      // case 'in':
      //   qb = qb.whereIn(fieldName, val);
      //   break;
      // case 'nin':
      //   qb = qb.whereNotIn(fieldName, val);
      //   break;
    }
  }

  return qb;
};

export default CustomKnex;
export { Knex, CustomKnex as XKnex };
