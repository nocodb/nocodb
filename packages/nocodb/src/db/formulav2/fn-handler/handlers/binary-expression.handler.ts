import {
  ComparisonOperators,
  FormulaDataTypes,
  JSEPNode,
  UITypes,
  validateDateWithUnknownFormat,
} from 'nocodb-sdk';
import { convertDateFormatForConcat } from 'src/helpers/formulaFnHelper';
import {
  coalesceNumericOperand,
  ieeeModuloSql,
  isPgIeeeEnabled,
  stripNaNSql,
} from '../../pg-ieee';
import { fnKeyOf } from '../fn-node';
import { getFnHandler } from '../registry';
import type {
  BinaryExpressionNode,
  CallExpressionNode,
  ComparisonOperator,
  IdentifierNode,
  LiteralNode,
  NcContext,
} from 'nocodb-sdk';
import type { Model } from 'src/models';
import type {
  FnParsedTreeNode,
  FormulaBuildHints,
  TAliasToColumn,
} from '../../formula-query-builder.types';
import type { CallExpressionCompiler } from '../fn-handler.interface';
import type CustomKnex from '../../../CustomKnex';

/**
 * Lowering for every binary operator. Kept whole rather than split per operator:
 * only two of its passes (`/` via the fn-handler registry, and `%`) are
 * per-operator lowerings — the rest (blank-as-zero coalescing, text->numeric
 * coercion, null-safe comparison, the mssql/oracle CASE materialisation and
 * FLOAT cast) apply across families of operators and read each other's results
 * in order.
 *
 * `compileCall` is injected rather than imported, for the same reason
 * `FnEmitContext` injects it: this module sits below parsed-tree-builder, which
 * imports the registry, so importing it back would close the cycle.
 */

const assignFnName = (pt: FnParsedTreeNode) => {
  if (pt.fnName) return;
  if (pt.dataType === FormulaDataTypes.STRING) {
    pt.fnName = 'CONCAT';
  } else {
    pt.fnName = 'ARITH';
  }
};

export const binaryExpressionBuilder = async ({
  context,
  pt,
  fn,
  prevBinaryOp,
  knex,
  columnIdToUidt,
  aliasToColumn,
  model,
  buildHints,
  compileCall,
}: {
  context: NcContext;
  pt: BinaryExpressionNode;
  fn: (
    pt: FnParsedTreeNode,
    prevBinaryOp?: string,
  ) => undefined | Promise<{ builder: any }>;
  prevBinaryOp: string;
  knex: CustomKnex;
  columnIdToUidt: Record<string, UITypes>;
  aliasToColumn: TAliasToColumn;
  model: Model;
  buildHints?: FormulaBuildHints;
  /** `callExpressionBuilder`, injected — see the note above. */
  compileCall: CallExpressionCompiler;
}) => {
  // treat `&` as shortcut for concat
  if (pt.operator === '&') {
    return fn(
      {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.left, pt.right],
        callee: {
          type: 'Identifier',
          name: 'CONCAT',
        },
      },
      prevBinaryOp,
    );
  }

  // if operator is + and expected return type is string, convert to concat
  if (pt.operator === '+' && pt.dataType === FormulaDataTypes.STRING) {
    return fn(
      {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.left, pt.right],
        callee: {
          type: 'Identifier',
          name: 'CONCAT',
        },
      },
      prevBinaryOp,
    );
  }

  // if operator is == or !=, then handle comparison with BLANK which should accept NULL and empty string
  if (pt.operator === '==' || pt.operator === '!=') {
    for (const operand of ['left', 'right']) {
      if (
        pt[operand].dataType === FormulaDataTypes.BOOLEAN &&
        pt[operand === 'left' ? 'right' : 'left'].dataType ===
          FormulaDataTypes.NUMERIC
      ) {
        pt[operand === 'left' ? 'right' : 'left'] = {
          type: JSEPNode.CALL_EXP,
          arguments: [pt[operand === 'left' ? 'right' : 'left']],
          callee: {
            type: 'Identifier',
            name: 'BOOLEAN',
          },
          dataType: FormulaDataTypes.BOOLEAN,
        };
      }
    }
    if (
      (pt.left as CallExpressionNode).callee?.name !==
      (pt.right as CallExpressionNode).callee?.name
    ) {
      // if left/right is BLANK, accept both NULL and empty string
      for (const operand of ['left', 'right']) {
        if (
          pt[operand].type === 'CallExpression' &&
          pt[operand].callee.name === 'BLANK'
        ) {
          const isString =
            pt[operand === 'left' ? 'right' : 'left'].dataType ===
            FormulaDataTypes.STRING;
          let calleeName;

          if (pt.operator === '==') {
            calleeName = isString ? 'ISBLANK' : 'ISNULL';
          } else {
            calleeName = isString ? 'ISNOTBLANK' : 'ISNOTNULL';
          }

          return fn(
            {
              type: JSEPNode.CALL_EXP,
              arguments: [operand === 'left' ? pt.right : pt.left],
              callee: {
                type: 'Identifier',
                name: calleeName,
              },
            },
            prevBinaryOp,
          );
        }
      }
    }
  }

  if (pt.operator === '==') {
    pt.operator = '=';
    // if left/right is of different type, convert to string and compare
    if (
      pt.left.dataType !== pt.right.dataType &&
      [pt.left.dataType, pt.right.dataType].every(
        (type) => type !== FormulaDataTypes.NULL,
      )
    ) {
      pt.left = {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.left],
        callee: {
          type: 'Identifier',
          name: 'STRING',
        },
      };
      pt.right = {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.right],
        callee: {
          type: 'Identifier',
          name: 'STRING',
        },
      };
    }
  }

  // A registered lowering owns its whole generation — operand wrapping,
  // blank-as-zero and the emitted form — in one class per variant. `buildHints`
  // can pin the variant; otherwise it follows the dialect. Operators with no
  // handler fall through to the inline handling below.
  const fnHandler = getFnHandler(
    fnKeyOf(pt),
    { pgIeee: isPgIeeeEnabled(knex), fnVariants: buildHints?.fnVariants },
    pt,
  );

  // `prepareTree` replaces the operand nodes with FLOAT() wrappers that carry no
  // dataType, so capture the operand types first.
  const leftDataType = pt.left.dataType;
  const rightDataType = pt.right.dataType;

  fnHandler?.prepareTree(pt);

  assignFnName(pt.left as FnParsedTreeNode);
  assignFnName(pt.right as FnParsedTreeNode);

  let left = (await fn(pt.left, pt.operator)).builder.toQuery();
  let right = (await fn(pt.right, pt.operator)).builder.toQuery();

  if (fnHandler) {
    [left, right] = fnHandler.prepareOperands([left, right], knex);
  } else if (
    // Blank numerics behave as 0 in arithmetic and comparisons (pg only).
    // Applied in every mode, not just display: if display coalesced but sort did
    // not, a blank operand would render as a number yet sort as NULL. `/` is
    // absent from the list — its handler owns the rule; the same goes for any
    // operator that moves into fn-handler.
    isPgIeeeEnabled(knex) &&
    ['+', '-', '*', '%', '<', '>', '<=', '>=', '=', '!='].includes(pt.operator)
  ) {
    if (leftDataType === FormulaDataTypes.NUMERIC) {
      left = coalesceNumericOperand(left, knex);
    }
    if (rightDataType === FormulaDataTypes.NUMERIC) {
      right = coalesceNumericOperand(right, knex);
    }
  }

  // Ordering comparisons (<, <=, >, >=) need numeric operands. A formula can put
  // a text-typed expression on one side — e.g. IF(cond, "", <number>), whose
  // mixed string/numeric branches the IF mapper unifies to text (`(?)::text`) —
  // while the other side is a number. On strict-typed DBs `text <= 1` fails
  // (Postgres `42883 operator does not exist: text <= integer`), surfacing as a
  // 500 on the formula dry-run / list. Coerce the text operand to a NULL-safe
  // numeric so a blank/non-numeric value becomes NULL (row excluded) rather than
  // erroring, matching the numeric intent of the comparison.
  const isOrderingComparison = ['<', '<=', '>', '>='].includes(pt.operator);
  if (isOrderingComparison) {
    const toSafeNumeric = (expr: string): string => {
      switch (knex.clientType()) {
        case 'pg':
          // btrim + regex guard so non-numeric/empty text yields NULL instead of
          // an "invalid input syntax for type double precision" runtime error.
          return `(CASE WHEN btrim((${expr})::text) ~ '^[-+]?[0-9]+(\\.[0-9]+)?$' THEN (${expr})::double precision END)`;
        case 'mssql':
          return `TRY_CAST(${expr} AS FLOAT)`;
        case 'oracledb':
          return `CAST(${expr} AS BINARY_DOUBLE DEFAULT NULL ON CONVERSION ERROR)`;
        // mysql2 / sqlite3 coerce text→number implicitly and don't hard-error,
        // so leave them untouched to avoid changing their existing behavior.
        default:
          return expr;
      }
    };

    if (
      pt.left.dataType === FormulaDataTypes.STRING &&
      pt.right.dataType === FormulaDataTypes.NUMERIC
    ) {
      left = toSafeNumeric(left);
    } else if (
      pt.right.dataType === FormulaDataTypes.STRING &&
      pt.left.dataType === FormulaDataTypes.NUMERIC
    ) {
      right = toSafeNumeric(right);
    }

    // Same rule the filter layer applies to gt/lt/gte/lte: NaN satisfies no
    // ordering comparison. Without this a divide-by-zero row takes the true
    // branch of `> 100`, silently flipping the IF around it.
    if (isPgIeeeEnabled(knex)) {
      if (pt.left.dataType === FormulaDataTypes.NUMERIC) {
        left = stripNaNSql(left);
      }
      if (pt.right.dataType === FormulaDataTypes.NUMERIC) {
        right = stripNaNSql(right);
      }
    }
  }

  let sql = `${left} ${pt.operator} ${right}`;

  if (ComparisonOperators.includes(pt.operator as ComparisonOperator)) {
    // comparing a date with empty string would throw
    // `ERROR: zero-length delimited identifier` in Postgres
    if (
      (knex.clientType() === 'pg' ||
        knex.clientType() === 'mssql' ||
        knex.clientType() === 'oracledb') &&
      columnIdToUidt[(pt.left as IdentifierNode).name] === UITypes.Date
    ) {
      // The correct way to compare with Date should be using
      // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
      // This is to prevent empty data returned to UI due to incorrect SQL
      if ((pt.right as LiteralNode).value === '') {
        if (pt.operator === '=') {
          sql = `${left} IS NULL `;
        } else {
          sql = `${left} IS NOT NULL `;
        }
      } else if (
        !validateDateWithUnknownFormat(
          (pt.right as LiteralNode).value as string,
        )
      ) {
        // left tree value is date but right tree value is not date
        // return true if left tree value is not null, else false
        sql = `${left} IS NOT NULL `;
      }
    }
    if (
      (knex.clientType() === 'pg' ||
        knex.clientType() === 'mssql' ||
        knex.clientType() === 'oracledb') &&
      columnIdToUidt[(pt.right as IdentifierNode).name] === UITypes.Date
    ) {
      // The correct way to compare with Date should be using
      // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
      // This is to prevent empty data returned to UI due to incorrect SQL
      if ((pt.left as LiteralNode).value === '') {
        if (pt.operator === '=') {
          sql = `${right} IS NULL `;
        } else {
          sql = `${right} IS NOT NULL `;
        }
      } else if (
        !validateDateWithUnknownFormat((pt.left as LiteralNode).value as string)
      ) {
        // right tree value is date but left tree value is not date
        // return true if right tree value is not null, else false
        sql = `${right} IS NOT NULL `;
      }
    }
  }

  if (
    (pt.left as FnParsedTreeNode).fnName === 'CONCAT' &&
    knex.clientType() === 'sqlite3'
  ) {
    // handle date format
    left = await convertDateFormatForConcat(
      context,
      (pt.left as CallExpressionNode)?.arguments?.[0],
      columnIdToUidt,
      left,
      knex.clientType(),
    );
    right = await convertDateFormatForConcat(
      context,
      (pt.right as CallExpressionNode)?.arguments?.[0],
      columnIdToUidt,
      right,
      knex.clientType(),
    );

    // handle NULL values when calling CONCAT for sqlite3
    sql = `COALESCE(${left}, '') ${pt.operator} COALESCE(${right},'')`;
  }

  if (knex.clientType() === 'mysql2') {
    sql = `IFNULL(${left} ${pt.operator} ${right}, ${
      pt.operator === '='
        ? pt.left.type === 'Literal'
          ? (pt.left as LiteralNode).value === ''
          : (pt.right as LiteralNode).value === ''
        : pt.operator === '!='
        ? pt.left.type !== 'Literal'
          ? (pt.left as any).value === ''
          : (pt.right as any).value === ''
        : 0
    })`;
  } else if (
    knex.clientType() === 'sqlite3' ||
    knex.clientType() === 'pg' ||
    knex.clientType() === 'mssql' ||
    knex.clientType() === 'oracledb'
  ) {
    // SQL Server has no `TEXT` cast (use NVARCHAR(MAX)) and no boolean literals
    // (use 1/0 instead of true/false). NULLIF divide-by-zero works as-is.
    // Oracle stores '' as NULL, so `= ''` / `!= ''` reduce to `IS [NOT] NULL` —
    // a `CAST(x …) != ''` arm would never be true there, and `CAST(x AS TEXT)`
    // is invalid anyway (ORA-00902).
    const isMssql = knex.clientType() === 'mssql';
    const isOracle = knex.clientType() === 'oracledb';
    const textType = isMssql ? 'NVARCHAR(MAX)' : 'TEXT';
    if (pt.operator === '=') {
      if (pt.left.type === 'Literal' && pt.left.value === '') {
        sql = isOracle
          ? `${right} IS NULL`
          : `${right} IS NULL OR CAST(${right} AS ${textType}) = ''`;
      } else if (pt.right.type === 'Literal' && pt.right.value === '') {
        sql = isOracle
          ? `${left} IS NULL`
          : `${left} IS NULL OR CAST(${left} AS ${textType}) = ''`;
      }
    } else if (pt.operator === '!=') {
      if (pt.left.type === 'Literal' && pt.left.value === '') {
        sql = isOracle
          ? `${right} IS NOT NULL`
          : `${right} IS NOT NULL AND CAST(${right} AS ${textType}) != ''`;
      } else if (pt.right.type === 'Literal' && pt.right.value === '') {
        sql = isOracle
          ? `${left} IS NOT NULL`
          : `${left} IS NOT NULL AND CAST(${left} AS ${textType}) != ''`;
      }
    }

    // T-SQL has no boolean type, so bare predicates are invalid in scalar
    // contexts. CASE-materialize all comparisons to 1/0 on mssql; pg/sqlite
    // only need `=`/`!=` wrapped to coerce them into a boolean-shaped value.
    // Oracle predicates are equally invalid in scalar contexts — same CASE
    // 1/0 shape as mssql.
    const isMssqlScalarComparison =
      (isMssql || isOracle) &&
      ['=', '!=', '<', '>', '<=', '>='].includes(pt.operator) &&
      prevBinaryOp !== 'AND' &&
      prevBinaryOp !== 'OR';

    if (
      isMssqlScalarComparison ||
      ((pt.operator === '=' || pt.operator === '!=') &&
        prevBinaryOp !== 'AND' &&
        prevBinaryOp !== 'OR')
    ) {
      sql =
        isMssql || isOracle
          ? `(CASE WHEN ${sql} THEN 1 ELSE 0 END )`
          : `(CASE WHEN ${sql} THEN true ELSE false END )`;
    } else if (fnHandler) {
      sql = await fnHandler.emit({
        context,
        pt,
        operands: [left, right],
        knex,
        fn,
        prevBinaryOp,
        aliasToColumn,
        columnIdToUidt,
        model,
        compileCall,
      });
    } else if (pt.operator === '%' && isPgIeeeEnabled(knex)) {
      // `%` is the operator spelling of MOD(), so it gets MOD's lowering. It
      // needs it: the COALESCE above turns a blank divisor into a literal 0,
      // which pg rejects with `division by zero` instead of returning NULL.
      sql = ieeeModuloSql(left, right);
    } else {
      sql = `${sql} `;
    }
  }

  // MSSQL: arithmetic over BIGINT/DECIMAL/NUMERIC preserves the input type,
  // and tedious returns those as JS strings (precision preservation). NocoDB
  // Number maps to BIGINT, so `{Number} + 10` would surface as `'10'`. Cast
  // the result to FLOAT so the formula matches pg/mysql/sqlite, which return
  // these as JS numbers. Only applies to numeric +/-/* — comparisons already
  // materialize to CASE 1/0 above, and `/` double-casts its operands to FLOAT.
  if (
    knex.clientType() === 'mssql' &&
    ['+', '-', '*'].includes(pt.operator) &&
    pt.dataType === FormulaDataTypes.NUMERIC
  ) {
    sql = `CAST(${sql} AS FLOAT)`;
  }

  const query = knex.raw(sql.replace(/\?/g, '\\?'));
  if (prevBinaryOp && pt.operator !== prevBinaryOp) {
    query.wrap('(', ')');
  }
  return { builder: query };
};
