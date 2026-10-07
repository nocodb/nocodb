<script setup lang="ts">
import { collectTokenDefs, resolveTokenValue, usePlaygroundTokens } from '../../-helper/tokens'
import type { TokenDef, TokenMode } from '../../-helper/tokens'
import { toHex } from '../../foundations/-sections/useResolvedVars'

const props = defineProps<{
  mode: TokenMode
}>()

const { overrides, setToken } = usePlaygroundTokens()

const RENDER_LIMIT = 150

const tokenDefs = ref<TokenDef[]>([])

const defsByName = computed(() => new Map(tokenDefs.value.map((d) => [d.name, d])))

const search = ref('')

const group = ref('all')

const showOnlyChanged = ref(false)

const invalidValues = ref<string[]>([])

const groups = computed(() => ['all', ...new Set(tokenDefs.value.map((d) => d.group))])

const filteredDefs = computed(() => {
  const q = search.value.trim().toLowerCase()
  const changed = overrides.value[props.mode]
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
  return overrides.value[props.mode][def.name] ?? def[props.mode]
}

function isColourToken(def: TokenDef) {
  return def.group.startsWith('Palette') || def.group.startsWith('System')
}

function resolved(def: TokenDef) {
  return resolveTokenValue(defsByName.value, overrides.value, props.mode, def.name)
}

function setValue(def: TokenDef, value: string | null) {
  for (const mode of isColourToken(def) ? [props.mode] : (['light', 'dark'] as const)) setToken(mode, def.name, value)
}

function onValueInput(def: TokenDef, raw: string) {
  const value = raw.trim()
  if (value && isColourToken(def) && !CSS.supports('color', value)) {
    if (!invalidValues.value.includes(def.name)) invalidValues.value = [...invalidValues.value, def.name]
    return
  }
  invalidValues.value = invalidValues.value.filter((n) => n !== def.name)
  setValue(def, value || null)
}

onMounted(() => {
  tokenDefs.value = collectTokenDefs()
})
</script>

<template>
  <section class="p-4 flex flex-col gap-2">
    <div class="text-captionXs text-nc-content-gray-muted">
      Every CSS variable on <code>:root</code> and <code>[theme='dark']</code>. Use the other tabs first — this is for the odd one
      out.
    </div>
    <a-input v-model:value="search" placeholder="Search --nc-bg-brand…" allow-clear class="nc-input-sm">
      <template #prefix>
        <GeneralIcon icon="ncSearch" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
      </template>
    </a-input>
    <div class="flex items-center gap-2">
      <NcSelect v-model:value="group" class="flex-1 min-w-0" show-search>
        <a-select-option v-for="g in groups" :key="g" :value="g">{{ g === 'all' ? 'All groups' : g }}</a-select-option>
      </NcSelect>
      <NcSwitch v-model:checked="showOnlyChanged" size="small">
        <span class="text-captionSm">Changed</span>
      </NcSwitch>
    </div>
    <div class="text-captionXs text-nc-content-gray-muted">
      {{ filteredDefs.length }} tokens
      <template v-if="filteredDefs.length > RENDER_LIMIT"> · showing first {{ RENDER_LIMIT }}</template>
    </div>

    <div class="flex flex-col">
      <div v-for="def in visibleDefs" :key="def.name" class="flex items-center gap-2 py-1 border-b-1 border-nc-border-gray-light">
        <label
          v-if="isColourToken(def)"
          class="relative flex-none w-5 h-5 rounded border-1 border-nc-border-gray-medium overflow-hidden"
          :class="{ 'cursor-pointer': isHex(resolved(def)) }"
          :style="{ background: resolved(def) }"
        >
          <input
            v-if="isHex(resolved(def))"
            type="color"
            :value="toHex(resolved(def))"
            class="absolute inset-0 opacity-0 cursor-pointer"
            :aria-label="def.name"
            @input="setToken(mode, def.name, ($event.target as HTMLInputElement).value)"
          />
        </label>
        <div v-else class="flex-none w-5" />
        <div class="flex-1 min-w-0">
          <div
            class="text-captionXs font-mono truncate"
            :class="def.name in overrides[mode] ? 'text-nc-content-brand' : 'text-nc-content-gray'"
          >
            {{ def.name }}
          </div>
          <input
            :value="currentValue(def)"
            :aria-label="`${def.name} value`"
            class="w-full bg-transparent outline-none text-captionXs font-mono"
            :class="invalidValues.includes(def.name) ? 'text-nc-content-red-dark' : 'text-nc-content-gray-muted'"
            :aria-invalid="invalidValues.includes(def.name)"
            @change="onValueInput(def, ($event.target as HTMLInputElement).value)"
          />
          <div v-if="invalidValues.includes(def.name)" class="text-captionXs text-nc-content-red-dark">
            {{ $t('msg.invalidColor') }}
          </div>
        </div>
        <NcButton v-if="def.name in overrides[mode]" size="xxsmall" type="text" icon-only @click="setValue(def, null)">
          <template #icon>
            <GeneralIcon icon="ncX" class="w-3 h-3" />
          </template>
        </NcButton>
      </div>
    </div>
  </section>
</template>
