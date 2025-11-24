import type { VariableDefinition } from '../interface';
import { workflowJsep } from '../../formula/jsepInstances';
import { WorkflowNodeFilterDataType } from './ifTypes';

/**
 * Maps VariableType to WorkflowNodeFilterDataType
 */
function variableTypeToFilterDataType(
  variable: VariableDefinition
): WorkflowNodeFilterDataType | undefined {
  switch (variable.type) {
    case 'string':
      return WorkflowNodeFilterDataType.TEXT;
    case 'number':
    case 'integer':
      return WorkflowNodeFilterDataType.NUMBER;
    case 'boolean':
      return WorkflowNodeFilterDataType.BOOLEAN;
    case 'date':
      return WorkflowNodeFilterDataType.DATE;
    case 'datetime':
      return WorkflowNodeFilterDataType.DATETIME;
    case 'object':
      // Check if it's an array
      if ((variable as any).isArray) {
        return WorkflowNodeFilterDataType.MULTI_SELECT;
      }
      // Check if it's an object with children (nested structure)
      if (variable.children && variable.children.length > 0) {
        // For structured objects with children, don't auto-select type
        return undefined;
      }
      // Default to text for simple objects
      return WorkflowNodeFilterDataType.TEXT;
    case 'array':
      return WorkflowNodeFilterDataType.MULTI_SELECT;
    default:
      return WorkflowNodeFilterDataType.TEXT;
  }
}

interface ParsedNode {
  type: string;
  dataType?: WorkflowNodeFilterDataType;
  [key: string]: any;
}

/**
 * Recursively searches for a variable in the children hierarchy
 */
function searchInChildren(
  path: string,
  variables: VariableDefinition[]
): VariableDefinition | undefined {
  for (const variable of variables) {
    // Check direct match
    if (variable.key === path) {
      return variable;
    }

    // Search in children recursively
    if (variable.children && variable.children.length > 0) {
      const found = searchInChildren(path, variable.children);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Finds a variable by path in the flatVariables list
 * Handles nested paths like "$('Node').trigger.timestamp"
 * If the exact path is not found, searches in children of parent variables
 */
function findVariable(
  path: string,
  flatVariables: VariableDefinition[]
): VariableDefinition | undefined {
  // First, try direct match in top-level variables
  const directMatch = flatVariables.find((v) => v.key === path);
  if (directMatch) return directMatch;

  // Search recursively through all children
  const foundInChildren = searchInChildren(path, flatVariables);
  if (foundInChildren) return foundInChildren;

  // Fallback: try partial matches
  return flatVariables.find((v) => {
    if (v.key.endsWith(`.${path}`)) return true;
    if (v.key.startsWith(path)) return true;
    return false;
  });
}

/**
 * Gets the return type of built-in workflow functions
 * Based on WorkflowExpressionParser in nocodb-sdk
 */
function getBuiltInFunctionReturnType(
  functionName: string
): WorkflowNodeFilterDataType | undefined {
  // Type checking functions return boolean
  if (['$isNull', '$isUndefined', '$isEmpty'].includes(functionName)) {
    return WorkflowNodeFilterDataType.BOOLEAN;
  }

  // Type conversion functions
  if (functionName === '$string') return WorkflowNodeFilterDataType.TEXT;
  if (functionName === '$number') return WorkflowNodeFilterDataType.NUMBER;
  if (functionName === '$boolean') return WorkflowNodeFilterDataType.BOOLEAN;

  // Array/String length returns number
  if (functionName === '$length') return WorkflowNodeFilterDataType.NUMBER;

  // Math functions return number
  if (
    ['$abs', '$ceil', '$floor', '$round', '$min', '$max'].includes(functionName)
  ) {
    return WorkflowNodeFilterDataType.NUMBER;
  }

  // $first and $last return element type (default to TEXT)
  if (['$first', '$last'].includes(functionName)) {
    return WorkflowNodeFilterDataType.TEXT;
  }

  // $ifEmpty depends on second argument, default to TEXT
  if (functionName === '$ifEmpty') {
    return WorkflowNodeFilterDataType.TEXT;
  }

  return undefined;
}

/**
 * Gets the return type of object methods (string, array, number)
 * Based on allowed methods in WorkflowExpressionParser
 */
function getMethodReturnType(
  methodName: string
): WorkflowNodeFilterDataType | undefined {
  // String methods returning string
  const stringMethods = [
    'toUpperCase',
    'toLowerCase',
    'trim',
    'slice',
    'substring',
    'charAt',
    'concat',
    'replace',
    'repeat',
    'padStart',
    'padEnd',
  ];
  if (stringMethods.includes(methodName)) {
    return WorkflowNodeFilterDataType.TEXT;
  }

  // String methods returning number
  const stringNumberMethods = ['indexOf', 'lastIndexOf', 'charCodeAt'];
  if (stringNumberMethods.includes(methodName)) {
    return WorkflowNodeFilterDataType.NUMBER;
  }

  // String methods returning boolean
  const stringBooleanMethods = ['startsWith', 'endsWith', 'includes'];
  if (stringBooleanMethods.includes(methodName)) {
    return WorkflowNodeFilterDataType.BOOLEAN;
  }

  // String split returns array
  if (methodName === 'split') {
    return WorkflowNodeFilterDataType.MULTI_SELECT;
  }

  // Array methods returning string
  if (methodName === 'join') {
    return WorkflowNodeFilterDataType.TEXT;
  }

  // Array methods returning number
  const arrayNumberMethods = ['indexOf', 'lastIndexOf', 'findIndex'];
  if (arrayNumberMethods.includes(methodName)) {
    return WorkflowNodeFilterDataType.NUMBER;
  }

  // Array methods returning boolean
  const arrayBooleanMethods = ['some', 'every', 'includes'];
  if (arrayBooleanMethods.includes(methodName)) {
    return WorkflowNodeFilterDataType.BOOLEAN;
  }

  // Array methods returning array
  const arrayArrayMethods = ['map', 'filter', 'slice', 'concat', 'flat'];
  if (arrayArrayMethods.includes(methodName)) {
    return WorkflowNodeFilterDataType.MULTI_SELECT;
  }

  // Number methods returning string
  const numberStringMethods = ['toFixed', 'toExponential', 'toPrecision'];
  if (numberStringMethods.includes(methodName)) {
    return WorkflowNodeFilterDataType.TEXT;
  }

  return undefined;
}

function getMemberExpressionReturnType(propertyName: string) {
  switch (propertyName) {
    case 'length':
      return WorkflowNodeFilterDataType.NUMBER;
    default:
      return undefined;
  }
}

/**
 * Parses a workflow variable reference from a MemberExpression
 * e.g., $('Node').trigger.timestamp
 */
function parseWorkflowVariable(
  node: any,
  flatVariables: VariableDefinition[]
): ParsedNode | null {
  // Handle MemberExpression: $('Node').trigger.timestamp or $('Node')['field name']
  if (node.type === 'MemberExpression') {
    // Build the path from the member expression, tracking whether each segment uses bracket notation
    const pathSegments: Array<{ value: string; useBracket: boolean }> = [];
    let current = node;

    while (current.type === 'MemberExpression') {
      // Handle both dot notation (Identifier) and bracket notation (Literal)
      if (current.property.type === 'Identifier') {
        pathSegments.unshift({
          value: current.property.name,
          useBracket: false,
        });
      } else if (current.property.type === 'Literal') {
        // Bracket notation: ['field name']
        pathSegments.unshift({
          value: String(current.property.value),
          useBracket: true,
        });
      }
      current = current.object;
    }

    // current should now be a CallExpression: $('Node')
    // Extract the node name and build the full variable path
    let nodeName = '';
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      current.callee.name === '$'
    ) {
      if (
        current.arguments.length > 0 &&
        current.arguments[0].type === 'Literal'
      ) {
        nodeName = current.arguments[0].value;
      }
    }

    // Build the full path with node name, preserving bracket notation
    let fullPath = '';
    if (nodeName) {
      fullPath = `$('${nodeName}')`;
      pathSegments.forEach((seg) => {
        if (seg.useBracket) {
          fullPath += `['${seg.value}']`;
        } else {
          fullPath += `.${seg.value}`;
        }
      });
    } else {
      fullPath = pathSegments
        .map((seg, i) => {
          if (seg.useBracket) {
            return i === 0 ? `['${seg.value}']` : `['${seg.value}']`;
          } else {
            return i === 0 ? seg.value : `.${seg.value}`;
          }
        })
        .join('');
    }

    const variable = findVariable(fullPath, flatVariables);

    if (variable) {
      const dataType = variableTypeToFilterDataType(variable);
      return {
        type: 'Identifier',
        dataType,
        name: variable.key,
      };
    }
  }

  // Handle simple CallExpression: $('variable')
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === '$'
  ) {
    if (node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
      const nodeName = node.arguments[0].value;
      const fullPath = `$('${nodeName}')`;
      const variable = findVariable(fullPath, flatVariables);

      if (variable) {
        const dataType = variableTypeToFilterDataType(variable);
        return {
          type: 'Identifier',
          dataType,
          name: variable.key,
        };
      }
    }
  }

  return null;
}

function validateAndExtractType(
  node: any,
  flatVariables: VariableDefinition[]
): ParsedNode {
  const result: ParsedNode = { ...node };

  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'number') {
        result.dataType = WorkflowNodeFilterDataType.NUMBER;
      } else if (typeof node.value === 'string') {
        result.dataType = WorkflowNodeFilterDataType.TEXT;
      } else if (typeof node.value === 'boolean') {
        result.dataType = WorkflowNodeFilterDataType.BOOLEAN;
      }
      break;

    case 'Identifier':
      result.dataType = WorkflowNodeFilterDataType.TEXT;
      break;

    case 'CallExpression': {
      // Check if it's a workflow variable reference
      const varNode = parseWorkflowVariable(node, flatVariables);
      if (varNode) {
        return varNode;
      }

      // Check if it's a built-in function (like $abs, $isNull, etc.)
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name.startsWith('$')
      ) {
        const functionType = getBuiltInFunctionReturnType(node.callee.name);
        if (functionType) {
          result.dataType = functionType;
          break;
        }
      }

      // Check if it's a method call (like .toUpperCase(), .indexOf(), etc.)
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier'
      ) {
        const methodType = getMethodReturnType(node.callee.property.name);
        if (methodType) {
          result.dataType = methodType;
          break;
        }
      }

      // Otherwise, default to TEXT
      result.dataType = WorkflowNodeFilterDataType.TEXT;
      break;
    }

    case 'MemberExpression': {
      // Check if this is a method/property access (not a call)
      if (node.property.type === 'Identifier') {
        // Check if it's a known property like 'length'
        const propertyType = getMemberExpressionReturnType(node.property.name);
        if (propertyType) {
          result.dataType = propertyType;
          break;
        }
      }

      // This might be a workflow variable reference
      const memberVar = parseWorkflowVariable(node, flatVariables);
      if (memberVar) {
        return memberVar;
      }
      result.dataType = WorkflowNodeFilterDataType.TEXT;
      break;
    }

    case 'UnaryExpression': {
      const argument = validateAndExtractType(node.argument, flatVariables);
      // Handle negative numbers and logical NOT
      if (node.operator === '-') {
        result.dataType = WorkflowNodeFilterDataType.NUMBER;
      } else if (node.operator === '!') {
        result.dataType = WorkflowNodeFilterDataType.BOOLEAN;
      }
      result.argument = argument;
      break;
    }
    case 'BinaryExpression':
      {
        const left = validateAndExtractType(node.left, flatVariables);
        const right = validateAndExtractType(node.right, flatVariables);

        // Apply type inference rules based on operator
        if (
          ['==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(
            node.operator
          )
        ) {
          // Comparison operators return boolean
          result.dataType = WorkflowNodeFilterDataType.BOOLEAN;
        } else if (node.operator === '+') {
          // In workflow expressions, + is ONLY for numeric addition
          // String concatenation uses .concat() method
          result.dataType = WorkflowNodeFilterDataType.NUMBER;
        } else if (node.operator === '&') {
          // String concatenation operator
          result.dataType = WorkflowNodeFilterDataType.TEXT;
        } else if (['-', '*', '/', '%', '**'].includes(node.operator)) {
          // Arithmetic operations return number
          result.dataType = WorkflowNodeFilterDataType.NUMBER;
        } else {
          result.dataType = WorkflowNodeFilterDataType.TEXT;
        }

        result.left = left;
        result.right = right;
      }
      break;

    case 'LogicalExpression':
      {
        // Logical operators (&&, ||) return boolean
        const logicalLeft = validateAndExtractType(node.left, flatVariables);
        const logicalRight = validateAndExtractType(node.right, flatVariables);
        result.dataType = WorkflowNodeFilterDataType.BOOLEAN;
        result.left = logicalLeft;
        result.right = logicalRight;
      }
      break;

    case 'ConditionalExpression': {
      // Ternary operator: condition ? consequent : alternate
      const test = validateAndExtractType(node.test, flatVariables);
      const consequent = validateAndExtractType(node.consequent, flatVariables);
      const alternate = validateAndExtractType(node.alternate, flatVariables);

      // Try to infer type from consequent/alternate branches
      // If both have same type, use that; otherwise default to TEXT
      if (consequent.dataType && consequent.dataType === alternate.dataType) {
        result.dataType = consequent.dataType;
      } else {
        // we default to TEXT as a fallback. This is a conservative choice to avoid incorrect type assumptions.
        result.dataType = WorkflowNodeFilterDataType.TEXT;
      }

      result.test = test;
      result.consequent = consequent;
      result.alternate = alternate;
      break;
    }
    default:
      result.dataType = WorkflowNodeFilterDataType.TEXT;
  }

  return result;
}

/**
 * Detects the WorkflowNodeFilterDataType from a workflow field expression
 * Handles expressions like:
 * - {{ $('Node').trigger.timestamp }} -> DATETIME
 * - {{ $('Node').trigger.timestamp + 100 }} -> NUMBER (+ is numeric only)
 * - {{ $('Node').user.email.toUpperCase() }} -> TEXT
 * - {{ $abs(-5) }} -> NUMBER
 * - {{ $isNull($('Node').value) }} -> BOOLEAN
 */
export function extractDataTypeFromWorkflowNodeExpression(
  fieldExpression: string,
  flatVariables: VariableDefinition[]
): WorkflowNodeFilterDataType | undefined {
  if (!fieldExpression || !fieldExpression.includes('{{')) return undefined;

  try {
    // Check if the field is ONLY an expression (no surrounding text)
    // Only detect type for pure expressions like "{{ ... }}" with optional whitespace
    const trimmed = fieldExpression.trim();

    // Count expression delimiters - should be exactly one {{ and one }}
    const openCount = (fieldExpression.match(/\{\{/g) || []).length;
    const closeCount = (fieldExpression.match(/}}/g) || []).length;

    // Multiple expressions like "{{ expr1 }} {{ expr2 }}" should be TEXT
    if (openCount !== 1 || closeCount !== 1) {
      return WorkflowNodeFilterDataType.TEXT;
    }

    const isPureExpression = /^\{\{\s*[^}]+\s*}}$/.test(trimmed);

    // If there's text mixed with the expression, treat as TEXT
    if (!isPureExpression) {
      return WorkflowNodeFilterDataType.TEXT;
    }

    // Extract expression from {{ }}
    const match = fieldExpression.match(/\{\{\s*([^}]+)\s*}}/);
    if (!match || !match[1]) return WorkflowNodeFilterDataType.TEXT;

    const expression = match[1].trim();

    const parsed = workflowJsep(expression);

    const result = validateAndExtractType(parsed, flatVariables);

    return result.dataType;
  } catch (error) {
    console.warn('Failed to parse workflow expression:', error);
    return WorkflowNodeFilterDataType.TEXT;
  }
}
