<script setup lang="ts">
import type { DocColorOption } from './DocColorConstants'

interface Props {
  textColors: DocColorOption[]
  bgColors: DocColorOption[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'textColor', color: string | null): void
  (e: 'bgColor', color: string | null): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="nc-doc-color-picker" @mousedown.prevent>
    <div class="nc-doc-color-picker-label">{{ t('labels.textColor') }}</div>
    <div class="nc-doc-color-picker-grid">
      <button
        v-for="tc in textColors"
        :key="tc.color || 'default'"
        class="nc-doc-color-picker-swatch"
        :style="{ borderColor: tc.color ? `color-mix(in srgb, ${tc.color} 30%, transparent)` : undefined }"
        :title="tc.name"
        @click="emit('textColor', tc.color || null)"
      >
        <span class="nc-doc-color-picker-letter" :style="{ color: tc.color || '#1f2937' }">A</span>
      </button>
    </div>
    <div class="nc-doc-color-picker-label">{{ t('labels.backgroundColor') }}</div>
    <div class="nc-doc-color-picker-grid">
      <button
        v-for="b in bgColors"
        :key="b.color || 'none'"
        class="nc-doc-color-picker-swatch"
        :style="b.color ? { backgroundColor: b.color, borderColor: b.color } : {}"
        :title="b.name"
        @click="emit('bgColor', b.color || null)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-color-picker {
  padding: 8px;
}

.nc-doc-color-picker-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-content-gray-subtle);
  margin-bottom: 6px;
  margin-top: 10px;

  &:first-child {
    margin-top: 0;
  }
}

.nc-doc-color-picker-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.nc-doc-color-picker-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px solid var(--nc-border-gray-medium);
  cursor: pointer;
  transition: transform 0.1s ease;

  &:hover {
    transform: scale(1.1);
  }
}

.nc-doc-color-picker-letter {
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
}
</style>
