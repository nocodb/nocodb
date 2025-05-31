<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { base } = storeToRefs(useBase())

const tablesStore = useTablesStore()

const { activeTable, activeTables } = storeToRefs(tablesStore)

const { openTable, openTableCreateDialog: _openTableCreateDialog } = tablesStore

const isOpen = ref<boolean>(false)

const activeTableSourceIndex = computed(() => base.value?.sources?.findIndex((s) => s.id === activeTable.value?.source_id) ?? -1)

const filteredTableList = computed(() => {
  return activeTables.value.filter((t: TableType) => t?.source_id === activeTable.value?.source_id) || []
})

/**
 * Handles navigation to a selected table.
 *
 * @param table - The table to navigate to.
 *
 * @remarks
 * This function is called when a user selects a table from the dropdown list.
 * It checks if the table has a valid ID and then opens the selected table.
 */
const handleNavigateToTable = (table: TableType) => {
  if (table?.id) {
    openTable(table)
  }
}

function openTableCreateDialog() {
  $e('c:table:create:topbar')

  if (activeTableSourceIndex.value === -1) return

  isOpen.value = false

  _openTableCreateDialog({ baseId: base.value?.id, sourceId: base.value!.sources?.[activeTableSourceIndex.value].id })
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" overlay-class-name="max-w-64">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-model:open="isOpen"
        :value="activeTable.id"
        :list="filteredTableList"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search tables"
        class="min-w-64 !w-auto"
        @change="handleNavigateToTable"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralIcon icon="table" class="min-w-4 !text-gray-500" />
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

        <template
          v-if="
            !isMobileMode &&
            isUIAllowed('tableCreate', {
              roles: base?.project_role || base?.workspace_role,
              source: base?.sources?.[activeTableSourceIndex] || {},
            })
          "
          #listFooter
        >
          <NcDivider class="!mt-0 !mb-2" />
          <div class="px-2 mb-2" @click="openTableCreateDialog()">
            <div
              class="px-2 py-1.5 flex items-center justify-between gap-2 text-sm font-weight-500 !text-brand-500 hover:bg-gray-100 rounded-md cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="plus" />
                <div>
                  {{
                    $t('general.createEntity', {
                      entity: $t('objects.table'),
                    })
                  }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </LazyNcList>
    </template>
  </NcDropdown>
</template>
