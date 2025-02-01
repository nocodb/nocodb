<script setup lang="ts">
import type { Component } from 'vue'
import { PageDesignerPayloadInj } from '../lib/context'
import { PageDesignerWidgetType } from '../lib/widgets'
import PageDesignerTextProperties from './PageDesignerTextProperties.vue'
import PageDesignerImageProperties from './PageDesignerImageProperties.vue'
import PageDesignerFieldProperties from './PageDesignerFieldProperties.vue'
import PageDesignerDividerProperties from './PageDesignerDividerProperties.vue'
import PageDesignerProperties from './PageDesignerProperties.vue'

defineEmits(['deleteCurrentWidget'])

const payload = inject(PageDesignerPayloadInj)!

const currentWidgetType = computed(() => payload.value.widgets?.[payload.value.currentWidgetId]?.type)

const widgetTypeToPropertiesComponent: Record<PageDesignerWidgetType, Component> = {
  [PageDesignerWidgetType.TEXT]: PageDesignerTextProperties,
  [PageDesignerWidgetType.IMAGE]: PageDesignerImageProperties,
  [PageDesignerWidgetType.DIVIDER]: PageDesignerDividerProperties,
  [PageDesignerWidgetType.FIELD]: PageDesignerFieldProperties,
}

const propertiesComponent = computed(() => {
  return widgetTypeToPropertiesComponent[currentWidgetType.value!] ?? PageDesignerProperties
})
</script>

<template>
  <div class="properties-panel w-[420px]">
    <component :is="propertiesComponent" @delete-current-widget="$emit('deleteCurrentWidget')" />
  </div>
</template>

<style lang="scss" scoped>
.properties-panel {
  @apply border-l-1 border-nc-border-gray-medium;
}
</style>
