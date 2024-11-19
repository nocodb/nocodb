<script lang="ts" setup>
const props = defineProps<{
  popupOffset?: number[]
}>()
</script>

<template>
  <a-sub-menu :popup-offset="props.popupOffset" class="nc-sub-menu" popup-class-name="nc-submenu-popup">
    <template #title>
      <div class="nc-submenu-title flex flex-row items-center gap-x-1.5 py-1.75 justify-between group">
        <div class="flex flex-row items-center gap-x-2">
          <slot name="title" />
        </div>

        <slot v-if="slots.expandIcon" name="expandIcon" />
        <GeneralIcon v-else icon="arrowRight" class="nc-submenu-arrow text-base" />
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

    .nc-submenu-arrow {
      @apply text-gray-600 group-hover:text-gray-800;
    }
  }
}

.nc-sub-menu > .ant-dropdown-menu-submenu-title {
  @apply pl-2 py-0 w-full;
}

.ant-dropdown-menu-submenu .ant-dropdown-menu-submenu-title:hover {
  @apply !bg-gray-100;
}

.nc-submenu-popup {
  @apply !rounded-lg border-1 border-gray-50;
}
.nc-submenu-popup .ant-dropdown-menu.ant-dropdown-menu-sub {
  @apply !rounded-lg !shadow-lg shadow-gray-200;
}

.nc-menu-item::after {
  background: none;
}
</style>
