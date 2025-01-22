<script setup lang="ts">
import { PageDesignerPayloadInj } from '../src/context'
import PageDesignerTextProperties from './widgets/PageDesignerTextProperties.vue'
import PageDesignerImageProperties from './widgets/PageDesignerImageProperties.vue'

const payload = inject(PageDesignerPayloadInj)!

const currentWidgetType = computed(() => payload.value.widgets?.[payload.value.currentWidgetIndex ?? -1]?.type)
</script>

<template>
  <div class="properties-panel w-[420px]">
    <PageDesignerTextProperties v-if="currentWidgetType === 'text'" />
    <PageDesignerImageProperties v-else-if="currentWidgetType === 'image'" />
  </div>
</template>

<style lang="scss" scoped>
.properties-panel {
  border-left: 1px solid;
  @apply border-nc-border-gray-medium;
}
</style>
