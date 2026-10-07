<script setup lang="ts">
import { collectTokenDefs, usePlaygroundTokens } from '../../-helper/tokens'
import type { TokenDef, TokenMode } from '../../-helper/tokens'
import { toHex, useResolvedVars } from '../../foundations/-sections/useResolvedVars'

const props = defineProps<{
  mode: TokenMode
}>()

const { overrides, setToken, setRamp, clearRamp } = usePlaygroundTokens()

const { lightProbe, darkProbe, resolveLight, resolveDark } = useResolvedVars()

const BRAND_PRESETS = ['#3366ff', '#7c3aed', '#0d9488', '#059669', '#e11d48', '#ea580c', '#111827']

const GRAY_PRESETS = [
  { label: 'Default', value: '' },
  { label: 'Slate', value: '#64748b' },
  { label: 'Zinc', value: '#71717a' },
  { label: 'Stone', value: '#78716c' },
  { label: 'Blue-gray', value: '#5b6b8c' },
]

const SEMANTIC_GROUPS = [
  { id: 'content', label: 'Text & icons', hint: 'text-nc-content-*' },
  { id: 'bg', label: 'Backgrounds', hint: 'bg-nc-bg-*' },
  { id: 'border', label: 'Borders', hint: 'border-nc-border-*' },
  { id: 'fill', label: 'Fills', hint: 'bg-nc-fill-* · buttons, badges, toggles' },
] as const

const ramps = ref<Array<{ hue: string; stops: string[] }>>([])

const semantic = ref<Record<string, TokenDef[]>>({})

const search = ref('')

const openGroups = ref<string[]>(['content'])

/** semantic token names whose last typed value wasn't a colour */
const invalidValues = ref<string[]>([])

const brandBase = computed(() => overrides.value.light['--nc-brand-accent'] ?? '#3366ff')

const grayBase = computed(() => overrides.value.light['--color-gray-500'] ?? '')

const filteredSemantic = computed(() => {
  const q = search.value.trim().toLowerCase()
  return Object.fromEntries(
    Object.entries(semantic.value).map(([group, defs]) => [group, defs.filter((d) => !q || d.name.includes(q))]),
  ) as Record<string, TokenDef[]>
})

function resolved(name: string) {
  const value = overrides.value[props.mode][name]
  if (value?.startsWith('#')) return value
  return toHex(props.mode === 'dark' ? resolveDark(name) : resolveLight(name))
}

function isChanged(name: string) {
  return name in overrides.value[props.mode]
}

function rampChanged(hue: string) {
  return [overrides.value.light, overrides.value.dark].some((values) =>
    Object.keys(values).some((k) => k.startsWith(`--color-${hue}-`)),
  )
}

/** `gray-700` → var(--color-gray-700); anything else is used as typed */
function normalise(value: string) {
  const v = value.trim()
  return /^[a-z]+-\d+$/.test(v) ? `var(--color-${v})` : v
}

/** the palette stop a semantic token points at, or its literal value */
function shortValue(def: TokenDef) {
  const value = overrides.value[props.mode][def.name] ?? def[props.mode]
  return value.match(/^var\(--color-([a-z]+-\d+)\)$/)?.[1] ?? value
}

function onSemanticInput(name: string, raw: string) {
  const value = normalise(raw)
  if (value && !CSS.supports('color', value)) {
    if (!invalidValues.value.includes(name)) invalidValues.value = [...invalidValues.value, name]
    return
  }
  invalidValues.value = invalidValues.value.filter((n) => n !== name)
  setToken(props.mode, name, value || null)
}

function onBrand(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) setRamp('brand', value)
}

function onGray(value: string) {
  if (value) setRamp('gray', value)
  else clearRamp('gray')
}

function toggleGroup(id: string) {
  openGroups.value = openGroups.value.includes(id) ? openGroups.value.filter((g) => g !== id) : [...openGroups.value, id]
}

onMounted(() => {
  const byHue = new Map<string, string[]>()
  const groups: Record<string, TokenDef[]> = { content: [], bg: [], border: [], fill: [] }
  for (const def of collectTokenDefs()) {
    const stop = def.name.match(/^--color-([a-z]+)-(\d+)$/)
    if (stop) byHue.set(stop[1], [...(byHue.get(stop[1]) ?? []), stop[2]])
    const family = def.name.match(/^--nc-(content|bg|border|fill)-/)?.[1]
    if (family) groups[family]!.push(def)
  }
  const order = ['brand', 'gray']
  ramps.value = [...byHue.entries()]
    .map(([hue, stops]) => ({ hue, stops: stops.sort((a, b) => Number(a) - Number(b)) }))
    .sort((a, b) => {
      const ia = order.indexOf(a.hue)
      const ib = order.indexOf(b.hue)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.hue.localeCompare(b.hue)
    })
  semantic.value = groups
})
</script>

<template>
  <div ref="lightProbe" class="hidden" />
  <div ref="darkProbe" theme="dark" class="hidden" />

  <section class="p-4 flex flex-col gap-4 border-b-1 border-nc-border-gray-medium">
    <div>
      <div class="text-captionSmBold text-nc-content-gray-subtle mb-2">Brand colour</div>
      <div class="flex items-center gap-1.5">
        <button
          v-for="c in BRAND_PRESETS"
          :key="c"
          class="w-6 h-6 rounded-full border-2 ring-1 ring-nc-border-gray-medium focus-visible:(outline-none ring-2 ring-nc-border-brand)"
          :class="brandBase === c ? 'border-nc-border-gray-dark' : 'border-transparent'"
          :style="{ background: c }"
          :aria-label="`Brand colour ${c}`"
          :aria-pressed="brandBase === c"
          @click="onBrand(c)"
        />
        <label
          class="relative w-6 h-6 rounded-full border-1 border-dashed border-nc-border-gray-dark cursor-pointer focus-within:(ring-2 ring-nc-border-brand)"
        >
          <GeneralIcon icon="plus" class="absolute inset-0 m-auto w-3 h-3 text-nc-content-gray-muted" />
          <input
            type="color"
            :value="brandBase"
            class="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Custom brand colour"
            @input="onBrand(($event.target as HTMLInputElement).value)"
          />
        </label>
        <NcButton
          class="!ml-auto"
          size="xsmall"
          type="text"
          :disabled="!overrides.light['--nc-brand-accent']"
          @click="clearRamp('brand')"
        >
          Reset
        </NcButton>
      </div>
      <div class="text-captionXs text-nc-content-gray-muted mt-1.5">Rebuilds the whole brand ramp, buttons and focus rings.</div>
    </div>

    <div>
      <div class="text-captionSmBold text-nc-content-gray-subtle mb-2">Gray tone</div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="g in GRAY_PRESETS"
          :key="g.label"
          class="h-7 px-2 rounded-md border-1 text-captionSm flex items-center gap-1.5"
          :class="grayBase === g.value ? 'border-nc-border-brand text-nc-content-brand' : 'border-nc-border-gray-medium'"
          @click="onGray(g.value)"
        >
          <span v-if="g.value" class="w-3 h-3 rounded-full" :style="{ background: g.value }" />
          {{ g.label }}
        </button>
      </div>
    </div>
  </section>

  <section class="p-4 flex flex-col gap-3 border-b-1 border-nc-border-gray-medium">
    <div>
      <div class="text-captionSmBold text-nc-content-gray-subtle">Palette</div>
      <div class="text-captionXs text-nc-content-gray-muted mt-0.5">
        Every utility class paints from these stops. Click a stop to edit it, or the dot to regenerate the whole ramp.
      </div>
    </div>
    <div v-for="ramp in ramps" :key="ramp.hue" class="flex flex-col gap-1">
      <div class="flex items-center gap-1.5">
        <span class="text-captionSm text-nc-content-gray capitalize">{{ ramp.hue }}</span>
        <NcTooltip title="Regenerate ramp from one colour" :arrow="false">
          <label
            class="relative inline-block flex-none w-3.5 h-3.5 rounded-full border-1 border-nc-border-gray-medium cursor-pointer focus-within:(ring-2 ring-nc-border-brand)"
            :style="{ background: `var(--color-${ramp.hue}-500)` }"
          >
            <input
              type="color"
              :value="resolved(`--color-${ramp.hue}-500`)"
              class="absolute inset-0 opacity-0 cursor-pointer"
              :aria-label="`Regenerate ${ramp.hue} ramp`"
              @change="setRamp(ramp.hue, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </NcTooltip>
        <NcButton v-if="rampChanged(ramp.hue)" class="!ml-auto" size="xxsmall" type="text" @click="clearRamp(ramp.hue)">
          <span class="text-captionXs">Reset</span>
        </NcButton>
      </div>
      <div class="flex gap-0.5">
        <NcTooltip
          v-for="stop in ramp.stops"
          :key="stop"
          class="flex-1 min-w-0"
          :title="`${stop} · ${resolved(`--color-${ramp.hue}-${stop}`)}`"
          :arrow="false"
        >
          <label
            :theme="mode === 'dark' ? 'dark' : undefined"
            class="relative block h-6 rounded cursor-pointer first:rounded-l-md focus-within:(ring-2 ring-nc-border-brand)"
            :class="
              isChanged(`--color-${ramp.hue}-${stop}`)
                ? 'ring-2 ring-offset-1 ring-nc-border-brand'
                : 'ring-1 ring-inset ring-nc-border-gray-medium'
            "
            :style="{ background: `var(--color-${ramp.hue}-${stop})` }"
          >
            <input
              type="color"
              :value="resolved(`--color-${ramp.hue}-${stop}`)"
              class="absolute inset-0 opacity-0 cursor-pointer"
              :aria-label="`${ramp.hue} ${stop}`"
              @input="setToken(mode, `--color-${ramp.hue}-${stop}`, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </NcTooltip>
      </div>
    </div>
  </section>

  <section class="p-4 flex flex-col gap-2">
    <div>
      <div class="text-captionSmBold text-nc-content-gray-subtle">Semantic colours</div>
      <div class="text-captionXs text-nc-content-gray-muted mt-0.5">
        What components ask for. Type a stop like <code>gray-700</code> or pick any colour.
      </div>
    </div>
    <a-input v-model:value="search" placeholder="Filter, e.g. brand or subtle" allow-clear class="nc-input-sm">
      <template #prefix>
        <GeneralIcon icon="ncSearch" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
      </template>
    </a-input>

    <div v-for="group in SEMANTIC_GROUPS" :key="group.id" class="flex flex-col">
      <button class="h-8 flex items-center gap-1.5 text-left" @click="toggleGroup(group.id)">
        <GeneralIcon
          icon="chevronRight"
          class="w-3.5 h-3.5 text-nc-content-gray-muted transition-transform"
          :class="{ 'rotate-90': openGroups.includes(group.id) || !!search }"
        />
        <span class="text-captionSm text-nc-content-gray">{{ group.label }}</span>
        <span class="text-captionXs text-nc-content-gray-muted font-mono truncate">{{ group.hint }}</span>
        <span class="ml-auto text-captionXs text-nc-content-gray-muted">{{ filteredSemantic[group.id]?.length ?? 0 }}</span>
      </button>
      <template v-if="openGroups.includes(group.id) || !!search">
        <div
          v-for="def in filteredSemantic[group.id]"
          :key="def.name"
          class="flex items-center gap-2 py-1 pl-5 border-b-1 border-nc-border-gray-light last:border-b-0"
        >
          <label
            :theme="mode === 'dark' ? 'dark' : undefined"
            class="relative flex-none w-5 h-5 rounded border-1 border-nc-border-gray-medium cursor-pointer"
            :style="{ background: `var(${def.name})` }"
          >
            <input
              type="color"
              :value="resolved(def.name)"
              class="absolute inset-0 opacity-0 cursor-pointer"
              @input="setToken(mode, def.name, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <div class="flex-1 min-w-0">
            <div
              class="text-captionXs font-mono truncate"
              :class="isChanged(def.name) ? 'text-nc-content-brand' : 'text-nc-content-gray'"
            >
              {{ def.name.slice(5) }}
            </div>
            <input
              :value="shortValue(def)"
              class="w-full bg-transparent outline-none text-captionXs font-mono"
              :class="invalidValues.includes(def.name) ? 'text-nc-content-red-dark' : 'text-nc-content-gray-muted'"
              :aria-invalid="invalidValues.includes(def.name)"
              @change="onSemanticInput(def.name, ($event.target as HTMLInputElement).value)"
            />
            <div v-if="invalidValues.includes(def.name)" class="text-captionXs text-nc-content-red-dark">
              {{ $t('msg.invalidColor') }}
            </div>
          </div>
          <NcButton v-if="isChanged(def.name)" size="xxsmall" type="text" icon-only @click="setToken(mode, def.name, null)">
            <template #icon>
              <GeneralIcon icon="ncX" class="w-3 h-3" />
            </template>
          </NcButton>
        </div>
      </template>
    </div>
  </section>
</template>
