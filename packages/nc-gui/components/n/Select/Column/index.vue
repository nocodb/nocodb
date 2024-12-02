<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import type { NSelectColumnProps } from './types'

const props = withDefaults(defineProps<NSelectColumnProps>(), {
  placeholder: '-select a field-',
  includeSystem: false,
})

const nSelect = ref()

const modelValue = useVModel(props, 'modelValue')

const { getMeta } = useMetas()
const tableMeta = computedAsync(() => getMeta(props.tableId))

const columnsRef = shallowRef<ColumnType[]>([])

watch(
  () => [props.tableId, tableMeta],
  () => {
    console.log('Here')
    debugger
    if (!tableMeta.value || !tableMeta.value.columns) return []
    let columnsList = [...tableMeta.value.columns]
    if (!props.includeSystem) {
      columnsList = columnsList.filter((c) => !c.system)
    }
    if (props.filterColumns) {
      columnsList = columnsList.filter(props.filterColumns)
    }
    columnsRef.value = columnsList

    if (!nSelect.value) return
    if (columnsRef.value.length) {
      nSelect.value.selectValue(columnsRef.value[0].id)
    } else {
      nSelect.value.selectValue(undefined)
    }
  },
  { immediate: true },
)

defineExpose({
  columnsRef,
})
</script>

<template>
  <NSelect v-bind="props" ref="nSelect" v-model="modelValue">
    <a-select-option v-for="col of columnsRef" :key="col.title" :value="col.id">
      <div class="flex items-center gap-2 w-full">
        <SmartsheetHeaderIcon :column="col" />
        <NcTooltip class="truncate flex-1" show-on-truncate-only>
          <template #title>
            {{ col.title }}
          </template>
          {{ col.title }}
        </NcTooltip>
        <component
          :is="iconMap.check"
          v-if="modelValue === col.id"
          id="nc-selected-item-icon"
          class="flex-none text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NSelect>
</template>
