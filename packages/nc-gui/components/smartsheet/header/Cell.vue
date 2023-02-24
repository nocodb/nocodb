<script setup lang="ts">
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'
import { ColumnInj, IsFormInj, IsKanbanInj, inject, provide, ref, toRef, useUIPermission } from '#imports'

interface Props {
  column: ColumnType
  required?: boolean | number
  hideMenu?: boolean
}

const props = defineProps<Props>()

const hideMenu = toRef(props, 'hideMenu')

const isForm = inject(IsFormInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const column = toRef(props, 'column')

const { isUIAllowed } = useUIPermission()

provide(ColumnInj, column)

const editColumnDropdown = ref(false)

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const addField = async (payload) => {
  columnOrder.value = payload
  editColumnDropdown.value = true
}

const closeAddColumnDropdown = () => {
  columnOrder.value = null
  editColumnDropdown.value = false
}

const openHeaderMenu = () => {
  if (!isForm && isUIAllowed('edit-column')) {
    editColumnDropdown.value = true
  }
}
</script>

<template>
  <div
    class="flex items-center w-full text-xs text-gray-500 font-weight-medium"
    :class="{ 'h-full': column, '!text-gray-400': isKanban }"
  >
    <SmartsheetHeaderCellIcon v-if="column" />
    <span
      v-if="column"
      class="name cursor-pointer"
      style="white-space: nowrap"
      :title="column.title"
      @dblclick="openHeaderMenu"
      >{{ column.title }}</span>

    <span v-if="(column.rqd && !column.cdf) || required" class="text-red-500">&nbsp;*</span>

    <template v-if="!hideMenu">
      <div class="flex-1" />

      <LazySmartsheetHeaderMenu v-if="!isForm && isUIAllowed('edit-column')" @add-column="addField" @edit="openHeaderMenu" />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      class="h-full"
      :trigger="['click']"
      placement="bottomRight"
      overlay-class-name="nc-dropdown-edit-column"
    >
      <div />

      <template #overlay>
        <SmartsheetColumnEditOrAddProvider
          v-if="editColumnDropdown"
          :column="columnOrder ? null : column"
          :column-position="columnOrder"
          class="w-full"
          @submit="closeAddColumnDropdown"
          @cancel="closeAddColumnDropdown"
          @click.stop
          @keydown.stop
        />
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
