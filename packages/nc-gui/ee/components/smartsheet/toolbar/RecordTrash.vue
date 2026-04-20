<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core'

const MAX_CHIPS = 8

const AVATAR_PALETTE = [
  'bg-blue-500 text-white',
  'bg-purple-500 text-white',
  'bg-orange-500 text-white',
  'bg-pink-500 text-white',
  'bg-green-600 text-white',
  'bg-red-500 text-white',
  'bg-teal-500 text-white',
]

const {
  isOpen,
  isLoading,
  isLoadingMore,
  trashEvents,
  trashCount,
  retentionDays,
  trashUnavailableReason,
  hasMoreEvents,
  loadTrashEvents,
  loadMoreEvents,
  restoreEvent,
  emptyTrash,
} = useRecordTrash()

const trashDisabled = computed(() => trashUnavailableReason.value === 'disabled')

const { meta } = useSmartsheetStoreOrThrow()

const router = useRouter()

const route = router.currentRoute

const { resolvedProject } = storeToRefs(useBases())

function openTrashSettings() {
  const wsId = route.value.params.typeOrId as string | undefined
  const baseId = resolvedProject.value?.id ?? (meta.value as any)?.base_id
  if (!wsId || !baseId) return
  isOpen.value = false
  navigateTo(`/${wsId}/${baseId}/settings/record-trash`)
}

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const { showErrorModal } = useNcConfirmModal()

const { user } = useGlobal()

const expandedEvents = ref<Set<string>>(new Set())

const isCurrentUser = (event: TrashEvent) => {
  if (!event) return false
  return !!event.fk_user_id && !!user.value?.id && event.fk_user_id === user.value.id
}

function userDisplayName(event: TrashEvent) {
  return event.display_name_short ?? ''
}

function userInitial(event: TrashEvent) {
  const name = userDisplayName(event)
  return (name || '?').charAt(0).toUpperCase()
}

function avatarColor(event: TrashEvent) {
  const key = event.fk_user_id || event.email || '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return t('trash.justNow')
  if (diffMins < 60) return t('trash.minutesAgo', { count: diffMins })
  if (diffHours < 24) return t('trash.hoursAgo', { count: diffHours })
  if (diffDays < 7) return t('trash.daysAgo', { count: diffDays })
  return dayjs(d).format('YYYY-MM-DD')
}

function absoluteDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function eventTitle(event: { user: string | null; fk_user_id: string | null; row_count: number }) {
  const count = event.row_count
  if (isCurrentUser(event)) {
    return t('trash.youDeletedRecord', { count }, count)
  }
  const name = userDisplayName(event)
  if (name) {
    return t('trash.userDeletedRecord', { user: name, count }, count)
  }
  return t('trash.someoneDeletedRecord', { count }, count)
}

function pvText(row: { pv: any }) {
  const v = row.pv
  if (v == null || v === '') return ''
  if (ncIsObject(v) || ncIsArray(v)) return ''
  return String(v)
}

function isExpanded(event: { id: string }) {
  return expandedEvents.value.has(event.id)
}

function toggleExpand(event: { id: string }) {
  if (expandedEvents.value.has(event.id)) expandedEvents.value.delete(event.id)
  else expandedEvents.value.add(event.id)
  expandedEvents.value = new Set(expandedEvents.value)
}

function visiblePreviewRows(event: { id: string; preview_rows: Array<{ row_id: string; pv: any }> }) {
  return isExpanded(event) ? event.preview_rows : event.preview_rows.slice(0, MAX_CHIPS)
}

function handleEmptyTrash() {
  const count = trashCount.value || trashEvents.value.reduce((sum, e) => sum + (e.row_count ?? 0), 0)

  showErrorModal({
    title: t('trash.emptyTrashTitle'),
    content: t('trash.confirmEmpty', { count }, count),
    showCancelBtn: true,
    okText: t('trash.emptyTrash'),
    okProps: { type: 'danger' },
    okCallback: async () => {
      await emptyTrash()
    },
  })
}

const scrollContainer = ref<HTMLElement | null>(null)

useInfiniteScroll(scrollContainer, () => loadMoreEvents(), {
  distance: 120,
  canLoadMore: () => hasMoreEvents.value && !isLoading.value && !isLoadingMore.value,
})

watch(isOpen, (val) => {
  if (val) {
    expandedEvents.value = new Set()
    loadTrashEvents()
  }
})
</script>

<template>
  <NcModal v-model:visible="isOpen" :show-separator="false" size="lg" wrap-class-name="nc-modal-record-trash">
    <template #header>
      <div class="flex w-full items-start px-6 pt-5 pb-4 justify-between gap-4 border-b-1 border-nc-border-gray-medium">
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <div class="text-nc-content-gray-emphasis font-semibold text-xl truncate">
            <template v-if="meta?.title">
              {{ $t('trash.deletedFromTable', { table: meta.title }) }}
            </template>
            <template v-else>
              {{ $t('trash.title') }}
            </template>
          </div>
          <div class="text-nc-content-gray-subtle2 text-bodySm">
            {{ trashDisabled ? $t('trash.autoExpiryDisabled') : $t('trash.autoExpiry', { days: retentionDays }) }}
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <NcButton
            v-if="trashEvents.length && isUIAllowed('recordTrashEmpty')"
            v-e="['c:trash:empty']"
            size="small"
            type="secondary"
            class="nc-trash-empty-btn"
            data-testid="nc-trash-empty-btn"
            @click="handleEmptyTrash"
          >
            {{ $t('trash.emptyTrash') }}
          </NcButton>
          <NcButton type="text" size="small" class="!px-2" data-testid="nc-trash-close-btn" @click="isOpen = false">
            <GeneralIcon icon="close" class="h-4 w-4" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div ref="scrollContainer" class="flex flex-col flex-1 overflow-auto nc-scrollbar-thin min-h-0">
        <div v-if="isLoading" class="flex-1 flex items-center justify-center">
          <GeneralLoader size="large" />
        </div>

        <div v-else-if="trashDisabled" class="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div class="w-14 h-14 rounded-full bg-nc-bg-gray-light flex items-center justify-center">
            <GeneralIcon icon="ncTrash2" class="w-7 h-7 text-nc-content-gray-muted" />
          </div>
          <div class="text-sm font-medium text-nc-content-gray-subtle">{{ $t('trash.disabledTitle') }}</div>
          <div class="text-captionSm text-nc-content-gray-muted max-w-sm">{{ $t('trash.disabledSubtitle') }}</div>
          <NcButton
            v-e="['c:trash:open-settings']"
            size="small"
            type="secondary"
            data-testid="nc-trash-open-settings-btn"
            @click="openTrashSettings"
          >
            <GeneralIcon icon="ncSettings" class="h-4 w-4 mr-1" />
            {{ $t('trash.openTrashSettings') }}
          </NcButton>
        </div>

        <div v-else-if="!trashEvents.length" class="flex-1 flex flex-col items-center justify-center gap-2">
          <div class="w-14 h-14 rounded-full bg-nc-bg-gray-light flex items-center justify-center">
            <GeneralIcon icon="ncTrash2" class="w-7 h-7 text-nc-content-gray-muted" />
          </div>
          <div class="text-sm font-medium text-nc-content-gray-subtle">{{ $t('trash.noDeletedRecords') }}</div>
          <div class="text-captionSm text-nc-content-gray-muted">{{ $t('trash.deletedRecordsWillAppearHere') }}</div>
        </div>

        <template v-else>
          <div>
            <div
              v-for="event in trashEvents"
              :key="event.id"
              class="nc-trash-event-row flex items-start gap-3 px-6 py-3.5 hover:bg-nc-bg-gray-extralight transition-colors"
              :data-testid="`nc-trash-event-${event.id}`"
            >
              <NcTooltip
                placement="bottom"
                color="light"
                :disabled="!event.email && !event.fk_user_id"
                overlay-class-name="nc-tooltip-trash-user"
              >
                <template #title>
                  <div class="flex items-center gap-2.5 py-1 pr-1">
                    <div
                      class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                      :class="avatarColor(event)"
                    >
                      {{ userInitial(event) }}
                    </div>
                    <div class="flex flex-col min-w-0 text-left">
                      <div class="text-bodySm font-semibold text-nc-content-gray-emphasis truncate">
                        {{ userDisplayName(event) || $t('trash.deletedBy') }}
                      </div>
                      <div v-if="event.email" class="text-captionSm text-nc-content-gray-muted truncate">
                        {{ event.email }}
                      </div>
                    </div>
                  </div>
                </template>
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-captionSm font-semibold shrink-0 mt-0.5 cursor-default"
                  :class="avatarColor(event)"
                >
                  {{ userInitial(event) }}
                </div>
              </NcTooltip>

              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <span class="text-bodyDefault font-semibold text-nc-content-gray-emphasis">
                    {{ eventTitle(event) }}
                  </span>
                  <NcTooltip placement="top" :disabled="!absoluteDate(event.created_at)">
                    <template #title>{{ absoluteDate(event.created_at) }}</template>
                    <span class="text-captionSm text-nc-content-gray-muted cursor-default">
                      {{ formatDate(event.created_at) }}
                    </span>
                  </NcTooltip>
                </div>
                <div v-if="event.preview_rows.length" class="flex flex-wrap gap-1.5 mt-2 items-center">
                  <span
                    v-for="(r, i) in visiblePreviewRows(event)"
                    :key="i"
                    class="px-2 py-0.5 rounded bg-nc-bg-gray-light text-nc-content-gray text-captionSm max-w-60 truncate"
                    :title="pvText(r)"
                  >
                    {{ pvText(r) || $t('trash.unnamedRecord') }}
                  </span>
                  <span
                    v-if="isExpanded(event) && event.row_count > event.preview_rows.length"
                    class="text-captionSm text-nc-content-gray-muted px-1 shrink-0"
                  >
                    {{ $t('trash.andNMore', { count: event.row_count - event.preview_rows.length }) }}
                  </span>
                  <button
                    v-if="event.row_count > MAX_CHIPS"
                    v-e="['c:trash:event:toggle-expand']"
                    type="button"
                    class="text-captionSm text-nc-content-brand hover:underline px-1 shrink-0"
                    @click="toggleExpand(event)"
                  >
                    {{ isExpanded(event) ? $t('trash.showLess') : $t('trash.showAll') }}
                  </button>
                </div>
              </div>

              <NcButton
                v-e="['c:trash:restore:event']"
                size="small"
                type="text"
                class="!text-nc-content-brand !px-2 shrink-0"
                :data-testid="`nc-trash-restore-event-${event.id}`"
                @click="restoreEvent(event.id)"
              >
                {{ $t('trash.restore') }}
              </NcButton>
            </div>
          </div>

          <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
            <GeneralLoader size="medium" />
          </div>
        </template>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-record-trash {
  .nc-modal {
    @apply !p-0 !flex !flex-col;
    height: min(calc(100vh - 100px), 720px);
    max-height: min(calc(100vh - 100px), 720px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0 shrink-0;
  }
}

.nc-tooltip-trash-user {
  .ant-tooltip-inner {
    @apply !bg-white !text-nc-content-gray !rounded-lg !p-3 !shadow-lg;
    min-width: 200px;
    max-width: 320px;
  }
  .ant-tooltip-arrow-content {
    @apply !bg-white;
  }
}

.nc-trash-empty-btn {
  &:hover:not(:disabled) {
    @apply !text-nc-content-red-dark !border-nc-border-red !bg-nc-bg-red-light;
  }
}

.nc-trash-event-row {
  position: relative;
}
.nc-trash-event-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 1.5rem;
  right: 1.5rem;
  bottom: 0;
  height: 1px;
  background: var(--nc-border-gray-medium);
  pointer-events: none;
}
</style>
