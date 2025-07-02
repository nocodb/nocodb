<script setup lang="ts">
import type { MetricWidgetType } from 'nocodb-sdk'
import { colorColoured, colorFilled } from './Config/color'

interface Props {
  widget: MetricWidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const widgetRef = toRef(props, 'widget')

const colors = computed(() => {
  const type = (widgetRef.value?.config.appearance as any)?.type ?? 'default'
  if (type === 'default')
    return {
      fill: 'white',
      color: 'var(--nc-content-gray-subtle2)',
    }
  if (type === 'filled') {
    return colorFilled.find((c) => c.id === (widgetRef.value?.config.appearance as any)?.theme) ?? colorFilled[0]
  } else {
    return colorColoured.find((c) => c.id === (widgetRef.value?.config.appearance as any)?.theme) ?? colorColoured[0]
  }
})
</script>

<template>
  <div
    class="nc-metric-widget h-full w-full p-4 flex group flex-col gap-1 relative"
    :style="{
      backgroundColor: colors.fill,
    }"
  >
    <div class="flex items-center mb-2">
      <div class="text-nc-content-gray-emphasis flex-1 text-subHeading2">
        {{ widget.title }}
      </div>
      <NcButton v-if="isEditing" type="text" size="small">
        <GeneralIcon icon="threeDotVertical" />
      </NcButton>
    </div>
    <div v-if="widget.description" class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
      {{ widget.description }}
    </div>
    <div
      :style="{
        color: colors.color,
      }"
      class="text-nc-content-gray-subtle2 text-heading2"
    >
      100
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-metric-widget {
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}
</style>
