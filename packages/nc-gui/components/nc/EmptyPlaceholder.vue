<script lang="ts" setup>
interface Props {
  title?: string
  subtitle?: string
}
defineProps<Props>()
</script>

<template>
  <div class="placeholder-container">
    <div v-if="$slots.icon" class="placeholder-icon">
      <slot name="icon" />
    </div>
    <div v-if="$slots.title || title" class="placeholder-title text-subHeading2">
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-if="$slots.subtitle || subtitle" class="placeholder-subtitle text-caption">
      <slot name="subtitle">{{ subtitle }}</slot>
    </div>
    <div v-if="$slots.action" class="placeholder-action">
      <slot name="action" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.placeholder-container {
  @apply flex flex-col items-center justify-center mx-auto max-w-[420px] text-center gap-3;
  .placeholder-title {
    @apply text-nc-content-gray;
  }
  .placeholder-subtitle {
    @apply text-nc-content-gray-subtle2;
  }
}
</style>
