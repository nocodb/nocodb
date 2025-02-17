<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import { LinkedFieldDisplayAs, type PageDesignerLinkedFieldWidget, LinkedFieldListType } from '../lib/widgets'
import BorderImage from '../assets/border.svg'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import NonNullableNumberInput from './NonNullableNumberInput.vue'
import TabbedSelect from './TabbedSelect.vue'

const payload = inject(PageDesignerPayloadInj)!

const fieldWidget = ref<PageDesignerLinkedFieldWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    fieldWidget.value = payload?.value?.widgets[id] as PageDesignerLinkedFieldWidget
  },
  { immediate: true },
)

const displayAsOptionsMap = {
  [LinkedFieldDisplayAs.INLINE]: iconMap.ncAlignLeft,
  [LinkedFieldDisplayAs.LIST]: iconMap.ncList,
  [LinkedFieldDisplayAs.TABLE]: iconMap.table,
}
</script>

<template>
  <div v-if="fieldWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header class="widget-header">
      <h1 class="m-0">{{ fieldWidget.field.title }}</h1>
    </header>
    <GroupedSettings title="Display as">
      <TabbedSelect
        v-model="fieldWidget.displayAs"
        :values="[LinkedFieldDisplayAs.INLINE, LinkedFieldDisplayAs.LIST, LinkedFieldDisplayAs.TABLE]"
      >
        <template #default="{ value }">
          <div class="flex gap-2 items-center">
            <component :is="displayAsOptionsMap[value as LinkedFieldDisplayAs]" />
            <span>{{ value }}</span>
          </div>
        </template>
      </TabbedSelect>
      <div v-if="fieldWidget.displayAs === LinkedFieldDisplayAs.LIST">
        <a-radio-group v-model:value="fieldWidget.listType" class="field-list-type w-full">
          <a-radio :value="LinkedFieldListType.Bullet">{{ LinkedFieldListType.Bullet }}</a-radio>
          <a-radio :value="LinkedFieldListType.Number">{{ LinkedFieldListType.Number }}</a-radio>
        </a-radio-group>
      </div>
    </GroupedSettings>
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
            <label>Border Color</label>
            <ColorPropertyPicker v-model="fieldWidget.borderColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Border Radius</label>
            <NonNullableNumberInput v-model="fieldWidget.borderRadius" />
          </div>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Background Color</label>
          <ColorPropertyPicker v-model="fieldWidget.backgroundColor" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Text Color</label>
          <ColorPropertyPicker v-model="fieldWidget.textColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>

<style lang="scss" scoped>
.field-list-type {
  :deep(.ant-radio-input:focus + .ant-radio-inner) {
    box-shadow: none !important;
  }
  :deep(.ant-radio-wrapper) {
    @apply flex px-4 py-2 border-1 border-nc-gray-medium m-0;
    .ant-radio-checked .ant-radio-inner {
      border-color: #1677ff !important;
      background-color: #1677ff !important;
      &::after {
        background: #fff;
        width: 12px;
        height: 12px;
        margin-top: -6px;
        margin-left: -6px;
      }
    }
    &:first-child {
      @apply rounded-tl-lg rounded-tr-lg;
    }
    &:last-child {
      @apply border-t-0 rounded-bl-lg rounded-br-lg;
    }
  }
}
</style>
