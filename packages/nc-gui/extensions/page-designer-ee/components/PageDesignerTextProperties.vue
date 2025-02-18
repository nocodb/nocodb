<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from '../lib/context'
import { type PageDesignerTextWidget, fontWeightToLabel, fontWeights, fonts } from '../lib/widgets'
import BorderImage from '../assets/border.svg'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'

defineEmits(['deleteCurrentWidget'])

const payload = inject(PageDesignerPayloadInj)!

const textWidget = ref<PageDesignerTextWidget>()

const meta = inject(PageDesignerTableTypeInj)
const row = inject(PageDesignerRowInj)!

const fieldsToIgnore = new Set([
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
  UITypes.Button,
  UITypes.GeoData,
  UITypes.Geometry,
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Attachment,
  UITypes.JSON,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.CreatedBy,
])
const columns = computed(() =>
  (meta?.value?.columns ?? []).filter(
    (column) => !fieldsToIgnore.has(column.uidt as UITypes) && row.value && !isRowEmpty(row.value, column),
  ),
)

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
      <AiPromptWithFields
        id="textWidgetContent"
        :key="payload.currentWidgetId"
        v-model="textWidget.value"
        :options="columns"
        placeholder="Lorem ipsum..."
        @keydown.delete="!textWidget.value && $emit('deleteCurrentWidget')"
      />
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
          <label>Family</label>
          <NcSelect v-model:value="textWidget.fontFamily" show-search>
            <a-select-option v-for="font of fonts" :key="font" :value="font">
              <span :style="{ fontFamily: font }">{{ font }}</span>
            </a-select-option>
          </NcSelect>
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Weight</label>
          <NcSelect v-model:value="textWidget.fontWeight">
            <a-select-option v-for="weight of fontWeights" :key="weight" :value="weight">
              <span :style="{ fontWeight: weight }"> {{ fontWeightToLabel[weight] }} - {{ weight }}</span>
            </a-select-option>
          </NcSelect>
        </div>
      </div>
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Size</label>
          <NonNullableNumberInput v-model="textWidget.fontSize" :reset-to="16" :min="1" class="flex-1" placeholder="16" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Line Height</label>
          <NonNullableNumberInput v-model="textWidget.lineHeight" :reset-to="1.4" :min="1" class="flex-1" placeholder="1.4" />
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
            <label>Border Color</label>
            <ColorPropertyPicker v-model="textWidget.borderColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Border Radius</label>
            <NonNullableNumberInput v-model="textWidget.borderRadius" />
          </div>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Background Color</label>
          <ColorPropertyPicker v-model="textWidget.backgroundColor" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Text Color</label>
          <ColorPropertyPicker v-model="textWidget.textColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>

<style lang="scss" scoped>
#textWidgetContent {
  :deep(.ProseMirror-focused) {
    @apply !border-nc-border-brand;
    box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24) !important;
  }
  :deep(.ProseMirror) {
    @apply !rounded-lg;
  }
}
</style>
