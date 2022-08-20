<script lang="ts" setup>
import ExportCache from './ExportCache.vue'
import DeleteCache from './DeleteCache.vue'
import DebugMeta from './DebugMeta.vue'
import ToggleDrawer from './ToggleDrawer.vue'
import { IsFormInj } from '#imports'

const isForm = inject(IsFormInj)

const debug = $ref(false)

const clickCount = $ref(0)
</script>

<template>
  <div
    v-if="!isForm"
    class="flex gap-2 justify-start"
    @click="
      () => {
        clickCount = clickCount + 1
        debug = clickCount >= 4
      }
    "
  >
    <slot name="start" />
    <ToggleDrawer />
    <span></span>
    <template v-if="debug">
      <ExportCache />

      <div class="dot" />

      <DeleteCache />

      <div class="dot" />

      <DebugMeta />

      <div class="dot" />
    </template>

    <slot name="end" />
  </div>
  <div v-else>
    <slot name="start" />
  </div>
</template>

<style scoped>
:deep(.nc-toolbar-btn) {
  @apply border-0 !text-xs font-semibold px-2;
}

.dot {
  @apply w-[3px] h-[3px] bg-gray-300 rounded-full;
}
</style>
