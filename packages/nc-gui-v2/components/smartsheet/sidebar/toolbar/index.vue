<script lang="ts" setup>
import AddRow from './AddRow.vue'
import LockMenu from './LockMenu.vue'
import Reload from './Reload.vue'
import ExportCache from './ExportCache.vue'
import DeleteCache from './DeleteCache.vue'
import DebugMeta from './DebugMeta.vue'
import ToggleDrawer from './ToggleDrawer.vue'
import { IsFormInj } from '#imports'

const { isUIAllowed } = useUIPermission()

const isForm = inject(IsFormInj)

const debug = $ref(false)

const clickCount = $ref(0)

const { isOpen } = useSidebar({ storageKey: 'nc-right-sidebar' })
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

    <template v-if="debug">
      <ExportCache />

      <div class="dot" />

      <DeleteCache />

      <div class="dot" />

      <DebugMeta />

      <div class="dot" />
    </template>
    <!--    <h3 class="pt-3 px-3 text-xs text-gray-500 font-semibold">{{ $t('objects.views') }}</h3> -->

    <!--    <LockMenu v-if="isUIAllowed('view-type')" @click.stop /> -->

    <!--    <div v-if="isUIAllowed('view-type')" class="dot" /> -->

    <!--    <Reload @click.stop /> -->

    <!--    <div class="dot" /> -->

    <!--    <AddRow v-if="isUIAllowed('xcDatatableEditable')" @click.stop /> -->

    <!--    <div :class="{ 'w-[calc(100%_+_16px)] h-[1px] bg-gray-200 mt-1 -ml-1': !isOpen, 'dot': isOpen }" /> -->

    <ToggleDrawer />
    <span></span>
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
