<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { inject, toRef } from 'vue'
import { ColumnInj, IsFormInj, MetaInj } from '~/context'
import { useProvideColumnCreateStore } from '#imports'

const props = defineProps<{ column: ColumnType & { meta: any }; required?: boolean; hideMenu?: boolean }>()

const hideMenu = toRef(props, 'hideMenu')

const meta = inject(MetaInj)

const isForm = inject(IsFormInj, ref(false))

const column = toRef(props, 'column')

const { isUIAllowed } = useUIPermission()

provide(ColumnInj, column)

const editColumnDropdown = ref(false)

function onVisibleChange() {
  // only allow to close the EditOrAdd component
  // by clicking cancel button
  editColumnDropdown.value = true
}

// instantiate column update store
useProvideColumnCreateStore(meta as Ref<TableType>, column)
</script>

<template>
  <div class="flex align-center w-full text-xs font-weight-regular">
    <SmartsheetHeaderCellIcon v-if="column" />
    <span v-if="column" class="name" style="white-space: nowrap" :title="column.title">{{ column.title }}</span>
    <span v-if="(column.rqd && !column.cdf) || required" class="text-red-500">&nbsp;*</span>

    <template v-if="!hideMenu">
      <div class="flex-1" />
      <SmartsheetHeaderMenu v-if="!isForm && isUIAllowed('edit-column')" @edit="editColumnDropdown = true" />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      :trigger="['click']"
      placement="bottomRight"
      @visible-change="onVisibleChange"
    >
      <div />
      <template #overlay>
        <SmartsheetColumnEditOrAdd
          class="w-full"
          :edit-column-dropdown="editColumnDropdown"
          @click.stop
          @keydown.stop
          @cancel="editColumnDropdown = false"
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
