<script setup lang="ts">
import type { VariableDefinition } from 'nocodb-sdk'
import { WorkflowExpressionParser } from 'nocodb-sdk'
import VariableDisplay from '~/components/smartsheet/workflow/sidebar/config/VariableDisplay.vue'

interface Props {
  variables: VariableDefinition[]
  data?: any
  depth?: number
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  data: undefined,
})

const expandedItems = ref<Set<string>>(new Set())

const getVariableIcon = (variable: VariableDefinition) => {
  if (variable.extra?.icon) {
    return variable.extra.icon
  }

  if (variable.isArray || variable.type === 'array') {
    return 'cellJson'
  }

  switch (variable.type) {
    case 'string':
      return 'cellText'
    case 'number':
    case 'integer':
      return 'cellNumber'
    case 'boolean':
      return 'cellCheckbox'
    case 'datetime':
      return 'cellDatetime'
    case 'object':
      return 'cellJson'
    default:
      return 'cellSystemText'
  }
}

const parser = new WorkflowExpressionParser()

const getVariableValue = (variable: VariableDefinition) => {
  // Check if we have a stored value in extra (for dynamically generated children)
  if (variable.extra?.value !== undefined) {
    return variable.extra.value
  }

  if (variable.extra?.tableName) {
    return variable.extra.tableName
  }

  if (variable.extra?.viewName) {
    return variable.extra.viewName
  }

  if (!props.data) return undefined

  try {
    // Convert the variable key to an expression
    // e.g., "record.fields['First Name']" → "$json.record.fields['First Name']"
    const expression = variable.key.startsWith('$json') ? variable.key : `$json.${variable.key}`

    // Set the data and evaluate
    const rawData = toRaw(props.data)
    parser.setCurrentNodeData(rawData)
    return parser.evaluate(expression)
  } catch (error) {
    console.warn(`Failed to evaluate variable key "${variable.key}":`, error)
    return undefined
  }
}

const isVariableExpandable = (variable: VariableDefinition) => {
  const value = getVariableValue(variable)

  if (variable.children?.length) return true

  if (Array.isArray(value) && value.length > 0) return true
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0
}

// Helper function to recursively populate values in schema children
const populateChildrenValues = (
  children: VariableDefinition[] | undefined,
  parentValue: any,
  parentKey?: string,
): VariableDefinition[] | undefined => {
  if (!children || !parentValue || typeof parentValue !== 'object') return children

  const parser = new WorkflowExpressionParser()

  return children.map((child) => {
    let expression: string

    if (parentKey && child.key.startsWith(parentKey)) {
      // Replace parent key with $json
      // "fields.Index" → "$json.Index"
      // "fields.Attachment.map(...)" → "$json.Attachment.map(...)"
      if (child.key.startsWith(`${parentKey}.`)) {
        expression = child.key.replace(`${parentKey}.`, '$json.')
      } else if (child.key.startsWith(`${parentKey}[`)) {
        // "fields['Customer Id']" → "$json['Customer Id']"
        expression = child.key.replace(parentKey, '$json')
      } else {
        expression = `$json.${child.key}`
      }
    } else {
      // No parent key or doesn't start with parent key - use key directly
      expression = child.key.includes('[') ? `$json${child.key}` : `$json.${child.key}`
    }

    let value: any
    try {
      const rawParentValue = toRaw(parentValue)
      parser.setCurrentNodeData(rawParentValue)
      value = parser.evaluate(expression)
    } catch (error) {
      console.warn(`Failed to evaluate expression "${expression}":`, error)
      value = undefined
    }

    return {
      ...child,
      extra: {
        ...child.extra,
        value,
      },
      children: child.children ? populateChildrenValues(child.children, value, child.key) : child.children,
    }
  })
}

const getArrayItems = (variable: VariableDefinition) => {
  const value = getVariableValue(variable)
  if (!Array.isArray(value)) return []

  const itemSchema = variable.extra?.itemSchema
  const entityReferences = variable.extra?.entityReferences

  return value.map((item, index) => {
    // If we have itemSchema, use it to generate proper variable definitions
    if (itemSchema && itemSchema.length > 0) {
      // Check if it's a primitive array (empty key means the item itself)
      const isPrimitiveArray = itemSchema.length === 1 && itemSchema[0].key === ''
      if (isPrimitiveArray) {
        // Array of primitives - display the value directly
        return {
          key: `${variable.key}[${index}]`,
          name: `${variable.name} ${index + 1}`,
          value: item,
          index,
          isPrimitive: true,
        }
      } else {
        // Array of objects - generate children based on itemSchema
        const children: VariableDefinition[] = itemSchema.map((schemaDef) => {
          let itemValue = item?.[schemaDef.key]

          // Check if this field has a corresponding entityReference
          // If so, use the human-readable name instead of the raw ID
          if (entityReferences && Array.isArray(entityReferences)) {
            const entityRef = entityReferences.find((ref: any) => ref.field === schemaDef.key && ref.entity_id === itemValue)
            if (entityRef?.title) {
              itemValue = entityRef.title
            }
          }

          return {
            key: `${variable.key}[${index}].${schemaDef.key}`,
            name: schemaDef.name,
            type: schemaDef.type,
            groupKey: schemaDef.groupKey,
            isArray: schemaDef.isArray,
            extra: {
              ...schemaDef.extra,
              value: itemValue,
            },
            children: populateChildrenValues(schemaDef.children, itemValue, schemaDef.key),
          }
        })

        return {
          key: `${variable.key}[${index}]`,
          name: `${variable.name} ${index + 1}`,
          value: item,
          index,
          isPrimitive: false,
          children,
        }
      }
    }

    // Fallback for when there's no itemSchema
    return {
      key: `${variable.key}[${index}]`,
      name: `${variable.name} ${index + 1}`,
      value: item,
      index,
      isPrimitive: typeof item !== 'object' || item === null,
    }
  })
}

const getObjectProperties = (variable: VariableDefinition) => {
  const value = getVariableValue(variable)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []

  return Object.entries(value).map(([key, val]) => ({
    key: `${variable.key}.${key}`,
    name: key,
    value: val,
  }))
}

const formatValue = (value: any): string => {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (value === '') return '(empty)'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<template>
  <div class="nc-variable-display w-full">
    <template v-for="variable in variables" :key="variable.key">
      <template v-if="!isVariableExpandable(variable)">
        <div
          v-if="getVariableValue(variable) !== undefined"
          class="flex items-center overflow-x-hidden py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
          :style="{ paddingLeft: `${depth * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
        >
          <div class="flex items-center flex-1 gap-2 pr-2">
            <GeneralIcon
              :icon="getVariableIcon(variable) as any"
              class="w-4 h-4 text-nc-content-gray-subtle stroke-transparent"
            />
            <div class="text-body text-nc-content-gray-emphasis line-clamp-1 truncate">{{ variable.name }}</div>
          </div>
          <NcTooltip
            class="text-bodyDefaultSm truncate min-w-8 text-right pr-1 text-nc-content-gray-subtle"
            show-on-truncate-only
          >
            <template #title>
              {{ getVariableValue(variable) }}
            </template>
            {{ getVariableValue(variable) }}
          </NcTooltip>
        </div>
      </template>

      <div v-else-if="getVariableValue(variable) !== undefined">
        <div
          class="flex items-center justify-between overflow-x-hidden py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium cursor-pointer"
          :style="{ paddingLeft: `${depth * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
          @click="expandedItems.has(variable.key) ? expandedItems.delete(variable.key) : expandedItems.add(variable.key)"
        >
          <div class="flex items-center flex-1 gap-2 overflow-x-hidden">
            <GeneralIcon
              :icon="getVariableIcon(variable) as any"
              class="w-4 h-4 text-nc-content-gray-subtle stroke-transparent"
            />
            <div class="text-body text-nc-content-gray-emphasis line-clamp-1 truncate">{{ variable.name }}</div>
          </div>
          <NcButton type="text" size="xxsmall">
            <GeneralIcon
              icon="ncChevronRight"
              class="transition-all transform"
              :class="{
                'rotate-90': expandedItems.has(variable.key),
              }"
            />
          </NcButton>
        </div>
        <div v-if="expandedItems.has(variable.key)" class="cursor-auto">
          <template v-if="Array.isArray(getVariableValue(variable))">
            <template v-for="item in getArrayItems(variable)" :key="item.key">
              <div
                v-if="item.isPrimitive"
                class="flex items-center gap-4 overflow-x-hidden py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
                :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
              >
                <div class="flex items-center flex-1 gap-2 overflow-x-hidden">
                  <GeneralIcon icon="cellText" class="w-4 h-4 text-nc-content-gray-subtle" />
                  <div class="text-body text-nc-content-gray-emphasis line-clamp-1 truncate">{{ item.name }}</div>
                </div>
                <NcTooltip class="text-bodyDefaultSm truncate text-nc-content-gray-subtle" show-on-truncate-only>
                  <template #title>
                    {{ formatValue(item.value) }}
                  </template>
                  {{ formatValue(item.value) }}
                </NcTooltip>
              </div>

              <!-- Object array  - expandable with children -->
              <div v-else>
                <div
                  class="flex items-center gap-4 overflow-x-hidden justify-between py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium cursor-pointer"
                  :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
                  @click="expandedItems.has(item.key) ? expandedItems.delete(item.key) : expandedItems.add(item.key)"
                >
                  <div class="flex items-center flex-1 gap-2">
                    <GeneralIcon icon="cellJson" class="w-4 h-4 text-nc-content-gray-subtle stroke-transparent" />
                    <div class="text-body text-nc-content-gray-emphasis line-clamp-1 truncate">{{ item.name }}</div>
                  </div>
                  <NcButton type="text" size="xxsmall">
                    <GeneralIcon
                      icon="ncChevronRight"
                      class="transition-all transform"
                      :class="{
                        'rotate-90': expandedItems.has(item.key),
                      }"
                    />
                  </NcButton>
                </div>
                <div v-if="expandedItems.has(item.key)" class="cursor-auto">
                  <VariableDisplay v-if="item.children" :variables="item.children" :data="data" :depth="depth + 2" />
                </div>
              </div>
            </template>
            <VariableDisplay v-if="variable.children?.length" :variables="variable.children" :data="data" :depth="depth + 1" />
          </template>
          <!-- Object properties -->
          <template
            v-else-if="
              typeof getVariableValue(variable) === 'object' &&
              getVariableValue(variable) !== null &&
              !Array.isArray(getVariableValue(variable)) &&
              !variable.children?.length
            "
          >
            <div
              v-for="prop in getObjectProperties(variable)"
              :key="prop.key"
              class="flex items-center gap-4 overflow-x-hidden py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
              :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
            >
              <div class="flex items-center flex-1 gap-2">
                <GeneralIcon icon="cellText" class="w-4 h-4 text-nc-content-gray-subtle" />
                <div class="text-body text-nc-content-gray-emphasis line-clamp-1 truncate">{{ prop.name }}</div>
              </div>
              <NcTooltip class="text-bodyDefaultSm truncate text-nc-content-gray-subtle" show-on-truncate-only>
                <template #title>
                  {{ formatValue(prop.value) }}
                </template>
                {{ formatValue(prop.value) }}
              </NcTooltip>
            </div>
          </template>
          <template v-else-if="variable.children?.length">
            <VariableDisplay :variables="variable.children" :data="data" :depth="depth + 1" />
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.nc-variable-display {
  @apply select-none;
}
</style>
