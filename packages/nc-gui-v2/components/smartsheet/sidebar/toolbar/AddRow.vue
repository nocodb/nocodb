<script setup lang="ts">
import { OpenNewRecordFormHookInj, inject } from '#imports'

const { isOpen } = useSidebar({ storageKey: 'nc-right-sidebar' })
const isLocked = inject(IsLockedInj)

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj)!

const onClick = () => {
  if (!isLocked) openNewRecordFormHook.trigger()
}
</script>

<template>
  <a-tooltip :placement="isOpen ? 'bottomRight' : 'left'">
    <template #title> {{ $t('activity.addRow') }} </template>
    <div
      :class="{ 'hover:after:bg-primary/75 group': !isLocked, 'disabled-ring': isLocked }"
      class="nc-sidebar-right-item nc-sidebar-add-row"
    >
      <MdiPlusOutline :class="{ 'cursor-pointer group-hover:(!text-white)': !isLocked, 'disabled': isLocked }" @click="onClick" />
    </div>
  </a-tooltip>
</template>
