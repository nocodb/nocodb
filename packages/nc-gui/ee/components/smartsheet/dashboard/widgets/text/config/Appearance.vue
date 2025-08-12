<script setup lang="ts">
import { fontWeightToLabel, fontWeights, fonts } from './utils'
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:appearance': [source: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const fontSettings = reactive({
  family: selectedWidget.value?.config?.appearance?.font?.family,
  weight: selectedWidget.value?.config?.appearance?.font?.weight,
  size: selectedWidget.value?.config?.appearance?.font?.size,
  lineHeight: selectedWidget.value?.config?.appearance?.font?.lineHeight,
})

const color = ref('#000000')

const onUpdate = () => {
  emit('update:appearance', {
    font: fontSettings,
    color: color.value,
  })
}
</script>

<template>
  <GroupedSettings title="Font Settings">
    <div class="flex gap-3">
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Font</label>
        <NcSelect v-model:value="fontSettings.family" show-search @change="onUpdate">
          <a-select-option v-for="font of fonts" :key="font" :value="font">
            <span :style="{ fontFamily: font }">{{ font }}</span>
          </a-select-option>
        </NcSelect>
      </div>
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Weight</label>
        <NcSelect v-model:value="fontSettings.weight" @change="onUpdate">
          <a-select-option v-for="weight of fontWeights" :key="weight" :value="weight">
            <span :style="{ fontWeight: weight }"> {{ fontWeightToLabel[weight] }}</span>
          </a-select-option>
        </NcSelect>
      </div>
    </div>

    <div class="flex gap-3">
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Size</label>
        <NcNonNullableNumberInput
          v-model="fontSettings.size"
          :reset-to="16"
          :min="1"
          class="flex-1"
          placeholder="16"
          @update:value="onUpdate"
        />
      </div>
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Line Height</label>
        <NcNonNullableNumberInput
          v-model="fontSettings.lineHeight"
          :reset-to="1.4"
          :min="1"
          class="flex-1"
          placeholder="1.4"
          @update:value="onUpdate"
        />
      </div>
    </div>
  </GroupedSettings>
  <GroupedSettings title="Colour">
    <div class="flex gap-3">
      <div class="flex flex-col gap-2 flex-1">
        <label>Text Color</label>
        <SmartsheetDashboardWidgetsCommonColorPicker v-model="color" @update:model-value="onUpdate" />
      </div>
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss"></style>
