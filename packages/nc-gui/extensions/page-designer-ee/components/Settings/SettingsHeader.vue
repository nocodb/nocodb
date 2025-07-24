<script lang="ts" setup>
import { PageDesignerPayloadInj } from '../../lib/context'

interface Props {
  title?: string
  description?: string
  isFieldHeader?: boolean
}

withDefaults(defineProps<Props>(), {
  isFieldHeader: true,
})

const payload = inject(PageDesignerPayloadInj)!

function unselectCurrentWidget() {
  payload.value.currentWidgetId = -1
}
</script>

<template>
  <header class="widget-header">
    <div class="flex items-center gap-3">
      <h1 class="nc-widget-header-title text-subHeading1 !text-[18px] m-0 flex items-center gap-3 flex-1">
        <template v-if="isFieldHeader">
          <div
            class="cursor-pointer select-none hover:underline text-nc-content-gray-subtle2"
            @click.stop="unselectCurrentWidget"
          >
            Page
          </div>
          <div class="font-normal text-nc-content-gray-muted -mx-1">/</div>
        </template>

        <slot name="title">{{ title }}</slot>
      </h1>
      <slot name="actions"></slot>
    </div>
    <div
      v-if="$slots.description || description"
      class="nc-widget-header-description text-bodyDefaultSm text-nc-content-gray-subtle2"
    >
      <slot name="description">{{ description }}</slot>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.widget-header {
  @apply p-4 border-b border-nc-border-gray-medium flex flex-col gap-2 w-full;
  h1 {
    @apply text-[18px] font-700 leading-8 tracking-[-0.4px];
  }
}
</style>
