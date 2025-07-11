<script setup lang="ts"></script>

<template>
  <div class="nc-menu-item-combo-wrapper nc-menu-item">
    <slot name="ncMenuItem"> </slot>

    <div class="h-7 w-px flex-none bg-nc-border-gray-medium" />
    <slot name="ncSubMenu"> </slot>
  </div>
</template>

<style lang="scss">
.nc-menu-item-combo-wrapper {
  @apply mx-1 flex flex-row items-center hover:bg-gray-100 rounded-lg;

  .ant-dropdown-menu-submenu-title {
    @apply !px-0 !w-8;
  }
}
</style>
