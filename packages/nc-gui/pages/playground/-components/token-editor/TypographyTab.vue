<script setup lang="ts">
import { FONT_OPTIONS, TYPE_STYLES, usePlaygroundTokens } from '../../-helper/tokens'
import type { TypeStyle } from '../../-helper/tokens'

const { overrides, setTypography, scaleTypography } = usePlaygroundTokens()

const WEIGHTS = [400, 500, 550, 600, 700, 800]

const FIELDS: Array<{ key: Exclude<keyof TypeStyle, 'weight'>; label: string; step: number }> = [
  { key: 'size', label: 'Size', step: 0.5 },
  { key: 'lineHeight', label: 'Line', step: 1 },
  { key: 'letterSpacing', label: 'Track', step: 0.05 },
]

const scale = ref(1)

const search = ref('')

const expanded = ref<string | null>(null)

const visibleStyles = computed(() => {
  const q = search.value.trim().toLowerCase()
  return TYPE_STYLES.filter((s) => !q || s.key.toLowerCase().includes(q))
})

function current(key: string, field: keyof TypeStyle) {
  return overrides.value.typography[key]?.[field] ?? TYPE_STYLES.find((s) => s.key === key)![field]
}

function isChanged(key: string) {
  return !!overrides.value.typography[key]
}

function summary(key: string) {
  return `${current(key, 'size')} / ${current(key, 'lineHeight')} · ${current(key, 'weight')}`
}

function onScale(value: number) {
  scale.value = value
  scaleTypography(value)
}
</script>

<template>
  <section class="p-4 flex flex-col gap-4 border-b-1 border-nc-border-gray-medium">
    <div>
      <div class="text-captionSmBold text-nc-content-gray-subtle mb-2">Font family</div>
      <NcSelect v-model:value="overrides.font" size="small" class="w-full">
        <a-select-option v-for="f in FONT_OPTIONS" :key="f.label" :value="f.value">{{ f.label }}</a-select-option>
      </NcSelect>
    </div>
    <div>
      <div class="flex items-center mb-1">
        <span class="text-captionSmBold text-nc-content-gray-subtle">Overall scale</span>
        <span class="ml-auto text-captionXs font-mono text-nc-content-gray-muted">× {{ scale }}</span>
      </div>
      <a-slider :value="scale" :min="0.8" :max="1.3" :step="0.05" class="!m-0 !mt-1" @change="onScale" />
      <div class="text-captionXs text-nc-content-gray-muted mt-1">Resizes every style below. Fine-tune single styles after.</div>
    </div>
  </section>

  <section class="p-4 flex flex-col gap-2">
    <div>
      <div class="text-captionSmBold text-nc-content-gray-subtle">Text styles</div>
      <div class="text-captionXs text-nc-content-gray-muted mt-0.5">
        The <code>text-*</code> presets every screen uses. Click one to edit its size, line height, weight and tracking.
      </div>
    </div>
    <a-input v-model:value="search" placeholder="Filter, e.g. caption" allow-clear class="nc-input-sm">
      <template #prefix>
        <GeneralIcon icon="ncSearch" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
      </template>
    </a-input>

    <div class="flex flex-col">
      <div v-for="style in visibleStyles" :key="style.key" class="border-b-1 border-nc-border-gray-light last:border-b-0">
        <button
          class="w-full py-2 flex items-baseline gap-2 text-left"
          @click="expanded = expanded === style.key ? null : style.key"
        >
          <span :class="`text-${style.key}`" class="flex-1 min-w-0 truncate text-nc-content-gray-emphasis"
            >Aa {{ style.key }}</span
          >
          <span
            class="flex-none text-captionXs font-mono"
            :class="isChanged(style.key) ? 'text-nc-content-brand' : 'text-nc-content-gray-muted'"
          >
            {{ summary(style.key) }}
          </span>
        </button>

        <div v-if="expanded === style.key" class="pb-3 flex flex-col gap-2">
          <div class="grid grid-cols-4 gap-2">
            <div v-for="f in FIELDS" :key="f.key" class="flex flex-col gap-1">
              <span class="text-captionXs text-nc-content-gray-muted">{{ f.label }}</span>
              <a-input-number
                :value="current(style.key, f.key)"
                :step="f.step"
                size="small"
                class="nc-input-sm !w-full"
                @change="(v: number | null) => setTypography(style.key, { [f.key]: v })"
              />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-captionXs text-nc-content-gray-muted">Weight</span>
              <NcSelect
                :value="current(style.key, 'weight')"
                size="small"
                class="w-full"
                @change="(v: number) => setTypography(style.key, { weight: v })"
              >
                <a-select-option v-for="w in WEIGHTS" :key="w" :value="w">{{ w }}</a-select-option>
              </NcSelect>
            </div>
          </div>
          <div class="flex items-center">
            <code class="text-captionXs text-nc-content-gray-muted">.text-{{ style.key }}</code>
            <NcButton
              class="!ml-auto !px-2"
              size="xxsmall"
              type="text"
              :disabled="!isChanged(style.key)"
              @click="setTypography(style.key, null)"
            >
              <span class="text-captionXs">Reset</span>
            </NcButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
