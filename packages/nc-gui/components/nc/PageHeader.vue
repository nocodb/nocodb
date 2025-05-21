<script lang="ts" setup>
interface Props {
  bottomBorder?: boolean
}
withDefaults(defineProps<Props>(), {
  bottomBorder: true,
})
</script>

<template>
  <div
    class="nc-page-header"
    :class="{
      'border-b-1 border-gray-200': bottomBorder,
    }"
  >
    <div class="flex-1 flex items-start gap-3">
      <div v-if="$slots.icon" class="h-7 flex items-center children:flex-none">
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
  @apply h-12 flex items-center gap-3 px-3 py-2;

  .nc-page-header-title {
    @apply text-xl font-semibold text-gray-800 my-0;
  }
  .nc-page-header-subtitle {
    @apply text-sm font-weight-500 text-gray-700;
  }
}
</style>
