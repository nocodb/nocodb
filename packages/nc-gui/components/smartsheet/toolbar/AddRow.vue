<script setup lang="ts">
import { IsLockedInj, OpenNewRecordFormHookInj, iconMap, inject } from '#imports'

const isLocked = inject(IsLockedInj)

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj)!

const onClick = () => {
  if (!isLocked?.value) openNewRecordFormHook.trigger()
}
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> {{ $t('activity.addRow') }} </template>
    <div
      v-e="['c:row:add:grid-top']"
      :class="{ 'group': !isLocked, 'disabled-ring': isLocked }"
      class="nc-add-new-row-btn nc-toolbar-btn flex !p-0 w-7 h-7 items-center justify-center select-none cursor-pointer"
    >
      <component :is="iconMap.plus" :class="{ 'group-hover:(text-black)': !isLocked, 'disabled': isLocked }" @click="onClick" />
    </div>
  </a-tooltip>
</template>
