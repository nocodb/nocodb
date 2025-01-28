<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import type { PageDesignerTextWidget } from '../lib/widgets'
import BorderImage from '../assets/border.svg'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'

const payload = inject(PageDesignerPayloadInj)!

const fontWeightToLabel: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra Light',
  '300': 'Light',
  '400': 'Normal',
  '500': 'Medium',
  '600': 'Semi Bold',
  '700': 'Bold',
  '800': 'Extra Bold',
  '900': 'Heavy',
}

const fonts = ['Arial', 'Tahoma', 'Times New Roman', 'Verdana', 'Courier New', 'Georgia', 'Impact', 'Trebuchet MS', 'Manrope']
const fontWeights = ['400', '700']

const textWidget = ref<PageDesignerTextWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    textWidget.value = payload?.value?.widgets[id] as PageDesignerTextWidget
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="textWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header class="widget-header">
      <h1 class="m-0">Text</h1>
    </header>
    <GroupedSettings title="Content">
      <a-textarea v-model:value="textWidget.value" :rows="4" placeholder="Lorem ipsum..."></a-textarea>
    </GroupedSettings>
    <GroupedSettings title="Alignment">
      <div class="flex gap-3">
        <a-radio-group v-model:value="textWidget.horizontalAlign" class="radio-pills">
          <a-radio-button value="flex-start">
            <GeneralIcon icon="ncAlignLeft" />
          </a-radio-button>
          <a-radio-button value="center">
            <GeneralIcon icon="ncAlignCenter" />
          </a-radio-button>
          <a-radio-button value="flex-end">
            <GeneralIcon icon="ncAlignRight" />
          </a-radio-button>
        </a-radio-group>
        <a-radio-group v-model:value="textWidget.verticalAlign" class="radio-pills">
          <a-radio-button value="flex-start">
            <GeneralIcon icon="ncVerticalAlignTop" />
          </a-radio-button>
          <a-radio-button value="center">
            <GeneralIcon icon="ncVerticalAlignCenter" />
          </a-radio-button>
          <a-radio-button value="flex-end">
            <GeneralIcon icon="ncVerticalAlignBottom" />
          </a-radio-button>
        </a-radio-group>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Font settings">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Family</span>
          <NcSelect v-model:value="textWidget.fontFamily" show-search>
            <a-select-option v-for="font of fonts" :key="font" :value="font">
              {{ font }}
            </a-select-option>
          </NcSelect>
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Weight</span>
          <NcSelect v-model:value="textWidget.fontWeight">
            <a-select-option v-for="weight of fontWeights" :key="weight" :value="weight">
              {{ fontWeightToLabel[weight] }} - {{ weight }}
            </a-select-option>
          </NcSelect>
        </div>
      </div>
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Size</span>
          <NonNullableNumberInput v-model="textWidget.fontSize" class="flex-1" placeholder="14" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Line Height</span>
          <NonNullableNumberInput v-model="textWidget.lineHeight" class="flex-1" placeholder="Value" />
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Border">
      <div class="flex gap-2 items-center">
        <div class="flex flex-col gap-2 border-inputs justify-center items-center flex-1">
          <div>
            <NonNullableNumberInput v-model="textWidget.borderTop" />
          </div>
          <div class="flex gap-2 items-center">
            <NonNullableNumberInput v-model="textWidget.borderLeft" />
            <img :src="BorderImage" />
            <NonNullableNumberInput v-model="textWidget.borderRight" />
          </div>
          <div>
            <NonNullableNumberInput v-model="textWidget.borderBottom" />
          </div>
        </div>
        <div class="flex-1 flex flex-col gap-2">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Color</span>
            <ColorPropertyPicker v-model="textWidget.borderColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Radius</span>
            <NonNullableNumberInput v-model="textWidget.borderRadius" />
          </div>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Background Color</span>
          <ColorPropertyPicker v-model="textWidget.backgroundColor" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Text Color</span>
          <ColorPropertyPicker v-model="textWidget.textColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>
