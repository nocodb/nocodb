<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import type { PageDesignerDividerWidget } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'
import SettingsHeader from './Settings/SettingsHeader.vue'

const payload = inject(PageDesignerPayloadInj)!

const dividerWidget = ref<PageDesignerDividerWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    dividerWidget.value = payload?.value?.widgets[id] as PageDesignerDividerWidget
  },
  { immediate: true },
)

watch(
  () => dividerWidget.value?.angle,
  (angle) => {
    if (!angle) return
    dividerWidget.value!.angle = angle % 360
  },
)
</script>

<template>
  <div v-if="dividerWidget" class="flex flex-col properties overflow-y-auto max-h-full">
    <SettingsHeader title="Divider" />
    <GroupedSettings title="Border">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Thickness</label>
          <NonNullableNumberInput v-model="dividerWidget.thickness" :min="1" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Color</label>
          <ColorPropertyPicker v-model="dividerWidget.backgroundColor" />
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Orientation">
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Angle</label>
        <div class="flex gap-3">
          <NonNullableNumberInput v-model="dividerWidget.angle" />
          <NcButton size="small" type="secondary" @click="dividerWidget.angle += 90">
            <GeneralIcon icon="ncAngleRotateCw"></GeneralIcon>
          </NcButton>
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>
