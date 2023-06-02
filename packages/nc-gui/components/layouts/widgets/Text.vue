<script lang="ts" setup>
import type { StaticTextWidget } from 'nocodb-sdk'
import { FontType } from 'nocodb-sdk'
const props = defineProps<{
  widgetConfig: StaticTextWidget
}>()

const { widgetConfig } = toRefs(props)
const text = computed(() => widgetConfig.value.data_config.text)
const url = computed(() => widgetConfig.value.data_config.staticTextFunction?.url)
const fontType = computed(() => widgetConfig.value.appearance_config.fontType)

const isLink = computed(() => {
  return widgetConfig.value.data_config.hasFunction && widgetConfig.value.data_config.staticTextFunction?.type === 'url'
})

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
    <component :is="elementTag" class="nc-layout-text-element">
      <a v-if="isLink" :href="url" target="_blank">{{ text }}</a>
      <span v-else>
        {{ text }}
      </span>
    </component>
  </a-card>
</template>

<style>
h1.nc-layout-text-element {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.2;
}
h2.nc-layout-text-element {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
}
h3.nc-layout-text-element {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
}
h4.nc-layout-text-element {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}
h5.nc-layout-text-element {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}
p.nc-layout-text-element {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}
figcaption.nc-layout-text-element {
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
}
span.nc-layout-text-element {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}
</style>
