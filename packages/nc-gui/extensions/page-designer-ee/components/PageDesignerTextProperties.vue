<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from '../lib/context'
import { type PageDesignerTextWidget, fontWeightToLabel, fontWeights, fonts } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'
import BorderSettings from './BorderSettings.vue'

const emit = defineEmits(['deleteCurrentWidget'])

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

const textPresets = {
  h1: {
    fontSize: '26',
    lineHeight: '1.2',
    fontWeight: '700',
  },
  h2: {
    fontSize: '20',
    lineHeight: '1.2',
    fontWeight: '700',
  },
  h3: {
    fontSize: '16',
    lineHeight: '1.5',
    fontWeight: '700',
  },
}

function isTextPresetActive(heading: 'h1' | 'h2' | 'h3') {
  if (!textWidget.value) return
  return (
    textWidget.value?.fontSize === textPresets[heading].fontSize &&
    textWidget.value?.lineHeight === textPresets[heading].lineHeight &&
    textWidget.value.fontWeight === textPresets[heading].fontWeight
  )
}

function setTextPreset(heading: 'h1' | 'h2' | 'h3') {
  if (!textWidget.value) return

  textWidget.value.fontSize = textPresets[heading].fontSize
  textWidget.value.lineHeight = textPresets[heading].lineHeight
  textWidget.value.fontWeight = textPresets[heading].fontWeight
}

const textValue = computed(() => textWidget.value?.value ?? '')
const previousTextValue = usePrevious(textValue)

function onTextFieldDelete() {
  const prevLen = previousTextValue.value?.length ?? 0
  if (prevLen <= 2 && !textValue.value) emit('deleteCurrentWidget')
}
</script>

<template>
  <div v-if="textWidget" class="flex flex-col properties overflow-y-auto max-h-full">
    <header class="widget-header flex items-center justify-between">
      <h1 class="m-0">Text</h1>
      <div class="flex gap-3">
        <NcButton
          type="secondary"
          size="small"
          :class="{ 'text-preset-active': isTextPresetActive('h1') }"
          @click="setTextPreset('h1')"
        >
          <GeneralIcon icon="ncHeading1" />
        </NcButton>
        <NcButton
          type="secondary"
          size="small"
          :class="{ 'text-preset-active': isTextPresetActive('h2') }"
          @click="setTextPreset('h2')"
        >
          <GeneralIcon icon="ncHeading2" />
        </NcButton>
        <NcButton
          type="secondary"
          size="small"
          :class="{ 'text-preset-active': isTextPresetActive('h3') }"
          @click="setTextPreset('h3')"
        >
          <GeneralIcon icon="ncHeading3" />
        </NcButton>
      </div>
    </header>
    <GroupedSettings title="Content">
      <AiPromptWithFields
        id="textWidgetContent"
        :key="payload.currentWidgetId"
        v-model="textWidget.value"
        :options="columns"
        placeholder="Lorem ipsum..."
        @keydown.delete="onTextFieldDelete"
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

    <BorderSettings
      v-model:border-top="textWidget.borderTop"
      v-model:border-bottom="textWidget.borderBottom"
      v-model:border-left="textWidget.borderLeft"
      v-model:border-right="textWidget.borderRight"
      v-model:border-radius="textWidget.borderRadius"
      v-model:border-color="textWidget.borderColor"
    />

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
.text-preset-active {
  @apply !border-nc-fill-primary;
  box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24) !important;
}
</style>
