import * as acorn from 'acorn-loose'
import * as walk from 'acorn-walk'
import { ScriptConfig, ScriptConfigItem } from './types'
import { extractObjectValue } from './utils'

export const isInputConfigCall = (node: any) => {
    return (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'input' &&
        node.callee.property.name === 'config'
    )
}

export const parseConfigItem = (node: any): ScriptConfigItem | null => {
    // Check if it's a config item call (input.config.type)
    if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'MemberExpression' &&
        node.callee.object.object.name === 'input' &&
        node.callee.object.property.name === 'config'
    ) {
        const type = node.callee.property.name as ScriptConfigItem['type']
        const [keyNode, optionsNode] = node.arguments

        if (keyNode && keyNode.type === 'Literal') {
            const key = keyNode.value
            const options = optionsNode ? extractObjectValue(optionsNode) : {}

            return {
                type,
                key,
                ...options,
            }
        }
    }
    return null
}

export const parseScript = (scriptContent: string): any => {
    try {
        const ast = acorn.parse(scriptContent, {
            ecmaVersion: 'latest',
            sourceType: 'module',
        })

        let config: ScriptConfig | null = null
        const items: ScriptConfigItem[] = []

        walk.simple(ast, {
            CallExpression(node: any) {
                const configItem = parseConfigItem(node)
                if (configItem) {
                    items.push(configItem)
                }
            },
        })

        walk.simple(ast, {
            CallExpression(node: any) {
                if (isInputConfigCall(node)) {
                    const configArg = node.arguments[0]
                    if (configArg && configArg.type === 'ObjectExpression') {
                        const configObj = extractObjectValue(configArg)
                        config = {
                            title: configObj.title || '',
                            description: configObj.description,
                            items,
                        }
                    }
                }
            },
        })

        if (config?.items?.length) {
            config.items = config.items.filter((item) => {
                if (!['table', 'field', 'view', 'text', 'number', 'select'].includes(item.type)) {
                    return false
                }

                switch (item.type) {
                    case 'view':
                    case 'field': {
                        if (!item?.parentTable) return false
                        if (!config.items.find((i: ScriptConfigItem) => i.type === 'table' && i.key === item.parentTable)) {
                            return false
                        }
                        break
                    }
                    case 'select': {
                        if (!item?.options?.length) return false
                        if (!item?.options?.some((option) => option?.value && option?.label)) return false
                        break
                    }
                }

                return true
            })
        }
        return config
    } catch (error) {
        console.error('Error parsing script configuration:', error)
        return null
    }
}

// helper function to find the variable name used for config
export const findConfigVariableName = (scriptContent: string): string | null => {
    const ast = acorn.parse(scriptContent, {
        ecmaVersion: 'latest',
        sourceType: 'module',
    })

    let configVariableName: string | null = null

    walk.simple(ast, {
        VariableDeclarator(node: any) {
            // Check if the init is input.config() call
            if (node.init && isInputConfigCall(node.init)) {
                configVariableName = node.id.name
            }
        },
        AssignmentExpression(node: any) {
            // Handle cases like: configVar = input.config()
            if (node.right && isInputConfigCall(node.right)) {
                if (node.left.type === 'Identifier') {
                    configVariableName = node.left.name
                }
            }
        },
    })

    return configVariableName
}

export const replaceConfigValues = (scriptContent: string, configValues: Record<string, any>): string => {
    const ast = acorn.parse(scriptContent, {
        ecmaVersion: 'latest',
        sourceType: 'module',
    })

    let updatedScript = scriptContent
    let configStart = 0
    let configEnd = 0

    // First, find what variable name is used for the config
    const detectedConfigVar = findConfigVariableName(scriptContent)

    // If no variable was detected, just remove the input.config() call
    if (!detectedConfigVar) {
        let expressionStart = 0
        let expressionEnd = 0

        walk.simple(ast, {
            ExpressionStatement(node: any) {
                // Check if this expression statement contains our input.config() call
                if (node.expression && isInputConfigCall(node.expression)) {
                    expressionStart = node.start
                    expressionEnd = node.end
                }
            },
            CallExpression(node: any) {
                if (isInputConfigCall(node)) {
                    configStart = node.start
                    configEnd = node.end
                }
            },
        })

        if (configStart !== 0 && configEnd !== 0) {
            // If we found the call within an expression statement, remove the entire statement
            if (expressionStart !== 0 && expressionEnd !== 0) {
                // Remove the entire expression statement (including semicolon)
                const beforeStatement = scriptContent.slice(0, expressionStart)
                let afterStatement = scriptContent.slice(expressionEnd)

                // Clean up any extra newlines that might be left
                if (beforeStatement.endsWith('\n') && afterStatement.startsWith('\n')) {
                    afterStatement = afterStatement.slice(1)
                }

                updatedScript = beforeStatement + afterStatement
            } else {
                // Fallback: just remove the call itself
                updatedScript = scriptContent.slice(0, configStart) + scriptContent.slice(configEnd)
            }
        }

        return updatedScript
    }

    // Find the input.config() call location
    walk.simple(ast, {
        CallExpression(node: any) {
            if (isInputConfigCall(node)) {
                configStart = node.start
                configEnd = node.end
            }
        },
    })

    if (configStart !== 0 && configEnd !== 0) {
        // Parse the script to get the actual config items defined in the script
        const scriptConfig = parseScript(scriptContent)

        // Only include values for keys that are actually defined in the script's config
        const filteredConfigValues: Record<string, any> = {}
        if (scriptConfig?.items) {
            scriptConfig.items.forEach((item: ScriptConfigItem) => {
                if (Object.prototype.hasOwnProperty.call(configValues, item.key)) {
                    filteredConfigValues[item.key] = configValues[item.key]
                }
            })
        }

        const configObj = `${JSON.stringify(filteredConfigValues, null, 2)}`

        // Replace the input.config() call with the actual config values
        updatedScript = `${scriptContent.slice(0, configStart)}${configObj}

    Object.entries(${detectedConfigVar}).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        switch (value.type) {
          case 'table': {
            const table = base.getTable(value.value)
            if (!table) {
              return
            }
            ${detectedConfigVar}[key] = table
            break
          }
          case 'view': {
            const table = base.getTable(value.tableId)
            if (!table) {
              return
            }
            const view = table.getView(value.value)
            if (!view) {
              return
            }
            ${detectedConfigVar}[key] = view
            break
          }
          case 'field': {
            const table = base.getTable(value.tableId)
            if (!table) {
              return
            }
            const field = table.getField(value.value)
            if (!field) {
              return
            }
            ${detectedConfigVar}[key] = field
            break
          }
        }
      }
    })
    
    ${scriptContent.slice(configEnd)}`
    }

    return updatedScript
}

export const validateConfigValues = (config: ScriptConfig, values: Record<string, any>): string[] => {
    const errors: string[] = []
    const tableValues = new Set<string>()

    config?.items?.forEach((item) => {
        // Track table selections
        if (item.type === 'table' && values[item.key]) {
            tableValues.add(item.key)
        }

        // Check required fields
        if (!values[item.key]) {
            errors.push(`Missing value for ${item.label || item.key}`)
        }

        // Check field/view parent table dependencies
        if ((item.type === 'field' || item.type === 'view') && item.parentTable && !tableValues.has(item.parentTable)) {
            errors.push(`${item.label || item.key} requires ${item.parentTable} to be selected`)
        }
    })

    return errors
}
