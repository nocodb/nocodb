<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

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
  trashItems,
  totalRows,
  currentPage,
  pageSize,
  retentionDays,
  close,
  loadTrash,
  restoreItem,
  permanentDeleteItem,
  emptyTrash,
} = useBaseTrash()

const { t } = useI18n()

const { showWarningModal } = useNcConfirmModal()

const { basesUser } = storeToRefs(useBases())

const baseUsers = computed(() => {
  const projectId = trashItems.value?.[0]?.base_id
  return projectId ? basesUser.value.get(projectId) || [] : []
})

function getDeleter(userId?: string | null) {
  if (!userId) return undefined
  return baseUsers.value.find((u: any) => u.id === userId)
}

function deleterDisplayName(userId?: string | null) {
  const u = getDeleter(userId)
  if (!u) return ''
  return u.display_name || extractNameFromEmail(u.email) || ''
}

function deleterInitial(userId?: string | null) {
  const name = deleterDisplayName(userId)
  return (name || '?').charAt(0).toUpperCase()
}

function avatarColor(userId?: string | null) {
  const key = userId || '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

const viewTypeIcons: Record<number, string> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.CALENDAR]: 'calendar',
  [ViewTypes.MAP]: 'map',
}

const viewTypeLabels: Record<number, string> = {
  [ViewTypes.GRID]: t('objects.viewType.grid'),
  [ViewTypes.FORM]: t('objects.viewType.form'),
  [ViewTypes.GALLERY]: t('objects.viewType.gallery'),
  [ViewTypes.KANBAN]: t('objects.viewType.kanban'),
  [ViewTypes.CALENDAR]: t('objects.viewType.calendar'),
  [ViewTypes.MAP]: t('objects.viewType.map'),
}

const resourceTypeIcons: Record<string, string> = {
  table: 'ncTable',
  view: 'ncGrid',
  field: 'ncColumns',
  dashboard: 'dashboards',
  widget: 'dashboards',
  workflow: 'ncAutomation',
  script: 'ncScript',
  extension: 'puzzle',
}

function getResourceIcon(item: any): string {
  const meta = item.meta
  if (item.resource_type === 'view' && meta?.viewType != null) {
    return viewTypeIcons[meta.viewType] || 'grid'
  }
  if (item.resource_type === 'field' && meta?.uidt) {
    return 'ncColumns'
  }
  return resourceTypeIcons[item.resource_type] || 'ncFile'
}

function resourceTypeLabel(type?: string, meta?: any) {
  if (!type) return ''

  if (type === 'view' && meta?.viewType != null) {
    return viewTypeLabels[meta.viewType] || t('objects.view')
  }

  const labels: Record<string, string> = {
    table: t('objects.table'),
    view: t('objects.view'),
    field: t('objects.field'),
    dashboard: t('objects.dashboard'),
    widget: t('objects.widget'),
    workflow: t('objects.workflow'),
    script: t('objects.script'),
    extension: t('objects.extension'),
  }

  return labels[type] || type
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
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

function absoluteDate(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function handlePermanentDelete(trashId: string, name?: string) {
  showWarningModal({
    title: t('general.permanentDelete'),
    content: t('baseTrash.confirmPermanentDelete', { name: name || t('general.item') }),
    okCallback: async () => {
      await permanentDeleteItem(trashId)
    },
  })
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

function handlePageChange(page: number) {
  loadTrash(page)
}
</script>

<template>
  <NcModal v-model:visible="isOpen" :show-separator="false" size="lg" wrap-class-name="nc-modal-base-trash">
    <template #header>
      <div class="flex w-full items-start px-6 pt-5 pb-4 justify-between gap-4 border-b-1 border-nc-border-gray-medium">
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <div class="text-nc-content-gray-emphasis font-semibold text-xl truncate">
            {{ $t('baseTrash.title') }}
          </div>
          <div class="text-nc-content-gray-subtle2 text-bodySm">
            {{ $t('baseTrash.autoExpiry', { days: retentionDays }) }}
          </div>
        </div>
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

        <template v-else>
          <div>
            <div
              v-for="item in trashItems"
              :key="item.id"
              class="nc-base-trash-item flex items-start gap-3 px-6 py-3.5 hover:bg-nc-bg-gray-extralight transition-colors"
              :data-testid="`nc-base-trash-item-${item.id}`"
            >
              <NcTooltip
                placement="bottom"
                color="light"
                :disabled="!item.deleted_by"
                overlay-class-name="nc-tooltip-base-trash-user"
              >
                <template #title>
                  <div class="flex items-center gap-2.5 py-1 pr-1">
                    <div
                      class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                      :class="avatarColor(item.deleted_by)"
                    >
                      {{ deleterInitial(item.deleted_by) }}
                    </div>
                    <div class="flex flex-col min-w-0 text-left">
                      <div class="text-bodySm font-semibold text-nc-content-gray-emphasis truncate">
                        {{ deleterDisplayName(item.deleted_by) || $t('trash.deletedBy') }}
                      </div>
                      <div
                        v-if="getDeleter(item.deleted_by)?.email"
                        class="text-captionSm text-nc-content-gray-muted truncate"
                      >
                        {{ getDeleter(item.deleted_by)?.email }}
                      </div>
                    </div>
                  </div>
                </template>
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-captionSm font-semibold shrink-0 mt-0.5 cursor-default"
                  :class="avatarColor(item.deleted_by)"
                >
                  {{ deleterInitial(item.deleted_by) }}
                </div>
              </NcTooltip>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <div class="w-5 h-5 flex items-center justify-center shrink-0 text-nc-content-gray-subtle">
                    <GeneralIcon :icon="getResourceIcon(item)" class="w-4 h-4" />
                  </div>
                  <NcTooltip
                    show-on-truncate-only
                    class="truncate max-w-80 text-bodyDefault font-semibold text-nc-content-gray-emphasis"
                  >
                    {{ item.name }}
                  </NcTooltip>
                  <span class="text-captionSm text-nc-content-gray-muted bg-nc-bg-gray-light rounded px-1.5 py-0.5 shrink-0">
                    {{ resourceTypeLabel(item.resource_type, item.meta) }}
                  </span>
                  <NcTooltip placement="top" :disabled="!absoluteDate(item.deleted_at)">
                    <template #title>{{ absoluteDate(item.deleted_at) }}</template>
                    <span class="text-captionSm text-nc-content-gray-muted cursor-default">
                      {{ formatDate(item.deleted_at) }}
                    </span>
                  </NcTooltip>
                </div>
                <div v-if="item.parent_name" class="text-captionSm text-nc-content-gray-muted mt-1 truncate">
                  {{ item.parent_name }}
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0" @click.stop>
                <NcTooltip :disabled="item.is_restorable !== false">
                  <template #title>
                    {{ $t('baseTrash.restoreParentFirst', { parent: item.parent_name || item.parent_type }) }}
                  </template>
                  <NcButton
                    v-e="['c:base-trash:restore']"
                    size="small"
                    type="text"
                    class="!text-nc-content-brand !px-2"
                    :disabled="item.is_restorable === false"
                    :data-testid="`nc-base-trash-restore-btn-${item.id}`"
                    @click="restoreItem(item.id!)"
                  >
                    {{ $t('trash.restore') }}
                  </NcButton>
                </NcTooltip>
                <NcButton
                  v-e="['c:base-trash:permanent-delete']"
                  size="small"
                  type="text"
                  class="!text-nc-content-red-dark !px-2"
                  :data-testid="`nc-base-trash-delete-btn-${item.id}`"
                  @click="handlePermanentDelete(item.id!, item.name)"
                >
                  <GeneralIcon icon="ncTrash" class="h-4 w-4" />
                </NcButton>
              </div>
            </div>
          </div>
        </template>
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
          @update:current="handlePageChange"
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

.nc-tooltip-base-trash-user {
  .ant-tooltip-inner {
    @apply !bg-white !text-nc-content-gray !rounded-lg !p-3 !shadow-lg;
    min-width: 200px;
    max-width: 320px;
  }
  .ant-tooltip-arrow-content {
    @apply !bg-white;
  }
}

.nc-base-trash-empty-btn {
  &:hover:not(:disabled) {
    @apply !text-nc-content-red-dark !border-nc-border-red !bg-nc-bg-red-light;
  }
}

.nc-base-trash-item {
  position: relative;
}
.nc-base-trash-item:not(:last-child)::after {
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
