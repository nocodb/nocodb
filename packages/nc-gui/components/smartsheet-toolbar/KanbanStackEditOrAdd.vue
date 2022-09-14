<script setup lang="ts">
import { ActiveViewInj, IsLockedInj, MetaInj, useKanbanViewData } from '#imports'

const meta = inject(MetaInj)!

const activeView = inject(ActiveViewInj)!

const { isUIAllowed } = useUIPermission()

const {
  loadKanbanData,
  loadKanbanMeta,
  kanbanMetaData,
  formattedData,
  updateOrSaveRow,
  updateKanbanMeta,
  addEmptyRow,
  groupingFieldColOptions,
  groupingField,
  groupingFieldColumn,
} = useKanbanViewData(meta, activeView as any)

const isLocked = inject(IsLockedInj, ref(false))

const addOrEditStackDropdown = ref(false)

provide(IsKanbanInj, ref(true))
</script>

<template>
  <a-dropdown v-if="isUIAllowed('edit-column')" v-model:visible="addOrEditStackDropdown" :trigger="['click']">
    <a-button v-t="['c:kanban-stack-edit-or-add']" class="nc-fields-menu-btn nc-toolbar-btn" :disabled="isLocked">
      <div class="flex items-center gap-1">
        <mdi-plus-circle-outline />
        <span class="text-capitalize !text-sm font-weight-normal">
          <!-- TODO: i18n -->
          Add / Edit Stack
        </span>
        <MdiMenuDown class="text-grey" />
      </div>
    </a-button>

    <template #overlay>
      <SmartsheetColumnEditOrAddProvider
        v-if="addOrEditStackDropdown"
        :column="groupingFieldColumn"
        @submit="
          ;async () => {
            addOrEditStackDropdown = false
            await loadKanbanMeta()
            await loadKanbanData()
          }
        "
        @cancel="addOrEditStackDropdown = false"
        @click.stop
        @keydown.stop
      />
    </template>
  </a-dropdown>
</template>
