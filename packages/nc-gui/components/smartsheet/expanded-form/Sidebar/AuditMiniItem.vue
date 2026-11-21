<script setup lang="ts">
import { type AuditType, type TableType, checkboxIconListMap, isAIPromptCol, parseHelper, ratingIconListMap } from 'nocodb-sdk'
import type { AuditDiffRow } from '~/utils/auditDiff'

const props = defineProps<{
  audit: AuditType
}>()

const { t } = useI18n()

const tableMeta = inject(MetaInj, ref())

const isSyncedTable = computed(() => !!(tableMeta.value as TableType | undefined)?.synced)

const details = computed(() => {
  try {
    return JSON.parse(props.audit.details || '')
  } catch (e) {
    return {}
  }
})

const oldData = computed(() => {
  return details.value.old_data ?? {}
})

const newData = computed(() => {
  return details.value.data ?? {}
})

const meta = computed(() => {
  return details.value.column_meta ?? {}
})

const columnKeys = computed(() => {
  const keys = Object.keys(newData.value)
  // On synced tables, sync bookkeeping fields (RemoteSyncedAt, SyncRunId, …)
  // change on every sync and drown out the real edit — hide their rows.
  if (!isSyncedTable.value) return keys
  return keys.filter((key) => !isSyncSystemColumnTitle(key))
})

/* provides */

provide(RawReadonlyInj, ref(true))

/* attachment */

const { getPossibleAttachmentSrc } = useAttachment()

/* meta processing */

function typeOf(key: string): string | undefined {
  return meta.value?.[key]?.type
}

function normalizeColOptions(key: string) {
  return {
    ...(meta.value?.[key]?.options ?? {}),
    options: meta.value?.[key]?.options?.choices,
  }
}

function normalizeMeta(key: string) {
  const mta = meta.value?.[key] ?? {}
  const opts = normalizeColOptions(key)
  const icn = opts.icon || (mta.type === 'Rating' ? 'star' : 'circle-check')

  return {
    ...opts,
    ...mta,
    icon: mta.type === 'Rating' ? ratingIconListMap[icn] : checkboxIconListMap[icn],
    duration: opts.duration_format ? durationOptions.find((it) => it.title === opts.duration_format)?.id : undefined,
    is12hrFormat: opts['12hr_format'],
    isLocaleString: opts.locale_string,
    isDisplayTimezone: opts?.isDisplayTimezone || opts?.is_display_timezone,
    useSameTimezoneForAll: opts?.useSameTimezoneForAll || opts?.use_same_timezone_for_all,
  }
}

function cellColumn(key: string) {
  return {
    uidt: typeOf(key),
    dt: typeOf(key) === 'Number' ? 'bigint' : undefined,
    meta: normalizeMeta(key),
    colOptions: normalizeColOptions(key),
  }
}

/* values */

// AI-generated long text stores `{ value, … }`; everything else is the raw value.
function textValue(data: Record<string, any>, key: string) {
  const val = data[key]
  if (typeOf(key) === 'LongText' && meta.value?.[key]?.options?.ai) return val?.value ?? ''
  return val
}

function isShowableValue(value: any) {
  return ![undefined, null, ''].includes(value) && !(Array.isArray(value) && value.length === 0)
}

const isAiGeneratedText = (key: string) => {
  return (
    isAIPromptCol({
      uidt: typeOf(key),
      dt: typeOf(key) === 'Number' ? 'bigint' : undefined,
      meta: normalizeMeta(key),
    }) &&
    (!ncIsObject(newData.value[key]) || !newData.value[key]?.lastModifiedBy)
  )
}

/* render mode per field */

type ChangeMode = 'files' | 'set' | 'lines' | 'words' | 'raw' | 'checkbox' | 'cell'

const SET_TYPES = ['MultiSelect', 'User']
const RAW_TYPES = ['URL', 'PhoneNumber', 'Email', 'SingleLineText']

function lineMode(key: string): 'plain' | 'formatted' | 'code' {
  if (typeOf(key) === 'JSON') return 'code'
  const opts = meta.value?.[key]?.options ?? {}
  return opts.rich_mode || opts.richMode || opts.smart_mode || opts.smartMode ? 'formatted' : 'plain'
}

function listValue(data: Record<string, any>, key: string) {
  const val = typeOf(key) === 'Attachment' ? parseHelper(data[key]) : data[key]
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val) return val.split(',').map((s) => s.trim())
  return []
}

function listKey(item: any) {
  if (item && typeof item === 'object') return item.id ?? item.email ?? item.url ?? item.path ?? item.title
  return item
}

const changes = computed(() => {
  return Object.fromEntries(
    columnKeys.value.map((key) => {
      const type = typeOf(key)
      const oldVal = textValue(oldData.value, key)
      const newVal = textValue(newData.value, key)

      if (type === 'Attachment' || SET_TYPES.includes(type ?? '')) {
        const diff = auditSetDiff(listValue(oldData.value, key), listValue(newData.value, key), listKey)
        return [key, { mode: (type === 'Attachment' ? 'files' : 'set') as ChangeMode, ...diff }]
      }
      if (type === 'LongText' || type === 'JSON') {
        const lines = auditLineDiff(oldVal, newVal, lineMode(key))
        const collapsed = lines.length > 6 ? collapseAuditLines(lines) : lines
        return [key, { mode: 'lines' as ChangeMode, lines, collapsed, canExpand: collapsed.length < lines.length }]
      }
      if (type === 'SingleLineText') {
        const words = auditWordDiff(oldVal, newVal)
        if (words) return [key, { mode: 'words' as ChangeMode, words }]
      }
      if (RAW_TYPES.includes(type ?? '')) return [key, { mode: 'raw' as ChangeMode }]
      if (type === 'Checkbox') return [key, { mode: 'checkbox' as ChangeMode }]
      return [key, { mode: 'cell' as ChangeMode }]
    }),
  ) as Record<string, any>
})

const expanded = ref<Record<string, boolean>>({})

function toggleExpanded(key: string) {
  expanded.value = { ...expanded.value, [key]: !expanded.value[key] }
}

function visibleRows(key: string): AuditDiffRow[] {
  const change = changes.value[key]
  return expanded.value[key] ? change.lines : change.collapsed
}

function checkboxLabel(value: any) {
  return value === true || value === 1 || value === '1' || value === 'true'
    ? t('aggregation.checked')
    : t('aggregation.unchecked')
}
</script>

<template>
  <div v-for="columnKey of columnKeys" :key="columnKey" class="nc-audit-change">
    <div
      class="w-full flex items-center gap-1 !text-nc-content-gray-subtle2 uppercase !text-[10px] tracking-wide font-weight-500 nc-audit-mini-item-header"
    >
      <NcTooltip
        class="truncate"
        :class="{
          'max-w-1/2': isAiGeneratedText(columnKey),
        }"
        show-on-truncate-only
      >
        <template #title>
          {{ columnKey }}
        </template>

        {{ columnKey }}
      </NcTooltip>
      <span v-if="isAiGeneratedText(columnKey)" class="whitespace-nowrap text-xs normal-case text-nc-content-purple-medium">
        ({{ $t('labels.generatedByAi') }})
      </span>
    </div>

    <div class="mt-1 text-small1 text-nc-content-gray">
      <!-- Attachments: one row per file added or removed -->
      <div v-if="changes[columnKey].mode === 'files'" class="flex flex-col gap-1">
        <div
          v-for="(item, i) of [...changes[columnKey].added, ...changes[columnKey].removed]"
          :key="`${listKey(item)}-${i}`"
          class="flex items-center gap-2 min-w-0"
          :class="{ 'nc-audit-gone': i >= changes[columnKey].added.length }"
        >
          <span class="nc-audit-pm" :class="i >= changes[columnKey].added.length ? 'nc-audit-pm-minus' : 'nc-audit-pm-plus'">
            {{ i >= changes[columnKey].added.length ? '−' : '+' }}
          </span>
          <div class="flex items-center justify-center w-6 h-6 flex-none">
            <LazyCellAttachmentPreviewImage
              v-if="isImage(item.title, item.mimetype ?? item.type)"
              :alt="item.title || `#${i}`"
              class="nc-attachment rounded !w-6 !h-6 object-cover overflow-hidden"
              :srcs="getPossibleAttachmentSrc(item, 'small')"
            />
            <CellAttachmentIconView v-else :item="item" class="!w-6 !h-6" />
          </div>
          <span class="flex-1 truncate nc-audit-strike-target">{{ item.title }}</span>
          <span class="text-xs text-nc-content-gray-muted">{{ getReadableFileSize(item.size) }}</span>
        </div>
      </div>

      <!-- Multi select, User: what was added and what was removed -->
      <div v-else-if="changes[columnKey].mode === 'set'" class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div v-if="changes[columnKey].added.length" class="flex items-center gap-1 min-w-0">
          <span class="nc-audit-pm nc-audit-pm-plus">+</span>
          <div class="nc-audit-mini-item-cell">
            <SmartsheetCell
              :column="cellColumn(columnKey)"
              :model-value="changes[columnKey].added"
              :edit-enabled="false"
              read-only
            />
          </div>
        </div>
        <div v-if="changes[columnKey].removed.length" class="flex items-center gap-1 min-w-0 nc-audit-gone">
          <span class="nc-audit-pm nc-audit-pm-minus">−</span>
          <div class="nc-audit-mini-item-cell nc-audit-removal">
            <SmartsheetCell
              :column="cellColumn(columnKey)"
              :model-value="changes[columnKey].removed"
              :edit-enabled="false"
              read-only
            />
          </div>
        </div>
      </div>

      <!-- Long text, rich/smart text, JSON: line diff with context -->
      <template v-else-if="changes[columnKey].mode === 'lines'">
        <div
          class="flex flex-col gap-0.5 break-words"
          :class="{ 'font-mono text-xs whitespace-pre-wrap': lineMode(columnKey) === 'code' }"
        >
          <template v-for="(row, i) of visibleRows(columnKey)" :key="i">
            <div v-if="row.op === 'gap'" class="text-nc-content-gray-muted leading-4 select-none" aria-hidden="true">⋯</div>
            <div
              v-else
              class="nc-audit-line flex items-start gap-1.5"
              :class="[`nc-audit-line-${row.op}`, `nc-audit-kind-${row.kind}`]"
            >
              <span v-if="row.kind === 'li' || row.kind === 'ol'" class="flex-none">•</span>
              <span v-else-if="row.kind === 'task'" class="nc-audit-task" :class="{ 'nc-audit-task-checked': row.checked }">
                <GeneralIcon v-if="row.checked" icon="ncCheck" class="w-2.5 h-2.5" />
              </span>
              <span class="min-w-0" :class="{ 'whitespace-pre-wrap': lineMode(columnKey) !== 'formatted' }">
                <span v-for="(seg, j) of row.segments" :key="j" :class="`nc-audit-seg-${seg.op}`">{{ seg.text }}</span>
                <template v-if="!row.segments.some((s) => s.text)">&nbsp;</template>
              </span>
            </div>
          </template>
        </div>
        <button
          v-if="changes[columnKey].canExpand"
          type="button"
          class="nc-audit-long-text-toggle mt-1 text-xs font-weight-600 text-nc-content-brand hover:text-nc-content-brand-hover"
          @click="toggleExpanded(columnKey)"
        >
          {{ expanded[columnKey] ? $t('general.showLess') : $t('labels.audit.showFullText') }}
        </button>
      </template>

      <!-- Short text, mostly unchanged: words in place -->
      <div v-else-if="changes[columnKey].mode === 'words'" class="break-words whitespace-pre-wrap">
        <span v-for="(seg, j) of changes[columnKey].words" :key="j" :class="`nc-audit-seg-${seg.op}`">{{ seg.text }}</span>
      </div>

      <!-- Everything else: old → new -->
      <div v-else class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <template v-if="changes[columnKey].mode === 'checkbox'">
          <span class="nc-audit-old">{{ checkboxLabel(oldData[columnKey]) }}</span>
        </template>
        <template v-else-if="!isShowableValue(oldData[columnKey])">
          <span class="nc-audit-empty">{{ $t('general.empty') }}</span>
        </template>
        <span v-else-if="changes[columnKey].mode === 'raw'" class="nc-audit-old break-all">{{ oldData[columnKey] }}</span>
        <div v-else class="nc-audit-mini-item-cell nc-audit-removal nc-audit-gone">
          <SmartsheetCell
            :column="cellColumn(columnKey)"
            :model-value="oldData[columnKey]"
            :edit-enabled="false"
            read-only
            :class="{ 'min-w-[100px]': normalizeMeta(columnKey).is_progress }"
          />
        </div>

        <GeneralIcon icon="ncArrowRight" class="w-3 h-3 flex-none text-nc-content-gray-subtle2" aria-hidden="true" />

        <template v-if="changes[columnKey].mode === 'checkbox'">
          <span>{{ checkboxLabel(newData[columnKey]) }}</span>
        </template>
        <template v-else-if="!isShowableValue(newData[columnKey])">
          <span class="nc-audit-empty">{{ $t('general.empty') }}</span>
        </template>
        <span v-else-if="changes[columnKey].mode === 'raw'" class="break-all">{{ newData[columnKey] }}</span>
        <div v-else class="nc-audit-mini-item-cell">
          <SmartsheetCell
            :column="cellColumn(columnKey)"
            :model-value="newData[columnKey]"
            :edit-enabled="false"
            read-only
            :class="{ 'min-w-[100px]': normalizeMeta(columnKey).is_progress }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-audit-change {
  @apply min-w-0;
}

// Old side of a replaced value: faded, struck through where it is text.
.nc-audit-old {
  @apply text-nc-content-gray-muted line-through;
}
.nc-audit-gone {
  opacity: 0.55;
  .nc-audit-strike-target {
    @apply line-through;
  }
}
.nc-audit-empty {
  @apply text-nc-content-gray-muted italic;
}

.nc-audit-pm {
  @apply flex-none w-2.5 text-center text-xs font-bold;
}
.nc-audit-pm-plus {
  @apply text-nc-content-green-dark;
}
.nc-audit-pm-minus {
  @apply text-nc-content-red-dark;
}

// In-text diff marks: background only, no padding, so spacing stays natural.
.nc-audit-seg-added {
  @apply bg-nc-bg-green-light text-nc-content-green-dark rounded-sm decoration-clone;
}
.nc-audit-seg-removed {
  @apply bg-nc-bg-red-light text-nc-content-red-dark rounded-sm line-through decoration-clone;
}

.nc-audit-line {
  @apply leading-5;
}
.nc-audit-line-unchanged {
  @apply text-nc-content-gray-subtle;
}
.nc-audit-line-added,
.nc-audit-line-removed {
  .nc-audit-seg-added,
  .nc-audit-seg-removed {
    @apply bg-transparent;
  }
}
.nc-audit-line-added {
  @apply bg-nc-bg-green-light text-nc-content-green-dark rounded-sm;
}
.nc-audit-line-removed {
  @apply bg-nc-bg-red-light text-nc-content-red-dark rounded-sm line-through;
}
.nc-audit-kind-h {
  @apply font-weight-700;
}
.nc-audit-kind-quote {
  @apply italic pl-2 border-l-2 border-nc-border-gray-medium;
}
.nc-audit-task {
  @apply flex-none mt-[3px] w-3.5 h-3.5 rounded-[3px] border-1 border-nc-border-gray-dark flex items-center justify-center;
}
.nc-audit-task-checked {
  @apply bg-nc-fill-primary border-nc-fill-primary text-white;
}

.nc-audit-long-text-toggle {
  cursor: pointer;
  background: transparent;
  border: 0;
  padding: 0;
  line-height: 1.2;
}

.nc-audit-mini-item-cell :deep(.nc-cell-checkbox > div:first-child) {
  @apply pl-0;
}
.nc-audit-mini-item-cell :deep(.nc-cell-field.nc-multi-select > div) {
  @apply !gap-1 !flex;
  & > span {
    @apply !m-0 flex items-center h-[22px];
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-field.nc-single-select > div) {
  height: 20px !important;
  & > span {
    @apply !m-0;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-field.nc-multi-select > div) {
  span.ant-tag span.text-ellipsis {
    @apply line-through;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-field.nc-single-select > div) {
  span.ant-tag span.text-ellipsis {
    @apply line-through;
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-rating .ant-rate) {
  @apply !p-0 transform -translate-y-[1px];
}
.nc-audit-mini-item-cell :deep(.nc-cell-percent) {
  & > div > div {
    @apply !p-0;
    &,
    & * {
      height: 6px !important;
    }
    .ant-progress-inner {
      transform: translateY(-9px) !important;
    }
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-datetime) {
  .nc-date-picker {
    @apply !inline !text-inherit text-small1;

    & > div {
      @apply !inline;

      & > div {
        @apply !inline;
      }
    }
    & > div + div {
      @apply !ml-1;
    }
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-time) {
  .nc-time-picker span {
    text-decoration: line-through;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-year) {
  .nc-year-picker span {
    text-decoration: line-through;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-date) {
  .nc-date-picker span {
    text-decoration: line-through;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-field) {
  text-decoration: line-through;
}
.nc-audit-mini-item-cell :deep(.nc-cell-user) {
  .nc-cell-field > div {
    display: flex !important;
    & > .ant-tag {
      @apply !m-0 !text-inherit !border-1 !border-nc-border-gray-dark !pr-1 !pl-0.5 !bg-nc-bg-gray-light !rounded-[17px];
      & > span > div + div {
        @apply flex items-center !text-small1 font-weight-500 !leading-[16px];
      }
      & > span {
        @apply gap-1;
      }
    }
    .nc-user-avatar {
      @apply border-1 border-nc-border-gray-medium !text-[8px];
      height: 16px !important;
      width: 16px !important;
    }
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-user:has(.ant-tag + .ant-tag)) {
  .ant-tag {
    @apply !border-1 !border-nc-border-gray-dark !py-0.5 !px-1 !bg-nc-bg-gray-light !rounded-[6px];
  }
}
</style>

<style lang="scss">
.nc-audit-mini-item-header {
  svg {
    height: 12px;
  }
}
.nc-audit-mini-item-cell:has(.nc-cell-user .ant-tag + .ant-tag) {
  .nc-cell-field > div {
    @apply gap-1;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal:has(.nc-cell-user) {
  text-decoration: none;
  .ant-tag div + div {
    text-decoration: line-through;
  }
}
.nc-audit-mini-item-cell.nc-audit-mini-item-cell.nc-audit-mini-item-cell.nc-audit-mini-item-cell
  .nc-cell
  .nc-cell-field.nc-cell-field {
  font-size: 13px !important;
}
.nc-audit-mini-item-cell.nc-audit-mini-item-cell.nc-audit-mini-item-cell.nc-audit-mini-item-cell
  .nc-cell
  :where(.nc-date-picker)
  span {
  font-size: 13px !important;
}
</style>
