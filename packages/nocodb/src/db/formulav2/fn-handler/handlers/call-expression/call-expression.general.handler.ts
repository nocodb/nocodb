import {
  type CallExpressionNode,
  JSEPNode,
  type ParsedFormulaNode,
} from 'nocodb-sdk';
import { convertDateFormatForConcat } from 'src/helpers/formulaFnHelper';
import mapFunctionName from '../../../../mapFunctionName';
import { isPgIeeeEnabled } from '../../../pg-ieee';
import { getFnHandler } from '../../registry';
import type { ClientType, NcContext, UITypes } from 'nocodb-sdk';
import type { Model } from 'src/models';
import type {
  FnParsedTreeNode,
  TAliasToColumn,
} from '../../../formula-query-builder.types';
import type {
  FnHandlerKey,
  FnNodeContext,
  FnNodeEstimateContext,
  FnNodeHandlerInterface,
} from '../../fn-handler.interface';
import type CustomKnex from '../../../../CustomKnex';

/**
 * Flat allowance for the dialect template a function name expands into — a
 * `CAST(... AS ...)`, a `strftime(...)`, an `IFNULL` wrap. Measured as a rough
 * middle of the mappings in `db/functionMappings/`.
 */
const MAPPED_FUNCTION_ALLOWANCE = 16;

export const callExpressionBuilder = async ({
  context,
  pt,
  fn,
  prevBinaryOp,
  aliasToColumn,
  knex,
  model,
  columnIdToUidt,
}: {
  context: NcContext;
  pt: CallExpressionNode;
  fn: (
    pt: FnParsedTreeNode,
    prevBinaryOp?: string,
  ) => undefined | Promise<{ builder: any }>;
  prevBinaryOp: string;
  aliasToColumn: TAliasToColumn;
  knex: CustomKnex;
  model: Model;
  columnIdToUidt: Record<string, UITypes>;
}): Promise<{ builder: any }> => {
  // A registered lowering owns the whole emitted form for its function, the
  // same way one does for an operator in `binaryExpressionBuilder`. Resolved
  // before the switch so it takes precedence over `mapFunctionName`; a function
  // with no handler on this dialect resolves to undefined and the existing
  // mapping runs untouched.
  const resolvedFn = getFnHandler(
    pt.callee.name.toUpperCase() as FnHandlerKey,
    {
      clientType: knex.clientType() as ClientType,
      pgIeee: isPgIeeeEnabled(knex),
    },
    pt,
  );
  if (resolvedFn) {
    resolvedFn.handler.prepareTree(pt);
    const compiled = await Promise.all(
      pt.arguments.map(async (arg) => `${(await fn(arg)).builder}`),
    );
    const operands = resolvedFn.handler.prepareOperands(
      compiled,
      knex,
      resolvedFn.variant,
      pt,
    );
    const sql = await resolvedFn.handler.emit({
      context,
      variant: resolvedFn.variant,
      pt,
      operands,
      knex,
      fn,
      prevBinaryOp,
      aliasToColumn,
      columnIdToUidt,
      model,
      compileCall: callExpressionBuilder,
    });
    return { builder: knex.raw(sql) };
  }

  switch (pt.callee.name.toUpperCase()) {
    case 'ADD':
    case 'SUM':
      if (pt.arguments.length > 1) {
        return fn(
          {
            type: JSEPNode.BINARY_EXP,
            operator: '+',
            // Preserve the numeric dataType from the original ADD/SUM call so
            // the MSSQL FLOAT-cast (see binaryExpressionBuilder) still fires —
            // otherwise `ADD({Num}, 10)` surfaces as the string '10' on mssql.
            dataType: pt.dataType,
            left: {
              type: JSEPNode.CALL_EXP,
              callee: { type: 'Identifier', name: 'COALESCE' },
              arguments: [
                pt.arguments[0],
                { type: JSEPNode.LITERAL, value: 0 } as ParsedFormulaNode,
              ],
            },
            right: { ...pt, arguments: pt.arguments.slice(1) },
          },
          prevBinaryOp,
        );
      } else {
        return fn(
          {
            type: JSEPNode.CALL_EXP,
            callee: { type: 'Identifier', name: 'COALESCE' },
            dataType: pt.dataType,
            arguments: [
              pt.arguments[0],
              { type: JSEPNode.LITERAL, value: 0 } as ParsedFormulaNode,
            ],
          },
          prevBinaryOp,
        );
      }
      break;
    case 'CONCAT':
      if (knex.clientType() === 'sqlite3') {
        if (pt.arguments.length > 1) {
          return fn(
            {
              type: JSEPNode.BINARY_EXP,
              operator: '||',
              left: pt.arguments[0],
              right: { ...pt, arguments: pt.arguments.slice(1) },
            },
            prevBinaryOp,
          );
        } else {
          return fn(pt.arguments[0], prevBinaryOp);
        }
      } else if (knex.clientType() === 'databricks') {
        const res = await mapFunctionName({
          pt,
          knex,
          aliasToCol: aliasToColumn,
          fn,
          prevBinaryOp,
          model,
        });
        if (res) return res;
      } else if (knex.clientType() === 'oracledb') {
        // The generic assembler below emits a literal n-ary `CONCAT(a, b, …)`.
        // Oracle 23ai accepts that syntax, but it returns VARCHAR2 (capped at
        // 4000 / 32767 bytes), so a large concatenation raises ORA-01489
        // ("result of string concatenation is too long") — whereas pg/mysql
        // build an unlimited TEXT result. Route through the oracle function
        // mapping instead, which chains the operands with `||` and wraps each
        // in TO_CLOB() so the result is an (unlimited) CLOB.
        const res = await mapFunctionName({
          pt,
          knex,
          aliasToCol: aliasToColumn,
          fn,
          prevBinaryOp,
          model,
        });
        if (res) return res;
      }
      break;
    case 'URL':
      /**
       * Added extra whitespace around URI and LABEL content to avoid conflicts during regex parsing.
       *
       * Reason for Adding Whitespace:
       * - Our URI syntax uses parentheses `(` and `)` to wrap URL and label content.
       * - Escaped parentheses `\(` and `\)` are allowed inside content, but without extra space,
       *   trailing backslashes (e.g., `\)`) near the closing parenthesis can cause incomplete group matches.
       * - Adding leading and trailing spaces around the content (`URI::( ` and ` )`) ensures that
       *   closing parentheses after escaped characters are parsed correctly.
       *
       * Example Case:
       * - Without space: `URI::(https://github.com/nocodb/nocodb/pull/10707\)`
       *   - Results in incomplete or invalid group matches.
       * - With space: `URI::( https://github.com/nocodb/nocodb/pull/10707\ )`
       *   - Handles escaped characters and parses content as expected.
       *
       * How It Works:
       * - The backend adds a leading space after `URI::(` and before the closing `)`.
       * - For labels, a leading space is added after `LABEL::(` and before `)`.
       * - The frontend regex is updated to accommodate these changes.
       *
       */
      return fn(
        {
          type: JSEPNode.CALL_EXP,
          arguments: [
            {
              type: JSEPNode.LITERAL,
              value: 'URI::( ',
              raw: '"URI::( "',
            },
            // wrap with replace function to escape parenthesis since it has special meaning in our URI syntax
            {
              type: JSEPNode.CALL_EXP,
              arguments: [
                {
                  type: JSEPNode.CALL_EXP,
                  arguments: [
                    pt.arguments[0],
                    {
                      type: JSEPNode.LITERAL,
                      value: '(',
                      raw: '"("',
                    },
                    {
                      type: JSEPNode.LITERAL,
                      value: '\\(',
                      raw: '"\\("',
                    },
                  ],
                  callee: {
                    type: 'Identifier',
                    name: 'REPLACE',
                  },
                },
                {
                  type: JSEPNode.LITERAL,
                  value: ')',
                  raw: '")"',
                },
                {
                  type: JSEPNode.LITERAL,
                  value: '\\)',
                  raw: '"\\)"',
                },
              ],
              callee: {
                type: 'Identifier',
                name: 'REPLACE',
              },
            },
            {
              type: JSEPNode.LITERAL,
              value: ' )',
              raw: '" )"',
            },
            ...(pt.arguments[1]
              ? ([
                  {
                    type: JSEPNode.LITERAL,
                    value: ' LABEL::( ',
                    raw: ' LABEL::( ',
                  },

                  // wrap with replace function to escape parenthesis since it has special meaning in our URI syntax
                  {
                    type: JSEPNode.CALL_EXP,
                    arguments: [
                      {
                        type: JSEPNode.CALL_EXP,
                        arguments: [
                          pt.arguments[1],
                          {
                            type: JSEPNode.LITERAL,
                            value: '(',
                            raw: '"("',
                          },
                          {
                            type: JSEPNode.LITERAL,
                            value: '\\(',
                            raw: '"\\("',
                          },
                        ],
                        callee: {
                          type: 'Identifier',
                          name: 'REPLACE',
                        },
                      },
                      {
                        type: JSEPNode.LITERAL,
                        value: ')',
                        raw: '")"',
                      },
                      {
                        type: JSEPNode.LITERAL,
                        value: '\\)',
                        raw: '"\\)"',
                      },
                    ],
                    callee: {
                      type: 'Identifier',
                      name: 'REPLACE',
                    },
                  },
                  {
                    type: JSEPNode.LITERAL,
                    value: ' )',
                    raw: '" )"',
                  },
                ] as ParsedFormulaNode[])
              : ([] as ParsedFormulaNode[])),
          ],
          callee: {
            type: 'Identifier',
            name: 'CONCAT',
          },
        },
        prevBinaryOp,
      );
      break;
    default:
      {
        const res = await mapFunctionName({
          pt,
          knex,
          aliasToCol: aliasToColumn,
          fn,
          prevBinaryOp,
          model,
        });
        if (res) return res;
      }
      break;
  }

  const calleeName = pt.callee.name.toUpperCase();
  const callArgs = (
    await Promise.all(
      pt.arguments.map(async (arg) => {
        let query = (await fn(arg)).builder.toQuery();
        if (calleeName === 'CONCAT') {
          if (knex.clientType() !== 'sqlite3') {
            query = await convertDateFormatForConcat(
              context,
              arg,
              columnIdToUidt,
              query,
              knex.clientType(),
            );
          } else {
            // sqlite3: special handling - See BinaryExpression
          }

          if (knex.clientType() === 'mysql2') {
            // mysql2: CONCAT() returns NULL if any argument is NULL.
            // adding IFNULL to convert NULL values to empty strings
            return `IFNULL(${query}, '')`;
          } else {
            // do nothing
            // pg: Concatenate all arguments. NULL arguments are ignored.
            // sqlite3: special handling - See BinaryExpression
          }
        }
        return query;
      }),
    )
  ).join();
  return {
    builder: knex.raw(`${calleeName}(${callArgs})`.replace(/\?/g, '\\?')),
  };
};

/** `call_exp` — the node-kind entry for a CallExpression. */
export class CallExpressionGeneralHandler implements FnNodeHandlerInterface {
  readonly kind = 'call_exp' as const;

  compile(ctx: FnNodeContext): Promise<{ builder: any }> {
    return callExpressionBuilder({
      context: ctx.context,
      pt: ctx.pt as CallExpressionNode,
      fn: ctx.fn,
      prevBinaryOp: ctx.prevBinaryOp,
      aliasToColumn: ctx.aliasToColumn,
      knex: ctx.knex,
      model: ctx.model,
      columnIdToUidt: ctx.columnIdToUidt,
    });
  }

  /**
   * A registered lowering answers for itself, exactly as it does for an
   * operator — without that, a function that writes an operand more than once
   * (every pg IEEE guard: ROUND writes its value three times) is counted once
   * and the whole estimate lands UNDER, which is the direction a size gate
   * cannot afford.
   *
   * Everything else gets `NAME(arg, arg)` plus a flat allowance for what the
   * dialect's mapping expands it into. Deliberately coarse: `mapFunctionName`
   * has a template per function per dialect, and mirroring all of them here
   * would be a second copy to keep in step. Measured, an unregistered call
   * contributes at most ~28B beyond the allowance — a constant, not a
   * multiplier, so it does not compound the way duplication does.
   */
  estimate(ctx: FnNodeEstimateContext): number {
    const pt = ctx.pt as {
      callee?: { name?: string };
      arguments?: unknown[];
    };
    const args = pt.arguments ?? [];
    const operands = args.map((arg) => ctx.estimate(arg as never));

    const resolved = getFnHandler(
      pt.callee?.name?.toUpperCase() as FnHandlerKey,
      { clientType: ctx.clientType, pgIeee: ctx.pgIeee },
      ctx.pt,
    );
    if (resolved) {
      return resolved.handler.estimate({
        pt: ctx.pt,
        operands,
        variant: resolved.variant,
      });
    }

    return (
      (pt.callee?.name?.length ?? 0) +
      '()'.length +
      Math.max(0, args.length - 1) * ', '.length +
      operands.reduce((sum, bytes) => sum + bytes, 0) +
      MAPPED_FUNCTION_ALLOWANCE
    );
  }
}
