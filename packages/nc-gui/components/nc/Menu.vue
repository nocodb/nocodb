<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    selectable?: boolean | undefined
    variant?: 'default' | 'small'
  }>(),
  {
    variant: 'default',
  },
)

const selectable = computed(() => props.selectable ?? false)
</script>

<template>
  <a-menu class="nc-menu" :class="`nc-variant-${variant}`" :selectable="selectable">
    <slot />
  </a-menu>
</template>

<style lang="scss">
.nc-menu {
  @apply bg-white !rounded-md !py-1.5;

  &.nc-variant-small {
    @apply gap-0.5;
    .ant-dropdown-menu-item {
      @apply !py-1 !text-small !leading-[18px] mx-1 text-gray-700;

      .nc-menu-item-inner {
        @apply !text-small !leading-[18px];
      }
    }
  }
}

.nc-menu.ant-dropdown-menu {
  @apply !rounded-lg !shadow-none;
}
</style>
