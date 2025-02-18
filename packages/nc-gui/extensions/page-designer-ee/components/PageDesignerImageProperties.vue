<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import type { PageDesignerImageWidget } from '../lib/widgets'
import { objectFitLabels } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import TabbedSelect from './TabbedSelect.vue'
import BorderSettings from './BorderSettings.vue'

const payload = inject(PageDesignerPayloadInj)!

const imageWidget = ref<PageDesignerImageWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    imageWidget.value = payload?.value?.widgets[id] as PageDesignerImageWidget
  },
  { immediate: true },
)
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

    <BorderSettings
      v-model:border-top="imageWidget.borderTop"
      v-model:border-bottom="imageWidget.borderBottom"
      v-model:border-left="imageWidget.borderLeft"
      v-model:border-right="imageWidget.borderRight"
      v-model:border-radius="imageWidget.borderRadius"
      v-model:border-color="imageWidget.borderColor"
    />

    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Background Color</label>
          <ColorPropertyPicker v-model="imageWidget.backgroundColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>
