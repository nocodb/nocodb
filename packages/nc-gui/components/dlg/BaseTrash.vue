<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

const {
  isOpen,
  isLoading,
  trashItems,
  totalRows,
  currentPage,
  pageSize,
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
  const projectId = useBaseTrash().trashItems.value?.[0]?.base_id
  return projectId ? basesUser.value.get(projectId) || [] : []
})

function getDeletedByName(userId?: string) {
  if (!userId) return ''
  const user = baseUsers.value.find((u: any) => u.id === userId)
  return user?.display_name || user?.email || ''
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

function handlePermanentDelete(trashId: string, name?: string) {
  showWarningModal({
    title: t('general.permanentDelete'),
    content: t('trash.confirmPermanentDelete', { name: name || t('general.item') }),
    okCallback: async () => {
      await permanentDeleteItem(trashId)
    },
  })
}

function handleEmptyTrash() {
  showWarningModal({
    title: t('general.emptyTrash'),
    content: t('trash.confirmEmpty'),
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
  <NcModal v-model:visible="isOpen" :show-separator="true" size="lg" wrap-class-name="nc-modal-base-trash">
    <template #header>
      <div class="flex w-full items-center px-4 py-2 justify-between">
        <div class="flex items-center gap-3 flex-1">
          <GeneralIcon icon="ncTrash" class="text-nc-content-gray-emphasis h-5 w-5" />
          <span class="text-nc-content-gray-emphasis font-semibold text-xl">
            {{ $t('title.trash') }}
          </span>
        </div>
        <div class="flex justify-end items-center gap-3 flex-1">
          <NcButton type="text" size="small" data-testid="nc-base-trash-close-btn" @click="close">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="flex flex-col h-[calc(100%_-_66px)] overflow-hidden">
      <!-- Toolbar -->
      <div
        class="flex items-center justify-between h-11 px-4 border-b-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight shrink-0"
      >
        <span class="text-captionSm text-nc-content-gray-muted">
          {{ $t('trash.autoExpiry') }}
        </span>
        <NcButton
          v-if="trashItems.length"
          v-e="['c:base-trash:empty']"
          size="small"
          type="text"
          class="!text-nc-content-red-dark"
          data-testid="nc-base-trash-empty-btn"
          @click="handleEmptyTrash"
        >
          {{ $t('general.emptyTrash') }}
        </NcButton>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-auto nc-scrollbar-thin min-h-0">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <GeneralLoader size="large" />
        </div>

        <!-- Empty -->
        <div v-else-if="!trashItems.length" class="flex flex-col items-center justify-center h-full gap-2">
          <div class="w-14 h-14 rounded-full bg-nc-bg-gray-light flex items-center justify-center">
            <GeneralIcon icon="ncTrash" class="w-7 h-7 text-nc-content-gray-muted" />
          </div>
          <div class="text-sm font-medium text-nc-content-gray-subtle">{{ $t('msg.info.trashEmpty') }}</div>
        </div>

        <!-- Items -->
        <template v-else>
          <div
            v-for="item in trashItems"
            :key="item.id"
            class="nc-base-trash-item group border-b-1 border-nc-border-gray-medium hover:bg-nc-bg-gray-extralight"
            :data-testid="`nc-base-trash-item-${item.id}`"
          >
            <div class="flex items-center gap-3 px-4 py-3">
              <!-- Icon -->
              <div class="w-8 h-8 rounded-md bg-nc-bg-gray-light flex items-center justify-center shrink-0">
                <GeneralIcon :icon="getResourceIcon(item)" class="w-4 h-4 text-nc-content-gray-subtle" />
              </div>

              <!-- Content -->
              <div class="flex-1 flex flex-col gap-1 overflow-hidden min-w-0">
                <div class="flex items-center gap-2">
                  <NcTooltip show-on-truncate-only class="truncate max-w-60 font-semibold text-sm text-nc-content-gray-emphasis">
                    {{ item.name }}
                  </NcTooltip>
                  <span class="text-captionSm text-nc-content-gray-muted bg-nc-bg-gray-light rounded px-1.5 py-0.5">
                    {{ resourceTypeLabel(item.resource_type, item.meta) }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-captionSm text-nc-content-gray-muted">
                  <span v-if="item.parent_name">{{ item.parent_name }}</span>
                  <span v-if="item.parent_name && item.deleted_at">&middot;</span>
                  <span v-if="item.deleted_at">{{ timeAgo(item.deleted_at) }}</span>
                  <template v-if="getDeletedByName(item.deleted_by)">
                    <span>&middot;</span>
                    <span>{{ getDeletedByName(item.deleted_by) }}</span>
                  </template>
                </div>
              </div>

              <!-- Actions -->
              <div
                class="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                @click.stop
              >
                <NcTooltip :disabled="item.is_restorable !== false">
                  <template #title>
                    {{ $t('trash.restoreParentFirst', { parent: item.parent_name || item.parent_type }) }}
                  </template>
                  <NcButton
                    v-e="['c:base-trash:restore']"
                    size="small"
                    type="secondary"
                    :disabled="item.is_restorable === false"
                    :data-testid="`nc-base-trash-restore-btn-${item.id}`"
                    @click="restoreItem(item.id!)"
                  >
                    {{ $t('general.restore') }}
                  </NcButton>
                </NcTooltip>
                <NcButton
                  v-e="['c:base-trash:permanent-delete']"
                  size="small"
                  type="text"
                  class="!text-nc-content-red-dark"
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

      <!-- Pagination -->
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

<style lang="scss" scoped>
.nc-base-trash-item:last-child {
  @apply border-b-0;
}
</style>

<style lang="scss">
.nc-modal-base-trash {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 860px);
    max-height: min(calc(100vh - 100px), 860px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>
