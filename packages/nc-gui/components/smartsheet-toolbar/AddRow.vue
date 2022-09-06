<script setup lang="ts">
import { OpenNewRecordFormHookInj, inject } from '#imports'

const isLocked = inject(IsLockedInj)

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj)!

const onClick = () => {
  if (!isLocked?.value) openNewRecordFormHook.trigger()
}
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> {{ $t('activity.addRow') }} </template>
    <div :class="{ 'group': !isLocked, 'disabled-ring': isLocked }" class="nc-add-new-row-btn flex align-center">
      <MdiPlusOutline
        :class="{ 'cursor-pointer text-gray-500 group-hover:(text-primary)': !isLocked, 'disabled': isLocked }"
        @click="onClick"
      />
    </div>
  </a-tooltip>
</template>
