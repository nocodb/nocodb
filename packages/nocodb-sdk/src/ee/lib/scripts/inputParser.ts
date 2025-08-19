import * as acorn from 'acorn-loose'
import * as walk from 'acorn-walk'
import { CursorRowUsage, InputCallInfo } from '~/lib'
import { extractObjectValue } from './utils'

export const isInputMethodCall = (node: any) => {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.name === 'input' &&
    typeof node.callee.property.name === 'string' &&
    node.callee.property.name.endsWith('Async')
  )
}

// Check if a node is any input call (including config)
export const isAnyInputCall = (node: any) => {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.name === 'input'
  )
}

// Check if a node is cursor.row usage
export const isCursorRowUsage = (node: any) => {
  return (
    node.type === 'MemberExpression' &&
    node.object.name === 'cursor' &&
    node.property.name === 'row'
  )
}

// Find all input method calls in the script
export const findInputCalls = (scriptContent: string): InputCallInfo[] => {
  try {
    const ast = acorn.parse(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })

    const inputCalls: InputCallInfo[] = []

    walk.simple(ast, {
      CallExpression(node: any) {
        if (isAnyInputCall(node)) {
          const methodName = node.callee.property.name
          const line = node.loc ? node.loc.start.line : 0
          const column = node.loc ? node.loc.start.column : 0

          inputCalls.push({
            type: methodName,
            line,
            column,
            start: node.start,
            end: node.end,
            arguments: node.arguments?.map((arg: any) => extractObjectValue(arg))
          })
        }
      }
    })

    return inputCalls
  } catch (error) {
    console.error('Error parsing script for input calls:', error)
    return []
  }
}

// Find all cursor.row usages in the script
export const findCursorRowUsages = (scriptContent: string): CursorRowUsage[] => {
  try {
    const ast = acorn.parse(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })

    const cursorRowUsages: CursorRowUsage[] = []

    walk.simple(ast, {
      MemberExpression(node: any) {
        if (isCursorRowUsage(node)) {
          const line = node.loc ? node.loc.start.line : 0
          const column = node.loc ? node.loc.start.column : 0

          cursorRowUsages.push({
            line,
            column,
            start: node.start,
            end: node.end,
            context: 'property'
          })
        }
        
        // Check for cursor.row.fieldName patterns
        if (
          node.type === 'MemberExpression' &&
          node.object.type === 'MemberExpression' &&
          node.object.object.name === 'cursor' &&
          node.object.property.name === 'row'
        ) {
          const line = node.loc ? node.loc.start.line : 0
          const column = node.loc ? node.loc.start.column : 0
          const propertyName = node.property.name || node.property.value

          cursorRowUsages.push({
            line,
            column,
            start: node.object.start, // Start from cursor.row
            end: node.end, // End at the full expression
            context: 'method',
            property: propertyName
          })
        }
      }
    })

    return cursorRowUsages
  } catch (error) {
    console.error('Error parsing script for cursor.row usages:', error)
    return []
  }
}

// Check if script has any input calls
export const hasInputCalls = (scriptContent: string): boolean => {
  const inputCalls = findInputCalls(scriptContent)
  return inputCalls.length > 0
}

// Check if script has any cursor.row usages
export const hasCursorRowUsages = (scriptContent: string): boolean => {
  const cursorRowUsages = findCursorRowUsages(scriptContent)
  return cursorRowUsages.length > 0
}

