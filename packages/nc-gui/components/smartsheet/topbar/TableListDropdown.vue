<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

const { activeTable, activeTables } = storeToRefs(useTablesStore())

const { openTable } = useTablesStore()

const isOpen = ref<boolean>(false)

/**
 * Handles navigation to a selected table.
 * 
 * @param {TableType} table - The table to navigate to.
 * @returns {void}
 * 
 * @description
 * This function is called when a user selects a table from the dropdown list.
 * It checks if the table has a valid ID and then opens the selected table.
 */

const handleNavigateToTable = (table: TableType) => {
  if (table?.id) {
    openTable(table)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen">
    <slot name="default" :isOpen="isOpen"></slot>
    <template #overlay>
      <NcList
        v-model:open="isOpen"
        :value="activeTable.id"
        @change="handleNavigateToTable"
        :list="activeTables"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search tables"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralIcon icon="table" class="min-w-4 !text-gray-600" />
              </template>
            </LazyGeneralEmojiPicker>
          </div>
          <NcTooltip class="truncate flex-1" show-on-truncate-only>
            <template #title>
              {{ option?.title }}
            </template>
            {{ option?.title }}
          </NcTooltip>
          <GeneralIcon
            v-if="option.id === activeTable.id"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>
      </NcList>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scopped></style>
