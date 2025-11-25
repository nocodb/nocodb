<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'

const dedupe = useDedupeOrThrow()

const filterOption = (input: string, option: { key: string }) => {
  return option.key?.toLowerCase()?.includes(input?.toLowerCase())
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <div>
      <h2 class="text-lg font-semibold mb-2">Find Duplicates</h2>
      <p class="text-sm text-gray-600 mb-4">
        Select a table and fields to identify duplicate records. Records with matching values in all selected fields will
        be considered duplicates.
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <div>
        <label class="block text-sm font-medium mb-1">Table</label>
        <NcSelect
          v-model:value="dedupe.config.value.selectedTableId"
          class="w-full"
          placeholder="-select table-"
          :filter-option="filterOption"
          :show-search="dedupe.tableList.value.length > 6"
          @change="dedupe.onTableSelect"
        >
          <a-select-option v-for="table of dedupe.tableList.value" :key="table.value" :value="table.value">
            <div class="w-full flex items-center gap-2">
              <GeneralTableIcon size="xsmall" :meta="table.tableMeta" />
              <span>{{ table.label }}</span>
            </div>
          </a-select-option>
        </NcSelect>
      </div>

      <div v-if="dedupe.config.value.selectedTableId">
        <label class="block text-sm font-medium mb-1">View (Optional)</label>
        <NcSelect
          v-model:value="dedupe.config.value.selectedViewId"
          class="w-full"
          placeholder="-select view-"
          :filter-option="filterOption"
          :show-search="dedupe.viewList.value.length > 6"
          @change="dedupe.onViewSelect"
        >
          <a-select-option v-for="view of dedupe.viewList.value" :key="view.value" :value="view.value">
            {{ view.label }}
          </a-select-option>
        </NcSelect>
      </div>

      <div v-if="dedupe.config.value.selectedTableId && dedupe.availableFields.value.length > 0">
        <label class="block text-sm font-medium mb-1">Fields for Duplicate Detection</label>
        <p class="text-xs text-gray-500 mb-2">
          Select one or more fields. Records with matching values in all selected fields will be considered duplicates.
        </p>
        <div class="flex flex-col gap-2 max-h-60 overflow-y-auto border rounded-lg p-2">
          <a-checkbox-group v-model:value="dedupe.config.value.selectedFieldIds" class="w-full">
            <div v-for="field of dedupe.availableFields.value" :key="field.id" class="py-1">
              <a-checkbox :value="field.id">
                <span>{{ field.title }}</span>
                <span class="text-xs text-gray-400 ml-1">({{ field.uidt }})</span>
              </a-checkbox>
            </div>
          </a-checkbox-group>
        </div>
      </div>

      <div v-if="dedupe.config.value.selectedTableId && dedupe.availableFields.value.length === 0" class="text-sm text-gray-500">
        No suitable fields available for duplicate detection in this table.
      </div>

      <div class="flex gap-2 mt-4">
        <NcButton
          type="primary"
          :disabled="!dedupe.config.value.selectedTableId || dedupe.config.value.selectedFieldIds.length === 0 || dedupe.isFindingDuplicates.value"
          :loading="dedupe.isFindingDuplicates.value"
          @click="dedupe.findDuplicates"
        >
          Find Duplicates
        </NcButton>
      </div>
    </div>
  </div>
</template>
