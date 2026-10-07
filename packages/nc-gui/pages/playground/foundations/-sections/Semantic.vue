<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import { collectTokenDefs } from '../../-helper/tokens'
import { copyText, isLightColor, toHex, useResolvedVars } from './useResolvedVars'

type Family = 'content' | 'bg' | 'border' | 'fill'

const FAMILIES: Array<{ id: Family; label: string; classPrefix: string }> = [
  { id: 'content', label: 'Content', classPrefix: 'text' },
  { id: 'bg', label: 'Background', classPrefix: 'bg' },
  { id: 'border', label: 'Border', classPrefix: 'border' },
  { id: 'fill', label: 'Fill', classPrefix: 'bg' },
]

const { isDark, lightProbe, darkProbe, resolveLight, resolveDark } = useResolvedVars()

const tokens = ref<Record<Family, string[]>>({ content: [], bg: [], border: [], fill: [] })

const family = ref<Family>('content')

const search = ref('')

const activeFamily = computed(() => FAMILIES.find((f) => f.id === family.value)!)

function matching(f: Family) {
  const q = search.value.trim().toLowerCase()
  return tokens.value[f].filter((name) => !q || name.includes(q))
}

const rows = computed(() => matching(family.value))

// inverted-primary sits on a filled surface (gray-800 flips with the theme); inverted-secondary is for the default surface
function isInverted(name: string) {
  return family.value === 'content' && name.includes('-inverted-primary')
}

const columns = computed(() => (isDark.value ? (['dark'] as const) : (['light', 'dark'] as const)))

function utilityClass(name: string) {
  return `${activeFamily.value.classPrefix}-${name.slice(2)}`
}

function resolved(mode: 'light' | 'dark', name: string) {
  const value = mode === 'dark' ? resolveDark(name) : resolveLight(name)
  return value ? toHex(value) : '—'
}

onMounted(() => {
  const next: Record<Family, string[]> = { content: [], bg: [], border: [], fill: [] }
  for (const def of collectTokenDefs()) {
    const m = def.name.match(/^--nc-(content|bg|border|fill)-/)
    if (m) next[m[1] as Family].push(def.name)
  }
  tokens.value = next
})
</script>

<template>
  <div ref="lightProbe" class="hidden" />
  <div ref="darkProbe" theme="dark" class="hidden" />
  <PgDemo :padded="false">
    <template #actions>
      <a-input v-model:value="search" placeholder="Filter tokens" allow-clear size="small" class="nc-input-sm !w-48" />
    </template>
    <template #default>
      <div class="flex items-center gap-1 px-4 pt-3">
        <button
          v-for="f in FAMILIES"
          :key="f.id"
          class="h-7 px-3 rounded-md text-captionSm"
          :class="
            family === f.id ? 'bg-nc-bg-brand text-nc-content-brand' : 'text-nc-content-gray-subtle hover:bg-nc-bg-gray-light'
          "
          @click="family = f.id"
        >
          {{ f.label }}
          <span class="text-captionXs text-nc-content-gray-muted ml-1">{{ matching(f.id).length }}</span>
        </button>
        <span v-if="isDark" class="ml-auto text-captionXs text-nc-content-gray-muted">
          Switch to light theme to compare light and dark side by side
        </span>
      </div>

      <div
        class="grid items-center gap-x-4 px-4 py-2 text-captionXsBold uppercase tracking-wide text-nc-content-gray-muted"
        :style="{ gridTemplateColumns: `minmax(0, 1.4fr) repeat(${columns.length}, minmax(0, 1fr))` }"
      >
        <span>Token</span>
        <span v-for="c in columns" :key="c">{{ c }}</span>
      </div>

      <div
        v-if="!rows.length && search.trim()"
        class="px-4 py-6 border-t-1 border-nc-border-gray-light text-center text-captionSm text-nc-content-gray-muted"
      >
        No tokens match “{{ search.trim() }}”
      </div>

      <div
        v-for="name in rows"
        :key="name"
        class="grid items-center gap-x-4 px-4 py-2 border-t-1 border-nc-border-gray-light"
        :style="{ gridTemplateColumns: `minmax(0, 1.4fr) repeat(${columns.length}, minmax(0, 1fr))` }"
      >
        <div class="min-w-0">
          <button
            class="block text-captionSm font-mono text-nc-content-gray truncate max-w-full text-left"
            @click="copyText(name)"
          >
            {{ name }}
          </button>
          <button
            class="block text-captionXs font-mono text-nc-content-gray-muted truncate max-w-full text-left"
            @click="copyText(utilityClass(name))"
          >
            {{ utilityClass(name) }}
          </button>
        </div>

        <div
          v-for="c in columns"
          :key="c"
          :theme="c === 'dark' && !isDark ? 'dark' : undefined"
          class="h-12 rounded-lg flex items-center gap-3 px-3 border-1"
          :style="{
            background: isInverted(name) ? 'var(--color-gray-800)' : 'var(--nc-bg-default)',
            borderColor: 'var(--nc-border-gray-light)',
          }"
        >
          <span v-if="family === 'content'" class="text-subHeading1" :style="{ color: `var(${name})` }">Aa</span>
          <span
            v-else-if="family === 'bg'"
            class="w-9 h-8 rounded-md"
            :style="{ background: `var(${name})`, boxShadow: 'inset 0 0 0 1px var(--nc-border-gray-light)' }"
          />
          <span v-else-if="family === 'border'" class="w-9 h-8 rounded-md border-2" :style="{ borderColor: `var(${name})` }" />
          <span
            v-else
            class="h-6 px-2.5 rounded-full flex items-center text-captionXsBold"
            :style="{ background: `var(${name})`, color: isLightColor(resolved(c, name)) ? '#101015' : '#ffffff' }"
          >
            Fill
          </span>
          <span
            class="text-captionXs font-mono truncate"
            :style="{ color: isInverted(name) ? 'var(--color-gray-300)' : 'var(--nc-content-gray-muted)' }"
            >{{ resolved(c, name) }}</span
          >
        </div>
      </div>
    </template>
  </PgDemo>
</template>
