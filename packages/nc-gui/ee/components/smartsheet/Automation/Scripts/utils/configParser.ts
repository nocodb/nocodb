import * as acorn from 'acorn-loose'
import * as walk from 'acorn-walk'

interface ConfigItem {
  type: 'table' | 'field' | 'view' | 'text' | 'number' | 'select'
  key: string
  label?: string
  description?: string
  parentTable?: string
  options?: Array<{ value: string; label?: string }>
}

interface ScriptConfig {
  title: string
  description?: string
  items: ConfigItem[]
}

export const isInputConfigCall = (node: any) => {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.name === 'input' &&
    node.callee.property.name === 'config'
  )
}

export const extractObjectValue = (node: any) => {
  if (!node) return undefined

  if (node.type === 'Literal') {
    return node.value
  } else if (node.type === 'ArrayExpression') {
    return node.elements.map((element: any) => extractObjectValue(element))
  } else if (node.type === 'ObjectExpression') {
    const obj: any = {}
    node.properties.forEach((prop: any) => {
      obj[prop.key.name || prop.key.value] = extractObjectValue(prop.value)
    })
    return obj
  }
  return undefined
}

export const parseConfigItem = (node: any): ConfigItem | null => {
  // Check if it's a config item call (input.config.type)
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'MemberExpression' &&
    node.callee.object.object.name === 'input' &&
    node.callee.object.property.name === 'config'
  ) {
    const type = node.callee.property.name as ConfigItem['type']
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

export const replaceConfigValues = (scriptContent: string, configValues: Record<string, any>): string => {
  const ast = acorn.parse(scriptContent, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  })

  let updatedScript = scriptContent
  let configStart = 0
  let configEnd = 0

  walk.simple(ast, {
    CallExpression(node: any) {
      if (isInputConfigCall(node)) {
        configStart = node.start
        configEnd = node.end
      }
    },
  })

  if (configStart !== 0 && configEnd !== 0) {
    const configObj = `${JSON.stringify(configValues, null, 2)}`
    updatedScript = `${scriptContent.slice(0, configStart) + configObj}

    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        switch (value.type) {
          case 'table': {
            const table = base.getTable(value.value)
            config[key] = table
            break
          }
          case 'view': {
            const table = base.getTable(value.tableId)
            const view = table.getView(value.value)
            config[key] = view
            break
          }
          case 'field': {
            const table = base.getTable(value.tableId)
            const field = table.getField(value.value)
            config[key] = field
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

  config.items.forEach((item) => {
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

export const parseScript = (scriptContent: string): any => {
  try {
    const ast = acorn.parse(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    })

    let config: ScriptConfig | null = null
    const items: ConfigItem[] = []

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

    return config
  } catch (error) {
    console.error('Error parsing script configuration:', error)
    return null
  }
}
