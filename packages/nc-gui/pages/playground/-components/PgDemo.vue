<script setup lang="ts">
/** Bordered preview card: a label row over a padded stage. */
withDefaults(
  defineProps<{
    label?: string
    hint?: string
    /** stage background: plain surface, the gray canvas, or a checkerboard for transparency */
    stage?: 'default' | 'canvas' | 'checker'
    padded?: boolean
  }>(),
  { stage: 'default', padded: true },
)
</script>

<template>
  <div class="rounded-xl border-1 border-nc-border-gray-medium overflow-hidden bg-nc-bg-default">
    <div v-if="label || hint || $slots.actions" class="flex items-center gap-2 px-4 h-9 border-b-1 border-nc-border-gray-light">
      <span v-if="label" class="text-captionSmBold text-nc-content-gray-subtle">{{ label }}</span>
      <span v-if="hint" class="text-captionXs text-nc-content-gray-muted truncate">{{ hint }}</span>
      <div class="ml-auto flex items-center gap-2">
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
