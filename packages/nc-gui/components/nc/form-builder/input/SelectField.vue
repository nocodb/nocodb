<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
interface Props {
  value?: string | string[] | null
  tableId?: string
  options?: any[]
  multiple?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:value': [value: string | string[] | null | undefined]
}>()

const modelValue = useVModel(props, 'value', emit)

const isOpenColumnSelectDropdown = ref(false)

const columnList = computed(() => {
  return (props.options || []).map((opt: any) => ({
    label: opt.label,
    value: opt.value,
    ncItemDisabled: opt.ncItemDisabled || false,
    ncItemTooltip: opt.ncItemTooltip || '',
    ...opt,
  }))
})

const columnListMap = computed(() => {
  if (!columnList.value || columnList.value.length === 0) return new Map()
  return new Map(columnList.value.map((column) => [column.value, column]))
})

const selectedColumn = computed(() => {
  if (!columnListMap.value || columnListMap.value.size === 0) return undefined
  if (props.multiple && Array.isArray(modelValue.value)) {
    return modelValue.value.map((val) => columnListMap.value.get(val)).filter(Boolean)
  }
  return columnListMap.value.get(modelValue.value as string) || undefined
})

const selectedColumnLabel = computed(() => {
  if (!selectedColumn.value) return '-- Select field --'
  if (Array.isArray(selectedColumn.value)) {
    return selectedColumn.value.length > 0
      ? `${selectedColumn.value.length} field${selectedColumn.value.length > 1 ? 's' : ''} selected`
      : '-- Select field --'
  }
  return selectedColumn.value.label
})

const handleValueUpdate = (value: any) => {
  modelValue.value = value
}
</script>

<template>
  <NcListDropdown v-model:is-open="isOpenColumnSelectDropdown" :has-error="!!selectedColumn?.ncItemDisabled">
    <div class="flex-1 flex items-center gap-2 min-w-0">
      <div v-if="selectedColumn && !Array.isArray(selectedColumn)" class="min-w-5 flex items-center justify-center">
        <SmartsheetHeaderIcon :column="selectedColumn.column as ColumnType" color="text-nc-content-gray-muted" />
      </div>
      <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
        <span
          class="text-sm flex-1 truncate"
          :class="{
            'text-nc-content-gray-muted': !selectedColumn || (Array.isArray(selectedColumn) && selectedColumn.length === 0),
          }"
        >
          {{ selectedColumnLabel }}
        </span>

        <template #title>
          {{ selectedColumnLabel }}
        </template>
      </NcTooltip>

      <GeneralIcon
        icon="ncChevronDown"
        class="flex-none h-4 w-4 transition-transform opacity-70"
        :class="{ 'transform rotate-180': isOpenColumnSelectDropdown }"
      />
    </div>
    <template #overlay="{ onEsc }">
      <NcList
        v-model:open="isOpenColumnSelectDropdown"
        :value="multiple ? (Array.isArray(modelValue) ? modelValue : []) : modelValue || ''"
        :list="columnList"
        variant="medium"
        :close-on-select="!multiple"
        :is-multi-select="multiple"
        class="!w-auto"
        wrapper-class-name="!h-auto"
        @update:value="handleValueUpdate"
        @escape="onEsc"
      >
        <template #listItemExtraLeft="{ option }">
          <div class="min-w-5 flex items-center justify-center">
            <SmartsheetHeaderIcon :column="option.column as ColumnType" color="text-nc-content-gray-muted" />
          </div>
        </template>
      </NcList>
    </template>
  </NcListDropdown>
</template>
