<script setup lang="ts">
/**
 * Theme settings drawer — appearance mode + dark palette presets with
 * per-token fine-tuning. Opened from the user menu; mounted once in app.vue.
 */

const { isThemeConfigOpen, selectedTheme, setTheme, darkPalette, activeDarkPaletteValues, setDarkPreset, setDarkPaletteToken } =
  useTheme()

const { $e } = useNuxtApp()

const { t } = useI18n()

const showAdvanced = ref(false)

const modes = computed(() => [
  { value: 'system', label: t('general.system'), icon: 'ncSunMoon' as const },
  { value: 'light', label: t('general.light'), icon: 'ncSun' as const },
  { value: 'dark', label: t('general.dark'), icon: 'ncMoon' as const },
])

const onSelectMode = (mode: string) => {
  setTheme(mode as ThemeMode)
  $e('c:theme:mode', { mode })
}

const onSelectPreset = (presetId: string) => {
  setDarkPreset(presetId)
  $e('c:theme:preset', { preset: presetId })
}

/** swatch strip keys shown on each preset row */
const swatchKeys = ['minisidebar', 'sidebar', 'content', 'elevated', 'border']

/** color inputs need hex — blend translucent values over the elevated surface */
const toHexPreview = (value: string, values: Record<string, string>) => {
  if (value.startsWith('#')) return value
  const m = value.match(/rgba?\(([^)]+)\)/)
  if (!m) return '#000000'
  const [r, g, b, a = '1'] = m[1].split(',').map((v) => v.trim())
  const alpha = parseFloat(a)
  const base = values.elevated?.startsWith('#') ? values.elevated : '#292b32'
  const br = parseInt(base.slice(1, 3), 16)
  const bg = parseInt(base.slice(3, 5), 16)
  const bb = parseInt(base.slice(5, 7), 16)
  const mix = (c: string, bc: number) => Math.round(parseFloat(c) * alpha + bc * (1 - alpha))
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(mix(r, br))}${hex(mix(g, bg))}${hex(mix(b, bb))}`
}

const onTokenInput = (key: string, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  setDarkPaletteToken(key, value)
  $e('c:theme:token', { token: key })
}

const close = () => {
  isThemeConfigOpen.value = false
}
</script>

<template>
  <a-drawer
    v-model:visible="isThemeConfigOpen"
    placement="right"
    :width="340"
    :closable="false"
    :body-style="{ padding: '0' }"
    :mask-style="{ backgroundColor: 'transparent' }"
    class="nc-theme-config-drawer"
    :z-index="1050"
  >
    <div class="flex flex-col h-full">
      <!-- header -->
      <div class="flex items-center gap-2 px-4 h-12 flex-shrink-0 border-b-1 border-nc-border-gray-light">
        <GeneralIcon icon="palette" class="w-4 h-4 text-nc-content-gray-muted" />
        <span class="text-nc-content-gray font-semibold">{{ $t('title.themeSettings') }}</span>
        <div class="flex-1" />
        <NcButton size="xsmall" type="text" data-testid="nc-theme-config-close" @click="close">
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </div>

      <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-4 py-4 flex flex-col gap-5">
        <!-- appearance mode -->
        <div class="flex flex-col gap-2">
          <div class="nc-theme-config-section-title">{{ $t('general.appearance') }}</div>
          <div class="flex gap-2">
            <div
              v-for="mode of modes"
              :key="mode.value"
              class="nc-theme-mode-tile"
              :class="{ active: selectedTheme === mode.value }"
              :data-testid="`nc-theme-mode-${mode.value}`"
              @click="onSelectMode(mode.value)"
            >
              <GeneralIcon :icon="mode.icon" class="w-4 h-4" />
              <span class="text-small">{{ mode.label }}</span>
            </div>
          </div>
        </div>

        <!-- dark palette presets -->
        <div class="flex flex-col gap-2">
          <div class="nc-theme-config-section-title">{{ $t('labels.themeConfig.darkPalette') }}</div>
          <div class="text-tiny text-nc-content-gray-muted -mt-1">
            {{ $t('labels.themeConfig.darkPaletteHint') }}
          </div>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="preset of DARK_PALETTE_PRESETS"
              :key="preset.id"
              class="nc-theme-preset-row"
              :class="{ active: darkPalette.preset === preset.id }"
              :data-testid="`nc-theme-preset-${preset.id}`"
              @click="onSelectPreset(preset.id)"
            >
              <div class="nc-theme-preset-swatches">
                <span
                  v-for="key of swatchKeys"
                  :key="key"
                  :style="{ backgroundColor: toHexPreview(preset.values[key], preset.values) }"
                />
              </div>
              <span class="text-small font-medium text-nc-content-gray flex-1">{{ preset.label }}</span>
              <GeneralIcon v-if="darkPalette.preset === preset.id" icon="check" class="w-4 h-4 text-nc-content-brand" />
            </div>
          </div>
        </div>

        <!-- advanced fine-tune -->
        <div class="flex flex-col gap-2">
          <div
            class="flex items-center gap-1 cursor-pointer select-none"
            data-testid="nc-theme-advanced-toggle"
            @click="showAdvanced = !showAdvanced"
          >
            <div class="nc-theme-config-section-title">{{ $t('general.advanced') }}</div>
            <GeneralIcon
              icon="chevronRight"
              class="w-3.5 h-3.5 text-nc-content-gray-muted transition-transform"
              :class="{ 'transform rotate-90': showAdvanced }"
            />
          </div>
          <div v-if="showAdvanced" class="flex flex-col gap-1">
            <div v-for="token of DARK_PALETTE_TOKENS" :key="token.key" class="nc-theme-token-row">
              <input
                type="color"
                :value="toHexPreview(activeDarkPaletteValues[token.key], activeDarkPaletteValues)"
                :data-testid="`nc-theme-token-${token.key}`"
                @input="onTokenInput(token.key, $event)"
              />
              <span class="text-small text-nc-content-gray flex-1">{{ $t(`labels.themeConfig.${token.labelKey}`) }}</span>
              <span class="text-tiny text-nc-content-gray-muted font-mono">
                {{ toHexPreview(activeDarkPaletteValues[token.key], activeDarkPaletteValues) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<style lang="scss">
.nc-theme-config-drawer {
  .ant-drawer-content-wrapper {
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.16);
  }
}
</style>

<style lang="scss" scoped>
.nc-theme-config-section-title {
  @apply text-tiny font-semibold uppercase tracking-wider text-nc-content-gray-muted;
}

.nc-theme-mode-tile {
  @apply flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-1 border-nc-border-gray-medium cursor-pointer text-nc-content-gray-subtle2 transition-colors;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }

  &.active {
    @apply border-nc-border-brand text-nc-content-gray;
  }
}

.nc-theme-preset-row {
  @apply flex items-center gap-3 px-2.5 py-2 rounded-lg border-1 border-nc-border-gray-light cursor-pointer transition-colors;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }

  &.active {
    @apply border-nc-border-brand;
  }
}

.nc-theme-preset-swatches {
  @apply flex rounded-md overflow-hidden border-1 border-nc-border-gray-medium;

  span {
    @apply block w-4 h-6;
  }
}

.nc-theme-token-row {
  @apply flex items-center gap-2.5 px-1 py-1;

  input[type='color'] {
    @apply w-7 h-5.5 p-0 border-1 border-nc-border-gray-medium rounded-md cursor-pointer bg-transparent;

    &::-webkit-color-swatch-wrapper {
      padding: 1px;
    }

    &::-webkit-color-swatch {
      border: none;
      border-radius: 4px;
    }
  }
}
</style>
