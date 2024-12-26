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
    @apply flex flex-col gap-0.5 !py-1;

    .ant-dropdown-menu-item {
      @apply !py-1 !text-small !leading-5 font-weight-550 mx-1;

      .nc-menu-item-inner {
        @apply !text-small !leading-5 font-weight-550;
      }

      &:not(.ant-dropdown-menu-item-disabled) {
        @apply hover:text-black text-gray-700;
      }
    }

    .nc-divider {
      @apply my-0.5;
    }
  }
}

.nc-menu.ant-dropdown-menu {
  @apply !rounded-lg !shadow-none;
}
</style>
