<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import { PageDesignerWidgetType } from '../lib/widgets'
import PageDesignerTextProperties from './PageDesignerTextProperties.vue'
import PageDesignerImageProperties from './PageDesignerImageProperties.vue'
import PageDesignerDividerProperties from './PageDesignerDividerProperties.vue'
import PageDesignerProperties from './PageDesignerProperties.vue'

const payload = inject(PageDesignerPayloadInj)!

const currentWidgetType = computed(() => payload.value.widgets?.[payload.value.currentWidgetId]?.type)

const widgetTypeToPropertiesComponent = {
  [PageDesignerWidgetType.TEXT]: PageDesignerTextProperties,
  [PageDesignerWidgetType.IMAGE]: PageDesignerImageProperties,
  [PageDesignerWidgetType.DIVIDER]: PageDesignerDividerProperties,
}

const propertiesComponent = computed(() => {
  return widgetTypeToPropertiesComponent[currentWidgetType.value!] ?? PageDesignerProperties
})
</script>

<template>
  <div class="properties-panel w-[420px]">
    <component :is="propertiesComponent" />
  </div>
</template>

<style lang="scss" scoped>
.properties-panel {
  border-left: 1px solid;
  @apply border-nc-border-gray-medium;
}
</style>
