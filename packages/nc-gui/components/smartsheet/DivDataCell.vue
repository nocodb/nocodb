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
  @apply !border-1 !border-nc-border-brand !rounded-lg !shadow-none !ring-0;
}
.nc-data-cell {
  @apply border-1 border-nc-border-gray-medium overflow-hidden rounded-lg;
}
/* Compact view — strip the visible wrapper at all states. Cells stay editable;
   the inner widget shows its own feedback (text cursor, picker overlay,
   dropdown, etc.). Lives here (not in a parent's scoped style) so it competes
   in the same scope as the rules above and reliably wins. */
.nc-data-cell.nc-data-cell-compact,
.nc-data-cell.nc-data-cell-compact:focus-within,
.nc-data-cell.nc-data-cell-compact:hover {
  @apply !border-0 !rounded-none !shadow-none !ring-0;
  background: transparent !important;
}
</style>
