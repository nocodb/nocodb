<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    hint?: string
    stage?: 'default' | 'canvas' | 'checker'
    padded?: boolean
  }>(),
  { stage: 'default', padded: true },
)
</script>

<template>
  <div class="rounded-xl border-1 border-nc-border-gray-medium overflow-hidden bg-nc-bg-default">
    <div v-if="label || hint || $slots.actions" class="flex items-center gap-2 px-4 h-9 border-b-1 border-nc-border-gray-light">
      <span v-if="label" class="flex-none max-w-full truncate text-captionSmBold text-nc-content-gray-subtle">{{ label }}</span>
      <NcTooltip v-if="hint" show-on-truncate-only class="min-w-0 truncate text-captionXs text-nc-content-gray-muted">
        <template #title>{{ hint }}</template>
        {{ hint }}
      </NcTooltip>
      <div class="ml-auto flex-none flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div
      class="pg-demo-stage"
      :class="[
        padded ? 'p-4' : '',
        stage === 'canvas' ? 'bg-nc-bg-gray-extralight' : '',
        stage === 'checker' ? 'pg-demo-checker' : '',
      ]"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.pg-demo-checker {
  background-image: linear-gradient(45deg, var(--nc-bg-gray-light) 25%, transparent 25%),
    linear-gradient(-45deg, var(--nc-bg-gray-light) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--nc-bg-gray-light) 75%),
    linear-gradient(-45deg, transparent 75%, var(--nc-bg-gray-light) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
</style>
