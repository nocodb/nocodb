<script lang="ts" setup></script>

<template>
  <div class="nc-page-header">
    <div class="flex-1 flex items-start gap-3">
      <div v-if="$slots.icon" class="h-8 flex items-center children:flex-none">
        <slot name="icon"></slot>
      </div>

      <div class="flex flex-col gap-3">
        <h1 class="nc-page-header-title truncate">
          <slot name="title"></slot>
        </h1>
        <p v-if="$slots.subtitle" class="nc-page-header-subtitle">
          <slot name="subtitle"></slot>
        </p>
      </div>
    </div>
    <div v-if="$slots.action">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-page-header {
  @apply flex gap-3 p-3;

  .nc-page-header-title {
    @apply text-2xl font-bold text-gray-800 my-0;
  }
  .nc-page-header-subtitle {
    @apply text-sm font-weight-500 text-gray-700;
  }
}
</style>
