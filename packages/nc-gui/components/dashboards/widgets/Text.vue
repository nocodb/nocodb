<script lang="ts" setup>
import type { StaticTextWidget } from 'nocodb-sdk'
import { FontType } from 'nocodb-sdk'
const props = defineProps<{
  widgetConfig: StaticTextWidget
}>()

const { widgetConfig: textVisualizationElementMetaData } = toRefs(props)
const text = computed(() => textVisualizationElementMetaData.value.data_config.text)
const fontType = computed(() => textVisualizationElementMetaData.value.appearance_config.fontType)

const fontTypeToElement = (fontType: FontType | undefined) => {
  switch (fontType) {
    case FontType.HEADING1:
      return 'h1'
    case FontType.HEADING2:
      return 'h2'
    case FontType.HEADING3:
      return 'h3'
    case FontType.SUB_HEADING_1:
      return 'h4'
    case FontType.SUB_HEADING_2:
      return 'h5'
    case FontType.BODY:
      return 'p'
    case FontType.CAPTION:
      return 'figcaption'
    default:
      return 'span'
  }
}

const elementTag = computed(() => fontTypeToElement(fontType.value))
</script>

<template>
  <a-card>
    <component :is="elementTag" class="nc-dashboard-text-element">{{ text }}</component>
  </a-card>
</template>

<style>
h1.nc-dashboard-text-element {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.2;
}
h2.nc-dashboard-text-element {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
}
h3.nc-dashboard-text-element {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
}
h4.nc-dashboard-text-element {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}
h5.nc-dashboard-text-element {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}
p.nc-dashboard-text-element {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}
figcaption.nc-dashboard-text-element {
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
}
span.nc-dashboard-text-element {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}
</style>
