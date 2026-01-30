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

/**
 * Apply default value for a config item, converting to the appropriate runtime format
 */
export const applyDefaultValue = (item: ScriptConfigItem): any => {
    if (item.default === undefined) {
        return undefined
    }

    switch (item.type) {
        case 'table':
            // For table, default is a table ID string, wrap in config format
            return { type: 'table', value: item.default }
        case 'field':
            // For field, default is a field ID string, needs tableId from parentTable
            // Note: tableId will be resolved at runtime from the parentTable config
            return { type: 'field', value: item.default, tableId: '' }
        case 'view':
            // For view, default is a view ID string, needs tableId from parentTable
            return { type: 'view', value: item.default, tableId: '' }
        case 'text':
        case 'number':
        case 'select':
            // For primitive types, return the default directly
            return item.default
    }
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
        // Apply default values when user-provided values are missing
        const filteredConfigValues: Record<string, any> = {}
        if (scriptConfig?.items) {
            // First pass: process table configs (and other non-dependent types)
            scriptConfig.items.forEach((item: ScriptConfigItem) => {
                if (item.type !== 'field' && item.type !== 'view') {
                    if (Object.prototype.hasOwnProperty.call(configValues, item.key) && configValues[item.key] != null) {
                        filteredConfigValues[item.key] = configValues[item.key]
                    } else if (item.default !== undefined) {
                        filteredConfigValues[item.key] = applyDefaultValue(item)
                    }
                }
            })

            // Second pass: process field/view configs that depend on parent tables
            scriptConfig.items.forEach((item: ScriptConfigItem) => {
                if (item.type === 'field' || item.type === 'view') {
                    if (Object.prototype.hasOwnProperty.call(configValues, item.key) && configValues[item.key] != null) {
                        filteredConfigValues[item.key] = configValues[item.key]
                    } else if (item.default !== undefined) {
                        // Get tableId from parent table's config value
                        const parentTableValue = filteredConfigValues[item.parentTable]
                        const tableId = parentTableValue?.value || parentTableValue?.tableId || ''
                        filteredConfigValues[item.key] = {
                            type: item.type,
                            value: item.default,
                            tableId,
                        }
                    }
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
        const hasValue = values[item.key] != null && values[item.key] !== ''
        const hasDefault = item.default !== undefined

        // Track table selections (from value or default)
        if (item.type === 'table' && (hasValue || hasDefault)) {
            tableValues.add(item.key)
        }

        // Check required fields - default satisfies requirement
        if (!hasValue && !hasDefault) {
            errors.push(`Missing value for ${item.label || item.key}`)
        }

        // Check field/view parent table dependencies
        if ((item.type === 'field' || item.type === 'view') && item.parentTable && !tableValues.has(item.parentTable)) {
            errors.push(`${item.label || item.key} requires ${item.parentTable} to be selected`)
        }
    })

    return errors
}
