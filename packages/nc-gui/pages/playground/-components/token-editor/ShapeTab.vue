<script setup lang="ts">
import { usePlaygroundTokens } from '../../-helper/tokens'

const { overrides } = usePlaygroundTokens()

const RADII = [
  { cls: 'rounded-sm', label: 'sm' },
  { cls: 'rounded-md', label: 'md' },
  { cls: 'rounded-lg', label: 'lg' },
  { cls: 'rounded-xl', label: 'xl' },
  { cls: 'rounded-2xl', label: '2xl' },
]
</script>

<template>
  <section class="p-4 flex flex-col gap-4">
    <div>
      <div class="flex items-center mb-1">
        <span class="text-captionSmBold text-nc-content-gray-subtle">Corner radius</span>
        <span class="ml-auto text-captionXs font-mono text-nc-content-gray-muted">× {{ overrides.radiusScale }}</span>
      </div>
      <a-slider v-model:value="overrides.radiusScale" :min="0" :max="2" :step="0.25" class="!m-0 !mt-1" />
      <div class="text-captionXs text-nc-content-gray-muted mt-1">
        Multiplies the rounded-* utilities and the Ant button, input, select, dropdown and modal corners.
      </div>
    </div>
    <div class="grid grid-cols-5 gap-2">
      <div v-for="r in RADII" :key="r.cls" class="flex flex-col items-center gap-1">
        <div :class="r.cls" class="w-12 h-12 bg-nc-bg-brand border-1 border-nc-border-brand" />
        <span class="text-captionXs font-mono text-nc-content-gray-muted">{{ r.label }}</span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <NcButton size="small">Primary</NcButton>
      <NcButton size="small" type="secondary">Secondary</NcButton>
      <a-input class="nc-input-sm nc-input-shadow !w-28" placeholder="Input" />
    </div>
  </section>
</template>
