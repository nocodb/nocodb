<script setup lang="ts">
import {
  KANBAN_SUMMARY_COUNT,
  getKanbanSummaryColor,
  getLegacyDateRollupAggregation,
  isFieldFormattedAggregation,
} from 'nocodb-sdk'
import type { ColumnType, KanbanStackSummary } from 'nocodb-sdk'

/** One stack's summary — label, formatted value and the colour its rules pick. */

interface Props {
  summary: KanbanStackSummary
  column?: ColumnType
  value?: unknown
}

const props = defineProps<Props>()

const { t } = useI18n()

const { metas } = useMetas()

const { isMysql, isPg } = useBase()

const { meta } = useSmartsheetStoreOrThrow()

const label = computed(() => {
  const mode = props.summary.label?.mode ?? 'function'
  if (mode === 'none') return ''
  if (mode === 'custom') return props.summary.label?.text ?? ''
  // A date rollup runs min/max/range as earliest/latest/date range.
  const fn = (props.column && getLegacyDateRollupAggregation(props.column, props.summary.fn)) || props.summary.fn
  return t(`aggregation_type.${fn}`)
})

const formatted = computed(() => {
  // null = no records for Avg/Min/Max/etc.; a dash, not "0".
  if (props.value === null || props.value === undefined || props.value === '') return '–'
  if (props.summary.fn === KANBAN_SUMMARY_COUNT || !props.column) return Number(props.value).toLocaleString()
  const value = getFormattedAggrationValue(props.summary.fn, props.value, props.column, [], {
    meta: meta.value,
    metas: metas.value,
    isMysql,
    isPg,
    col: props.column,
  })
  // Field-formatted results keep the field's precision and separators; other bare numbers get grouped.
  const isFieldFormatted = isFieldFormattedAggregation(props.column, props.summary.fn)
  if (!isFieldFormatted && (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)))) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 20 })
  }
  return value ?? '–'
})

const color = computed(() => getKanbanSummaryColor(props.value, props.summary.colors))

const colorStyle = computed(() =>
  color.value ? { backgroundColor: color.value, color: getOppositeColorOfBackground(color.value, '#1f293a') } : undefined,
)
</script>

<template>
  <div
    class="nc-kanban-stack-summary flex items-center gap-1.5 min-w-0 text-bodySm"
    :class="color ? 'px-1.5 py-0.5 rounded-md' : 'text-nc-content-gray-muted'"
    :style="colorStyle"
    data-testid="nc-kanban-stack-summary"
  >
    <span v-if="label" class="truncate" data-testid="nc-kanban-stack-summary-label">{{ label }}</span>
    <span class="flex-none text-nc-content-gray" :class="{ '!text-inherit': color }" data-testid="nc-kanban-stack-summary-value">
      {{ formatted }}
    </span>
  </div>
</template>
