<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import BorderImage from '../assets/border.svg'
import type { PageDesignerImageWidget } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import TabbedSelect from './TabbedSelect.vue'

const payload = inject(PageDesignerPayloadInj)!

const imageWidget = ref<PageDesignerImageWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    imageWidget.value = payload?.value?.widgets[id] as PageDesignerImageWidget
  },
  { immediate: true },
)

const objectFitLabels: Record<string, string> = {
  contain: 'Fit',
  cover: 'Fill',
  fill: 'Stretch',
}
</script>

<template>
  <div v-if="imageWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header class="widget-header">
      <h1 class="m-0">Image</h1>
    </header>
    <GroupedSettings title="Source">
      <a-input v-model:value="imageWidget.imageSrc" placeholder="Image URL"></a-input>
    </GroupedSettings>
    <GroupedSettings title="Fitting">
      <TabbedSelect v-model="imageWidget.objectFit" :values="['contain', 'cover', 'fill']">
        <template #default="{ value }">
          {{ objectFitLabels[`${value}`] }}
        </template>
      </TabbedSelect>
    </GroupedSettings>
    <GroupedSettings title="Border">
      <div class="flex gap-2 items-center">
        <div class="flex flex-col gap-2 border-inputs justify-center items-center flex-1">
          <div>
            <a-input v-model:value="imageWidget.borderTop" type="number" min="0"></a-input>
          </div>
          <div class="flex gap-2 items-center">
            <a-input v-model:value="imageWidget.borderLeft" type="number" min="0"></a-input>
            <img :src="BorderImage" />
            <a-input v-model:value="imageWidget.borderRight" type="number" min="0"></a-input>
          </div>
          <div>
            <a-input v-model:value="imageWidget.borderBottom" type="number" min="0"></a-input>
          </div>
        </div>
        <div class="flex-1 flex flex-col gap-2">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Color</span>
            <ColorPropertyPicker v-model="imageWidget.borderColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Radius</span>
            <a-input v-model:value="imageWidget.borderRadius" type="number" min="0" />
          </div>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Background Color</span>
          <ColorPropertyPicker v-model="imageWidget.backgroundColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>
