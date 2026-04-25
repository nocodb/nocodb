<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'

const MAX_CHIPS = 8

const AVATAR_PALETTE = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-green-600',
  'bg-red-500',
  'bg-teal-500',
]

const {
  isOpen,
  isLoading,
  trashItems,
  totalRows,
  currentPage,
  pageSize,
  retentionDays,
  close,
  loadTrash,
  restoreItem,
  emptyTrash,
  conflictFor,
} = useBaseTrash()

const { t } = useI18n()

const { user } = useGlobal()

const { showWarningModal } = useNcConfirmModal()

const { basesUser, openedProject } = storeToRefs(useBases())

const { getMeta, getMetaByKey } = useMetas()

const baseUsers = computed(() => (openedProject.value?.id ? basesUser.value.get(openedProject.value.id) || [] : []))

// ── Per-record-entry meta resolution ──────────────────────────────────
//
// Record entries' inline `records` need their parent table's meta to look
// up the PV column for chip rendering. Pre-fetch any missing metas after
// each load (in parallel) so PlainCell has columns to bind against.
const recordEntryMetas = computed(() => {
  const out: Record<string, TableType | undefined> = {}
  for (const item of trashItems.value as any[]) {
    if (item.resource_type !== 'record' || !item.parent_id || !item.base_id) continue
    out[item.id] = getMetaByKey(item.base_id, item.parent_id)
  }
  return out
})

watch(
  trashItems,
  async (items) => {
    await Promise.all(
      (items as any[])
        .filter((i) => i.resource_type === 'record' && i.parent_id && i.base_id && !getMetaByKey(i.base_id, i.parent_id))
        .map((i) => getMeta(i.base_id, i.parent_id).catch(() => null)),
    )
  },
  { immediate: true },
)

const expandedEntries = ref<Set<string>>(new Set())

function isExpanded(id: string) {
  return expandedEntries.value.has(id)
}

function toggleExpand(id: string) {
  if (expandedEntries.value.has(id)) expandedEntries.value.delete(id)
  else expandedEntries.value.add(id)
  expandedEntries.value = new Set(expandedEntries.value)
}

function pvColumn(item: any): ColumnType | undefined {
  const meta = recordEntryMetas.value[item.id]
  return meta?.columns?.find((c: ColumnType) => c.pv)
}

function visibleRecords(item: any): any[] {
  const all = (item.records ?? []) as any[]
  return isExpanded(item.id) ? all : all.slice(0, MAX_CHIPS)
}

function displayName(userId?: string | null) {
  if (!userId) return ''
  const u = baseUsers.value.find((x: any) => x.id === userId)
  if (!u) return ''
  return u.display_name || extractNameFromEmail(u.email) || ''
}

function avatarColor(userId?: string | null) {
  const key = userId || '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

const RESOURCE_LABEL_KEYS: Record<string, string> = {
  table: 'objects.table',
  view: 'objects.view',
  field: 'objects.field',
  dashboard: 'objects.dashboard',
  widget: 'objects.widget',
  workflow: 'objects.workflow',
  script: 'objects.script',
  extension: 'objects.extension',
}

function activitySentence(item: any) {
  const isSelf = !!item.deleted_by && item.deleted_by === user.value?.id
  const actor = isSelf ? '' : displayName(item.deleted_by)

  if (item.resource_type === 'record') {
    const count = item.visible_record_count ?? item.records?.length ?? 0
    if (isSelf) return t('trash.youDeletedRecord', { count }, count)
    if (actor) return t('trash.userDeletedRecord', { user: actor, count }, count)
    return t('trash.someoneDeletedRecord', { count }, count)
  }

  const typeLabel = (
    RESOURCE_LABEL_KEYS[item.resource_type] ? t(RESOURCE_LABEL_KEYS[item.resource_type]) : item.resource_type || ''
  ).toLowerCase()
  const name = item.name || ''
  const parent = item.parent_name || ''

  if (!isSelf && !actor) return t('baseTrash.someoneDeleted', { type: typeLabel, name })

  const key = `baseTrash.${isSelf ? 'you' : 'user'}Deleted${parent ? '' : 'NoParent'}`
  return t(key, { user: actor, type: typeLabel, parent, name })
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const diffSecs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diffSecs < 5) return t('trash.justNow')
  if (diffSecs < 60) return t('baseTrash.secondsAgo', { count: diffSecs })
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return t('trash.minutesAgo', { count: diffMins })
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return t('trash.hoursAgo', { count: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return t('trash.daysAgo', { count: diffDays })
  return dayjs(d).format('YYYY-MM-DD')
}

function handleEmptyTrash() {
  showWarningModal({
    title: t('general.emptyTrash'),
    content: t('baseTrash.confirmEmpty'),
    okCallback: async () => {
      await emptyTrash()
    },
  })
}
</script>

<template>
  <NcModal v-model:visible="isOpen" :show-separator="false" size="lg" wrap-class-name="nc-modal-base-trash">
    <template #header>
      <div class="flex flex-col w-full px-6 pt-5 pb-4 gap-1 border-b-1 border-nc-border-gray-medium">
        <div class="flex w-full items-start justify-between gap-4">
          <NcTooltip show-on-truncate-only class="text-nc-content-gray-emphasis font-semibold text-xl truncate min-w-0 flex-1">
            {{ openedProject?.title ? $t('baseTrash.header', { base: openedProject.title }) : $t('baseTrash.title') }}
          </NcTooltip>
          <div class="flex items-center gap-1 shrink-0">
            <NcButton
              v-if="trashItems.length"
              v-e="['c:base-trash:empty']"
              size="small"
              type="secondary"
              class="nc-base-trash-empty-btn"
              data-testid="nc-base-trash-empty-btn"
              @click="handleEmptyTrash"
            >
              {{ $t('trash.emptyTrash') }}
            </NcButton>
            <NcButton type="text" size="small" class="!px-2" data-testid="nc-base-trash-close-btn" @click="close">
              <GeneralIcon icon="close" class="h-4 w-4" />
            </NcButton>
          </div>
        </div>
        <div class="text-bodySm text-nc-content-gray-subtle2">
          {{ $t('baseTrash.description', { days: retentionDays }) }}
        </div>
      </div>
    </template>

    <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div class="flex flex-col flex-1 overflow-auto nc-scrollbar-thin min-h-0">
        <div v-if="isLoading" class="flex-1 flex items-center justify-center">
          <GeneralLoader size="large" />
        </div>

        <div v-else-if="!trashItems.length" class="flex-1 flex flex-col items-center justify-center gap-2">
          <div class="w-14 h-14 rounded-full bg-nc-bg-gray-light flex items-center justify-center">
            <GeneralIcon icon="ncTrash2" class="w-7 h-7 text-nc-content-gray-muted" />
          </div>
          <div class="text-sm font-medium text-nc-content-gray-subtle">{{ $t('baseTrash.noDeletedItems') }}</div>
          <div class="text-captionSm text-nc-content-gray-muted">{{ $t('baseTrash.deletedItemsWillAppearHere') }}</div>
        </div>

        <div v-else>
          <div
            v-for="item in trashItems"
            :key="item.id"
            class="nc-base-trash-event-row flex flex-col"
            :class="{ 'bg-nc-bg-gray-extralight': !!conflictFor(item.id!) }"
            :data-testid="`nc-base-trash-item-${item.id}`"
          >
            <div class="nc-base-trash-item flex items-center gap-3 px-6 py-4 hover:bg-nc-bg-gray-extralight transition-colors">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center text-bodySm font-semibold shrink-0 text-white"
                :class="avatarColor(item.deleted_by)"
              >
                {{ (displayName(item.deleted_by) || '?').charAt(0).toUpperCase() }}
              </div>

              <div class="flex-1 min-w-0">
                <NcTooltip
                  show-on-truncate-only
                  class="block truncate text-bodyDefault font-semibold text-nc-content-gray-emphasis"
                >
                  {{ activitySentence(item) }}
                </NcTooltip>
                <div class="text-captionSm text-nc-content-gray-muted mt-0.5">
                  {{ formatDate(item.deleted_at) }}
                </div>

                <!-- Record entries: PV chips, rendered via PlainCell so the
                   parent table's display-value column dictates formatting
                   (datetime, user, currency, etc). Falls back to "Unnamed
                   record" when meta isn't loaded yet or PV is empty. -->
                <div
                  v-if="item.resource_type === 'record' && item.records?.length"
                  class="flex flex-wrap gap-1.5 mt-2 items-center"
                >
                  <span
                    v-for="(record, i) in visibleRecords(item)"
                    :key="i"
                    class="px-2 py-0.5 rounded bg-nc-bg-gray-light text-nc-content-gray text-captionSm max-w-60 truncate"
                  >
                    <SmartsheetPlainCell
                      v-if="pvColumn(item) && recordEntryMetas[item.id]"
                      :column="pvColumn(item)!"
                      :model-value="record[pvColumn(item)!.title!]"
                      :meta="recordEntryMetas[item.id]"
                    />
                    <span v-else class="italic text-nc-content-gray-muted">
                      {{ $t('trash.unnamedRecord') }}
                    </span>
                  </span>
                  <span
                    v-if="isExpanded(item.id) && (item.records?.length ?? 0) > visibleRecords(item).length"
                    class="text-captionSm text-nc-content-gray-muted px-1 shrink-0"
                  >
                    {{
                      $t('trash.andNMore', {
                        count: (item.records?.length ?? 0) - visibleRecords(item).length,
                      })
                    }}
                  </span>
                  <button
                    v-if="(item.records?.length ?? 0) > MAX_CHIPS"
                    v-e="['c:base-trash:record:toggle-expand']"
                    type="button"
                    class="text-captionSm text-nc-content-brand hover:underline px-1 shrink-0"
                    @click="toggleExpand(item.id)"
                  >
                    {{ isExpanded(item.id) ? $t('trash.showLess') : $t('trash.showAll') }}
                  </button>
                </div>
              </div>

              <NcTooltip :disabled="item.is_restorable !== false">
                <template #title>
                  {{ $t('baseTrash.restoreParentFirst', { parent: item.parent_name || item.parent_type }) }}
                </template>
                <NcButton
                  v-e="['c:base-trash:restore']"
                  size="small"
                  type="text"
                  class="!text-nc-content-brand !px-2 !font-semibold shrink-0"
                  :disabled="item.is_restorable === false || !!conflictFor(item.id!)"
                  :data-testid="`nc-base-trash-restore-btn-${item.id}`"
                  @click="restoreItem(item.id!)"
                >
                  {{ $t('trash.restore') }}
                </NcButton>
              </NcTooltip>
            </div>

            <BaseTrashConflictPanel
              v-if="conflictFor(item.id!)"
              :entry-id="item.id!"
              :row-count="item.visible_record_count ?? item.records?.length ?? 1"
              :state="conflictFor(item.id!)!"
            />
          </div>
        </div>
      </div>

      <div
        v-if="totalRows > pageSize"
        class="flex items-center justify-center h-11 border-t-1 border-nc-border-gray-medium shrink-0"
      >
        <NcPagination
          v-e="['c:base-trash:paginate']"
          :current="currentPage"
          :total="totalRows"
          :page-size="pageSize"
          data-testid="nc-base-trash-pagination"
          @update:current="loadTrash"
        />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-base-trash {
  .nc-modal {
    @apply !p-0 !flex !flex-col;
    height: min(calc(100vh - 100px), 720px);
    max-height: min(calc(100vh - 100px), 720px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0 shrink-0;
  }
}

.nc-base-trash-empty-btn {
  &:hover:not(:disabled) {
    @apply !text-nc-content-red-dark !border-nc-border-red !bg-nc-bg-red-light;
  }
}

.nc-base-trash-event-row:not(:last-child) {
  @apply border-b-1 border-nc-border-gray-medium;
}
</style>
