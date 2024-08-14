<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { base } = storeToRefs(useBase())

const { activeTable, activeTables } = storeToRefs(useTablesStore())

const { openTable } = useTablesStore()

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

/**
 * Opens a dialog to create a new table.
 *
 * @returns void
 *
 * @remarks
 * This function is triggered when the user initiates the table creation process from the topbar.
 * It emits a tracking event, checks for a valid source, and opens a dialog for table creation.
 * The function also handles the dialog closure and potential scrolling to the newly created table.
 *
 * @see {@link packages/nc-gui/components/dashboard/TreeView/ProjectNode.vue} for a similar implementation
 * of table creation dialog. If this function is updated, consider updating the other implementation as well.
 */
function openTableCreateDialog() {
  $e('c:table:create:topbar')

  if (activeTableSourceIndex.value === -1) return

  isOpen.value = false

  const isCreateTableOpen = ref(true)
  const sourceId = base.value!.sources?.[activeTableSourceIndex.value].id

  if (!sourceId || !base.value?.id) return

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isCreateTableOpen,
    sourceId, // || sources.value[0].id,
    'baseId': base.value!.id,
    'onCreate': closeDialog,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isCreateTableOpen.value = false

    if (!table) return

    // TODO: Better way to know when the table node dom is available
    setTimeout(() => {
      const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
      if (!newTableDom) return

      // Scroll to the table node
      newTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 1000)

    close(1000)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-model:open="isOpen"
        :value="activeTable.id"
        :list="filteredTableList"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search tables"
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

<style lang="scss" scoped></style>
