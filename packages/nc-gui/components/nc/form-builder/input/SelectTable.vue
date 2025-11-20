<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'
interface Props {
  value?: string | string[] | null
  baseId?: string
  options?: any[]
  multiple?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:value': [value: string | string[] | null | undefined]
}>()

const modelValue = useVModel(props, 'value', emit)

const options = toRef(props, 'options')

const isOpenTableSelectDropdown = ref(false)

const tableList = computed(() => {
  return (options.value || []).map((opt: any) => ({
    label: opt.label,
    value: opt.value,
    ncItemDisabled: opt.ncItemDisabled || false,
    ncItemTooltip: opt.ncItemTooltip || '',
    ...opt,
  }))
})

const tableListMap = computed(() => {
  if (!tableList.value || tableList.value.length === 0) return new Map()
  return new Map(tableList.value.map((table) => [table.value, table]))
})

const selectedTable = computed(() => {
  if (!tableListMap.value || tableListMap.value.size === 0) return undefined
  if (props.multiple && Array.isArray(modelValue.value)) {
    return modelValue.value.map((val) => tableListMap.value.get(val)).filter(Boolean)
  }
  return tableListMap.value.get(modelValue.value as string) || undefined
})

const selectedTableLabel = computed(() => {
  if (!selectedTable.value) return '-- Select table --'
  if (Array.isArray(selectedTable.value)) {
    return selectedTable.value.length > 0
      ? `${selectedTable.value.length} table${selectedTable.value.length > 1 ? 's' : ''} selected`
      : '-- Select table --'
  }
  return selectedTable.value.label
})

const handleValueUpdate = (value: any) => {
  modelValue.value = value
}
</script>

<template>
  <NcListDropdown v-model:is-open="isOpenTableSelectDropdown" :has-error="!!selectedTable?.ncItemDisabled">
    <div class="flex-1 flex items-center gap-2 min-w-0">
      <div v-if="selectedTable && !Array.isArray(selectedTable)" class="min-w-5 flex items-center justify-center">
        <NcIconTable :table="selectedTable.table as TableType" class="text-nc-content-muted" />
      </div>
      <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
        <span
          class="text-sm flex-1 truncate"
          :class="{
            'text-nc-content-gray-muted': !selectedTable || (Array.isArray(selectedTable) && selectedTable.length === 0),
          }"
        >
          {{ selectedTableLabel }}
        </span>

        <template #title>
          {{ selectedTableLabel }}
        </template>
      </NcTooltip>

      <GeneralIcon
        icon="ncChevronDown"
        class="flex-none h-4 w-4 transition-transform opacity-70"
        :class="{ 'transform rotate-180': isOpenTableSelectDropdown }"
      />
    </div>
    <template #overlay="{ onEsc }">
      <NcList
        v-model:open="isOpenTableSelectDropdown"
        :value="multiple ? (Array.isArray(modelValue) ? modelValue : []) : modelValue || ''"
        :list="tableList"
        variant="medium"
        class="!w-auto"
        :close-on-select="!multiple"
        :is-multi-select="multiple"
        wrapper-class-name="!h-auto"
        @update:value="handleValueUpdate"
        @escape="onEsc"
      >
        <template #listItemExtraLeft="{ option }">
          <div class="min-w-5 flex items-center justify-center">
            <NcIconTable :table="option.table as TableType" class="text-nc-content-muted" />
          </div>
        </template>
      </NcList>
    </template>
  </NcListDropdown>
</template>
