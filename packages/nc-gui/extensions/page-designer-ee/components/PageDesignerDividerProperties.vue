<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import type { PageDesignerDividerWidget } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'

const payload = inject(PageDesignerPayloadInj)!

const dividerWidget = ref<PageDesignerDividerWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    dividerWidget.value = payload?.value?.widgets[id] as PageDesignerDividerWidget
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="dividerWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header class="widget-header">
      <h1 class="m-0">Divider</h1>
    </header>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Background Color</span>
          <ColorPropertyPicker v-model="dividerWidget.backgroundColor" />
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Orientation">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Angle</span>
          <NonNullableNumberInput v-model="dividerWidget.angle" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>
