<script lang="ts" setup>
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
import { PageDesignerPayloadInj } from '../../lib/context'

interface Props {
  title?: string
  description?: string
  isFieldHeader?: boolean
  field?: ColumnType
}

withDefaults(defineProps<Props>(), {
  isFieldHeader: true,
})

const payload = inject(PageDesignerPayloadInj)!

function unselectCurrentWidget() {
  payload.value.currentWidgetId = -1
}

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })
</script>

<template>
  <header class="widget-header">
    <div class="flex items-center gap-3">
      <h1 class="nc-widget-header-title text-bodyBold !font-semibold m-0 flex items-center gap-2 flex-1">
        <template v-if="isFieldHeader">
          <div
            class="cursor-pointer select-none hover:underline text-nc-content-gray-subtle2"
            @click.stop="unselectCurrentWidget"
          >
            Page
          </div>
          <div class="text-xl font-normal text-nc-content-gray-muted !leading-6">/</div>
        </template>

        <slot v-if="$slots.field || field" name="field">
          <template v-if="field">
            <component :is="getIcon(field)" class="!m-0 flex-none" />
            <NcTooltip class="truncate max-w-[220px] text-bodyBold !font-semibold" show-on-truncate-only>
              <template #title>
                {{ field.title }}
              </template>

              {{ field.title }}
            </NcTooltip>
          </template>
        </slot>

        <slot name="title">
          {{ title }}
        </slot>
      </h1>
      <div v-if="$slots.actions" class="flex items-center gap-3 -my-1">
        <slot name="actions"></slot>
      </div>
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
  @apply p-4 border-b border-nc-border-gray-medium flex flex-col gap-1 w-full;
}
</style>
