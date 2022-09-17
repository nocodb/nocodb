<script setup lang="ts">
import { ActiveViewInj, IsLockedInj, MetaInj, useKanbanViewData } from '#imports'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { isUIAllowed } = useUIPermission()

const { loadKanbanData, loadKanbanMeta, groupingFieldColumn } = useKanbanViewData(meta, activeView)

const isLocked = inject(IsLockedInj, ref(false))

const addOrEditStackDropdown = ref(false)

const handleSubmit = async () => {
  addOrEditStackDropdown.value = false
}

provide(IsKanbanInj, ref(true))
</script>

<template>
  <a-dropdown
    v-if="isUIAllowed('edit-column')"
    v-model:visible="addOrEditStackDropdown"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-kanban-add-edit-stack-menu"
  >
    <div class="nc-kanban-btn">
      <a-button
        v-e="['c:kanban-stack-edit-or-add']"
        class="nc-kanban-add-edit-stack-menu-btn nc-toolbar-btn"
        :disabled="isLocked"
      >
        <div class="flex items-center gap-1">
          <mdi-plus-circle-outline />
          <span class="text-capitalize !text-sm font-weight-normal">
            <!-- TODO: i18n -->
            Add / Edit Stack
          </span>
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <SmartsheetColumnEditOrAddProvider
        v-if="addOrEditStackDropdown"
        :column="groupingFieldColumn"
        @submit="handleSubmit"
        @cancel="addOrEditStackDropdown = false"
        @click.stop
        @keydown.stop
      />
    </template>
  </a-dropdown>
</template>
