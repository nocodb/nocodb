<script setup lang="ts">
import { type ColumnType, type DateAxisSummaryConfig, UTILIZATION_AGGREGATION, ViewTypes, parseProp } from 'nocodb-sdk'
import { useViewColumns } from '~/composables/useViewColumns'

/**
 * What a view's shared link leaves out: it reads only the view's shown fields
 * (plus the primary key and display value), so grouping by a hidden field
 * shows the rows ungrouped and a summary over hidden fields shows nothing.
 * Offers to show those fields.
 */

const meta = inject(MetaInj, ref())

// The active view carries its type's settings (`view.view`), e.g. a timeline's summary.
const view = inject(ActiveViewInj, ref())

const { t } = useI18n()

const { $e } = useNuxtApp()

const viewColumns = useViewColumns()

const isShowing = ref(false)

/** The view-columns state can resolve to another view's instance — use it only when it's this one. */
const isThisView = computed(() => {
  const rows = Object.values(viewColumns?.gridViewCols.value ?? {}) as { fk_view_id?: string }[]
  return !!rows.length && rows[0]?.fk_view_id === view.value?.id
})

const shownIds = computed(() => new Set((viewColumns?.fields.value ?? []).filter((f) => f.show).map((f) => f.fk_column_id)))

function hiddenColumns(ids: string[]) {
  return ids
    .map((id) => meta.value?.columns?.find((c) => c.id === id))
    .filter((c): c is ColumnType => !!c && !c.pk && !c.pv && !shownIds.value.has(c.id))
}

const hiddenGroupBy = computed(() => {
  if (!isThisView.value) return []
  const ids = Object.values(viewColumns?.gridViewCols.value ?? {})
    .filter((c) => c.group_by)
    .map((c) => c.fk_column_id as string)
  return hiddenColumns(ids)
})

/** A timeline's Utilization reads hours, resource and working hours, and may count time off. */
const summaryNeeds = computed(() => {
  if (view.value?.type !== ViewTypes.TIMELINE) return { columnIds: [] as string[], countsTimeOff: false }
  const summary = parseProp((view.value.view as { meta?: unknown } | undefined)?.meta)?.summary as
    | DateAxisSummaryConfig
    | undefined
  const util = summary?.aggregation === UTILIZATION_AGGREGATION ? summary.utilization : undefined
  if (!summary || !util) return { columnIds: [] as string[], countsTimeOff: false }
  return {
    columnIds: [summary.fk_column_id, util.fk_resource_column_id, util.fk_available_column_id].filter((id): id is string => !!id),
    countsTimeOff: !!util.time_off,
  }
})

const hiddenForSummary = computed(() => (isThisView.value ? hiddenColumns(summaryNeeds.value.columnIds) : []))

const lines = computed(() => {
  const out: string[] = []
  const names = (cols: ColumnType[]) => cols.map((c) => c.title).join(', ')
  if (hiddenGroupBy.value.length) {
    out.push(t('msg.info.sharedLinkGroupedByHidden', { fields: names(hiddenGroupBy.value) }))
  }
  if (hiddenForSummary.value.length) {
    out.push(t('msg.info.sharedLinkUtilizationHidden', { fields: names(hiddenForSummary.value) }))
  }
  if (summaryNeeds.value.countsTimeOff) out.push(t('msg.info.sharedLinkNoTimeOff'))
  return out
})

const toShow = computed(() => {
  const ids = new Set([...hiddenGroupBy.value, ...hiddenForSummary.value].map((c) => c.id))
  return (viewColumns?.fields.value ?? []).filter((f) => f.fk_column_id && ids.has(f.fk_column_id))
})

async function showFields() {
  if (!viewColumns || isShowing.value) return
  $e('a:share:view:show-fields', { count: toShow.value.length })
  isShowing.value = true
  try {
    for (const field of toShow.value) {
      field.show = true
      try {
        await viewColumns.toggleFieldVisibility(true, field)
      } catch (e) {
        field.show = false
        message.error(await extractSdkResponseErrorMsg(e as Error))
        break
      }
    }
  } finally {
    isShowing.value = false
  }
}
</script>

<template>
  <NcAlert
    v-if="lines.length"
    type="warning"
    :show-icon="false"
    bordered
    align="top"
    message-class="!text-bodyDefaultSm !font-semibold"
    description-class="!text-bodySm !text-nc-content-gray-subtle !line-clamp-none"
    class="nc-share-link-notice"
    data-testid="nc-share-link-notice"
  >
    <template #message>
      <div class="flex items-center gap-2">
        <GeneralIcon icon="alertTriangleSolid" class="h-4 w-4 flex-none text-orange-700" />
        {{ $t('msg.info.sharedLinkMissingTitle') }}
      </div>
    </template>
    <template #description>
      <div class="flex flex-col gap-1 min-w-0">
        <NcTooltip v-for="line in lines" :key="line" show-on-truncate-only class="truncate">
          <template #title>{{ line }}</template>
          {{ line }}
        </NcTooltip>
      </div>
      <NcButton
        v-if="toShow.length && viewColumns?.canUpdateViewMeta?.value !== false"
        size="xsmall"
        type="secondary"
        class="mt-2 !px-2"
        :loading="isShowing"
        data-testid="nc-share-link-show-fields"
        @click="showFields"
      >
        <span class="text-xs" :style="{ fontWeight: 500 }">{{ $t('labels.showTheseFields') }}</span>
      </NcButton>
    </template>
  </NcAlert>
</template>

<style lang="scss" scoped>
.nc-share-link-notice :deep(.nc-alert-content) {
  @apply min-w-0;
}
</style>
