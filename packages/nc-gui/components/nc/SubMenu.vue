<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    popupOffset?: number[]
    variant?: 'default' | 'small' | 'medium'
  }>(),
  {
    variant: 'default',
  },
)
</script>

<template>
  <a-sub-menu
    :popup-offset="props.popupOffset"
    class="nc-sub-menu"
    :class="`nc-variant-${variant}`"
    :popup-class-name="`nc-variant-${variant} nc-submenu-popup`"
  >
    <template #title>
      <div class="nc-submenu-title flex flex-row items-center gap-x-1.5 py-1.75 justify-between group">
        <div class="flex flex-row items-center gap-x-2">
          <slot name="title" />
        </div>

        <slot v-if="$slots.expandIcon" name="expandIcon" />
        <GeneralIcon v-else icon="ncChevronRight" class="nc-submenu-arrow !opacity-60" />
      </div>
    </template>

    <template #expandIcon> </template>
    <div class="py-1.5">
      <slot />
    </div>
  </a-sub-menu>
</template>

<style lang="scss">
.ant-dropdown-menu-submenu.nc-sub-menu {
  @apply flex mx-1.5 rounded-md overflow-hidden !hover:bg-gray-100;

  &:not(.ant-dropdown-menu-submenu-disabled) {
    .nc-submenu-title {
      @apply hover:text-gray-800;
    }

    .nc-icon {
      @apply opacity-80;
    }
  }

  & > .ant-dropdown-menu-submenu-title {
    @apply pl-2 py-0 w-full;
  }

  &:not(.nc-variant-default) {
    @apply text-small leading-5 font-weight-550 mx-1;

    & .nc-submenu-title {
      @apply py-0.5 text-small leading-5 font-weight-550;
    }

    &.nc-variant-small .nc-submenu-title {
      @apply min-h-7;
    }

    &.nc-variant-medium .nc-submenu-title {
      @apply min-h-8;
    }

    &:not(.ant-dropdown-menu-submenu-disabled) {
      @apply hover:text-black text-gray-700;

      & .nc-submenu-title {
        @apply hover:text-black text-gray-700;
      }
    }
  }
}

.ant-dropdown-menu-submenu .ant-dropdown-menu-submenu-title:hover {
  @apply !bg-gray-100;
}

.nc-submenu-popup {
  @apply !rounded-lg border-1 border-gray-50 min-w-[144px];

  .ant-dropdown-menu.ant-dropdown-menu-sub {
    @apply !rounded-lg !shadow-lg shadow-gray-200;
  }

  &:not(.nc-variant-default) {
    @apply flex flex-col gap-0.5 py-1;

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

.nc-menu-item::after {
  background: none;
}
</style>
