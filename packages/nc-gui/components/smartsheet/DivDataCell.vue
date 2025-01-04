<script lang="ts" setup>
const el = ref()

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
  <div ref="el" class="select-none nc-data-cell" @keydown.tab="onTabPress">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500 !rounded-lg !shadow-none !ring-0;
  // Mimic ant's input box
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24) !important;
}
.nc-data-cell {
  @apply border-1 border-gray-200 overflow-hidden rounded-lg shadow;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}
</style>
