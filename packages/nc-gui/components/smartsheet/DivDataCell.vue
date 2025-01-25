<script lang="ts" setup>
const el = ref()

const cellClickHook = createEventHook()

provide(OnDivDataCellEventHookInj, cellClickHook)

provide(CurrentCellInj, el)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const onTabPress = () => {
  if (!isExpandedFormOpen.value && !isForm.value) return

  // Find the focused element
  const focusedElement = document.activeElement

  if (focusedElement) {
    // Check if the focused element is a descendant of the wrapper
    const closestWrapper = focusedElement.closest('.nc-data-cell')

    // Scroll it into view
    if (closestWrapper === el.value) {
      el.value?.scrollIntoView({ block: 'center' })
    }
  }
}
</script>

<template>
  <div ref="el" class="select-none nc-data-cell" @keydown.tab="onTabPress" @click="cellClickHook.trigger($event)">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500 !rounded-lg !shadow-none !ring-0;
}
.nc-data-cell {
  @apply border-1 border-gray-200 overflow-hidden rounded-lg;
}
</style>
