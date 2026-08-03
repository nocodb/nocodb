<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

interface Props {
  record: Row
  fields?: (ColumnType | undefined)[]
}

const props = withDefaults(defineProps<Props>(), {
  fields: () => [],
})

const visibleFields = computed(() => (props.fields ?? []).filter((f): f is ColumnType => !!f && !isRowEmpty(props.record, f)))

// Only label fields when there's ambiguity. With a single value there's nothing
// to disambiguate, so the label would just be noise.
const showLabels = computed(() => visibleFields.value.length > 1)
</script>

<template>
  <div class="nc-record-fields-tooltip-content flex flex-col gap-2 text-left">
    <div v-for="field in visibleFields" :key="field.id" class="nc-record-tooltip-field">
      <div v-if="showLabels" class="nc-record-tooltip-label">{{ field.title }}</div>
      <LazySmartsheetPlainCell :model-value="record.row[field.title!]" :column="field" />
    </div>
  </div>
</template>

<!-- Global (non-scoped): the tooltip overlay is teleported to <body>, so scoped
     styles can't reach it. Any NcTooltip using this content sets
     overlay-class-name="nc-record-fields-tooltip". -->
<style lang="scss">
.nc-record-fields-tooltip {
  // Roughly a month-cell/record-chip width — the labeled fields read as short
  // rows instead of a tall wrapped column (antd's default caps at 250px).
  max-width: 280px;

  .ant-tooltip-inner {
    min-width: 240px;
    max-height: 220px;
    overflow-y: auto;
  }
}

.nc-record-fields-tooltip-content {
  .plain-cell {
    display: block;
    width: 100%;
    line-height: 18px;

    // Drop the inline "•" separator used in the single-line card layout.
    &::before {
      content: '' !important;
      padding: 0 !important;
    }
  }

  .nc-record-tooltip-field {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .nc-record-tooltip-label {
    font-size: 11px;
    line-height: 14px;
    font-weight: 500;
    opacity: 0.6;
  }
}
</style>
