<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    selectable?: boolean | undefined
    variant?: 'default' | 'small' | 'medium'
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

  &:not(.nc-variant-default) {
    @apply flex flex-col gap-0.5 !py-1 min-w-[144px];

    .ant-dropdown-menu-item {
      @apply !py-1 !text-small !leading-5 font-weight-550 mx-1;

      .nc-menu-item-inner {
        @apply !text-small !leading-5 font-weight-550;
      }

      &:not(.ant-dropdown-menu-item-disabled) {
        @apply hover:text-black text-gray-700;
      }

      .nc-icon {
        @apply opacity-80;
      }
    }

    &.nc-variant-small {
      .ant-dropdown-menu-item,
      .nc-ant-dropdown-menu-item-label {
        @apply min-h-7;
      }
    }

    &.nc-variant-medium {
      .ant-dropdown-menu-item,
      .nc-ant-dropdown-menu-item-label {
        @apply min-h-8;
      }
    }

    .nc-ant-dropdown-menu-item-label {
      @apply py-0 mx-1;
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
