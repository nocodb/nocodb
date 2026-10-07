<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import { copyText, useResolvedVars } from './useResolvedVars'

const props = defineProps<{
  kind: 'shadows' | 'radii' | 'spacing' | 'surfaces'
}>()

// literal class names so UnoCSS generates them (boxShadow in uno.config.ts)
const SHADOWS = [
  'shadow-default',
  'shadow-hover',
  'shadow-nc-sm',
  'shadow-selected',
  'shadow-selected-ai',
  'shadow-focus',
  'shadow-error',
  'shadow-disabled',
  'shadow-sm',
  'shadow',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
]

const RADII = ['rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full']

const SPACING = [
  '--spacing-00',
  '--spacing-01',
  '--spacing-02',
  '--spacing-03',
  '--spacing-04',
  '--spacing-05',
  '--spacing-06',
  '--spacing-07',
  '--spacing-08',
  '--spacing-09',
  '--spacing-10',
  '--spacing-11',
  '--spacing-12',
  '--spacing-13',
]

const SURFACES = [
  { name: 'Mini sidebar', cssVar: '--color-minisidebar-bg' },
  { name: 'Sidebar', cssVar: '--color-sidebar-bg' },
  { name: 'Canvas', cssVar: '--nc-bg-canvas' },
  { name: 'Default', cssVar: '--nc-bg-default' },
  { name: 'Card', cssVar: '--nc-bg-card' },
  { name: 'Elevated', cssVar: '--nc-bg-elevated' },
  { name: 'Input', cssVar: '--nc-bg-input' },
  { name: 'Tooltip', cssVar: '--nc-bg-tooltip' },
]

const { version, lightProbe, resolveLight } = useResolvedVars()

const els = ref<Record<string, HTMLElement>>({})

function cssOf(key: string, prop: 'borderRadius' | 'boxShadow') {
  // eslint-disable-next-line no-unused-expressions
  version.value
  const el = els.value[key]
  return el ? getComputedStyle(el)[prop] : ''
}

function setEl(key: string, el: unknown) {
  if (el) els.value[key] = el as HTMLElement
}
</script>

<template>
  <div ref="lightProbe" class="hidden" />

  <PgDemo v-if="props.kind === 'shadows'" stage="canvas">
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      <button
        v-for="cls in SHADOWS"
        :key="cls"
        :ref="(el) => setEl(cls, el)"
        :class="cls"
        class="h-24 rounded-lg bg-nc-bg-default flex flex-col items-start justify-end p-3 text-left"
        @click="copyText(cls)"
      >
        <span class="text-captionSmBold font-mono text-nc-content-gray">{{ cls }}</span>
        <span class="text-captionXs font-mono text-nc-content-gray-muted line-clamp-2">{{ cssOf(cls, 'boxShadow') }}</span>
      </button>
    </div>
  </PgDemo>

  <PgDemo v-else-if="props.kind === 'radii'" hint="Radius × in the token editor rescales these">
    <div class="flex flex-wrap gap-5">
      <button v-for="cls in RADII" :key="cls" class="flex flex-col items-center gap-2" @click="copyText(cls)">
        <div :ref="(el) => setEl(cls, el)" :class="cls" class="w-20 h-20 bg-nc-bg-brand border-2 border-nc-border-brand" />
        <span class="text-captionSm font-mono text-nc-content-gray">{{ cls }}</span>
        <span class="text-captionXs font-mono text-nc-content-gray-muted">{{ cssOf(cls, 'borderRadius') }}</span>
      </button>
    </div>
  </PgDemo>

  <PgDemo v-else-if="props.kind === 'spacing'">
    <div class="flex flex-col gap-1.5">
      <button v-for="name in SPACING" :key="name" class="flex items-center gap-3 text-left" @click="copyText(name)">
        <span class="w-28 flex-none text-captionSm font-mono text-nc-content-gray">{{ name }}</span>
        <span class="w-12 flex-none text-captionXs font-mono text-nc-content-gray-muted">{{ resolveLight(name) }}</span>
        <span class="h-4 rounded-sm bg-nc-fill-primary" :style="{ width: `var(${name})` }" />
      </button>
    </div>
  </PgDemo>

  <PgDemo v-else stage="canvas" hint="Each layer sits on the one before it">
    <div class="flex flex-wrap gap-4">
      <div
        v-for="(s, i) in SURFACES"
        :key="s.cssVar"
        class="w-40 h-28 rounded-xl border-1 border-nc-border-gray-medium p-3 flex flex-col justify-between"
        :class="{ 'shadow-default': i >= 5 }"
        :style="{ background: `var(${s.cssVar}, transparent)` }"
      >
        <span
          class="text-captionBold"
          :style="{
            color: s.cssVar === '--nc-bg-tooltip' ? 'var(--nc-content-inverted-primary)' : 'var(--nc-content-gray-emphasis)',
          }"
        >
          {{ s.name }}
        </span>
        <button class="text-left" @click="copyText(s.cssVar)">
          <div class="text-captionXs font-mono text-nc-content-gray-muted">{{ s.cssVar }}</div>
          <div class="text-captionXs font-mono text-nc-content-gray-muted">
            {{ resolveLight(s.cssVar) || 'not set in this mode' }}
          </div>
        </button>
      </div>
    </div>
    <div class="mt-5 rounded-xl overflow-hidden border-1 border-nc-border-gray-medium flex h-56">
      <div class="w-12 flex-none" :style="{ background: 'var(--color-minisidebar-bg)' }" />
      <div
        class="w-44 flex-none border-x-1 border-nc-border-gray-medium p-3 flex flex-col gap-1.5"
        :style="{ background: 'var(--color-sidebar-bg)' }"
      >
        <div v-for="n in 5" :key="n" class="h-6 rounded-md" :class="n === 2 ? 'bg-nc-bg-brand' : 'bg-nc-bg-gray-light'" />
      </div>
      <div class="flex-1 p-4 relative" :style="{ background: 'var(--nc-bg-canvas)' }">
        <div class="rounded-lg border-1 border-nc-border-gray-medium p-3 h-full" :style="{ background: 'var(--nc-bg-default)' }">
          <div
            class="h-8 w-56 rounded-md border-1 px-2 flex items-center text-captionSm text-nc-content-gray-muted"
            :style="{ background: 'var(--nc-bg-input)', borderColor: 'var(--nc-border-input, var(--nc-border-gray-medium))' }"
          >
            Input field
          </div>
          <div
            class="absolute right-8 top-10 w-48 rounded-lg shadow-lg border-1 border-nc-border-gray-medium p-2 flex flex-col gap-1"
            :style="{ background: 'var(--nc-bg-elevated)' }"
          >
            <div class="text-captionSm px-2 py-1 rounded text-nc-content-gray">Elevated menu</div>
            <div class="text-captionSm px-2 py-1 rounded bg-nc-bg-gray-light text-nc-content-gray">Hovered item</div>
          </div>
          <div
            class="absolute left-8 bottom-8 px-2 py-1 rounded-md text-captionSm"
            :style="{ background: 'var(--nc-bg-tooltip, var(--color-gray-900))', color: 'var(--nc-content-inverted-primary)' }"
          >
            Tooltip
          </div>
        </div>
      </div>
    </div>
  </PgDemo>
</template>
