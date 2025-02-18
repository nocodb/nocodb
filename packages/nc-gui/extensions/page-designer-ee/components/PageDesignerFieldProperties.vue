<script setup lang="ts">
import type { UITypes } from 'nocodb-sdk'
import { PageDesignerPayloadInj } from '../lib/context'
import { type PageDesignerFieldWidget, fontWeightToLabel, fontWeights, fonts, plainCellFields } from '../lib/widgets'
import { objectFitLabels } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'
import TabbedSelect from './TabbedSelect.vue'
import BorderSettings from './BorderSettings.vue'

const payload = inject(PageDesignerPayloadInj)!

const fieldWidget = ref<PageDesignerFieldWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    fieldWidget.value = payload?.value?.widgets[id] as PageDesignerFieldWidget
  },
  { immediate: true },
)

const isPlainCell = computed(() => plainCellFields.has(fieldWidget.value?.field.uidt as UITypes))

const isAttachmentField = computed(() => fieldWidget.value?.field && isAttachment(fieldWidget.value.field))
</script>

<template>
  <div v-if="fieldWidget" class="flex flex-col properties overflow-y-auto max-h-full">
    <header class="widget-header">
      <h1 class="m-0">{{ fieldWidget.field.title }}</h1>
    </header>
    <GroupedSettings v-if="isPlainCell" title="Alignment">
      <div class="flex gap-3">
        <a-radio-group v-model:value="fieldWidget.horizontalAlign" class="radio-pills">
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
        <a-radio-group v-model:value="fieldWidget.verticalAlign" class="radio-pills">
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
    <GroupedSettings v-if="isPlainCell" title="Font settings">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Family</label>
          <NcSelect v-model:value="fieldWidget.fontFamily" show-search>
            <a-select-option v-for="font of fonts" :key="font" :value="font">
              <span :style="{ fontFamily: font }">{{ font }}</span>
            </a-select-option>
          </NcSelect>
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Weight</label>
          <NcSelect v-model:value="fieldWidget.fontWeight">
            <a-select-option v-for="weight of fontWeights" :key="weight" :value="weight">
              <span :style="{ fontWeight: weight }"> {{ fontWeightToLabel[weight] }} - {{ weight }}</span>
            </a-select-option>
          </NcSelect>
        </div>
      </div>
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Size</label>
          <NonNullableNumberInput v-model="fieldWidget.fontSize" :reset-to="16" :min="1" class="flex-1" placeholder="16" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Line Height</label>
          <NonNullableNumberInput v-model="fieldWidget.lineHeight" :reset-to="1.4" :min="1" class="flex-1" placeholder="1.4" />
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings v-if="isAttachmentField" title="Fitting">
      <TabbedSelect v-model="fieldWidget.objectFit" :values="['contain', 'cover', 'fill']">
        <template #default="{ value }">
          {{ objectFitLabels[`${value}`] }}
        </template>
      </TabbedSelect>
    </GroupedSettings>

    <BorderSettings
      v-model:border-top="fieldWidget.borderTop"
      v-model:border-bottom="fieldWidget.borderBottom"
      v-model:border-left="fieldWidget.borderLeft"
      v-model:border-right="fieldWidget.borderRight"
      v-model:border-radius="fieldWidget.borderRadius"
      v-model:border-color="fieldWidget.borderColor"
    />

    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Background Color</label>
          <ColorPropertyPicker v-model="fieldWidget.backgroundColor" />
        </div>
        <div v-if="isPlainCell" class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Text Color</label>
          <ColorPropertyPicker v-model="fieldWidget.textColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>
