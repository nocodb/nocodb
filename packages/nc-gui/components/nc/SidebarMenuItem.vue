<script lang="ts" setup>
/**
 * NcSidebarMenuItem — reusable sidebar navigation menu item.
 *
 * Matches the visual style of table/view nodes in the sidebar (h-7, 13px, rounded-md).
 *
 * Slots:
 *   - icon          — leading icon area (default: renders `icon` prop via GeneralIcon)
 *   - default       — label content
 *   - extraRight    — trailing content (badges, counts, action buttons)
 */

interface Props {
  active?: boolean
  disabled?: boolean
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  disabled: false,
  icon: undefined,
})

const emits = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const handleClick = (event: MouseEvent) => {
  if (props.disabled) return
  emits('click', event)
}
</script>

<template>
  <div
    class="nc-sidebar-menu-item"
    :class="{
      active,
      disabled,
    }"
    @click="handleClick"
  >
    <slot name="icon">
      <GeneralIcon v-if="icon" :icon="icon" class="flex-none" />
    </slot>

    <div class="flex-1 truncate">
      <slot />
    </div>

    <slot name="extraRight" />
  </div>
</template>

<style lang="scss" scoped>
.nc-sidebar-menu-item {
  @apply flex items-center gap-2 h-7 xs:(h-10 text-base) pl-3 pr-1 my-[2px] rounded-md cursor-pointer select-none text-nc-content-gray-subtle text-bodyDefaultSm font-medium transition-all duration-200;

  :deep(svg) {
    @apply w-4 h-4 xs:(w-5 h-5);
  }

  &:hover:not(.disabled) {
    @apply bg-nc-bg-gray-medium text-nc-content-gray;
  }

  &.active {
    @apply bg-primary-selected dark:bg-nc-bg-gray-medium text-nc-content-gray;
  }

  &.disabled {
    @apply opacity-60 cursor-not-allowed;
  }
}
</style>
