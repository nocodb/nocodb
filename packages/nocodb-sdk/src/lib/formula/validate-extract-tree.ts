import jsep from 'jsep';

import {
  ColumnType,
  FormulaType,
  LinkToAnotherRecordType,
  LookupType,
  RollupType,
  TableType,
} from '../Api';
import UITypes from '../UITypes';
import { FormulaDataTypes, FormulaErrorType, JSEPNode } from './enums';
import { FormulaError } from './error';
import {
  BinaryExpressionNode,
  CallExpressionNode,
  IdentifierNode,
  ParsedFormulaNode,
} from './operators';
import { handleFormulaError } from './handle-formula-error';
import { formulas } from './formulas';
import { jsepCurlyHook, jsepIndexHook } from './hooks';
import { ClientTypeOrSqlUI } from './types';
import { SqlUiFactory } from '../sqlUi';
import {
  extractBinaryExpReferencedInfo,
  extractCallExpressionReferencedInfo,
} from './referenced-info-extractor';

async function extractColumnIdentifierType({
  col,
  columns,
  getMeta,
  clientOrSqlUi,
}: {
  col: Record<string, any>;
  columns: ColumnType[];
  getMeta: (tableId: string) => Promise<any>;
  clientOrSqlUi: ClientTypeOrSqlUI;
}) {
  const res: {
    dataType?: FormulaDataTypes;
    errors?: Set<string>;
    referencedColumn?: { id: string; uidt: string };
    [p: string]: any;
  } = {};
  const sqlUI =
    typeof clientOrSqlUi === 'string'
      ? SqlUiFactory.create({ client: clientOrSqlUi })
      : clientOrSqlUi;

  switch (col?.uidt) {
    // string
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.MultiSelect:
    case UITypes.SingleSelect:
    case UITypes.PhoneNumber:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      res.dataType = FormulaDataTypes.STRING;
      break;
    // numeric
    case UITypes.Year:
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Rating:
    case UITypes.Count:
    case UITypes.AutoNumber:
      res.dataType = FormulaDataTypes.NUMERIC;
      break;
    // date
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      res.dataType = FormulaDataTypes.DATE;
      break;

    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Links:
      res.dataType = FormulaDataTypes.NUMERIC;
      break;

    case UITypes.Rollup:
      {
        const rollupFunction = col.colOptions.rollup_function;
        if (
          [
            'count',
            'avg',
            'sum',
            'countDistinct',
            'sumDistinct',
            'avgDistinct',
          ].includes(rollupFunction)
        ) {
          // these functions produce a numeric value, which can be used in numeric functions
          res.dataType = FormulaDataTypes.NUMERIC;
        } else {
          const relationColumnOpt = columns.find(
            (column) =>
              column.id === (<RollupType>col.colOptions).fk_relation_column_id
          );

          // the value is based on the foreign rollup column type
          const refTableMeta = await getMeta(
            (<LinkToAnotherRecordType>relationColumnOpt.colOptions)
              .fk_related_model_id
          );

          const refTableColumns = refTableMeta.columns;
          const childFieldColumn = refTableColumns.find(
            (column: ColumnType) =>
              column.id === col.colOptions.fk_rollup_column_id
          );

          // extract type and add to res
          Object.assign(
            res,
            await extractColumnIdentifierType({
              col: childFieldColumn,
              columns: refTableColumns,
              getMeta,
              clientOrSqlUi,
            })
          );
        }
      }
      break;

    case UITypes.Attachment:
      res.dataType = FormulaDataTypes.STRING;
      break;
    case UITypes.Checkbox:
      if (col.dt === 'boolean' || col.dt === 'bool') {
        res.dataType = FormulaDataTypes.BOOLEAN;
      } else {
        res.dataType = FormulaDataTypes.NUMERIC;
      }
      break;
    case UITypes.Time:
      res.dataType = FormulaDataTypes.INTERVAL;
      break;
    case UITypes.ID:
    case UITypes.ForeignKey:
    case UITypes.SpecificDBType:
      {
        if (sqlUI) {
          const abstractType = sqlUI.getAbstractType(col);
          if (['integer', 'float', 'decimal'].includes(abstractType)) {
            res.dataType = FormulaDataTypes.NUMERIC;
          } else if (['boolean'].includes(abstractType)) {
            res.dataType = FormulaDataTypes.BOOLEAN;
          } else if (
            ['date', 'datetime', 'time', 'year'].includes(abstractType)
          ) {
            res.dataType = FormulaDataTypes.DATE;
          } else {
            res.dataType = FormulaDataTypes.STRING;
          }
        } else {
          res.dataType = FormulaDataTypes.UNKNOWN;
        }
      }
      break;
    // not supported
    case UITypes.Lookup:
    case UITypes.LinkToAnotherRecord:
      res.dataType = FormulaDataTypes.ARRAY;
      break;
    case UITypes.Barcode:
    case UITypes.Button:
    case UITypes.Collaborator:
    case UITypes.QrCode:
    default:
      res.dataType = FormulaDataTypes.UNKNOWN;
      break;
  }
  res.referencedColumn = { id: col.id, uidt: col.uidt };

  return res;
}

function handleBinaryExpressionForDateAndTime(params: {
  sourceBinaryNode: BinaryExpressionNode;
}): BinaryExpressionNode | CallExpressionNode | undefined {
  const { sourceBinaryNode } = params;
  let res: BinaryExpressionNode | CallExpressionNode;

  if (
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.left.dataType
    ) &&
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.right.dataType
    ) &&
    sourceBinaryNode.operator === '-'
  ) {
    // when it's interval and interval, we return diff in minute (numeric)
    if (
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.right.dataType)
    ) {
      res = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
    }
    // when it's date - date, show the difference in minute
    else if (
      [FormulaDataTypes.DATE].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.DATE].includes(sourceBinaryNode.right.dataType)
    ) {
      res = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
    }
    // else interval and date can be addedd seamlessly A - B
    // with result as DATE
    // may be changed if we find other db use case
    else if (
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.left.dataType
      ) &&
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.right.dataType
      ) &&
      sourceBinaryNode.left.dataType != sourceBinaryNode.right.dataType
    ) {
      res = {
        type: JSEPNode.BINARY_EXP,
        left: sourceBinaryNode.left,
        right: sourceBinaryNode.right,
        operator: '-',
        dataType: FormulaDataTypes.DATE,
      } as BinaryExpressionNode;
    }
  } else if (
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.left.dataType
    ) &&
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.right.dataType
    ) &&
    sourceBinaryNode.operator === '+'
  ) {
    // when it's interval and interval, we return addition in minute (numeric)
    if (
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.right.dataType)
    ) {
      const left = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          {
            type: 'Literal',
            value: '00:00:00',
            raw: '"00:00:00"',
            dataType: FormulaDataTypes.INTERVAL,
          },
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
      const right = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: '00:00:00',
            raw: '"00:00:00"',
            dataType: FormulaDataTypes.INTERVAL,
          },
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
      return {
        type: JSEPNode.BINARY_EXP,
        left,
        right,
        operator: '+',
        dataType: FormulaDataTypes.NUMERIC,
      } as BinaryExpressionNode;
    }
    // else interval and date can be addedd seamlessly A + B
    // with result as DATE
    // may be changed if we find other db use case
    else if (
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.left.dataType
      ) &&
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.right.dataType
      ) &&
      sourceBinaryNode.left.dataType != sourceBinaryNode.right.dataType
    ) {
      res = {
        type: JSEPNode.BINARY_EXP,
        left: sourceBinaryNode.left,
        right: sourceBinaryNode.right,
        operator: '+',
        dataType: FormulaDataTypes.DATE,
      } as BinaryExpressionNode;
    }
  }
  return res;
}
async function checkForCircularFormulaRef(
  formulaCol: ColumnType,
  parsedTree: ParsedFormulaNode,
  columns: ColumnType[],
  getMeta: (tableId: string) => Promise<TableType & { columns: ColumnType[] }>
) {
  // Extract formula references
  const formulaPaths = await columns.reduce(async (promiseRes, c) => {
    const res = await promiseRes;
    if (c.id !== formulaCol.id && c.uidt === UITypes.Formula) {
      const neighbours = [
        ...new Set(
          (
            (c.colOptions as FormulaType).formula.match(/cl?_?\w{14,15}/g) || []
          ).filter((colId) =>
            columns.some(
              (col) => col.id === colId && col.uidt === UITypes.Formula
            )
          )
        ),
      ];
      if (neighbours.length) res.push({ [c.id]: neighbours });
    } else if (
      c.uidt === UITypes.Lookup ||
      c.uidt === UITypes.LinkToAnotherRecord
    ) {
      const neighbours = await processLookupOrLTARColumn(c);
      if (neighbours?.length) res.push({ [c.id]: neighbours });
    }
    return res;
  }, Promise.resolve([]));

  async function processLookupFormula(col: ColumnType, columns: ColumnType[]) {
    const neighbours = [];

    if (formulaCol.fk_model_id === col.fk_model_id) {
      return [col.id];
    }

    // Extract columns used in the formula and check for cycles
    const referencedColumns =
      (col.colOptions as FormulaType).formula.match(/cl?_?\w{14,15}/g) || [];

    for (const refColId of referencedColumns) {
      const refCol = columns.find((c) => c.id === refColId);
      if (refCol.uidt === UITypes.Formula) {
        neighbours.push(...(await processLookupFormula(refCol, columns)));
      } else if (
        refCol.uidt === UITypes.Lookup ||
        refCol.uidt === UITypes.LinkToAnotherRecord
      ) {
        neighbours.push(...(await processLookupOrLTARColumn(refCol)));
      }
    }
    return neighbours;
  }

  // Function to process lookup columns recursively
  async function processLookupOrLTARColumn(
    lookupOrLTARCol: ColumnType & {
      colOptions?: LookupType | LinkToAnotherRecordType;
    }
  ) {
    const neighbours = [];

    let ltarColumn: ColumnType;
    let lookupFilterFn: (column: ColumnType) => boolean;

    if (lookupOrLTARCol.uidt === UITypes.Lookup) {
      const relationColId = (lookupOrLTARCol.colOptions as LookupType)
        .fk_relation_column_id;
      const lookupColId = (lookupOrLTARCol.colOptions as LookupType)
        .fk_lookup_column_id;
      ltarColumn = columns.find((c) => c.id === relationColId);
      lookupFilterFn = (column: ColumnType) => column.id === lookupColId;
    } else if (lookupOrLTARCol.uidt === UITypes.LinkToAnotherRecord) {
      ltarColumn = lookupOrLTARCol;
      lookupFilterFn = (column: ColumnType) => !!column.pv;
    }

    if (ltarColumn) {
      const relatedTableMeta = await getMeta(
        (ltarColumn.colOptions as LinkToAnotherRecordType).fk_related_model_id
      );
      const lookupTarget = relatedTableMeta.columns.find(lookupFilterFn);

      if (lookupTarget) {
        if (lookupTarget.uidt === UITypes.Formula) {
          neighbours.push(
            ...(await processLookupFormula(
              lookupTarget,
              relatedTableMeta.columns
            ))
          );
        } else if (
          lookupTarget.uidt === UITypes.Lookup ||
          lookupTarget.uidt === UITypes.LinkToAnotherRecord
        ) {
          neighbours.push(...(await processLookupOrLTARColumn(lookupTarget)));
        }
      }
    }
    return [...new Set(neighbours)];
  }

  // include target formula column (i.e. the one to be saved if applicable)
  const targetFormulaCol = columns.find(
    (c: ColumnType) =>
      c.title === (parsedTree as IdentifierNode).name &&
      [UITypes.Formula, UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(
        c.uidt as UITypes
      )
  );

  if (targetFormulaCol && formulaCol?.id) {
    formulaPaths.push({
      [formulaCol?.id as string]: [targetFormulaCol.id],
    });
  }
  const vertices = formulaPaths.length;
  if (vertices > 0) {
    // perform kahn's algo for cycle detection
    const adj = new Map();
    const inDegrees = new Map();
    // init adjacency list & indegree

    for (const [_, v] of Object.entries(formulaPaths)) {
      const src = Object.keys(v)[0];
      const neighbours = v[src];
      inDegrees.set(src, inDegrees.get(src) || 0);
      for (const neighbour of neighbours) {
        adj.set(src, (adj.get(src) || new Set()).add(neighbour));
        inDegrees.set(neighbour, (inDegrees.get(neighbour) || 0) + 1);
      }
    }
    const queue: string[] = [];
    // put all vertices with in-degree = 0 (i.e. no incoming edges) to queue
    inDegrees.forEach((inDegree, col) => {
      if (inDegree === 0) {
        // in-degree = 0 means we start traversing from this node
        queue.push(col);
      }
    });
    // init count of visited vertices
    let visited = 0;
    // BFS
    while (queue.length !== 0) {
      // remove a vertex from the queue
      const src = queue.shift();
      // if this node has neighbours, increase visited by 1
      const neighbours = adj.get(src) || new Set();
      if (neighbours.size > 0) {
        visited += 1;
      }
      // iterate each neighbouring nodes
      neighbours.forEach((neighbour: string) => {
        // decrease in-degree of its neighbours by 1
        inDegrees.set(neighbour, inDegrees.get(neighbour) - 1);
        // if in-degree becomes 0
        if (inDegrees.get(neighbour) === 0) {
          // then put the neighboring node to the queue
          queue.push(neighbour);
        }
      });
    }
    // vertices not same as visited = cycle found
    if (vertices !== visited) {
      throw new FormulaError(
        FormulaErrorType.CIRCULAR_REFERENCE,
        {
          key: 'msg.formula.cantSaveCircularReference',
        },
        'Circular reference detected'
      );
    }
  }
}

export async function validateFormulaAndExtractTreeWithType({
  formula,
  column,
  columns,
  clientOrSqlUi,
  getMeta,
  trackPosition,
}: {
  formula: string;
  columns: ColumnType[];
  clientOrSqlUi: ClientTypeOrSqlUI;
  column?: ColumnType;
  getMeta: (tableId: string) => Promise<any>;
  trackPosition?: boolean;
}): Promise<ParsedFormulaNode> {
  const sqlUI =
    typeof clientOrSqlUi === 'string'
      ? SqlUiFactory.create({ client: clientOrSqlUi })
      : clientOrSqlUi;

  const colAliasToColMap = {};
  const colIdToColMap = {};

  for (const col of columns) {
    colAliasToColMap[col.title] = col;
    colIdToColMap[col.id] = col;
  }

  const validateAndExtract = async (
    parsedTree: ParsedFormulaNode
  ): Promise<ParsedFormulaNode> => {
    const res: ParsedFormulaNode = { ...parsedTree };

    if (parsedTree.type === JSEPNode.CALL_EXP) {
      const calleeName = (
        parsedTree.callee as IdentifierNode
      ).name.toUpperCase();
      // validate function name
      if (!formulas[calleeName]) {
        throw new FormulaError(
          FormulaErrorType.INVALID_FUNCTION_NAME,
          {
            calleeName,
            position:
              (parsedTree as any).indexStart >= 0
                ? {
                    index: (parsedTree as any).indexStart,
                    length: (parsedTree as any).nodeLength,
                  }
                : undefined,
          },
          `Function ${calleeName} is not available`
        );
      } else if (sqlUI?.getUnsupportedFnList().includes(calleeName)) {
        throw new FormulaError(
          FormulaErrorType.INVALID_FUNCTION_NAME,
          {
            calleeName,
            position:
              (parsedTree as any).indexStart >= 0
                ? {
                    index: (parsedTree as any).indexStart,
                    length: (parsedTree as any).nodeLength,
                  }
                : undefined,
          },
          `Function ${calleeName} is unavailable for your database`
        );
      }

      // validate arguments
      const validation =
        formulas[calleeName] && formulas[calleeName].validation;
      if (validation && validation.args) {
        if (
          validation.args.rqd !== undefined &&
          validation.args.rqd !== parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            {
              key: 'msg.formula.requiredArgumentsFormula',
              requiredArguments: validation.args.rqd,
              calleeName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexStart,
                      length: (parsedTree as any).nodeLength,
                    }
                  : undefined,
            },
            'Required arguments missing'
          );
        } else if (
          validation.args.min !== undefined &&
          validation.args.min > parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.MIN_ARG,
            {
              key: 'msg.formula.minRequiredArgumentsFormula',
              minRequiredArguments: validation.args.min,
              calleeName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexStart,
                      length: (parsedTree as any).nodeLength,
                    }
                  : undefined,
            },
            'Minimum arguments required'
          );
        } else if (
          validation.args.max !== undefined &&
          validation.args.max < parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            {
              key: 'msg.formula.maxRequiredArgumentsFormula',
              maxRequiredArguments: validation.args.max,
              calleeName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexStart,
                      length: (parsedTree as any).nodeLength,
                    }
                  : undefined,
            },
            'Maximum arguments missing'
          );
        }
      }
      // get args type and validate
      const validateResult = ((res as CallExpressionNode).arguments =
        await Promise.all(
          parsedTree.arguments.map((arg) => {
            return validateAndExtract(arg);
          })
        ));

      const argTypes = validateResult.map((v: any) => v.dataType);

      // if validation function is present, call it
      if (formulas[calleeName].validation?.custom) {
        formulas[calleeName].validation?.custom(argTypes, parsedTree);
      }
      // validate against expected arg types if present
      else if (formulas[calleeName].validation?.args?.type) {
        for (let i = 0; i < validateResult.length; i++) {
          const argPt = validateResult[i];

          // if type
          const expectedArgType = Array.isArray(
            formulas[calleeName].validation.args.type
          )
            ? formulas[calleeName].validation.args.type[i]
            : formulas[calleeName].validation.args.type;

          if (
            argPt.dataType !== expectedArgType &&
            argPt.dataType !== FormulaDataTypes.NULL &&
            argPt.dataType !== FormulaDataTypes.UNKNOWN &&
            expectedArgType !== FormulaDataTypes.STRING
          ) {
            if (argPt.type === JSEPNode.IDENTIFIER) {
              const name =
                columns?.find(
                  (c) => c.id === argPt.name || c.title === argPt.name
                )?.title || argPt.name;

              throw new FormulaError(
                FormulaErrorType.INVALID_ARG,
                {
                  key: 'msg.formula.columnWithTypeFoundButExpected',
                  columnName: name,
                  columnType: argPt.dataType,
                  expectedType: expectedArgType,
                },
                `Field ${name} with ${argPt.dataType} type is found but ${expectedArgType} type is expected`
              );
            } else {
              let key = '';
              const position = i + 1;
              let type = '';

              if (expectedArgType === FormulaDataTypes.NUMERIC) {
                key = 'msg.formula.typeIsExpected';
                type = 'numeric';
              } else if (expectedArgType === FormulaDataTypes.BOOLEAN) {
                key = 'msg.formula.typeIsExpected';
                type = 'boolean';
              } else if (expectedArgType === FormulaDataTypes.DATE) {
                key = 'msg.formula.typeIsExpected';
                type = 'date';
              }

              throw new FormulaError(
                FormulaErrorType.INVALID_ARG,
                {
                  type,
                  key,
                  position,
                  calleeName,
                },
                `${calleeName?.toUpperCase()} requires a ${
                  type || expectedArgType
                } at position ${position}`
              );
            }
          }

          // if expected type is string and arg type is not string, then cast it to string
          if (
            expectedArgType === FormulaDataTypes.STRING &&
            expectedArgType !== argPt.dataType
          ) {
            argPt.cast = FormulaDataTypes.STRING;
          }
        }
      }

      if (typeof formulas[calleeName].returnType === 'function') {
        res.dataType = (formulas[calleeName].returnType as any)?.(
          argTypes
        ) as FormulaDataTypes;
      } else if (formulas[calleeName].returnType) {
        res.dataType = formulas[calleeName].returnType as FormulaDataTypes;
      }

      Object.assign(
        res,
        extractCallExpressionReferencedInfo({
          parsedTree: res as CallExpressionNode,
        })
      );
    } else if (parsedTree.type === JSEPNode.IDENTIFIER) {
      const identifierName = (parsedTree as IdentifierNode).name;
      const col = (colIdToColMap[identifierName] ||
        colAliasToColMap[identifierName]) as Record<string, any>;

      if (!col) {
        if (formulas[identifierName]) {
          throw new FormulaError(
            FormulaErrorType.INVALID_SYNTAX,
            {
              key: 'msg.formula.formulaMissingParentheses',
              calleeName: identifierName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexEnd,
                      length: 1,
                    }
                  : undefined,
            },
            `Missing parentheses after function name "${JSON.stringify(
              identifierName
            )}"`
          );
        }
        throw new FormulaError(
          FormulaErrorType.INVALID_COLUMN,
          {
            key: 'msg.formula.columnNotAvailable',
            columnName: identifierName,
            position:
              (parsedTree as any).indexStart >= 0
                ? {
                    index: (parsedTree as any).indexStart,
                    length: (parsedTree as any).nodeLength,
                  }
                : undefined,
          },
          `Invalid column name/id ${JSON.stringify(identifierName)} in formula`
        );
      }

      (res as IdentifierNode).name = col.id;

      if (col?.uidt === UITypes.Formula) {
        if (column) {
          // check for circular reference when column is present(only available when calling root formula)
          await checkForCircularFormulaRef(
            column,
            parsedTree,
            columns,
            getMeta
          );
        }
        const formulaRes =
          (col.colOptions as FormulaType).parsed_tree ||
          (await validateFormulaAndExtractTreeWithType(
            // formula may include double curly brackets in previous version
            // convert to single curly bracket here for compatibility
            {
              formula: col.colOptions.formula
                .replaceAll('{{', '{')
                .replaceAll('}}', '}'),
              columns,
              clientOrSqlUi,
              getMeta,
            }
          ));

        res.dataType = (formulaRes as ParsedFormulaNode)?.dataType;
      } else {
        if (
          col?.uidt === UITypes.Lookup ||
          col?.uidt === UITypes.LinkToAnotherRecord
        ) {
          // check for circular reference when column is present(only available when calling root formula)
          if (column) {
            await checkForCircularFormulaRef(
              column,
              parsedTree,
              columns,
              getMeta
            );
          }
        }

        // extract type and add to res
        Object.assign(
          res,
          await extractColumnIdentifierType({
            col,
            columns,
            getMeta,
            clientOrSqlUi,
          })
        );
      }
    } else if (parsedTree.type === JSEPNode.LITERAL) {
      if (typeof parsedTree.value === 'number') {
        res.dataType = FormulaDataTypes.NUMERIC;
      } else if (typeof parsedTree.value === 'string') {
        res.dataType = FormulaDataTypes.STRING;
      } else if (typeof parsedTree.value === 'boolean') {
        res.dataType = FormulaDataTypes.BOOLEAN;
      } else {
        res.dataType = FormulaDataTypes.STRING;
      }
    } else if (parsedTree.type === JSEPNode.UNARY_EXP) {
      // only support -ve values
      if (
        ['-'].includes(parsedTree.operator) &&
        parsedTree.argument.type === JSEPNode.LITERAL &&
        typeof parsedTree.argument.value === 'number'
      ) {
        res.dataType = FormulaDataTypes.NUMERIC;
      } else {
        throw new FormulaError(
          FormulaErrorType.NOT_SUPPORTED,
          {},
          `Unary expression '${parsedTree.operator}' is not supported`
        );
      }
    } else if (parsedTree.type === JSEPNode.BINARY_EXP) {
      const argsLeft = await validateAndExtract(parsedTree.left);
      const argsRight = await validateAndExtract(parsedTree.right);
      (res as BinaryExpressionNode).left = argsLeft;
      (res as BinaryExpressionNode).right = argsRight;

      const dateAndTimeParsedNode = handleBinaryExpressionForDateAndTime({
        sourceBinaryNode: res as any,
      });
      if (dateAndTimeParsedNode) {
        Object.assign(
          res,
          handleBinaryExpressionForDateAndTime({ sourceBinaryNode: res as any })
        );
        if (res.type !== JSEPNode.BINARY_EXP) {
          (res as any).left = undefined;
          (res as any).right = undefined;
          (res as any).operator = undefined;
        }
      } else if (
        ['==', '<', '>', '<=', '>=', '!='].includes(parsedTree.operator)
      ) {
        res.dataType = FormulaDataTypes.COND_EXP;
      } else if (parsedTree.operator === '+') {
        res.dataType = FormulaDataTypes.NUMERIC;
        // if any side is string/date/other type, then the result will be concatenated string
        // e.g. 1 + '2' = '12'
        if (
          [
            (res as BinaryExpressionNode).left,
            (res as BinaryExpressionNode).right,
          ].some(
            (r) =>
              ![
                FormulaDataTypes.NUMERIC,
                FormulaDataTypes.BOOLEAN,
                FormulaDataTypes.NULL,
                FormulaDataTypes.UNKNOWN,
              ].includes(r.dataType)
          )
        ) {
          res.dataType = FormulaDataTypes.STRING;
        }
      } else if (['&'].includes(parsedTree.operator)) {
        res.dataType = FormulaDataTypes.STRING;
      } else {
        res.dataType = FormulaDataTypes.NUMERIC;
      }

      Object.assign(
        res,
        extractBinaryExpReferencedInfo({
          parsedTree: res as BinaryExpressionNode,
          left: argsLeft,
          right: argsRight,
        })
      );
    } else if (parsedTree.type === JSEPNode.MEMBER_EXP) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Bracket notation is not supported'
      );
    } else if (parsedTree.type === JSEPNode.ARRAY_EXP) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Array is not supported'
      );
    } else if (parsedTree.type === JSEPNode.COMPOUND) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Compound statement is not supported'
      );
    }
    return res;
  };

  try {
    // register jsep curly hook
    jsep.plugins.register(jsepCurlyHook);
    if (trackPosition) {
      jsep.plugins.register(jsepIndexHook);
    }
    const parsedFormula = jsep(formula);
    // TODO: better jsep expression handling
    const result = await validateAndExtract(
      parsedFormula as unknown as ParsedFormulaNode
    );
    return result;
  } catch (ex) {
    if (trackPosition) {
      handleFormulaError({ formula, error: ex });
    }
    throw ex;
  }
}
