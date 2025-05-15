<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import windiColors from 'windicss/colors'
import { themeV3Colors } from '../../utils/colorsUtils'

interface Props {
  modelValue?: string | any
  isOpen?: boolean
  includeBlackAndWhiteAsDefaultColors?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
})

const emit = defineEmits(['input', 'closeModal'])

const { isOpen } = toRefs(props)

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('input', val || null)
  },
})

const showActiveColorTab = ref<boolean>(false)

const picked = ref<string>(props.modelValue || enumColor.light[0])

const defaultColors = computed<string[][]>(() => {
  const colors = [
    'gray',
    'red',
    'green',
    'yellow',
    'orange',
    'pink',
    'maroon',
    'purple',
    'blue',
  ] as (keyof typeof themeV3Colors)[] & (keyof typeof windiColors)[]

  const allColors = []

  for (const color of colors) {
    if (themeV3Colors[color]) {
      allColors.push(color === 'gray' ? Object.values(themeV3Colors[color]).slice(1) : Object.values(themeV3Colors[color]))
    } else if (windiColors[color]) {
      allColors.push(Object.values(windiColors[color]))
    }
  }
  return allColors
})

const localIsDefaultColorTab = ref<'true' | 'false'>('true')

const isDefaultColorTab = computed({
  get: () => {
    const colorGrps = [...defaultColors.value]
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
  <div class="nc-advance-color-picker w-[336px] pt-2" click.stop>
    <NcTabs v-model:activeKey="isDefaultColorTab" class="nc-advance-color-picker-tab w-full">
      <a-tab-pane key="true">
        <template #tab>
          <div class="tab" data-testid="nc-default-colors-tab">Default colors</div>
        </template>
        <div class="h-full p-2">
          <div class="flex flex-col gap-1">
            <div v-for="(colorGroup, i) of defaultColors" :key="i" class="flex">
              <div v-for="(color, j) of colorGroup" :key="`color-${i}-${j}`" class="p-1 rounded-md flex h-8 hover:bg-gray-200">
                <button
                  class="color-selector"
                  :class="{ selected: compare(picked, color) }"
                  :style="{
                    backgroundColor: `${color}`,
                  }"
                  @click="selectColor(color, true)"
                ></button>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>
      <a-tab-pane key="false">
        <template #tab>
          <div class="tab" data-testid="nc-custom-colors-tab">
            <div>Custom colours</div>
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
  @apply flex flex-col items-center justify-center bg-white p-2.5;
}
.color-picker-row {
  @apply flex flex-row space-x-1;
}
.color-selector {
  @apply h-6 w-6 rounded;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: white;
}
.color-selector:hover {
  filter: brightness(90%);
  -webkit-filter: brightness(90%);
}
.color-selector:focus,
.color-selector.selected,
.nc-more-colors-trigger:focus {
  outline: none;
  box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
}

:deep(.vc-chrome-toggle-icon) {
  @apply !ml-3;
}

:deep(.ant-tabs) {
  @apply !overflow-visible;
  .ant-tabs-nav {
    @apply px-1;
    .ant-tabs-nav-list {
      @apply w-[99%] mx-auto gap-6;

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
