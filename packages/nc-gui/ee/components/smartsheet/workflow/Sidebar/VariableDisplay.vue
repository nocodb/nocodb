<script setup lang="ts">
import type { VariableDefinition } from 'nocodb-sdk'
import VariableDisplay from '~/components/smartsheet/workflow/Sidebar/VariableDisplay.vue'

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

  return value.map((item, index) => ({
    key: `${variable.key}[${index}]`,
    name: `${variable.name} ${index + 1}`,
    value: item,
    index,
  }))
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
        <div class="flex items-center flex-1 gap-2">
          <GeneralIcon :icon="getVariableIcon(variable) as any" class="w-4 h-4 text-nc-content-gray-subtle" />
          <div class="text-captionBold text-nc-content-gray-emphasis">{{ variable.name }}</div>
        </div>

        <div class="text-body text-nc-content-gray-subtle">{{ getVariableValue(variable) }}</div>
      </div>
      <div v-else>
        <div
          class="flex items-center justify-between py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium cursor-pointer"
          :style="{ paddingLeft: `${depth * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
          @click="expandedItems.has(variable.key) ? expandedItems.delete(variable.key) : expandedItems.add(variable.key)"
        >
          <div class="flex items-center flex-1 gap-2">
            <GeneralIcon :icon="getVariableIcon(variable) as any" class="w-4 h-4 text-nc-content-gray-subtle" />
            <div class="text-captionBold text-nc-content-gray-emphasis">{{ variable.name }}</div>
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
        <div v-if="expandedItems.has(variable.key)">
          <template v-if="variable.children?.length">
            <VariableDisplay :variables="variable.children" :data="data" :depth="depth + 1" />
          </template>
          <template v-else-if="Array.isArray(getVariableValue(variable))">
            <div
              v-for="item in getArrayItems(variable)"
              :key="item.key"
              class="flex items-center py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
              :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
            >
              <div class="flex items-center flex-1 gap-2">
                <GeneralIcon icon="cellJson" class="w-4 h-4 text-nc-content-gray-subtle" />
                <div class="text-captionBold text-nc-content-gray-emphasis">{{ item.name }}</div>
              </div>
              <div class="text-body text-nc-content-gray-subtle">{{ formatValue(item.value) }}</div>
            </div>
          </template>
          <template v-else>
            <div
              v-for="prop in getObjectProperties(variable)"
              :key="prop.key"
              class="flex items-center py-1 hover:bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-extralight hover:bg-nc-bg-gray-medium"
              :style="{ paddingLeft: `${(depth + 1) * 1 + 0.75}rem`, paddingRight: '0.75rem' }"
            >
              <div class="flex items-center flex-1 gap-2">
                <GeneralIcon icon="cellText" class="w-4 h-4 text-nc-content-gray-subtle" />
                <div class="text-captionBold text-nc-content-gray-emphasis">{{ prop.name }}</div>
              </div>
              <div class="text-body text-nc-content-gray-subtle">{{ formatValue(prop.value) }}</div>
            </div>
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
