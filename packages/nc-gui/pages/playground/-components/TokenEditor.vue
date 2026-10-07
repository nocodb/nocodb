<script setup lang="ts">
import { FONT_OPTIONS, collectTokenDefs, usePlaygroundTokens } from '../-helper/tokens'
import type { TokenDef, TokenMode } from '../-helper/tokens'

const { isDark } = useTheme()

const { overrides, css, overrideCount, setToken, setRamp, clearRamp, reset, importJson } = usePlaygroundTokens()

const { copy } = useClipboard()

const BRAND_PRESETS = ['#3366ff', '#7c3aed', '#0d9488', '#059669', '#e11d48', '#ea580c', '#111827']

const GRAY_PRESETS = [
  { label: 'Default', value: '' },
  { label: 'Slate', value: '#64748b' },
  { label: 'Zinc', value: '#71717a' },
  { label: 'Stone', value: '#78716c' },
  { label: 'Blue-gray', value: '#5b6b8c' },
]

const RENDER_LIMIT = 150

const tokenDefs = ref<TokenDef[]>([])

const search = ref('')

const group = ref('all')

const editMode = ref<TokenMode>(isDark.value ? 'dark' : 'light')

const showOnlyChanged = ref(false)

const importText = ref('')

const isImportOpen = ref(false)

const brandBase = computed(() => overrides.value.light['--nc-brand-accent'] ?? '#3366ff')

const grayBase = computed(() => overrides.value.light['--color-gray-500'] ?? '')

const groups = computed(() => ['all', ...new Set(tokenDefs.value.map((d) => d.group))])

const filteredDefs = computed(() => {
  const q = search.value.trim().toLowerCase()
  const changed = overrides.value[editMode.value]
  return tokenDefs.value.filter(
    (d) =>
      (group.value === 'all' || d.group === group.value) &&
      (!q || d.name.includes(q)) &&
      (!showOnlyChanged.value || d.name in changed),
  )
})

const visibleDefs = computed(() => filteredDefs.value.slice(0, RENDER_LIMIT))

function isHex(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

function currentValue(def: TokenDef) {
  return overrides.value[editMode.value][def.name] ?? def[editMode.value]
}

function resolvedColor(def: TokenDef) {
  const value = currentValue(def)
  if (isHex(value)) return value
  return value.startsWith('var(') || value.startsWith('rgb') || value.startsWith('#') ? value : 'transparent'
}

function onBrandChange(value: string) {
  if (isHex(value)) setRamp('brand', value)
}

function onGrayChange(value: string) {
  if (value) setRamp('gray', value, ['light'])
  else clearRamp('gray')
}

function copyCss() {
  copy(css.value || '/* no overrides */')
  message.success('CSS copied')
}

function copyJson() {
  copy(JSON.stringify(overrides.value, null, 2))
  message.success('JSON copied')
}

function applyImport() {
  try {
    importJson(importText.value)
    isImportOpen.value = false
    importText.value = ''
  } catch {
    message.error('Invalid JSON')
  }
}

watch(isDark, (dark) => {
  editMode.value = dark ? 'dark' : 'light'
})

onMounted(() => {
  tokenDefs.value = collectTokenDefs()
})
</script>

<template>
  <aside class="nc-playground-token-editor flex flex-col bg-nc-bg-default">
    <div class="flex-none px-4 h-11 flex items-center gap-2 border-b-1 border-nc-border-gray-medium">
      <span class="text-captionBold text-nc-content-gray-emphasis">Design tokens</span>
      <span class="text-captionSm text-nc-content-gray-muted">{{ overrideCount }} changed</span>
      <NcButton class="!ml-auto" size="xsmall" type="text" :disabled="!overrideCount" @click="reset">
        <div class="flex items-center gap-1">
          <GeneralIcon icon="ncRotateCcw" class="w-3.5 h-3.5" />
          Reset
        </div>
      </NcButton>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto nc-scrollbar-thin">
      <section class="p-4 flex flex-col gap-4 border-b-1 border-nc-border-gray-medium">
        <div>
          <div class="text-captionSmBold text-nc-content-gray-subtle mb-2">Brand colour</div>
          <div class="flex items-center gap-2">
            <input
              type="color"
              :value="brandBase"
              class="w-8 h-8 rounded-md border-1 border-nc-border-gray-medium cursor-pointer bg-transparent"
              @input="onBrandChange(($event.target as HTMLInputElement).value)"
            />
            <a-input
              :value="brandBase"
              class="nc-input-sm !w-28 font-mono"
              @change="onBrandChange(($event.target as HTMLInputElement).value)"
            />
            <NcButton size="xsmall" type="text" :disabled="!overrides.light['--nc-brand-accent']" @click="clearRamp('brand')">
              Clear
            </NcButton>
          </div>
          <div class="flex gap-1.5 mt-2">
            <button
              v-for="c in BRAND_PRESETS"
              :key="c"
              class="w-6 h-6 rounded-full border-2"
              :class="brandBase === c ? 'border-nc-border-gray-dark' : 'border-transparent'"
              :style="{ background: c }"
              @click="onBrandChange(c)"
            />
          </div>
          <div class="text-captionXs text-nc-content-gray-muted mt-1.5">
            Generates the full --color-brand-* ramp for both modes, plus the accent and Ant primary vars.
          </div>
        </div>

        <div>
          <div class="text-captionSmBold text-nc-content-gray-subtle mb-2">Gray tone (light mode)</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="g in GRAY_PRESETS"
              :key="g.label"
              class="h-7 px-2 rounded-md border-1 text-captionSm flex items-center gap-1.5"
              :class="grayBase === g.value ? 'border-nc-border-brand text-nc-content-brand' : 'border-nc-border-gray-medium'"
              @click="onGrayChange(g.value)"
            >
              <span v-if="g.value" class="w-3 h-3 rounded-full" :style="{ background: g.value }" />
              {{ g.label }}
            </button>
          </div>
        </div>

        <div class="flex gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-captionSmBold text-nc-content-gray-subtle mb-2">Font</div>
            <NcSelect v-model:value="overrides.font" size="small" class="w-full">
              <a-select-option v-for="f in FONT_OPTIONS" :key="f.label" :value="f.value">{{ f.label }}</a-select-option>
            </NcSelect>
          </div>
          <div class="w-32">
            <div class="text-captionSmBold text-nc-content-gray-subtle mb-2">Radius × {{ overrides.radiusScale }}</div>
            <a-slider v-model:value="overrides.radiusScale" :min="0" :max="2" :step="0.25" class="!m-0 !mt-2" />
          </div>
        </div>
      </section>

      <section class="p-4 flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="text-captionSmBold text-nc-content-gray-subtle">All tokens</span>
          <div class="ml-auto flex items-center p-0.5 rounded-md bg-nc-bg-gray-light">
            <button
              v-for="m in ['light', 'dark'] as const"
              :key="m"
              class="h-6 px-2 rounded text-captionSm capitalize"
              :class="editMode === m ? 'bg-nc-bg-default shadow-sm text-nc-content-gray-emphasis' : 'text-nc-content-gray-muted'"
              @click="editMode = m"
            >
              {{ m }}
            </button>
          </div>
        </div>
        <a-input v-model:value="search" placeholder="Search --nc-bg-brand…" allow-clear class="nc-input-sm">
          <template #prefix>
            <GeneralIcon icon="ncSearch" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
          </template>
        </a-input>
        <div class="flex items-center gap-2">
          <NcSelect v-model:value="group" size="small" class="flex-1 min-w-0" show-search>
            <a-select-option v-for="g in groups" :key="g" :value="g">{{ g === 'all' ? 'All groups' : g }}</a-select-option>
          </NcSelect>
          <NcSwitch v-model:checked="showOnlyChanged" size="small">
            <span class="text-captionSm">Changed</span>
          </NcSwitch>
        </div>
        <div class="text-captionXs text-nc-content-gray-muted">
          Editing <b>{{ editMode }}</b> values · {{ filteredDefs.length }} tokens
          <template v-if="filteredDefs.length > RENDER_LIMIT"> · showing first {{ RENDER_LIMIT }}</template>
        </div>
        <div
          v-if="group.startsWith('System') || search.startsWith('--nc-')"
          class="text-captionXs text-nc-content-yellow-dark bg-nc-bg-yellow-light rounded-md px-2 py-1.5"
        >
          Utility classes like <code>text-nc-content-gray</code> compile straight to palette stops, so editing a
          <code>--nc-*</code> token only changes CSS that reads <code>var(--nc-…)</code>. To recolour everything, edit the palette
          stop it points to.
        </div>

        <div class="flex flex-col">
          <div
            v-for="def in visibleDefs"
            :key="def.name"
            class="group flex items-center gap-2 py-1 border-b-1 border-nc-border-gray-light"
          >
            <label
              class="relative flex-none w-5 h-5 rounded border-1 border-nc-border-gray-medium overflow-hidden cursor-pointer"
              :style="{ background: resolvedColor(def) }"
            >
              <input
                v-if="isHex(currentValue(def))"
                type="color"
                :value="currentValue(def)"
                class="absolute inset-0 opacity-0 cursor-pointer"
                @input="setToken(editMode, def.name, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <div class="flex-1 min-w-0">
              <div
                class="text-captionXs font-mono truncate"
                :class="def.name in overrides[editMode] ? 'text-nc-content-brand' : 'text-nc-content-gray'"
              >
                {{ def.name }}
              </div>
              <input
                :value="currentValue(def)"
                class="w-full bg-transparent outline-none text-captionXs font-mono text-nc-content-gray-muted"
                @change="setToken(editMode, def.name, ($event.target as HTMLInputElement).value.trim() || null)"
              />
            </div>
            <NcButton
              v-if="def.name in overrides[editMode]"
              size="xxsmall"
              type="text"
              icon-only
              @click="setToken(editMode, def.name, null)"
            >
              <template #icon>
                <GeneralIcon icon="ncX" class="w-3 h-3" />
              </template>
            </NcButton>
          </div>
        </div>
      </section>
    </div>

    <div class="flex-none p-3 border-t-1 border-nc-border-gray-medium flex flex-col gap-2">
      <div v-if="isImportOpen" class="flex flex-col gap-2">
        <a-textarea v-model:value="importText" :rows="4" placeholder="Paste exported JSON" class="!text-captionXs font-mono" />
        <div class="flex gap-2 justify-end">
          <NcButton size="xsmall" type="text" @click="isImportOpen = false">Cancel</NcButton>
          <NcButton size="xsmall" :disabled="!importText" @click="applyImport">Apply</NcButton>
        </div>
      </div>
      <div class="flex gap-2">
        <NcButton size="small" type="secondary" class="flex-1" @click="copyCss">Copy CSS</NcButton>
        <NcButton size="small" type="secondary" class="flex-1" @click="copyJson">Copy JSON</NcButton>
        <NcButton size="small" type="secondary" @click="isImportOpen = !isImportOpen">Import</NcButton>
      </div>
    </div>
  </aside>
</template>
