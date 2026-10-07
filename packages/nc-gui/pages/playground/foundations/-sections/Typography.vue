<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import { copyText, useResolvedVars } from './useResolvedVars'

// literal class names so UnoCSS generates every preset rule (assets/nc-typography-preset.ts)
const TYPE_CLASSES = [
  'text-heading1',
  'text-heading2',
  'text-heading3',
  'text-subHeading1',
  'text-subHeading2',
  'text-bodyLg',
  'text-bodyLgBold',
  'text-body',
  'text-bodyBold',
  'text-bodyDefaultSm',
  'text-bodyDefaultSmBold',
  'text-bodySm',
  'text-bodySmBold',
  'text-caption',
  'text-captionMedium',
  'text-captionBold',
  'text-captionSm',
  'text-captionSmBold',
  'text-captionXs',
  'text-captionXsBold',
  'text-captionDropdownDefault',
  'text-sidebarDefault',
  'text-sidebarSelected',
]

const { version } = useResolvedVars()

const sample = ref('The quick brown fox jumps over the lazy dog')

const samples = ref<Record<string, HTMLElement>>({})

function metrics(cls: string) {
  // eslint-disable-next-line no-unused-expressions
  version.value
  const el = samples.value[cls]
  if (!el) return ''
  const s = getComputedStyle(el)
  return `${s.fontSize} / ${s.lineHeight} · ${s.fontWeight}${s.letterSpacing !== 'normal' ? ` · ${s.letterSpacing}` : ''}`
}

function family() {
  // eslint-disable-next-line no-unused-expressions
  version.value
  const el = Object.values(samples.value)[0]
  return el ? getComputedStyle(el).fontFamily : ''
}
</script>

<template>
  <PgDemo :padded="false">
    <template #actions>
      <a-input v-model:value="sample" size="small" class="nc-input-sm !w-72" />
    </template>
    <template #default>
      <div class="px-4 py-2 text-captionXs text-nc-content-gray-muted font-mono truncate border-b-1 border-nc-border-gray-light">
        font-family: {{ family() }}
      </div>
      <div
        v-for="cls in TYPE_CLASSES"
        :key="cls"
        class="flex items-baseline gap-4 px-4 py-3 border-b-1 border-nc-border-gray-light last:border-b-0"
      >
        <div class="w-48 flex-none">
          <button class="text-captionSm font-mono text-nc-content-gray" @click="copyText(cls)">{{ cls }}</button>
          <div class="text-captionXs text-nc-content-gray-muted">{{ metrics(cls) }}</div>
        </div>
        <div
          :ref="(el) => el && (samples[cls] = el as HTMLElement)"
          :class="cls"
          class="flex-1 min-w-0 truncate text-nc-content-gray-emphasis"
        >
          {{ sample }}
        </div>
      </div>
    </template>
  </PgDemo>
</template>
