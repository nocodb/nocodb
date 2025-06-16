import type { IPosition, Range } from 'monaco-editor'
import { MarkerSeverity, editor } from 'monaco-editor'
import type { ColumnType, SqlUiFactory } from 'nocodb-sdk'
import { FormulaDataTypes, JSEPNode, formulas, validateFormulaAndExtractTreeWithType } from 'nocodb-sdk'

interface ValidationOptions {
  columns: ColumnType[]
  columnId?: string
  dbType: ReturnType<SqlUiFactory.create>
  getMeta: (tableId: string) => Promise<{ id: string; columns: ColumnType[] }>
}

interface TypeError {
  message: string
  severity: MarkerSeverity
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

const dataTypeLabels = {
  [FormulaDataTypes.NUMERIC]: 'Number',
  [FormulaDataTypes.STRING]: 'Text',
  [FormulaDataTypes.DATE]: 'Date',
  [FormulaDataTypes.LOGICAL]: 'Boolean',
  [FormulaDataTypes.BOOLEAN]: 'Boolean',
  [FormulaDataTypes.COND_EXP]: 'Condition',
  [FormulaDataTypes.NULL]: 'Empty',
  [FormulaDataTypes.INTERVAL]: 'Time',
  [FormulaDataTypes.UNKNOWN]: 'Unknown',
}

/**
 * Formula type validator that integrates with Monaco Editor
 */
export class FormulaTypeValidator {
  private editor: editor.IStandaloneCodeEditor
  private readonly columns: ColumnInfo[]
  private readonly columnId?: string
  private readonly dbType: ClientOrSqlUi
  private readonly markerId: string
  private debounceTimer: NodeJS.Timeout | null = null
  private debounceDelay = 300 // ms
  private readonly getMeta: (tableId: string) => Promise<{ id: string; columns: ColumnInfo[] }>

  constructor(editor: editor.IStandaloneCodeEditor, options: ValidationOptions) {
    this.editor = editor
    this.columns = options.columns
    this.columnId = options.columnId
    this.dbType = options.dbType
    this.markerId = 'formula-validation'
    this.getMeta = options.getMeta

    this.editor.onDidChangeModelContent(() => {
      this.scheduleValidation()
    })

    this.validateFormula()
  }

  /**
   * Schedule a validation after a delay to avoid excessive validation during typing
   */
  private scheduleValidation(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.validateFormula()
      this.debounceTimer = null
    }, this.debounceDelay)
  }

  /**
   * Validate the current formula in the editor
   */
  public async validateFormula(): Promise<void> {
    const model = this.editor.getModel()
    if (!model) return

    const formula = model.getValue()
    const errors: TypeError[] = []

    try {
      const result = await validateFormulaAndExtractTreeWithType({
        formula,
        columns: this.columns,
        clientOrSqlUi: this.dbType,
        column: this.columnId ? this.columns.find((c) => c.id === this.columnId) : undefined,
        getMeta: this.getMeta,
      })

      this.analyzeTypeWarnings(result, errors)
    } catch (err) {
      if (err.type) {
        this.handleFormulaError(err, formula, errors)
      } else {
        errors.push({
          message: `Formula error: ${err.message}`,
          severity: MarkerSeverity.Error,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: formula.length + 1,
        })
      }
    }
    // Update the error markers in the editor
    editor.setModelMarkers(model, this.markerId, errors)
  }

  /**
   * Find the position in the formula text for the given node
   */
  private findNodePosition(node: any, formula: string): Range {
    const startPos: IPosition = { lineNumber: 1, column: 1 }
    const endPos: IPosition = { lineNumber: 1, column: formula.length + 1 }

    // For future improvement: implement more precise node location
    // This requires tracking node positions during parsing

    return {
      startLineNumber: startPos.lineNumber,
      startColumn: startPos.column,
      endLineNumber: endPos.lineNumber,
      endColumn: endPos.column,
    }
  }

  /**
   * Handle specific FormulaError types and create appropriate error markers
   */
  private handleFormulaError(err: any, formula: string, errors: TypeError[]): void {
    const { type, extra } = err
    let message = err.message
    const range = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: formula.length + 1,
    }

    // Different error types require different handling
    switch (type) {
      case 'INVALID_COLUMN':
        // Find the invalid column reference
        if (extra.columnName) {
          const colRefPattern = new RegExp(`\\{${extra.columnName}\\}`)
          const match = colRefPattern.exec(formula)
          if (match) {
            range.startColumn = match.index + 1
            range.endColumn = match.index + match[0].length + 1
          }
        }
        message = `Column '${extra.columnName}' not found`
        break

      case 'CIRCULAR_REFERENCE':
        message = 'Circular reference detected in formula'
        break

      case 'TYPE_MISMATCH':
        message = extra.key.includes('columnWithTypeFoundButExpected')
          ? `Column '${extra.columnName}' has type ${dataTypeLabels[extra.columnType]}, but ${
              dataTypeLabels[extra.expectedType]
            } is required`
          : err.message
        break

      case 'INVALID_FUNCTION_NAME': {
        // Locate the function name
        const funcMatch = /\b([A-Z][A-Z0-9_]*)\s*\(/i.exec(formula)
        if (funcMatch) {
          range.startColumn = funcMatch.index + 1
          range.endColumn = funcMatch.index + funcMatch[1].length + 1
        }
        message = `Unknown function: ${funcMatch?.[1]}`
        break
      }

      case 'INVALID_ARG':
      case 'MIN_ARG':
      case 'MAX_ARG':
        if (extra.calleeName) {
          // Locate the function call
          const funcMatch = new RegExp(`\\b${extra.calleeName}\\s*\\(`).exec(formula)
          if (funcMatch) {
            // Highlight the whole function call
            const openParenIndex = formula.indexOf('(', funcMatch.index)
            const closeParenIndex = this.findMatchingCloseParen(formula, openParenIndex)
            range.startColumn = funcMatch.index + 1
            range.endColumn = closeParenIndex + 2 // +2 because column is 1-based
          }
        }
        break
    }

    errors.push({
      message,
      severity: MarkerSeverity.Error,
      ...range,
    })
  }

  /**
   * Comprehensive analysis of parse tree for all possible type warnings
   */
  private analyzeTypeWarnings(node: any, errors: TypeError[], formula: string): void {
    if (!node || !er) return

    // Find the position of this node in the formula
    const nodePosition = this.findNodePosition(node, formula)

    // Check common issues for all nodes with data types
    if (node.dataType === FormulaDataTypes.UNKNOWN) {
      errors.push({
        message: `Unable to determine the type of this expression`,
        severity: MarkerSeverity.Warning,
        ...nodePosition,
      })
    }

    // Process based on node type
    switch (node.type) {
      case JSEPNode.BINARY_EXP:
        this.analyzeBinaryExpression(node, errors, formula, nodePosition)
        break

      case JSEPNode.CALL_EXP:
        this.analyzeCallExpression(node, errors, formula, nodePosition)
        break

      case JSEPNode.IDENTIFIER:
        this.analyzeIdentifier(node, errors, nodePosition)
        break

      case JSEPNode.LITERAL:
        this.analyzeLiteral(node, errors, nodePosition)
        break

      case JSEPNode.UNARY_EXP:
        this.analyzeUnaryExpression(node, errors, formula, nodePosition)
        break

      case JSEPNode.MEMBER_EXP:
      case JSEPNode.ARRAY_EXP:
      case JSEPNode.COMPOUND:
        // These are handled by the validator as unsupported
        // but just in case they get through, add a warning
        errors.push({
          message: `Unsupported expression type: ${node.type}`,
          severity: MarkerSeverity.Error,
          ...nodePosition,
        })
        break
    }
  }

  /**
   * Analyze binary expressions (e.g., a + b, x > y)
   */
  private analyzeBinaryExpression(node: any, errors: TypeError[], formula: string, nodePosition: any): void {
    const leftType = node.left?.dataType
    const rightType = node.right?.dataType

    // Skip if types are unknown or null
    if (
      !leftType ||
      !rightType ||
      leftType === FormulaDataTypes.UNKNOWN ||
      rightType === FormulaDataTypes.UNKNOWN ||
      leftType === FormulaDataTypes.NULL ||
      rightType === FormulaDataTypes.NULL
    ) {
      // Continue to analyze child nodes
      this.analyzeTypeWarnings(node.left, errors, formula)
      this.analyzeTypeWarnings(node.right, errors, formula)
      return
    }

    // Check for type incompatibilities based on operator
    switch (node.operator) {
      // Arithmetic operators
      case '+':
        if (leftType === FormulaDataTypes.STRING || rightType === FormulaDataTypes.STRING) {
          if (leftType !== rightType) {
            errors.push({
              message: `Mixed types in addition: ${dataTypeLabels[leftType]} + ${dataTypeLabels[rightType]} will be converted to Text`,
              severity: MarkerSeverity.Info,
              ...nodePosition,
            })
          }
        } else if (leftType === FormulaDataTypes.DATE && rightType === FormulaDataTypes.INTERVAL) {
          // Valid date + interval
        } else if (leftType === FormulaDataTypes.INTERVAL && rightType === FormulaDataTypes.DATE) {
          // Valid interval + date
        } else if (leftType === FormulaDataTypes.DATE && rightType === FormulaDataTypes.DATE) {
          errors.push({
            message: `Adding two dates is not valid. Use DATETIME_DIFF for date calculations.`,
            severity: MarkerSeverity.Warning,
            ...nodePosition,
          })
        } else if (leftType !== rightType) {
          errors.push({
            message: `Mixed types in addition: ${dataTypeLabels[leftType]} + ${dataTypeLabels[rightType]} may give unexpected results`,
            severity: MarkerSeverity.Warning,
            ...nodePosition,
          })
        }
        break

      case '-':
        if (leftType === FormulaDataTypes.STRING || rightType === FormulaDataTypes.STRING) {
          errors.push({
            message: `Cannot subtract with Text type`,
            severity: MarkerSeverity.Error,
            ...nodePosition,
          })
        } else if (leftType === FormulaDataTypes.DATE && rightType === FormulaDataTypes.DATE) {
          // Valid date - date (returns interval)
        } else if (leftType === FormulaDataTypes.DATE && rightType === FormulaDataTypes.INTERVAL) {
          // Valid date - interval
        } else if (
          leftType !== rightType &&
          !(leftType === FormulaDataTypes.NUMERIC && rightType === FormulaDataTypes.BOOLEAN) &&
          !(leftType === FormulaDataTypes.BOOLEAN && rightType === FormulaDataTypes.NUMERIC)
        ) {
          errors.push({
            message: `Mixed types in subtraction: ${dataTypeLabels[leftType]} - ${dataTypeLabels[rightType]} may give unexpected results`,
            severity: MarkerSeverity.Warning,
            ...nodePosition,
          })
        }
        break

      case '*':
      case '/':
        if (leftType !== FormulaDataTypes.NUMERIC || rightType !== FormulaDataTypes.NUMERIC) {
          // Special case for boolean which can be treated as 0/1
          if (
            (leftType === FormulaDataTypes.BOOLEAN || rightType === FormulaDataTypes.BOOLEAN) &&
            (leftType === FormulaDataTypes.NUMERIC || rightType === FormulaDataTypes.NUMERIC)
          ) {
            errors.push({
              message: `Boolean values in multiplication/division will be treated as 0 or 1`,
              severity: MarkerSeverity.Info,
              ...nodePosition,
            })
          } else {
            errors.push({
              message: `${node.operator === '*' ? 'Multiplication' : 'Division'} requires numeric values, but got ${
                dataTypeLabels[leftType]
              } and ${dataTypeLabels[rightType]}`,
              severity: MarkerSeverity.Error,
              ...nodePosition,
            })
          }
        }

        // Division by zero warning (for literals)
        if (node.operator === '/' && node.right.type === JSEPNode.LITERAL && node.right.value === 0) {
          errors.push({
            message: `Division by zero will result in an error`,
            severity: MarkerSeverity.Error,
            ...nodePosition,
          })
        }
        break

      // Comparison operators
      case '==':
      case '=':
      case '<':
      case '>':
      case '<=':
      case '>=':
      case '!=':
        // Different types can be compared, but might give unexpected results
        if (
          leftType !== rightType &&
          !(leftType === FormulaDataTypes.NUMERIC && rightType === FormulaDataTypes.BOOLEAN) &&
          !(leftType === FormulaDataTypes.BOOLEAN && rightType === FormulaDataTypes.NUMERIC)
        ) {
          errors.push({
            message: `Comparing different types: ${dataTypeLabels[leftType]} and ${dataTypeLabels[rightType]} may give unexpected results`,
            severity: MarkerSeverity.Warning,
            ...nodePosition,
          })
        }

        // Special case for date comparisons with specific operators
        if (
          (leftType === FormulaDataTypes.DATE || rightType === FormulaDataTypes.DATE) &&
          ['==', '=', '!='].includes(node.operator)
        ) {
          errors.push({
            message: `Exact date equality checks may be unreliable. Consider using date range comparisons.`,
            severity: MarkerSeverity.Info,
            ...nodePosition,
          })
        }
        break

      // String concatenation
      case '&':
        // This is usually fine with any types, as they'll be converted to strings
        if (leftType === FormulaDataTypes.NULL || rightType === FormulaDataTypes.NULL) {
          errors.push({
            message: `Concatenating with a NULL value will result in NULL`,
            severity: MarkerSeverity.Info,
            ...nodePosition,
          })
        }
        break

      // Handle other operators
      default:
        if (leftType !== rightType) {
          errors.push({
            message: `Mixed types with operator '${node.operator}': ${dataTypeLabels[leftType]} and ${dataTypeLabels[rightType]}`,
            severity: MarkerSeverity.Warning,
            ...nodePosition,
          })
        }
    }

    // Recurse into child nodes
    this.analyzeTypeWarnings(node.left, errors, formula)
    this.analyzeTypeWarnings(node.right, errors, formula)
  }

  /**
   * Analyze function calls with comprehensive checks for all formula functions
   */
  private analyzeCallExpression(node: any, errors: TypeError[], formula: string, nodePosition: any): void {
    const functionName = node.callee?.name?.toUpperCase()

    if (!functionName) {
      errors.push({
        message: `Invalid function call`,
        severity: MarkerSeverity.Error,
        ...nodePosition,
      })
      return
    }

    if (!formulas[functionName]) {
      // This should be caught by the main validator, but just in case
      errors.push({
        message: `Unknown function: ${functionName}`,
        severity: MarkerSeverity.Error,
        ...nodePosition,
      })
      return
    }

    const expectedTypes = this.getExpectedArgumentTypes(functionName)
    const argCount = node.arguments?.length || 0
    const formula_info = formulas[functionName]

    // Check argument count
    const minArgs = formula_info.validation?.args?.min || 0
    const maxArgs = formula_info.validation?.args?.max
    const requiredArgs = formula_info.validation?.args?.rqd

    if (requiredArgs !== undefined && argCount !== requiredArgs) {
      errors.push({
        message: `${functionName} requires exactly ${requiredArgs} argument${requiredArgs !== 1 ? 's' : ''}`,
        severity: MarkerSeverity.Error,
        ...nodePosition,
      })
    } else if (minArgs > argCount) {
      errors.push({
        message: `${functionName} requires at least ${minArgs} argument${minArgs !== 1 ? 's' : ''}`,
        severity: MarkerSeverity.Error,
        ...nodePosition,
      })
    } else if (maxArgs !== undefined && maxArgs < argCount) {
      errors.push({
        message: `${functionName} accepts at most ${maxArgs} argument${maxArgs !== 1 ? 's' : ''}`,
        severity: MarkerSeverity.Error,
        ...nodePosition,
      })
    }

    // Check function-specific issues
    switch (functionName) {
      // === Control flow functions ===
      case 'IF':
        // Check if first argument is a condition
        if (
          node.arguments[0] &&
          node.arguments[0].dataType !== FormulaDataTypes.COND_EXP &&
          node.arguments[0].dataType !== FormulaDataTypes.BOOLEAN &&
          node.arguments[0].dataType !== FormulaDataTypes.NUMERIC
        ) {
          errors.push({
            message: `First argument of IF should be a condition, but got ${dataTypeLabels[node.arguments[0].dataType]}`,
            severity: MarkerSeverity.Warning,
            ...this.findNodePosition(node.arguments[0], formula),
          })
        }

        // Check return branches consistency
        if (argCount >= 3 && node.arguments[1] && node.arguments[2]) {
          const trueType = node.arguments[1].dataType
          const falseType = node.arguments[2].dataType

          if (
            trueType !== falseType &&
            trueType !== FormulaDataTypes.NULL &&
            falseType !== FormulaDataTypes.NULL &&
            trueType !== FormulaDataTypes.UNKNOWN &&
            falseType !== FormulaDataTypes.UNKNOWN
          ) {
            errors.push({
              message: `IF branches return different types: ${dataTypeLabels[trueType]} and ${dataTypeLabels[falseType]}`,
              severity: MarkerSeverity.Info,
              ...nodePosition,
            })
          }
        }
        break

      case 'SWITCH': {
        // Check that values (index 1, 3, 5, etc.) have consistent types
        const valueTypes = new Set()
        for (let i = 1; i < node.arguments.length; i += 2) {
          if (
            node.arguments[i] &&
            node.arguments[i].dataType !== FormulaDataTypes.NULL &&
            node.arguments[i].dataType !== FormulaDataTypes.UNKNOWN
          ) {
            valueTypes.add(node.arguments[i].dataType)
          }
        }

        // Last argument is default (if odd number of arguments)
        if (node.arguments.length % 2 === 0 && node.arguments[node.arguments.length - 1]) {
          const defaultType = node.arguments[node.arguments.length - 1].dataType
          if (defaultType !== FormulaDataTypes.NULL && defaultType !== FormulaDataTypes.UNKNOWN) {
            valueTypes.add(defaultType)
          }
        }

        if (valueTypes.size > 1) {
          errors.push({
            message: `SWITCH branches return multiple types: ${Array.from(valueTypes)
              .map((t) => dataTypeLabels[t])
              .join(', ')}`,
            severity: MarkerSeverity.Info,
            ...nodePosition,
          })
        }
        break
      }

      // === String functions ===
      case 'CONCAT':
        // Check for NULL values that would result in NULL output
        for (const arg of node.arguments) {
          if (arg.dataType === FormulaDataTypes.NULL) {
            errors.push({
              message: `CONCAT with NULL values will result in NULL`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(arg, formula),
            })
            break
          }
        }
        break

      case 'LEN':
        if (node.arguments[0]?.dataType === FormulaDataTypes.NULL) {
          errors.push({
            message: `LEN() with NULL input will return NULL`,
            severity: MarkerSeverity.Info,
            ...this.findNodePosition(node.arguments[0], formula),
          })
        }
        break

      case 'LEFT':
      case 'RIGHT':
      case 'MID':
      case 'SUBSTR':
        // Check if second argument (count/position) is non-negative
        if (node.arguments[1]?.type === JSEPNode.LITERAL && typeof node.arguments[1].value === 'number') {
          const posValue = node.arguments[1].value
          if (posValue < 0) {
            errors.push({
              message: `Position/length parameter cannot be negative`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          }
        }

        // For MID/SUBSTR - check third param if present
        if (
          (functionName === 'MID' || functionName === 'SUBSTR') &&
          node.arguments[2]?.type === JSEPNode.LITERAL &&
          typeof node.arguments[2].value === 'number'
        ) {
          const lengthValue = node.arguments[2].value
          if (lengthValue <= 0) {
            errors.push({
              message: `Length parameter must be positive`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[2], formula),
            })
          }
        }
        break

      case 'SEARCH':
        // Check for empty search string
        if (node.arguments[1]?.type === JSEPNode.LITERAL && node.arguments[1].value === '') {
          errors.push({
            message: `Search string cannot be empty`,
            severity: MarkerSeverity.Warning,
            ...this.findNodePosition(node.arguments[1], formula),
          })
        }
        break

      case 'REPLACE':
        // Check replace with empty string (not an error, but worth noting)
        if (node.arguments[2]?.type === JSEPNode.LITERAL && node.arguments[2].value === '') {
          errors.push({
            message: `Replacing with empty string will remove all occurrences of the search string`,
            severity: MarkerSeverity.Info,
            ...this.findNodePosition(node.arguments[2], formula),
          })
        }
        break

      case 'REPEAT':
        // Check for reasonable repeat count
        if (node.arguments[1]?.type === JSEPNode.LITERAL && typeof node.arguments[1].value === 'number') {
          const count = node.arguments[1].value
          if (count < 0) {
            errors.push({
              message: `REPEAT count cannot be negative`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          } else if (count > 1000) {
            errors.push({
              message: `Very large REPEAT count may cause performance issues`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          }
        }
        break

      case 'TRIM':
      case 'UPPER':
      case 'LOWER':
        // These are generally safe, but check for NULL
        if (node.arguments[0]?.dataType === FormulaDataTypes.NULL) {
          errors.push({
            message: `${functionName} with NULL input will return NULL`,
            severity: MarkerSeverity.Info,
            ...this.findNodePosition(node.arguments[0], formula),
          })
        }
        break

      case 'URL':
        // Check if URL is valid (simple check)
        if (node.arguments[0]?.type === JSEPNode.LITERAL && typeof node.arguments[0].value === 'string') {
          const urlStr = node.arguments[0].value
          if (!urlStr.match(/^https?:\/\//i)) {
            errors.push({
              message: `URL should start with http:// or https://`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(node.arguments[0], formula),
            })
          }
        }
        break

      case 'REGEX_MATCH':
      case 'REGEX_EXTRACT':
      case 'REGEX_REPLACE':
        // Check for valid regex pattern
        if (node.arguments[1]?.type === JSEPNode.LITERAL && typeof node.arguments[1].value === 'string') {
          const pattern = node.arguments[1].value
          try {
            // Test if it's a valid regex
            // eslint-disable-next-line no-new
            new RegExp(pattern)
          } catch (e) {
            errors.push({
              message: `Invalid regular expression: ${e.message}`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          }
        }
        break

      // === Numeric functions ===
      case 'ROUND':
      case 'ROUNDUP':
      case 'ROUNDDOWN':
        // Check second parameter is valid precision
        if (node.arguments[1] && node.arguments[1].type === JSEPNode.LITERAL) {
          const precision = node.arguments[1].value
          if (typeof precision === 'number' && (precision < 0 || precision > 20 || !Number.isInteger(precision))) {
            errors.push({
              message: `Rounding precision should be a non-negative integer (0-20)`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          }
        }
        break

      case 'MOD':
        // Check for division by zero
        if (node.arguments[1]?.type === JSEPNode.LITERAL && node.arguments[1].value === 0) {
          errors.push({
            message: `MOD by zero will result in an error`,
            severity: MarkerSeverity.Error,
            ...this.findNodePosition(node.arguments[1], formula),
          })
        }
        break

      case 'LOG':
        // Check for invalid log base
        if (node.arguments[0]?.type === JSEPNode.LITERAL && typeof node.arguments[0].value === 'number') {
          const base = node.arguments[0].value
          if (base <= 0 || base === 1) {
            errors.push({
              message: `Logarithm base must be positive and not equal to 1`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[0], formula),
            })
          }
        }

        // Check for negative value
        if (node.arguments[1]?.type === JSEPNode.LITERAL && typeof node.arguments[1].value === 'number') {
          const value = node.arguments[1].value
          if (value <= 0) {
            errors.push({
              message: `Cannot take logarithm of non-positive number`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          }
        }
        break

      case 'POWER':
        // Check for special cases
        if (node.arguments[0]?.type === JSEPNode.LITERAL && node.arguments[1]?.type === JSEPNode.LITERAL) {
          const base = node.arguments[0].value
          const exp = node.arguments[1].value

          if (base === 0 && exp < 0) {
            errors.push({
              message: `Cannot raise zero to a negative power`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node, formula),
            })
          }
        }
        break

      case 'SQRT':
        // Check for negative value
        if (node.arguments[0]?.type === JSEPNode.LITERAL && typeof node.arguments[0].value === 'number') {
          const value = node.arguments[0].value
          if (value < 0) {
            errors.push({
              message: `Cannot take square root of negative number`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[0], formula),
            })
          }
        }
        break

      case 'AVG':
      case 'MIN':
      case 'MAX':
      case 'COUNT':
      case 'COUNTA':
      case 'COUNTALL':
        // These functions need at least one argument
        if (argCount === 0) {
          errors.push({
            message: `${functionName} requires at least one argument`,
            severity: MarkerSeverity.Error,
            ...nodePosition,
          })
        }

        // Check for appropriate numeric values for aggregation functions
        if (functionName === 'AVG') {
          for (const arg of node.arguments) {
            if (
              arg.dataType !== FormulaDataTypes.NUMERIC &&
              arg.dataType !== FormulaDataTypes.NULL &&
              arg.dataType !== FormulaDataTypes.UNKNOWN
            ) {
              errors.push({
                message: `AVG requires numeric arguments, found ${dataTypeLabels[arg.dataType]}`,
                severity: MarkerSeverity.Warning,
                ...this.findNodePosition(arg, formula),
              })
            }
          }
        }
        break

      case 'ADD':
        // Similar to AVG, all arguments should be numeric
        for (const arg of node.arguments) {
          if (
            arg.dataType !== FormulaDataTypes.NUMERIC &&
            arg.dataType !== FormulaDataTypes.NULL &&
            arg.dataType !== FormulaDataTypes.UNKNOWN
          ) {
            errors.push({
              message: `ADD requires numeric arguments, found ${dataTypeLabels[arg.dataType]}`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(arg, formula),
            })
          }
        }
        break

      // === Date and time functions ===
      case 'DATEADD':
        // Check for valid interval units in the third argument
        if (node.arguments[2] && node.arguments[2].type === JSEPNode.LITERAL) {
          const unit = node.arguments[2].value
          if (typeof unit === 'string' && !['day', 'week', 'month', 'year'].includes(unit)) {
            errors.push({
              message: `Invalid time unit: "${unit}". Use "day", "week", "month", or "year".`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[2], formula),
            })
          }
        }

        // Check if first argument is a date
        if (
          node.arguments[0] &&
          node.arguments[0].dataType !== FormulaDataTypes.DATE &&
          node.arguments[0].dataType !== FormulaDataTypes.NULL &&
          node.arguments[0].dataType !== FormulaDataTypes.UNKNOWN
        ) {
          errors.push({
            message: `First argument of DATEADD should be a Date`,
            severity: MarkerSeverity.Warning,
            ...this.findNodePosition(node.arguments[0], formula),
          })
        }

        // Check if second argument is numeric
        if (
          node.arguments[1] &&
          node.arguments[1].dataType !== FormulaDataTypes.NUMERIC &&
          node.arguments[1].dataType !== FormulaDataTypes.NULL &&
          node.arguments[1].dataType !== FormulaDataTypes.UNKNOWN
        ) {
          errors.push({
            message: `Second argument of DATEADD should be a Number`,
            severity: MarkerSeverity.Warning,
            ...this.findNodePosition(node.arguments[1], formula),
          })
        }
        break

      case 'DATETIME_DIFF':
        // Check for valid interval units in the third argument
        if (node.arguments[2] && node.arguments[2].type === JSEPNode.LITERAL) {
          const unit = node.arguments[2].value
          if (
            typeof unit === 'string' &&
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
            ].includes(unit)
          ) {
            errors.push({
              message: `Invalid time unit: "${unit}".`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[2], formula),
            })
          }
        }

        // Check if first and second arguments are dates
        for (let i = 0; i < 2; i++) {
          if (
            node.arguments[i] &&
            node.arguments[i].dataType !== FormulaDataTypes.DATE &&
            node.arguments[i].dataType !== FormulaDataTypes.NULL &&
            node.arguments[i].dataType !== FormulaDataTypes.UNKNOWN
          ) {
            errors.push({
              message: `Argument ${i + 1} of DATETIME_DIFF should be a Date`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(node.arguments[i], formula),
            })
          }
        }
        break

      case 'DATESTR':
      case 'DAY':
      case 'MONTH':
      case 'YEAR':
      case 'HOUR':
        // Check if argument is a date
        if (
          node.arguments[0] &&
          node.arguments[0].dataType !== FormulaDataTypes.DATE &&
          node.arguments[0].dataType !== FormulaDataTypes.NULL &&
          node.arguments[0].dataType !== FormulaDataTypes.UNKNOWN
        ) {
          errors.push({
            message: `${functionName} requires a Date input`,
            severity: MarkerSeverity.Warning,
            ...this.findNodePosition(node.arguments[0], formula),
          })
        }
        break

      case 'WEEKDAY':
        // Check if first argument is a date
        if (
          node.arguments[0] &&
          node.arguments[0].dataType !== FormulaDataTypes.DATE &&
          node.arguments[0].dataType !== FormulaDataTypes.NULL &&
          node.arguments[0].dataType !== FormulaDataTypes.UNKNOWN
        ) {
          errors.push({
            message: `First argument of WEEKDAY should be a Date`,
            severity: MarkerSeverity.Warning,
            ...this.findNodePosition(node.arguments[0], formula),
          })
        }

        // Check if second argument is a valid start day
        if (node.arguments[1] && node.arguments[1].type === JSEPNode.LITERAL) {
          const startDay = node.arguments[1].value
          if (
            typeof startDay === 'string' &&
            !['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(startDay.toLowerCase())
          ) {
            errors.push({
              message: `Invalid start day: "${startDay}". Use a day name like "monday"`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          }
        }
        break

      case 'NOW':
        // NOW takes no arguments, but it's caught by argument count check
        break

      // === Logical functions ===
      case 'AND':
      case 'OR':
      case 'XOR':
        // Check that arguments can be interpreted as boolean
        for (const arg of node.arguments) {
          if (
            arg.dataType !== FormulaDataTypes.BOOLEAN &&
            arg.dataType !== FormulaDataTypes.COND_EXP &&
            arg.dataType !== FormulaDataTypes.NUMERIC &&
            arg.dataType !== FormulaDataTypes.NULL &&
            arg.dataType !== FormulaDataTypes.UNKNOWN
          ) {
            errors.push({
              message: `${functionName} expects boolean values or conditions`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(arg, formula),
            })
          }
        }
        break

      case 'TRUE':
      case 'FALSE':
      case 'BLANK':
        // These functions take no arguments, but it's caught by argument count check
        break

      // === Type checking functions ===
      case 'ISBLANK':
      case 'ISNOTBLANK':
        // These functions accept any argument type, so no specific checks needed
        break

      // === Special functions ===
      case 'VALUE':
        // Check if string can be converted to a number
        if (node.arguments[0]?.type === JSEPNode.LITERAL && typeof node.arguments[0].value === 'string') {
          const strValue = node.arguments[0].value
          // Simple check for numeric conversion possibility
          if (!strValue.match(/^[$€£¥]?[-+]?[0-9,.]*[0-9]%?$/)) {
            errors.push({
              message: `"${strValue}" may not be convertible to a number`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(node.arguments[0], formula),
            })
          }
        }
        break

      case 'JSON_EXTRACT':
        // Check for valid JSON in first argument if literal
        if (node.arguments[0]?.type === JSEPNode.LITERAL && typeof node.arguments[0].value === 'string') {
          try {
            JSON.parse(node.arguments[0].value)
          } catch (e) {
            errors.push({
              message: `Invalid JSON: ${e.message}`,
              severity: MarkerSeverity.Error,
              ...this.findNodePosition(node.arguments[0], formula),
            })
          }
        }

        // Check for valid path syntax in second argument
        if (node.arguments[1]?.type === JSEPNode.LITERAL && typeof node.arguments[1].value === 'string') {
          const path = node.arguments[1].value
          if (!path.startsWith('.') && !path.startsWith('[')) {
            errors.push({
              message: `JSON path should start with '.' or '['`,
              severity: MarkerSeverity.Warning,
              ...this.findNodePosition(node.arguments[1], formula),
            })
          }
        }
        break

      case 'RECORD_ID':
        // RECORD_ID takes no arguments, but it's caught by argument count check
        break
    }

    // Type-check arguments for all functions
    node.arguments.forEach((arg: any, index: number) => {
      if (!arg) return

      const expectedType = expectedTypes[index]

      // Skip type checking if expected type is undefined or we don't know the arg type
      if (!expectedType || arg.dataType === FormulaDataTypes.NULL || arg.dataType === FormulaDataTypes.UNKNOWN) {
        this.analyzeTypeWarnings(arg, errors, formula)
        return
      }

      // Check if argument type matches expected type
      if (arg.dataType !== expectedType) {
        // Special handling for conditional expressions in logical functions
        if (
          (functionName === 'AND' || functionName === 'OR' || functionName === 'XOR') &&
          (arg.dataType === FormulaDataTypes.COND_EXP ||
            arg.dataType === FormulaDataTypes.BOOLEAN ||
            arg.dataType === FormulaDataTypes.NUMERIC)
        ) {
          // This is fine - conditions, booleans, and numbers can be used in logical functions
        }
        // Special handling for numeric and boolean equivalence
        else if (
          (expectedType === FormulaDataTypes.NUMERIC && arg.dataType === FormulaDataTypes.BOOLEAN) ||
          (expectedType === FormulaDataTypes.BOOLEAN && arg.dataType === FormulaDataTypes.NUMERIC)
        ) {
          errors.push({
            message: `Argument ${index + 1} of ${functionName} expects ${
              dataTypeLabels[expectedType]
            }. Boolean will be treated as 0 or 1.`,
            severity: MarkerSeverity.Info,
            ...this.findNodePosition(arg, formula),
          })
        }
        // Actual type mismatch
        else {
          errors.push({
            message: `Argument ${index + 1} of ${functionName} should be ${dataTypeLabels[expectedType]}, but got ${
              dataTypeLabels[arg.dataType]
            }`,
            severity: MarkerSeverity.Warning,
            ...this.findNodePosition(arg, formula),
          })
        }
      }

      // Recurse into argument
      this.analyzeTypeWarnings(arg, errors, formula)
    })
  }

  /**
   * Analyze literal values
   */
  private analyzeLiteral(node: any, errors: TypeError[], nodePosition: any): void {
    // Check for potential issues with literals

    if (node.dataType === FormulaDataTypes.STRING) {
      // Check if string looks like a date but isn't in a date context
      const value = node.value
      if (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}/.test(value) &&
        !['DATEADD', 'DATESTR', 'DAY', 'MONTH', 'YEAR'].includes(node.parentFunction)
      ) {
        errors.push({
          message: `"${value}" looks like a date but is used as Text. Use a date function if date operations are intended.`,
          severity: MarkerSeverity.Info,
          ...nodePosition,
        })
      }
    } else if (node.dataType === FormulaDataTypes.NUMERIC) {
      // Check for very large numbers that might cause precision issues
      const value = node.value
      if (typeof value === 'number' && (value > 9007199254740991 || value < -9007199254740991)) {
        errors.push({
          message: `Number ${value} exceeds safe integer limits and may lose precision`,
          severity: MarkerSeverity.Warning,
          ...nodePosition,
        })
      }
    }
  }

  /**
   * Analyze unary expressions (e.g., -x, !y)
   */
  private analyzeUnaryExpression(node: any, errors: TypeError[], formula: string, nodePosition: any): void {
    const argType = node.argument?.dataType

    if (!argType || argType === FormulaDataTypes.UNKNOWN || argType === FormulaDataTypes.NULL) {
      this.analyzeTypeWarnings(node.argument, errors, formula)
      return
    }

    switch (node.operator) {
      case '-':
        if (argType !== FormulaDataTypes.NUMERIC) {
          errors.push({
            message: `Negation operator requires a number, but got ${dataTypeLabels[argType]}`,
            severity: MarkerSeverity.Error,
            ...nodePosition,
          })
        }
        break

      case '!':
        if (
          argType !== FormulaDataTypes.BOOLEAN &&
          argType !== FormulaDataTypes.COND_EXP &&
          argType !== FormulaDataTypes.NUMERIC
        ) {
          errors.push({
            message: `NOT operator requires a boolean or condition, but got ${dataTypeLabels[argType]}`,
            severity: MarkerSeverity.Error,
            ...nodePosition,
          })
        }
        break

      default:
        errors.push({
          message: `Unsupported unary operator: ${node.operator}`,
          severity: MarkerSeverity.Error,
          ...nodePosition,
        })
    }

    // Recurse into argument
    this.analyzeTypeWarnings(node.argument, errors, formula)
  }

  /**
   * Get expected argument types for a function
   */
  private getExpectedArgumentTypes(functionName: string): FormulaDataTypes[] {
    const func = formulas[functionName]
    if (!func || !func.validation || !func.validation.args) {
      return []
    }

    const { args } = func.validation
    if (!args.type) {
      return []
    }

    // Handle both single type and array of types
    if (Array.isArray(args.type)) {
      return args.type
    } else {
      // If a single type is specified, apply it to all arguments
      const count = args.max || args.rqd || 1
      return Array(count).fill(args.type)
    }
  }

  /**
   * Find matching closing parenthesis
   */
  private findMatchingCloseParen(text: string, openParenIndex: number): number {
    let depth = 0
    for (let i = openParenIndex; i < text.length; i++) {
      if (text[i] === '(') {
        depth++
      } else if (text[i] === ')') {
        depth--
        if (depth === 0) {
          return i
        }
      }
    }
    return text.length - 1 // If no matching parenthesis, return end of text
  }
}

/**
 * Create and register the formula type validation provider
 */
export function registerFormulaTypeValidation(
  editor: editor.IStandaloneCodeEditor,
  options: ValidationOptions,
): FormulaTypeValidator {
  return new FormulaTypeValidator(editor, options)
}
