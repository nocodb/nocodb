<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, parseCurrencyValue, parseDecimalValue, parseIntValue, parsePercentValue } from 'nocodb-sdk'

interface Props {
  /** Off: the slot renders in place, exactly as without this wrapper. On: a row that opens the slot in a flyout. */
  enabled?: boolean
  value: ColumnType
}

const props = withDefaults(defineProps<Props>(), {
  enabled: false,
})

const { t } = useI18n()

const isOpen = ref(false)

const isSelect = computed(() => getFieldAgentOptionsKind(props.value.uidt) === 'options')

const title = computed(() => (isSelect.value ? t('general.options') : t('general.format')))

// What the grid would show for a sample value — the same parsers the cells use
const summary = computed(() => {
  const col = props.value

  if (isSelect.value) {
    const count = (col.colOptions as { options?: unknown[] } | undefined)?.options?.length ?? 0
    return t('labels.fieldAgent.optionsCount', { count }, count)
  }

  switch (col.uidt) {
    case UITypes.Number:
      return parseIntValue(3456, col)
    case UITypes.Decimal:
      return parseDecimalValue(3456, col)
    case UITypes.Currency:
      return parseCurrencyValue(3456, col)
    case UITypes.Percent:
      return parsePercentValue('50', col)
    default:
      return ''
  }
})
</script>

<template>
  <slot v-if="!enabled" />

  <!--
    force-render: the option editors register validations and write default meta when
    they mount, so they must exist even while the flyout is closed.
  -->
  <a-popover
    v-else
    v-model:visible="isOpen"
    trigger="click"
    placement="leftTop"
    force-render
    :align="{ points: ['tr', 'tl'], offset: [-16, -8] }"
    overlay-class-name="nc-options-flyout"
  >
    <template #content>
      <div class="nc-options-flyout-content" data-testid="nc-options-flyout-content">
        <div class="nc-options-flyout-title">{{ title }}</div>
        <slot />
      </div>
    </template>

    <div class="nc-options-flyout-row" :class="{ 'nc-options-flyout-row-open': isOpen }" data-testid="nc-options-flyout-row">
      <span>{{ title }}</span>
      <span class="flex items-center gap-1.5 min-w-0">
        <span class="truncate">{{ summary }}</span>
        <GeneralIcon icon="chevronRight" class="w-4 h-4 flex-none text-nc-content-gray-muted" />
      </span>
    </div>
  </a-popover>
</template>

<style lang="scss" scoped>
.nc-options-flyout-row {
  @apply flex items-center justify-between gap-3 h-8 px-2 -mx-2 rounded-md cursor-pointer text-sm text-nc-content-gray hover:bg-nc-bg-gray-light;
}

.nc-options-flyout-row-open {
  @apply bg-nc-bg-gray-light;
}
</style>

<style lang="scss">
// The popover is teleported to <body>, so its styles can't be scoped. NocoDB styles
// every popover as a dark tooltip (style.scss: `.ant-popover-inner-content` is
// black, white, text-xs with !important padding) — reset that to a panel surface.
.nc-options-flyout {
  .ant-popover-arrow {
    @apply hidden;
  }

  .ant-popover-inner {
    @apply rounded-xl shadow-lg border-1 border-nc-border-gray-medium overflow-hidden bg-nc-bg-elevated;
  }

  .ant-popover-inner-content {
    @apply !p-0 !bg-nc-bg-elevated !text-nc-content-gray !text-sm;
  }
}

.nc-options-flyout-content {
  @apply flex flex-col w-[380px] px-4 pt-3 pb-4 overflow-y-auto nc-scrollbar-thin;
  max-height: min(560px, 70vh);

  // Height-capped scrolling column: children must scroll, not shrink to fit
  > * {
    @apply flex-none;
  }

  // The option editors are antd horizontal form items: short labels sit inline, long ones
  // wrap their control underneath, and each carries a ~24px bottom margin. Give every
  // item the same shape here — label on top, full-width control, one 12px rhythm.
  .ant-form-item {
    @apply !mb-3;

    &:last-child {
      @apply !mb-0;
    }
  }

  .ant-form-item-row {
    @apply !flex-col !items-stretch;
  }

  .ant-form-item-label {
    @apply !p-0 !pb-1.5 !text-left !leading-5;
    flex: none !important;
    max-width: none !important;

    > label {
      @apply !h-auto !text-sm !text-nc-content-gray;

      // antd's trailing ':'
      &::after {
        @apply !hidden;
      }
    }
  }

  .ant-form-item-control {
    @apply !w-full;
    flex: none !important;
    max-width: none !important;
  }

  .ant-select {
    @apply !w-full;
  }
}

.nc-options-flyout-title {
  @apply mb-3 pb-3 text-sm font-semibold text-nc-content-gray border-b-1 border-nc-border-gray-light;
}
</style>
