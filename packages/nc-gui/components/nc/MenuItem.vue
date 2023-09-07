<template>
  <a-menu-item class="nc-menu-item">
    <div class="nc-menu-item-inner">
      <slot />
    </div>
  </a-menu-item>
</template>

<style lang="scss">
.nc-menu-item {
  @apply !py-2 font-normal text-sm;
}

.nc-menu-item-inner {
  @apply flex flex-row items-center gap-x-2.25;
}
</style>
