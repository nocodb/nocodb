<script setup lang="ts">
import { IsKanbanInj, IsLockedInj, IsPublicInj, inject, provide, ref, useKanbanViewStoreOrThrow, useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()

const { groupingFieldColumn } = useKanbanViewStoreOrThrow()

const isLocked = inject(IsLockedInj, ref(false))

const addOrEditStackDropdown = ref(false)

const IsPublic = inject(IsPublicInj, ref(false))

const handleSubmit = async () => {
  addOrEditStackDropdown.value = false
}

provide(IsKanbanInj, ref(true))
</script>

<template>
  <a-dropdown
    v-if="!IsPublic && isUIAllowed('edit-column')"
    v-model:visible="addOrEditStackDropdown"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-kanban-add-edit-stack-menu"
  >
    <div class="nc-kanban-btn">
      <a-button
        v-e="['c:kanban:edit-or-add-stack']"
        class="nc-kanban-add-edit-stack-menu-btn nc-toolbar-btn"
        :disabled="isLocked"
      >
        <div class="flex items-center gap-1">
          <MdiPlusCircleOutline />
          <span class="text-capitalize !text-sm font-weight-normal">
            {{ $t('activity.kanban.addOrEditStack') }}
          </span>
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <LazySmartsheetColumnEditOrAddProvider
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
