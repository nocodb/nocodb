<script setup lang="ts">
import type { VariableDefinition } from 'nocodb-sdk'
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

  const key = variable.key
  const parts = key.split('.')
  let value = props.data

  for (const part of parts) {
    if (value === undefined || value === null) return undefined

    if (part.includes('[i]')) {
      const arrayKey = part.replace('[i]', '')
      value = value[arrayKey]
      if (Array.isArray(value)) {
        return value
      }
      return undefined
    }

    value = value[part]
  }

  return value
}

const isVariableExpandable = (variable: VariableDefinition) => {
  const value = getVariableValue(variable)

  if (variable.children?.length) return true

  if (Array.isArray(value) && value.length > 0) return true
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0
}

const getArrayItems = (variable: VariableDefinition) => {
  const value = getVariableValue(variable)
  if (!Array.isArray(value)) return []

  const itemSchema = variable.extra?.itemSchema

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
        const children: VariableDefinition[] = itemSchema.map((schemaDef) => ({
          key: `${variable.key}[${index}].${schemaDef.key}`,
          name: schemaDef.name,
          type: schemaDef.type,
          groupKey: schemaDef.groupKey,
          isArray: schemaDef.isArray,
          extra: {
            ...schemaDef.extra,
            value: item?.[schemaDef.key],
          },
          children: schemaDef.children,
        }))

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
      <div
        v-if="!isVariableExpandable(variable)"
        class="flex items-center py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
        :style="{ paddingLeft: `${depth * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
      >
        <div class="flex items-center flex-1 gap-2 pr-2">
          <GeneralIcon :icon="getVariableIcon(variable) as any" class="w-4 h-4 text-nc-content-gray-subtle stroke-transparent" />
          <div class="text-body text-nc-content-gray-emphasis">{{ variable.name }}</div>
        </div>

        <div class="text-bodyDefaultSm text-nc-content-gray-subtle truncate">{{ getVariableValue(variable) }}</div>
      </div>
      <div v-else>
        <div
          class="flex items-center justify-between py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium cursor-pointer"
          :style="{ paddingLeft: `${depth * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
          @click="expandedItems.has(variable.key) ? expandedItems.delete(variable.key) : expandedItems.add(variable.key)"
        >
          <div class="flex items-center flex-1 gap-2">
            <GeneralIcon
              :icon="getVariableIcon(variable) as any"
              class="w-4 h-4 text-nc-content-gray-subtle stroke-transparent"
            />
            <div class="text-body text-nc-content-gray-emphasis">{{ variable.name }}</div>
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
                class="flex items-center py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
                :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
              >
                <div class="flex items-center flex-1 gap-2">
                  <GeneralIcon icon="cellText" class="w-4 h-4 text-nc-content-gray-subtle" />
                  <div class="text-body text-nc-content-gray-emphasis">{{ item.name }}</div>
                </div>
                <div class="text-bodyDefaultSm truncate text-nc-content-gray-subtle">{{ formatValue(item.value) }}</div>
              </div>

              <!-- Object array  - expandable with children -->
              <div v-else>
                <div
                  class="flex items-center justify-between py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium cursor-pointer"
                  :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
                  @click="expandedItems.has(item.key) ? expandedItems.delete(item.key) : expandedItems.add(item.key)"
                >
                  <div class="flex items-center flex-1 gap-2">
                    <GeneralIcon icon="cellJson" class="w-4 h-4 text-nc-content-gray-subtle stroke-transparent" />
                    <div class="text-body text-nc-content-gray-emphasis">{{ item.name }}</div>
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
              !Array.isArray(getVariableValue(variable))
            "
          >
            <div
              v-for="prop in getObjectProperties(variable)"
              :key="prop.key"
              class="flex items-center py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
              :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
            >
              <div class="flex items-center flex-1 gap-2">
                <GeneralIcon icon="cellText" class="w-4 h-4 text-nc-content-gray-subtle" />
                <div class="text-body text-nc-content-gray-emphasis">{{ prop.name }}</div>
              </div>
              <div class="text-bodyDefaultSm truncate text-nc-content-gray-subtle">{{ formatValue(prop.value) }}</div>
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
