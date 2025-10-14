<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    popupOffset?: number[]
    variant?: 'default' | 'small' | 'medium' | 'large'
    titleClass?: string
  }>(),
  {
    variant: 'default',
    titleClass: '',
  },
)

const { isMobileMode } = useGlobal()

const responsiveVariant = computed(() => {
  if (isMobileMode.value && ['small', 'medium'].includes(props.variant)) {
    return 'large'
  }

  return props.variant
})
</script>

<template>
  <a-sub-menu
    :popup-offset="props.popupOffset"
    class="nc-sub-menu"
    :class="`nc-variant-${responsiveVariant}`"
    :popup-class-name="`nc-variant-${responsiveVariant} nc-submenu-popup`"
  >
    <template #title>
      <div class="nc-submenu-title flex flex-row items-center gap-x-1.5 py-1.75 justify-between group" :class="titleClass">
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
  @apply flex mx-1.5 rounded-md overflow-hidden !hover:bg-nc-bg-gray-light;

  &:not(.ant-dropdown-menu-submenu-disabled) {
    .nc-submenu-title {
      @apply hover:text-nc-content-gray;
    }

    .nc-icon {
      @apply opacity-80;
    }
  }

  & > .ant-dropdown-menu-submenu-title {
    @apply pl-2 py-0 w-full xs:(text-base !px-3.5);
  }

  &:not(.nc-variant-default) {
    @apply text-small leading-5 font-weight-550 mx-1;

    & .nc-submenu-title {
      @apply py-0.5 text-small leading-5 font-weight-550;
    }

    &.nc-variant-small {
      .nc-submenu-title {
        @apply min-h-7;
      }

      &.nc-sub-menu-item-icon-only {
        .nc-submenu-title {
          @apply !min-h-6;
        }
      }
    }

    &.nc-variant-medium {
      .nc-submenu-title {
        @apply min-h-8;
      }

      &.nc-sub-menu-item-icon-only {
        .nc-submenu-title {
          @apply !min-h-7;
        }
      }
    }

    &.nc-variant-large {
      .nc-submenu-title {
        @apply min-h-9 !font-600;
      }

      &.nc-sub-menu-item-icon-only {
        .nc-submenu-title {
          @apply !min-h-8;
        }
      }
    }

    &:not(.ant-dropdown-menu-submenu-disabled) {
      @apply hover:text-nc-content-gray-extreme text-nc-content-gray-subtle;

      & .nc-submenu-title {
        @apply hover:text-nc-content-gray-extreme text-nc-content-gray-subtle;
      }
    }
  }
}

.ant-dropdown-menu-submenu .ant-dropdown-menu-submenu-title:hover {
  @apply !bg-nc-bg-gray-light;
}

.nc-submenu-popup {
  @apply !rounded-lg border-1 border-nc-border-gray-extra-light min-w-[144px];

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
        @apply hover:text-nc-content-gray-extreme text-nc-content-gray-subtle;
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

    &.nc-variant-large {
      .ant-dropdown-menu-item,
      .nc-ant-dropdown-menu-item-label {
        @apply min-h-9;
      }

      .nc-menu-item-inner {
        @apply !font-600;
      }
    }

    .nc-ant-dropdown-menu-item-label {
      @apply py-0 mx-1 text-bodyDefaultSmBold;
    }

    .nc-divider {
      @apply my-0.5;
    }
  }

  &.nc-variant-default {
    .nc-ant-dropdown-menu-item-label {
      @apply py-2.5 text-bodyDefaultSmBold;
    }
  }
}

.nc-menu-item::after {
  background: none;
}
</style>
