<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import type { PageDesignerFieldWidget } from '../lib/widgets'
import BorderImage from '../assets/border.svg'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'

const payload = inject(PageDesignerPayloadInj)!

const fieldWidget = ref<PageDesignerFieldWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    fieldWidget.value = payload?.value?.widgets[id] as PageDesignerFieldWidget
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="fieldWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header class="widget-header">
      <h1 class="m-0">{{ fieldWidget.field.title }}</h1>
    </header>
    <GroupedSettings title="Border">
      <div class="flex gap-2 items-center">
        <div class="flex flex-col gap-2 border-inputs justify-center items-center flex-1">
          <div>
            <NonNullableNumberInput v-model="fieldWidget.borderTop" />
          </div>
          <div class="flex gap-2 items-center">
            <NonNullableNumberInput v-model="fieldWidget.borderLeft" />
            <img :src="BorderImage" />
            <NonNullableNumberInput v-model="fieldWidget.borderRight" />
          </div>
          <div>
            <NonNullableNumberInput v-model="fieldWidget.borderBottom" />
          </div>
        </div>
        <div class="flex-1 flex flex-col gap-2">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Color</span>
            <ColorPropertyPicker v-model="fieldWidget.borderColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Radius</span>
            <NonNullableNumberInput v-model="fieldWidget.borderRadius" />
          </div>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Background Color</span>
          <ColorPropertyPicker v-model="fieldWidget.backgroundColor" />
        </div>
        <!-- <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Text Color</span>
          <ColorPropertyPicker v-model="textWidget.textColor" />
        </div> -->
      </div>
    </GroupedSettings>
  </div>
</template>
