<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import { collectTokenDefs } from '../../-helper/tokens'
import { copyText, isLightColor, toHex, useResolvedVars } from './useResolvedVars'

const { isDark, lightProbe, darkProbe, resolveLight, resolveDark } = useResolvedVars()

const ramps = ref<Array<{ hue: string; stops: string[] }>>([])

const modes = computed(() => (isDark.value ? (['dark'] as const) : (['light', 'dark'] as const)))

function resolve(mode: 'light' | 'dark', name: string) {
  return toHex(mode === 'dark' ? resolveDark(name) : resolveLight(name))
}

onMounted(() => {
  const byHue = new Map<string, string[]>()
  for (const def of collectTokenDefs()) {
    const m = def.name.match(/^--color-([a-z]+)-(\d+)$/)
    if (!m) continue
    byHue.set(m[1], [...(byHue.get(m[1]) ?? []), m[2]])
  }
  const order = ['brand', 'gray']
  ramps.value = [...byHue.entries()]
    .map(([hue, stops]) => ({ hue, stops: stops.sort((a, b) => Number(a) - Number(b)) }))
    .sort((a, b) => {
      const ia = order.indexOf(a.hue)
      const ib = order.indexOf(b.hue)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.hue.localeCompare(b.hue)
    })
})
</script>

<template>
  <div ref="lightProbe" class="hidden" />
  <div ref="darkProbe" theme="dark" class="hidden" />
  <PgDemo v-for="ramp in ramps" :key="ramp.hue" :label="ramp.hue" :hint="`--color-${ramp.hue}-*  ·  bg-nc-${ramp.hue}-*`">
    <div class="flex flex-col gap-2">
      <div
        v-for="mode in modes"
        :key="mode"
        :theme="mode === 'dark' && !isDark ? 'dark' : undefined"
        class="flex items-center gap-2"
      >
        <span class="w-10 flex-none text-captionXs text-nc-content-gray-muted capitalize">{{ mode }}</span>
        <div
          class="flex-1 min-w-0 grid gap-1 overflow-x-auto"
          :style="{ gridTemplateColumns: `repeat(${ramp.stops.length}, minmax(44px, 1fr))` }"
        >
          <NcTooltip v-for="stop in ramp.stops" :key="stop" :title="`--color-${ramp.hue}-${stop} · click to copy`" :arrow="false">
            <button
              class="w-full h-14 rounded-md flex flex-col justify-end items-start p-1.5 border-1 border-nc-border-gray-light"
              :style="{ background: `var(--color-${ramp.hue}-${stop})` }"
              @click="copyText(`--color-${ramp.hue}-${stop}`)"
            >
              <span
                class="text-captionXsBold"
                :style="{ color: isLightColor(resolve(mode, `--color-${ramp.hue}-${stop}`)) ? '#101015' : '#ffffff' }"
              >
                {{ stop }}
              </span>
              <span
                class="text-captionXs font-mono truncate max-w-full"
                :style="{ color: isLightColor(resolve(mode, `--color-${ramp.hue}-${stop}`)) ? '#4a5268' : '#d5dce8' }"
              >
                {{ resolve(mode, `--color-${ramp.hue}-${stop}`) }}
              </span>
            </button>
          </NcTooltip>
        </div>
      </div>
    </div>
  </PgDemo>
</template>
