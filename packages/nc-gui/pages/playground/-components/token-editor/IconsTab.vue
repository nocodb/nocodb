<script setup lang="ts">
import { usePlaygroundTokens } from '../../-helper/tokens'

const { overrides } = usePlaygroundTokens()

const WEIGHT_PRESETS = [
  { label: 'Light', value: 0.75 },
  { label: 'Default', value: 1 },
  { label: 'Medium', value: 1.25 },
  { label: 'Bold', value: 1.5 },
]

const PREVIEW_ICONS = [
  'plus',
  'edit',
  'delete',
  'search',
  'filter',
  'settings',
  'ncUsers',
  'ncLock',
  'ncLink',
  'copy',
  'download',
  'calendar',
  'ncMail',
  'ncBell',
  'star',
  'ncFile',
  'ncChevronDown',
  'threeDotVertical',
] as const
</script>

<template>
  <section class="p-4 flex flex-col gap-4">
    <div>
      <div class="flex items-center mb-1">
        <span class="text-captionSmBold text-nc-content-gray-subtle">Stroke weight</span>
        <span class="ml-auto text-captionXs font-mono text-nc-content-gray-muted">× {{ overrides.iconStroke }}</span>
      </div>
      <a-slider v-model:value="overrides.iconStroke" :min="0.5" :max="2" :step="0.05" class="!m-0 !mt-1" />
      <div class="flex gap-1.5 mt-2">
        <button
          v-for="p in WEIGHT_PRESETS"
          :key="p.label"
          class="h-7 px-2 rounded-md border-1 text-captionSm"
          :class="
            overrides.iconStroke === p.value ? 'border-nc-border-brand text-nc-content-brand' : 'border-nc-border-gray-medium'
          "
          @click="overrides.iconStroke = p.value"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="text-captionXs text-nc-content-gray-muted mt-2">
        Scales every outline icon's stroke (default 1.33px on a 16px grid). Solid and logo icons keep their shape.
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div v-for="size in [16, 20, 24]" :key="size" class="flex flex-col gap-1.5">
        <span class="text-captionXs text-nc-content-gray-muted">{{ size }}px</span>
        <div class="flex flex-wrap gap-x-3 gap-y-2 text-nc-content-gray">
          <GeneralIcon
            v-for="icon in PREVIEW_ICONS"
            :key="icon"
            :icon="icon"
            :style="{ width: `${size}px`, height: `${size}px` }"
          />
        </div>
      </div>
    </div>

    <div class="text-captionXs text-nc-content-yellow-dark bg-nc-yellow-50 rounded-md px-2 py-1.5">
      The canvas grid paints its column-header and cell icons from cached images, so they keep the default weight.
    </div>
  </section>
</template>
