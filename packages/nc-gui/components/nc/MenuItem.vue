<template>
  <a-menu-item class="nc-menu-item">
    <div class="nc-menu-item-inner">
      <slot />
    </div>
  </a-menu-item>
</template>

<style lang="scss">
.ant-dropdown-menu-item.nc-menu-item {
  @apply p-2 mx-1.5 font-normal text-sm xs:(text-base py-3 px-3.5 mx-0) rounded-md overflow-hidden hover:bg-gray-100;
}

.nc-menu-item-inner {
  @apply flex flex-row items-center gap-x-2 text-sm;
}

.nc-menu-item > .ant-dropdown-menu-title-content {
  // Not Icon
  :not(.nc-icon):not(.material-symbols) {
    line-height: 1.5;
  }

  @apply flex flex-row items-center;
}

.nc-menu-item::after {
  background: none;
}
</style>
