<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isAttachment, isButton, isBarcode, isQrCode, isSystemColumn } from 'nocodb-sdk'

const emit = defineEmits<{
  'update:category': [category: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const modelId = computed(() => selectedWidget.value?.fk_model_id || null)
const selectedFieldId = ref(selectedWidget.value?.config?.data?.category?.column_id || null)
const selectedOrderValue = ref(selectedWidget.value?.config?.data?.category?.orderBy || 'default')
const includeEmptyRecords = ref(selectedWidget.value?.config?.data?.category?.includeEmptyRecords || false)
const includeOthers = ref(selectedWidget.value?.config?.data?.category?.includeOthers || true)

const fieldOrderOptions = [
  { value: 'default', label: 'Default field order' },
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]

const filterField = (column: ColumnType) => {
  if (isSystemColumn(column) || isAttachment(column) || isQrCode(column) || isBarcode(column) || isButton(column)) {
    return false
  }
  return true
}

const handleChange = () => {
  emit('update:category', {
    column_id: selectedFieldId.value,
    orderBy: selectedOrderValue.value,
    includeEmptyRecords: includeEmptyRecords.value,
    includeOthers: includeOthers.value,
  })
}

watch([() => selectedWidget.value?.fk_model_id], ([value], [oldValue]) => {
  if (value !== oldValue) {
    selectedFieldId.value = null
  }
  handleChange()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="text-nc-content-gray text-bodyBold">Category</div>
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Field</label>
      <NcListColumnSelector
        v-model:value="selectedFieldId"
        :disabled="!modelId"
        :table-id="modelId!"
        :filter-column="filterField"
        @update:value="handleChange"
        disable-label
      />
    </div>

    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Order</label>
      <a-select
        v-model:value="selectedOrderValue"
        :disabled="!selectedFieldId"
        :options="fieldOrderOptions"
        class="nc-select-shadow"
        placeholder="Aggregation"
        @update:value="handleChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-700" />
        </template>
      </a-select>
    </div>

    <div>
      <NcSwitch v-model:checked="includeEmptyRecords" @change="handleChange">
        <span class="text-caption text-nc-content-gray select-none">Include empty records</span>
      </NcSwitch>
    </div>
    <div class="flex items-center">
      <NcSwitch class="flex items-center" v-model:checked="includeOthers" @change="handleChange">
        <span class="text-caption text-nc-content-gray select-none">
          <NcTooltip class="flex items-center">
            <template #title>
              By default the chart will show top 10 categories and remaining categories will be grouped as "Others".
              Disabling this will hide "Others" category.
            </template>
            Include others
          </NcTooltip>
        </span>
      </NcSwitch>
    </div>
  </div>
</template>
