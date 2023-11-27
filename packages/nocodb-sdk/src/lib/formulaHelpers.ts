import jsep from 'jsep';

import { ColumnType } from './Api';
import {UITypes} from "../../build/main";

export const jsepCurlyHook = {
  name: 'curly',
  init(jsep) {
    jsep.hooks.add('gobble-token', function gobbleCurlyLiteral(env) {
      const OCURLY_CODE = 123; // {
      const CCURLY_CODE = 125; // }
      let start = -1;
      const { context } = env;
      if (
        !jsep.isIdentifierStart(context.code) &&
        context.code === OCURLY_CODE
      ) {
        if (start == -1) {
          start = context.index;
        }
        context.index += 1;
        context.gobbleExpressions(CCURLY_CODE);
        if (context.code === CCURLY_CODE) {
          context.index += 1;
          env.node = {
            type: jsep.IDENTIFIER,
            name: /{{(.*?)}}/.test(context.expr)
              ? // start would be the position of the first curly bracket
                // add 2 to point to the first character for expressions like {{col1}}
                context.expr.slice(start + 2, context.index - 1)
              : // start would be the position of the first curly bracket
                // add 1 to point to the first character for expressions like {col1}
                context.expr.slice(start + 1, context.index - 1),
          };
          return env.node;
        } else {
          context.throwError('Unclosed }');
        }
      }
    });
  },
} as jsep.IPlugin;

export async function substituteColumnAliasWithIdInFormula(
  formula,
  columns: ColumnType[]
) {
  const substituteId = async (pt: any) => {
    if (pt.type === 'CallExpression') {
      for (const arg of pt.arguments || []) {
        await substituteId(arg);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt.name;
      const column = columns.find(
        (c) =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = '{' + column.id + '}';
    } else if (pt.type === 'BinaryExpression') {
      await substituteId(pt.left);
      await substituteId(pt.right);
    }
  };
  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const parsedFormula = jsep(formula);
  await substituteId(parsedFormula);
  return jsepTreeToFormula(parsedFormula);
}

export function substituteColumnIdWithAliasInFormula(
  formula,
  columns: ColumnType[],
  rawFormula?
) {
  const substituteId = (pt: any, ptRaw?: any) => {
    if (pt.type === 'CallExpression') {
      let i = 0;
      for (const arg of pt.arguments || []) {
        substituteId(arg, ptRaw?.arguments?.[i++]);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt?.name;
      const column = columns.find(
        (c) =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = column?.title || ptRaw?.name || pt?.name;
    } else if (pt.type === 'BinaryExpression') {
      substituteId(pt.left, ptRaw?.left);
      substituteId(pt.right, ptRaw?.right);
    }
  };

  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const parsedFormula = jsep(formula);
  const parsedRawFormula = rawFormula && jsep(rawFormula);
  substituteId(parsedFormula, parsedRawFormula);
  return jsepTreeToFormula(parsedFormula);
}

// isCallExpId - is the identifier part of a call expression
// in case of call expression, we don't want to wrap the identifier in curly brackets
export function jsepTreeToFormula(node, isCallExpId = false) {
  if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
    return (
      '(' +
      jsepTreeToFormula(node.left) +
      ' ' +
      node.operator +
      ' ' +
      jsepTreeToFormula(node.right) +
      ')'
    );
  }

  if (node.type === 'UnaryExpression') {
    return node.operator + jsepTreeToFormula(node.argument);
  }

  if (node.type === 'MemberExpression') {
    return (
      jsepTreeToFormula(node.object) +
      '[' +
      jsepTreeToFormula(node.property) +
      ']'
    );
  }

  if (node.type === 'Identifier') {
    if (!isCallExpId) return '{' + node.name + '}';
    return node.name;
  }

  if (node.type === 'Literal') {
    if (typeof node.value === 'string') {
      return String.raw`"${escapeLiteral(node.value)}"`;
    }
    return '' + node.value;
  }

  if (node.type === 'CallExpression') {
    return (
      jsepTreeToFormula(node.callee, true) +
      '(' +
      node.arguments.map(jsepTreeToFormula).join(', ') +
      ')'
    );
  }

  if (node.type === 'ArrayExpression') {
    return '[' + node.elements.map(jsepTreeToFormula).join(', ') + ']';
  }

  if (node.type === 'Compound') {
    return node.body.map((e) => jsepTreeToFormula(e)).join(' ');
  }

  if (node.type === 'ConditionalExpression') {
    return (
      jsepTreeToFormula(node.test) +
      ' ? ' +
      jsepTreeToFormula(node.consequent) +
      ' : ' +
      jsepTreeToFormula(node.alternate)
    );
  }

  return '';
}

function escapeLiteral(v: string) {
  return (
    v
      // replace \ to \\
      .replace(/\\/g, `\\\\`)
      // replace " to \"
      .replace(/"/g, `\\"`)
      // replace ' to \'
      .replace(/'/g, `\\'`)
  );
}




function validateAgainstMeta(parsedTree: any, errors = new Set(), typeErrors = new Set()) {
  let returnType: formulaTypes
  if (parsedTree.type === JSEPNode.CALL_EXP) {
    const calleeName = parsedTree.callee.name.toUpperCase()
    // validate function name
    if (!availableFunctions.includes(calleeName)) {
      errors.add(t('msg.formula.functionNotAvailable', { function: calleeName }))
    }
    // validate arguments
    const validation = formulas[calleeName] && formulas[calleeName].validation
    if (validation && validation.args) {
      if (validation.args.rqd !== undefined && validation.args.rqd !== parsedTree.arguments.length) {
        errors.add(t('msg.formula.requiredArgumentsFormula', { requiredArguments: validation.args.rqd, calleeName }))
      } else if (validation.args.min !== undefined && validation.args.min > parsedTree.arguments.length) {
        errors.add(
          t('msg.formula.minRequiredArgumentsFormula', {
            minRequiredArguments: validation.args.min,
            calleeName,
          }),
        )
      } else if (validation.args.max !== undefined && validation.args.max < parsedTree.arguments.length) {
        errors.add(
          t('msg.formula.maxRequiredArgumentsFormula', {
            maxRequiredArguments: validation.args.max,
            calleeName,
          }),
        )
      }
    }

    parsedTree.arguments.map((arg: Record<string, any>) => validateAgainstMeta(arg, errors))

    // get args type and validate
    const validateResult = parsedTree.arguments.map((arg) => {
      return validateAgainstMeta(arg, errors, typeErrors)
    })

    const argsTypes = validateResult.map((v: any) => v.returnType);

    if (typeof validateResult[0].returnType === 'function') {
      returnType = formulas[calleeName].returnType(argsTypes)
    } else if (validateResult[0]) {
      returnType = formulas[calleeName].returnType
    }

    // validate data type
    if (parsedTree.callee.type === JSEPNode.IDENTIFIER) {
      const expectedType = formulas[calleeName.toUpperCase()].type

      if (expectedType === formulaTypes.NUMERIC) {
        if (calleeName === 'WEEKDAY') {
          // parsedTree.arguments[0] = date
          validateAgainstType(
            parsedTree.arguments[0],
            formulaTypes.DATE,
            (v: any) => {
              if (!validateDateWithUnknownFormat(v)) {
                typeErrors.add(t('msg.formula.firstParamWeekDayHaveDate'))
              }
            },
            typeErrors,
          )
          // parsedTree.arguments[1] = startDayOfWeek (optional)
          validateAgainstType(
            parsedTree.arguments[1],
            formulaTypes.STRING,
            (v: any) => {
              if (
                typeof v !== 'string' ||
                !['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(v.toLowerCase())
              ) {
                typeErrors.add(t('msg.formula.secondParamWeekDayHaveDate'))
              }
            },
            typeErrors,
          )
        } else {
          parsedTree.arguments.map((arg: Record<string, any>) => validateAgainstType(arg, expectedType, null, typeErrors, argsTypes))
        }
      } else if (expectedType === formulaTypes.DATE) {
        if (calleeName === 'DATEADD') {
          // parsedTree.arguments[0] = date
          validateAgainstType(
            parsedTree.arguments[0],
            formulaTypes.DATE,
            (v: any) => {
              if (!validateDateWithUnknownFormat(v)) {
                typeErrors.add(t('msg.formula.firstParamDateAddHaveDate'))
              }
            },
            typeErrors,
          )
          // parsedTree.arguments[1] = numeric
          validateAgainstType(
            parsedTree.arguments[1],
            formulaTypes.NUMERIC,
            (v: any) => {
              if (typeof v !== 'number') {
                typeErrors.add(t('msg.formula.secondParamDateAddHaveNumber'))
              }
            },
            typeErrors,
          )
          // parsedTree.arguments[2] = ["day" | "week" | "month" | "year"]
          validateAgainstType(
            parsedTree.arguments[2],
            formulaTypes.STRING,
            (v: any) => {
              if (!['day', 'week', 'month', 'year'].includes(v)) {
                typeErrors.add(typeErrors.add(t('msg.formula.thirdParamDateAddHaveDate')))
              }
            },
            typeErrors,
          )
        } else if (calleeName === 'DATETIME_DIFF') {
          // parsedTree.arguments[0] = date
          validateAgainstType(
            parsedTree.arguments[0],
            formulaTypes.DATE,
            (v: any) => {
              if (!validateDateWithUnknownFormat(v)) {
                typeErrors.add(t('msg.formula.firstParamDateDiffHaveDate'))
              }
            },
            typeErrors,
          )
          // parsedTree.arguments[1] = date
          validateAgainstType(
            parsedTree.arguments[1],
            formulaTypes.DATE,
            (v: any) => {
              if (!validateDateWithUnknownFormat(v)) {
                typeErrors.add(t('msg.formula.secondParamDateDiffHaveDate'))
              }
            },
            typeErrors,
          )
          // parsedTree.arguments[2] = ["milliseconds" | "ms" | "seconds" | "s" | "minutes" | "m" | "hours" | "h" | "days" | "d" | "weeks" | "w" | "months" | "M" | "quarters" | "Q" | "years" | "y"]
          validateAgainstType(
            parsedTree.arguments[2],
            formulaTypes.STRING,
            (v: any) => {
              if (
                ![
                  'milliseconds',
                  'ms',
                  'seconds',
                  's',
                  'minutes',
                  'm',
                  'hours',
                  'h',
                  'days',
                  'd',
                  'weeks',
                  'w',
                  'months',
                  'M',
                  'quarters',
                  'Q',
                  'years',
                  'y',
                ].includes(v)
              ) {
                typeErrors.add(t('msg.formula.thirdParamDateDiffHaveDate'))
              }
            },
            typeErrors,
          )
        }
      }
    }

    errors = new Set([...errors, ...typeErrors])
  } else if (parsedTree.type === JSEPNode.IDENTIFIER) {
    if (supportedColumns.value.filter((c) => !column || column.value?.id !== c.id).every((c) => c.title !== parsedTree.name)) {
      errors.add(
        t('msg.formula.columnNotAvailable', {
          columnName: parsedTree.name,
        }),
      )
    }

    // check circular reference
    // e.g. formula1 -> formula2 -> formula1 should return circular reference error

    // get all formula columns excluding itself
    const formulaPaths = supportedColumns.value
      .filter((c) => c.id !== column.value?.id && c.uidt === UITypes.Formula)
      .reduce((res: Record<string, any>[], c: Record<string, any>) => {
        // in `formula`, get all the (unique) target neighbours
        // i.e. all column id (e.g. cl_xxxxxxxxxxxxxx) with formula type
        const neighbours = [
          ...new Set(
            (c.colOptions.formula.match(/cl_\w{14}/g) || []).filter(
              (colId: string) =>
                supportedColumns.value.filter((col: ColumnType) => col.id === colId && col.uidt === UITypes.Formula).length,
            ),
          ),
        ]
        if (neighbours.length > 0) {
          // e.g. formula column 1 -> [formula column 2, formula column3]
          res.push({ [c.id]: neighbours })
        }
        return res
      }, [])
    // include target formula column (i.e. the one to be saved if applicable)
    const targetFormulaCol = supportedColumns.value.find(
      (c: ColumnType) => c.title === parsedTree.name && c.uidt === UITypes.Formula,
    )

    if (targetFormulaCol && column.value?.id) {
      formulaPaths.push({
        [column.value?.id as string]: [targetFormulaCol.id],
      })
    }
    const vertices = formulaPaths.length
    if (vertices > 0) {
      // perform kahn's algo for cycle detection
      const adj = new Map()
      const inDegrees = new Map()
      // init adjacency list & indegree

      for (const [_, v] of Object.entries(formulaPaths)) {
        const src = Object.keys(v)[0]
        const neighbours = v[src]
        inDegrees.set(src, inDegrees.get(src) || 0)
        for (const neighbour of neighbours) {
          adj.set(src, (adj.get(src) || new Set()).add(neighbour))
          inDegrees.set(neighbour, (inDegrees.get(neighbour) || 0) + 1)
        }
      }
      const queue: string[] = []
      // put all vertices with in-degree = 0 (i.e. no incoming edges) to queue
      inDegrees.forEach((inDegree, col) => {
        if (inDegree === 0) {
          // in-degree = 0 means we start traversing from this node
          queue.push(col)
        }
      })
      // init count of visited vertices
      let visited = 0
      // BFS
      while (queue.length !== 0) {
        // remove a vertex from the queue
        const src = queue.shift()
        // if this node has neighbours, increase visited by 1
        const neighbours = adj.get(src) || new Set()
        if (neighbours.size > 0) {
          visited += 1
        }
        // iterate each neighbouring nodes
        neighbours.forEach((neighbour: string) => {
          // decrease in-degree of its neighbours by 1
          inDegrees.set(neighbour, inDegrees.get(neighbour) - 1)
          // if in-degree becomes 0
          if (inDegrees.get(neighbour) === 0) {
            // then put the neighboring node to the queue
            queue.push(neighbour)
          }
        })
      }
      // vertices not same as visited = cycle found
      if (vertices !== visited) {
        errors.add(t('msg.formula.cantSaveCircularReference'))
      }
    }
  } else if (parsedTree.type === JSEPNode.BINARY_EXP) {
    if (!availableBinOps.includes(parsedTree.operator)) {
      errors.add(t('msg.formula.operationNotAvailable', { operation: parsedTree.operator }))
    }
    validateAgainstMeta(parsedTree.left, errors)
    validateAgainstMeta(parsedTree.right, errors)

    // todo: type extraction for binary exps
    returnType = formulaTypes.NUMERIC
  } else if (parsedTree.type === JSEPNode.LITERAL || parsedTree.type === JSEPNode.UNARY_EXP) {
    if (parsedTree.type === JSEPNode.LITERAL) {
      if (typeof parsedTree.value === 'number') {
        returnType = formulaTypes.NUMERIC
      } else if (typeof parsedTree.value === 'string') {
        returnType = formulaTypes.STRING
      } else if (typeof parsedTree.value === 'boolean') {
        returnType = formulaTypes.BOOLEAN
      } else {
        returnType = formulaTypes.STRING
      }
    }
    // do nothing
  } else if (parsedTree.type === JSEPNode.COMPOUND) {
    if (parsedTree.body.length) {
      errors.add(t('msg.formula.cantSaveFieldFormulaInvalid'))
    }
  } else {
    errors.add(t('msg.formula.cantSaveFieldFormulaInvalid'))
  }
  return { errors, returnType }
}

function validateAgainstType(parsedTree: any, expectedType: string, func: any, typeErrors = new Set(), argTypes: formulaTypes = []) {
  let type
  if (parsedTree === false || typeof parsedTree === 'undefined') {
    return typeErrors
  }
  if (parsedTree.type === JSEPNode.LITERAL) {
    if (typeof func === 'function') {
      func(parsedTree.value)
    } else if (expectedType === formulaTypes.NUMERIC) {
      if (typeof parsedTree.value !== 'number') {
        typeErrors.add(t('msg.formula.numericTypeIsExpected'))
      } else {
        type = formulaTypes.NUMERIC
      }
    } else if (expectedType === formulaTypes.STRING) {
      if (typeof parsedTree.value !== 'string') {
        typeErrors.add(t('msg.formula.stringTypeIsExpected'))
      } else {
        type = formulaTypes.STRING
      }
    }
  } else if (parsedTree.type === JSEPNode.IDENTIFIER) {
    const col = supportedColumns.value.find((c) => c.title === parsedTree.name)

    if (col === undefined) {
      return
    }

    if (col.uidt === UITypes.Formula) {
      const foundType = getRootDataType(jsep(col.colOptions?.formula_raw))
      type = foundType
      if (foundType === 'N/A') {
        typeErrors.add(t('msg.formula.notSupportedToReferenceColumn', { columnName: col.title }))
      } else if (expectedType !== foundType) {
        typeErrors.add(
          t('msg.formula.typeIsExpectedButFound', {
            type: expectedType,
            found: foundType,
          }),
        )
      }
    } else {
      switch (col.uidt) {
        // string
        case UITypes.SingleLineText:
        case UITypes.LongText:
        case UITypes.MultiSelect:
        case UITypes.SingleSelect:
        case UITypes.PhoneNumber:
        case UITypes.Email:
        case UITypes.URL:
          if (expectedType !== formulaTypes.STRING) {
            typeErrors.add(
              t('msg.formula.columnWithTypeFoundButExpected', {
                columnName: parsedTree.name,
                columnType: formulaTypes.STRING,
                expectedType,
              }),
            )
          }
          type = formulaTypes.STRING
          break

        // numeric
        case UITypes.Year:
        case UITypes.Number:
        case UITypes.Decimal:
        case UITypes.Rating:
        case UITypes.Count:
        case UITypes.AutoNumber:
        case UITypes.Currency:
          if (expectedType !== formulaTypes.NUMERIC) {
            typeErrors.add(
              t('msg.formula.columnWithTypeFoundButExpected', {
                columnName: parsedTree.name,
                columnType: formulaTypes.NUMERIC,
                expectedType,
              }),
            )
          }
          type = formulaTypes.NUMERIC
          break

        // date
        case UITypes.Date:
        case UITypes.DateTime:
        case UITypes.CreateTime:
        case UITypes.LastModifiedTime:
          if (expectedType !== formulaTypes.DATE) {
            typeErrors.add(
              t('msg.formula.columnWithTypeFoundButExpected', {
                columnName: parsedTree.name,
                columnType: formulaTypes.DATE,
                expectedType,
              }),
            )
          }
          type = formulaTypes.DATE
          break

        // not supported
        case UITypes.ForeignKey:
        case UITypes.Attachment:
        case UITypes.ID:
        case UITypes.Time:
        case UITypes.Percent:
        case UITypes.Duration:
        case UITypes.Rollup:
        case UITypes.Lookup:
        case UITypes.Barcode:
        case UITypes.Button:
        case UITypes.Checkbox:
        case UITypes.Collaborator:
        case UITypes.QrCode:
        default:
          typeErrors.add(t('msg.formula.notSupportedToReferenceColumn', { columnName: parsedTree.name }))
          break
      }
    }
  } else if (parsedTree.type === JSEPNode.UNARY_EXP || parsedTree.type === JSEPNode.BINARY_EXP) {
    if (expectedType !== formulaTypes.NUMERIC) {
      // parsedTree.name won't be available here
      typeErrors.add(
        t('msg.formula.typeIsExpectedButFound', {
          type: formulaTypes.NUMERIC,
          found: expectedType,
        }),
      )
    }

    type = formulaTypes.NUMERIC
  } else if (parsedTree.type === JSEPNode.CALL_EXP) {
    const calleeName = parsedTree.callee.name.toUpperCase()
    if (formulas[calleeName]?.type && expectedType !== formulas[calleeName].type) {
      typeErrors.add(
        t('msg.formula.typeIsExpectedButFound', {
          type: expectedType,
          found: formulas[calleeName].type,
        }),
      )
    }
    // todo: derive type from returnType
    type = formulas[calleeName]?.type
  }
  return { type, typeErrors }
}

function getRootDataType(parsedTree: any): any {
  // given a parse tree, return the data type of it
  if (parsedTree.type === JSEPNode.CALL_EXP) {
    return formulas[parsedTree.callee.name.toUpperCase()].type
  } else if (parsedTree.type === JSEPNode.IDENTIFIER) {
    const col = supportedColumns.value.find((c) => c.title === parsedTree.name) as Record<string, any>
    if (col?.uidt === UITypes.Formula) {
      return getRootDataType(jsep(col?.formula_raw))
    } else {
      switch (col?.uidt) {
        // string
        case UITypes.SingleLineText:
        case UITypes.LongText:
        case UITypes.MultiSelect:
        case UITypes.SingleSelect:
        case UITypes.PhoneNumber:
        case UITypes.Email:
        case UITypes.URL:
          return formulaTypes.STRING

        // numeric
        case UITypes.Year:
        case UITypes.Number:
        case UITypes.Decimal:
        case UITypes.Rating:
        case UITypes.Count:
        case UITypes.AutoNumber:
          return formulaTypes.NUMERIC

        // date
        case UITypes.Date:
        case UITypes.DateTime:
        case UITypes.CreateTime:
        case UITypes.LastModifiedTime:
          return formulaTypes.DATE

        // not supported
        case UITypes.ForeignKey:
        case UITypes.Attachment:
        case UITypes.ID:
        case UITypes.Time:
        case UITypes.Currency:
        case UITypes.Percent:
        case UITypes.Duration:
        case UITypes.Rollup:
        case UITypes.Lookup:
        case UITypes.Barcode:
        case UITypes.Button:
        case UITypes.Checkbox:
        case UITypes.Collaborator:
        case UITypes.QrCode:
        default:
          return 'N/A'
      }
    }
  } else if (parsedTree.type === JSEPNode.BINARY_EXP || parsedTree.type === JSEPNode.UNARY_EXP) {
    return formulaTypes.NUMERIC
  } else if (parsedTree.type === JSEPNode.LITERAL) {
    return typeof parsedTree.value
  } else {
    return 'N/A'
  }
}

function isCurlyBracketBalanced() {
  // count number of opening curly brackets and closing curly brackets
  const cntCurlyBrackets = (formulaRef.value.$el.value.match(/\{|}/g) || []).reduce(
    (acc: Record<number, number>, cur: number) => {
      acc[cur] = (acc[cur] || 0) + 1
      return acc
    },
    {},
  )
  return (cntCurlyBrackets['{'] || 0) === (cntCurlyBrackets['}'] || 0)
}


