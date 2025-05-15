<template>
  <div class="nc-ant-dropdown-menu-item-label">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.nc-ant-dropdown-menu-item-label {
  @apply flex items-center min-h-7 py-3 px-2 mx-2 font-bold uppercase text-xs text-nc-content-gray-muted;
}
</style>
