<script lang="ts" setup>
import dayjs from 'dayjs'
import { onKeyDown } from '@vueuse/core'
import type { ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

interface Props {
  record: RowType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openFull', record: RowType): void
}>()

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const {
  ganttRange,
  formattedData,
  dependencyLinks,
  updateRowProperty,
  linkDependency,
  unlinkDependency,
} = useGanttViewStoreOrThrow()

// Display value column (Title / Name).
const primaryField = computed(() => {
  const cols = meta.value?.columns ?? []
  return cols.find((c) => c.pv) ?? cols.find((c) => !!c.title)
})

// Convenience accessors for the range's date columns. ganttRange[0] always
// exists when this component is mounted — RecordInspector is only rendered
// after a bar click and bars only render with a configured rule.
const fromCol = computed<ColumnType | undefined>(() => ganttRange.value?.[0]?.fk_from_col as ColumnType | undefined)
const toCol = computed<ColumnType | undefined | null>(() => ganttRange.value?.[0]?.fk_to_col as ColumnType | undefined | null)
const depCol = computed<ColumnType | undefined | null>(
  () => ganttRange.value?.[0]?.fk_dependency_col as ColumnType | undefined | null,
)

// Edit-bound copies of the record's fields. Sync from props.record whenever
// the inspected record changes — bar click on a different bar swaps the
// inspector contents.
const nameValue = ref<string>('')
const startValue = ref<string>('')
const endValue = ref<string>('')

const syncFromRecord = () => {
  if (primaryField.value?.title) nameValue.value = props.record.row?.[primaryField.value.title] ?? ''
  if (fromCol.value?.title) startValue.value = formatForInput(props.record.row?.[fromCol.value.title])
  if (toCol.value?.title) endValue.value = formatForInput(props.record.row?.[toCol.value.title])
}

function formatForInput(raw: any): string {
  if (!raw) return ''
  const d = dayjs(raw)
  return d.isValid() ? d.format('YYYY-MM-DD') : ''
}

watch(
  () => props.record,
  () => syncFromRecord(),
  { immediate: true },
)

// Days between start and end (inclusive). Mirrors the Airtable Gantt
// "DAYS" pill — empty when either date is missing.
const durationDays = computed(() => {
  if (!startValue.value || !endValue.value) return ''
  const s = dayjs(startValue.value)
  const e = dayjs(endValue.value)
  if (!s.isValid() || !e.isValid()) return ''
  return `${e.diff(s, 'day') + 1}`
})

// Pretty date-range label for the subheader.
const dateRangeLabel = computed(() => {
  const s = startValue.value ? dayjs(startValue.value) : null
  const e = endValue.value ? dayjs(endValue.value) : null
  if (s && e && s.isValid() && e.isValid()) {
    if (s.year() === e.year()) {
      return `${s.format('MMM D')} – ${e.format('MMM D, YYYY')}`
    }
    return `${s.format('MMM D, YYYY')} – ${e.format('MMM D, YYYY')}`
  }
  if (s && s.isValid()) return s.format('MMM D, YYYY')
  if (e && e.isValid()) return e.format('MMM D, YYYY')
  return ''
})

// --- Save handlers ---

const saveName = async () => {
  if (!primaryField.value?.title) return
  const current = props.record.row?.[primaryField.value.title] ?? ''
  if (nameValue.value === current) return
  props.record.row[primaryField.value.title] = nameValue.value
  try {
    await updateRowProperty(props.record, [primaryField.value.title])
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    props.record.row[primaryField.value.title] = current
    nameValue.value = current
  }
}

const saveDate = async (col: ColumnType | undefined | null, raw: string) => {
  if (!col?.title) return
  const current = props.record.row?.[col.title] ?? ''
  const next = raw || null
  if (next === current) return
  props.record.row[col.title] = next
  try {
    await updateRowProperty(props.record, [col.title])
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    props.record.row[col.title] = current
  }
}

const saveStart = () => saveDate(fromCol.value, startValue.value)
const saveEnd = () => saveDate(toCol.value, endValue.value)

// --- Dependencies ---

const pkCols = computed(() => (meta.value?.columns ?? []) as ColumnType[])
const currentRowId = computed(() => String(extractPkFromRow(props.record.row, pkCols.value) ?? ''))

// Index records by primary key for fast lookup when rendering chips.
const recordsById = computed(() => {
  const map = new Map<string, RowType>()
  for (const row of formattedData.value) {
    const id = extractPkFromRow(row.row, pkCols.value)
    if (id != null) map.set(String(id), row)
  }
  return map
})

// successors = rows the current row links to via depCol (forward edges).
const successorIds = computed<string[]>(() => {
  if (!currentRowId.value) return []
  return [...(dependencyLinks.value.get(currentRowId.value) ?? [])]
})

// predecessors = rows that link TO the current row (reverse edges).
const predecessorIds = computed<string[]>(() => {
  if (!currentRowId.value) return []
  const ids: string[] = []
  for (const [rowId, linked] of dependencyLinks.value.entries()) {
    if (linked.includes(currentRowId.value)) ids.push(rowId)
  }
  return ids
})

const titleFor = (id: string): string => {
  const row = recordsById.value.get(id)
  if (!row || !primaryField.value?.title) return id
  return String(row.row?.[primaryField.value.title] ?? id)
}

const onUnlinkSuccessor = async (linkedId: string) => {
  if (!currentRowId.value) return
  try {
    await unlinkDependency(currentRowId.value, linkedId)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const onUnlinkPredecessor = async (predId: string) => {
  // Reverse direction: remove the predecessor's link to the current row.
  try {
    await unlinkDependency(predId, currentRowId.value)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// --- Link picker — search across formattedData and filter out the current
// row, anything already linked in that direction, and any cycle that would
// form (basic guard: don't allow linking to a predecessor as a successor).
const showSuccessorPicker = ref(false)
const showPredecessorPicker = ref(false)
const successorQuery = ref('')
const predecessorQuery = ref('')

const openSuccessorPicker = () => {
  successorQuery.value = ''
  showSuccessorPicker.value = true
}
const openPredecessorPicker = () => {
  predecessorQuery.value = ''
  showPredecessorPicker.value = true
}

const successorCandidates = computed(() => {
  const q = successorQuery.value.trim().toLowerCase()
  const already = new Set(successorIds.value)
  return formattedData.value
    .filter((row) => {
      const id = String(extractPkFromRow(row.row, pkCols.value) ?? '')
      if (!id || id === currentRowId.value || already.has(id)) return false
      if (!q) return true
      const title = primaryField.value?.title ? String(row.row?.[primaryField.value.title] ?? '').toLowerCase() : ''
      return title.includes(q)
    })
    .slice(0, 20)
})

const predecessorCandidates = computed(() => {
  const q = predecessorQuery.value.trim().toLowerCase()
  const already = new Set(predecessorIds.value)
  return formattedData.value
    .filter((row) => {
      const id = String(extractPkFromRow(row.row, pkCols.value) ?? '')
      if (!id || id === currentRowId.value || already.has(id)) return false
      if (!q) return true
      const title = primaryField.value?.title ? String(row.row?.[primaryField.value.title] ?? '').toLowerCase() : ''
      return title.includes(q)
    })
    .slice(0, 20)
})

const onLinkSuccessor = async (row: RowType) => {
  const id = String(extractPkFromRow(row.row, pkCols.value) ?? '')
  if (!id || !currentRowId.value) return
  try {
    await linkDependency(currentRowId.value, id)
    showSuccessorPicker.value = false
    successorQuery.value = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const onLinkPredecessor = async (row: RowType) => {
  const id = String(extractPkFromRow(row.row, pkCols.value) ?? '')
  if (!id || !currentRowId.value) return
  try {
    // Predecessor direction: make the OTHER row link TO this one.
    await linkDependency(id, currentRowId.value)
    showPredecessorPicker.value = false
    predecessorQuery.value = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Esc closes the panel.
onKeyDown('Escape', () => {
  emit('close')
})

// Date-picker dropdowns — one for start, one for end. Each owns its own
// open state and a paging date so the picker remembers the month the user
// last viewed even if `selectedDate` is null.
const startOpen = ref(false)
const endOpen = ref(false)
const startPageDate = ref(dayjs())
const endPageDate = ref(dayjs())

watch(
  startValue,
  (v) => {
    if (v && dayjs(v).isValid()) startPageDate.value = dayjs(v)
  },
  { immediate: true },
)
watch(
  endValue,
  (v) => {
    if (v && dayjs(v).isValid()) endPageDate.value = dayjs(v)
  },
  { immediate: true },
)

const startDayjs = computed(() => (startValue.value && dayjs(startValue.value).isValid() ? dayjs(startValue.value) : null))
const endDayjs = computed(() => (endValue.value && dayjs(endValue.value).isValid() ? dayjs(endValue.value) : null))

const onPickStart = (d: dayjs.Dayjs | null | undefined) => {
  startValue.value = d ? d.format('YYYY-MM-DD') : ''
  startOpen.value = false
  saveStart()
}

const onPickEnd = (d: dayjs.Dayjs | null | undefined) => {
  endValue.value = d ? d.format('YYYY-MM-DD') : ''
  endOpen.value = false
  saveEnd()
}

// Pretty per-input display — matches the shorter "Apr 6, 2026" style used
// in the date-range subheader so the inputs feel consistent.
const formatDisplay = (raw: string | null | undefined) => {
  if (!raw) return ''
  const d = dayjs(raw)
  return d.isValid() ? d.format('MMM D, YYYY') : ''
}
</script>

<template>
  <div
    class="nc-gantt-inspector flex flex-col flex-shrink-0 border-l border-nc-border-gray-medium bg-nc-bg-default"
    style="width: 320px"
    data-testid="nc-gantt-inspector"
  >
    <!-- Header — record title + open-full + close -->
    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0">
      <NcTooltip show-on-truncate-only class="truncate text-sm font-semibold text-nc-content-gray">
        {{ nameValue || primaryField?.title || $t('general.name') }}
      </NcTooltip>
      <div class="flex items-center gap-1 flex-shrink-0">
        <NcTooltip :title="$t('title.expand')" placement="bottom">
          <NcButton
            type="text"
            size="xxsmall"
            icon-only
            :centered="true"
            data-testid="nc-gantt-inspector-expand"
            @click="emit('openFull', record)"
          >
            <template #icon>
              <GeneralIcon icon="ncMaximize" class="!w-3.5 !h-3.5 text-nc-content-gray-muted" />
            </template>
          </NcButton>
        </NcTooltip>
        <NcButton
          type="text"
          size="xxsmall"
          icon-only
          :centered="true"
          data-testid="nc-gantt-inspector-close"
          @click="emit('close')"
        >
          <template #icon>
            <GeneralIcon icon="close" class="!w-3.5 !h-3.5 text-nc-content-gray-muted" />
          </template>
        </NcButton>
      </div>
    </div>

    <!-- Body — scrollable -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      <!-- Record badge + date range subheader -->
      <div class="flex items-center gap-2 text-xs">
        <span class="px-1.5 py-0.5 rounded bg-nc-bg-gray-light text-nc-content-gray-muted uppercase tracking-wide">
          {{ $t('objects.record') }}
        </span>
        <span class="text-nc-content-gray-subtle truncate">{{ dateRangeLabel }}</span>
      </div>

      <!-- Name -->
      <div v-if="primaryField">
        <div class="text-xs uppercase tracking-wide text-nc-content-gray-muted mb-1">
          {{ primaryField.title }}
        </div>
        <input
          v-model="nameValue"
          type="text"
          class="nc-gantt-inspector-input w-full px-2 py-1.5 text-sm rounded border border-nc-border-gray-medium bg-nc-bg-gray-extralight focus:outline-none focus:border-nc-border-brand"
          data-testid="nc-gantt-inspector-name"
          @change="saveName"
        />
      </div>

      <!-- Start / End / Days — dates take the lion's share of width, Days
           gets a narrow fixed column. Standard NocoDB date picker via
           NcDropdown + NcDatePicker; no native browser calendar icon. -->
      <div class="grid gap-2" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 56px">
        <div v-if="fromCol">
          <div class="text-xs uppercase tracking-wide text-nc-content-gray-muted mb-1 truncate">
            {{ fromCol.title }}
          </div>
          <NcDropdown
            v-model:visible="startOpen"
            :trigger="['click']"
            :auto-close="false"
            overlay-class-name="nc-picker-date !min-w-[260px]"
          >
            <div
              class="nc-gantt-inspector-input w-full px-2 py-1.5 text-xs rounded border border-nc-border-gray-medium bg-nc-bg-gray-extralight cursor-pointer truncate"
              :class="{ 'border-nc-border-brand': startOpen }"
              data-testid="nc-gantt-inspector-start"
            >
              <span v-if="startDayjs">{{ formatDisplay(startValue) }}</span>
              <span v-else class="text-nc-content-gray-muted">–</span>
            </div>
            <template #overlay>
              <div class="w-[256px] bg-nc-bg-default rounded-md shadow-md">
                <NcDatePicker
                  v-model:page-date="startPageDate"
                  :selected-date="startDayjs"
                  :is-open="startOpen"
                  type="date"
                  size="medium"
                  show-current-date-option
                  @update:selected-date="onPickStart"
                  @current-date="onPickStart"
                />
              </div>
            </template>
          </NcDropdown>
        </div>
        <div v-if="toCol">
          <div class="text-xs uppercase tracking-wide text-nc-content-gray-muted mb-1 truncate">
            {{ toCol.title }}
          </div>
          <NcDropdown
            v-model:visible="endOpen"
            :trigger="['click']"
            :auto-close="false"
            overlay-class-name="nc-picker-date !min-w-[260px]"
          >
            <div
              class="nc-gantt-inspector-input w-full px-2 py-1.5 text-xs rounded border border-nc-border-gray-medium bg-nc-bg-gray-extralight cursor-pointer truncate"
              :class="{ 'border-nc-border-brand': endOpen }"
              data-testid="nc-gantt-inspector-end"
            >
              <span v-if="endDayjs">{{ formatDisplay(endValue) }}</span>
              <span v-else class="text-nc-content-gray-muted">–</span>
            </div>
            <template #overlay>
              <div class="w-[256px] bg-nc-bg-default rounded-md shadow-md">
                <NcDatePicker
                  v-model:page-date="endPageDate"
                  :selected-date="endDayjs"
                  :is-open="endOpen"
                  type="date"
                  size="medium"
                  show-current-date-option
                  @update:selected-date="onPickEnd"
                  @current-date="onPickEnd"
                />
              </div>
            </template>
          </NcDropdown>
        </div>
        <div>
          <div class="text-xs uppercase tracking-wide text-nc-content-gray-muted mb-1">
            {{ $t('objects.days') }}
          </div>
          <div
            class="w-full px-2 py-1.5 text-xs rounded border border-nc-border-gray-medium bg-nc-bg-gray-light text-nc-content-gray"
          >
            {{ durationDays || '–' }}
          </div>
        </div>
      </div>

      <!-- Predecessors — visually grouped as a separate section from the
           general info above with extra top padding and a hairline divider. -->
      <div v-if="depCol" class="space-y-1.5 pt-4 mt-2 border-t border-nc-border-gray-light">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-nc-content-gray-muted">
            <span>{{ predecessorIds.length }} {{ $t('labels.dateDependency.predecessors') }}</span>
            <span class="nc-gantt-inspector-help-tooltip inline-flex items-center">
              <NcTooltip
                :title="$t('labels.dateDependency.predecessorsTooltip', { name: nameValue || $t('objects.record') })"
                placement="top"
              >
                <GeneralIcon icon="ncHelp" class="!w-3 !h-3 text-nc-content-gray-muted" />
              </NcTooltip>
            </span>
          </div>
        </div>
        <div class="space-y-1">
          <div
            v-for="id in predecessorIds"
            :key="`pred-${id}`"
            class="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-nc-border-gray-medium bg-nc-bg-gray-extralight text-sm"
          >
            <NcTooltip show-on-truncate-only class="truncate">{{ titleFor(id) }}</NcTooltip>
            <button
              class="nc-gantt-inspector-unlink flex-shrink-0 text-nc-content-gray-muted hover:text-nc-content-gray"
              :data-testid="`nc-gantt-inspector-unlink-pred-${id}`"
              @click="onUnlinkPredecessor(id)"
            >
              <GeneralIcon icon="close" class="!w-3 !h-3" />
            </button>
          </div>
        </div>
        <div v-if="!showPredecessorPicker">
          <button
            class="flex items-center gap-1.5 px-2 py-1.5 text-sm text-nc-content-gray-muted hover:text-nc-content-brand"
            data-testid="nc-gantt-inspector-add-predecessor"
            @click="openPredecessorPicker"
          >
            <GeneralIcon icon="plus" class="!w-3.5 !h-3.5" />
            {{ $t('activity.linkRecord') }}
          </button>
        </div>
        <div v-else class="space-y-1">
          <input
            v-model="predecessorQuery"
            type="text"
            :placeholder="$t('general.search')"
            class="nc-gantt-inspector-input w-full px-2 py-1.5 text-sm rounded border border-nc-border-brand bg-nc-bg-default focus:outline-none"
            @keydown.esc="showPredecessorPicker = false"
          />
          <div class="max-h-40 overflow-y-auto border border-nc-border-gray-light rounded">
            <div
              v-for="cand in predecessorCandidates"
              :key="`pred-cand-${extractPkFromRow(cand.row, pkCols)}`"
              class="px-2 py-1.5 text-sm cursor-pointer hover:bg-nc-bg-gray-extralight truncate"
              @click="onLinkPredecessor(cand)"
            >
              {{ primaryField ? cand.row[primaryField.title!] ?? '' : '' }}
            </div>
            <div
              v-if="!predecessorCandidates.length"
              class="px-2 py-1.5 text-sm text-nc-content-gray-muted text-center"
            >
              {{ $t('labels.noResults') }}
            </div>
          </div>
        </div>
      </div>

      <!-- Successors — separated from the predecessor block with the same
           padding + hairline pattern. -->
      <div v-if="depCol" class="space-y-1.5 pt-4 mt-2 border-t border-nc-border-gray-light">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-nc-content-gray-muted">
            <span>{{ successorIds.length }} {{ $t('labels.dateDependency.successors') }}</span>
            <span class="nc-gantt-inspector-help-tooltip inline-flex items-center">
              <NcTooltip
                :title="$t('labels.dateDependency.successorsTooltip', { name: nameValue || $t('objects.record') })"
                placement="top"
              >
                <GeneralIcon icon="ncHelp" class="!w-3 !h-3 text-nc-content-gray-muted" />
              </NcTooltip>
            </span>
          </div>
        </div>
        <div class="space-y-1">
          <div
            v-for="id in successorIds"
            :key="`succ-${id}`"
            class="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-nc-border-gray-medium bg-nc-bg-gray-extralight text-sm"
          >
            <NcTooltip show-on-truncate-only class="truncate">{{ titleFor(id) }}</NcTooltip>
            <button
              class="nc-gantt-inspector-unlink flex-shrink-0 text-nc-content-gray-muted hover:text-nc-content-gray"
              :data-testid="`nc-gantt-inspector-unlink-succ-${id}`"
              @click="onUnlinkSuccessor(id)"
            >
              <GeneralIcon icon="close" class="!w-3 !h-3" />
            </button>
          </div>
        </div>
        <div v-if="!showSuccessorPicker">
          <button
            class="flex items-center gap-1.5 px-2 py-1.5 text-sm text-nc-content-gray-muted hover:text-nc-content-brand"
            data-testid="nc-gantt-inspector-add-successor"
            @click="openSuccessorPicker"
          >
            <GeneralIcon icon="plus" class="!w-3.5 !h-3.5" />
            {{ $t('activity.linkRecord') }}
          </button>
        </div>
        <div v-else class="space-y-1">
          <input
            v-model="successorQuery"
            type="text"
            :placeholder="$t('general.search')"
            class="nc-gantt-inspector-input w-full px-2 py-1.5 text-sm rounded border border-nc-border-brand bg-nc-bg-default focus:outline-none"
            @keydown.esc="showSuccessorPicker = false"
          />
          <div class="max-h-40 overflow-y-auto border border-nc-border-gray-light rounded">
            <div
              v-for="cand in successorCandidates"
              :key="`succ-cand-${extractPkFromRow(cand.row, pkCols)}`"
              class="px-2 py-1.5 text-sm cursor-pointer hover:bg-nc-bg-gray-extralight truncate"
              @click="onLinkSuccessor(cand)"
            >
              {{ primaryField ? cand.row[primaryField.title!] ?? '' : '' }}
            </div>
            <div
              v-if="!successorCandidates.length"
              class="px-2 py-1.5 text-sm text-nc-content-gray-muted text-center"
            >
              {{ $t('labels.noResults') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-gantt-inspector-input {
  &:focus {
    border-color: var(--nc-content-brand);
  }
}

/* Help icon next to section labels (PREDECESSORS / SUCCESSORS).
   `items-center` on the flex parent aligns the icon's geometric center
   to the line-box center, but for uppercase text the visual weight sits
   above the line center — the icon reads as too low. Lift the wrapper
   so the icon center matches the cap-height of the surrounding text. */
.nc-gantt-inspector-help-tooltip {
  position: relative;
  top: -2px;
}
</style>
