<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import { chipPaletteColors, fullPaletteColors } from '../../utils/colorsUtils'

interface Props {
  modelValue?: string | any
  isOpen?: boolean
  includeBlackAndWhiteAsDefaultColors?: boolean
  invertInDarkMode?: boolean
  showTextIcon?: boolean
  /**
   * Which swatch set the Default colours tab offers.
   *
   * `full` — every stop of every ramp, 9 x 10. Right where the swatch becomes a
   *   foreground on a normal surface (checkbox tick, rating star, Colour cell),
   *   because all ten shades stay distinct there.
   * `chip` — 4 tiers x 9 hues. Right where the swatch becomes a chip: the trimmed
   *   set drops shades that render identically once a chip background is applied.
   */
  palette?: 'full' | 'chip'
  /**
   * Option title to render inside every swatch, so each one previews the real label
   * on the real background rather than a stand-in glyph. Chip palette only — the full
   * palette backs foreground pickers (checkbox tick, rating star) that have no label.
   */
  previewLabel?: string
  getBgColorCallback?: (color: string, isDark: boolean) => string
  getTextColorCallback?: (color: string, isDark: boolean) => string
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  palette: 'full',
})

const emit = defineEmits(['input', 'closeModal'])

const { isOpen } = toRefs(props)

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('input', val || null)
  },
})

const { isDark, getColor } = useTheme()

const showActiveColorTab = ref<boolean>(false)

const picked = ref<string>(props.modelValue || enumColor.light[0])

const swatches = computed<string[][]>(() => (props.palette === 'chip' ? chipPaletteColors : fullPaletteColors))

/** Swatch renders as a labelled chip only when there is a label to put in it. */
const swatchLabel = computed(() => (props.palette === 'chip' ? props.previewLabel?.trim() || '' : ''))

/** 24px square, or a 48px chip once it carries a label — plus 4px padding each side. */
const cellWidth = computed(() => (swatchLabel.value ? 56 : 32))

const localIsDefaultColorTab = ref<'true' | 'false'>('true')

const isDefaultColorTab = computed({
  get: () => {
    const colorGrps = [...swatches.value]
    if (props.includeBlackAndWhiteAsDefaultColors) colorGrps.push(['#000000', '#ffffff'])
    if (showActiveColorTab.value && vModel.value) {
      for (const colorGrp of colorGrps) {
        if (colorGrp.includes(vModel.value)) {
          return 'true'
        }
      }
      return 'false'
    }

    return localIsDefaultColorTab.value
  },
  set: (val: 'true' | 'false') => {
    localIsDefaultColorTab.value = val

    if (showActiveColorTab.value) {
      showActiveColorTab.value = false
    }
  },
})

/**
 * The spectrum doesn't need the swatch grid's width — a labelled grid runs to 520px
 * and the picker just stretches to fill it. Each tab sizes to its own content: the
 * grid to its columns, the spectrum to the width the full palette already uses.
 * Only the width changes on tab switch, which re-aligns the dropdown horizontally
 * without flipping it above the trigger the way a height change does.
 */
const SPECTRUM_TAB_WIDTH = 336

const gridTabWidth = computed(() => Math.max(...swatches.value.map((row) => row.length)) * cellWidth.value + 16)

const panelWidth = computed(() => (isDefaultColorTab.value === 'true' ? gridTabWidth.value : SPECTRUM_TAB_WIDTH))

/**
 * The tab bar keeps the narrower tab's width in both states. Left to fill the panel it
 * would stretch with it, and the title you just clicked slides out from under the
 * cursor as the panel resizes behind it.
 */
const tabBarWidth = computed(() => Math.min(gridTabWidth.value, SPECTRUM_TAB_WIDTH))

const selectColor = (color: string, closeModal = false) => {
  picked.value = color

  if (closeModal) {
    emit('closeModal')
  }
}

const compare = (colorA: string, colorB: string) => {
  if (!colorA || !colorB) return false

  return colorA.toLowerCase() === colorB.toLowerCase() || colorA.toLowerCase() === tinycolor(colorB).toHex8String().toLowerCase()
}

watch(picked, (n, _o) => {
  vModel.value = n
})

watch(
  isOpen,
  (newValue) => {
    if (newValue) {
      showActiveColorTab.value = true
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    class="nc-advance-color-picker pt-2"
    :style="{ 'width': `${panelWidth}px`, '--nc-color-picker-tab-bar-width': `${tabBarWidth}px` }"
    click.stop
  >
    <NcTabs v-model:active-key="isDefaultColorTab" class="nc-advance-color-picker-tab w-full">
      <a-tab-pane key="true">
        <template #tab>
          <div class="tab" data-testid="nc-default-colors-tab">{{ $t('labels.defaultColours') }}</div>
        </template>
        <div class="h-full p-2">
          <div class="flex flex-col gap-1">
            <div v-for="(colorGroup, i) of swatches" :key="i" class="flex">
              <div
                v-for="(color, j) of colorGroup"
                :key="`color-${i}-${j}`"
                class="p-1 rounded-md flex h-8 hover:bg-nc-bg-gray-medium"
              >
                <button
                  class="color-selector"
                  :class="{ 'selected': compare(picked, color), 'is-labelled': !!swatchLabel }"
                  :style="{
                    backgroundColor: getBgColorCallback
                      ? getBgColorCallback(color || '#ccc', isDark)
                      : showTextIcon
                      ? getSelectTypeFieldOptionBgColor({
                          color: color || '#ccc',
                          isDark: invertInDarkMode && isDark,
                        })
                      : getDarkModeCompatibleBgColor({ color: color || '#ccc', isDark: invertInDarkMode && isDark }),
                    color: getTextColorCallback
                      ? getTextColorCallback(color || '#ccc', isDark)
                      : getSelectTypeFieldOptionTextColor({
                          color: color || '#ccc',
                          isDark: invertInDarkMode && isDark,
                          getColor,
                        }),
                  }"
                  :title="swatchLabel || undefined"
                  @click="selectColor(color, true)"
                >
                  <span v-if="swatchLabel" class="nc-color-selector-label">{{ swatchLabel }}</span>
                  <GeneralIcon v-else-if="showTextIcon" icon="cellText" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>
      <a-tab-pane key="false">
        <template #tab>
          <div class="tab" data-testid="nc-custom-colors-tab">
            <div>{{ $t('labels.customColours') }}</div>
          </div>
        </template>
        <div class="h-full p-2">
          <LazyGeneralChromeWrapper v-model="picked" class="!w-full !shadow-none" />
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.color-picker {
  @apply flex flex-col items-center justify-center bg-nc-bg-default p-2.5;
}
.color-picker-row {
  @apply flex flex-row space-x-1;
}
.color-selector {
  @apply h-6 w-6 rounded;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: var(--nc-bg-default);
}

// Labelled variant: a real chip at the size the grid renders one, so the swatch
// previews the option instead of standing in for it.
.color-selector.is-labelled {
  @apply w-12 rounded-xl flex items-center justify-center overflow-hidden px-1.5;
  -webkit-text-stroke-width: 0;
}

.nc-color-selector-label {
  @apply truncate text-[11px] font-semibold leading-none;
}
.color-selector:hover {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}
.color-selector:focus,
.color-selector.selected,
.nc-more-colors-trigger:focus {
  outline: none;
  box-shadow: 0px 0px 0px 2px var(--nc-bg-default), 0px 0px 0px 4px var(--nc-fill-primary);
}

:deep(.vc-chrome-toggle-icon) {
  @apply !ml-3;
}

// The spectrum is aspect-driven — `.vc-chrome-saturation-wrap` is 55% of its width —
// so at the panel's width the gradient alone runs to ~277px and the tab towers over
// the swatch grid. A fixed height covers the same range, just sampled more coarsely.
:deep(.vc-chrome-saturation-wrap) {
  height: 150px;
  padding-bottom: 0;
}

:deep(.ant-tabs) {
  @apply !overflow-visible;
  .ant-tabs-nav {
    @apply px-1;
    .ant-tabs-nav-list {
      @apply gap-6;
      // fixed so the tab titles hold their position when the panel resizes; -8px for
      // the nav's own px-1
      width: calc(var(--nc-color-picker-tab-bar-width) - 8px);

      .ant-tabs-tab {
        @apply flex-1 flex items-center justify-center pt-2 pb-2 text-xs font-semibold;

        & + .ant-tabs-tab {
          @apply !ml-0;
        }
      }
    }
  }
  .ant-tabs-content-holder {
    .ant-tabs-content {
      @apply h-full;
    }
  }
}
</style>
