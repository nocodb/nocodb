<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { ColumnInj, IsFormInj, inject, provide, ref, toRef, useUIPermission } from '#imports'

const props = defineProps<{ column: ColumnType & { meta: any }; required?: boolean | number; hideMenu?: boolean }>()

const hideMenu = toRef(props, 'hideMenu')

const isForm = inject(IsFormInj, ref(false))

const column = toRef(props, 'column')

const { isUIAllowed } = useUIPermission()

provide(ColumnInj, column)

const editColumnDropdown = ref(false)
</script>

<template>
  <div class="flex items-center w-full text-xs text-normal text-gray-500 font-weight-medium" :class="{ 'h-full': column }">
    <SmartsheetHeaderCellIcon v-if="column" />
    <span v-if="column" class="name" style="white-space: nowrap" :title="column.title">{{ column.title }}</span>
    <span v-if="(column.rqd && !column.cdf) || required" class="text-red-500">&nbsp;*</span>

    <template v-if="!hideMenu">
      <div class="flex-1" />
      <SmartsheetHeaderMenu v-if="!isForm && isUIAllowed('edit-column')" @edit="editColumnDropdown = true" />
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
          :column="column"
          class="w-full"
          @submit="editColumnDropdown = false"
          @cancel="editColumnDropdown = false"
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
