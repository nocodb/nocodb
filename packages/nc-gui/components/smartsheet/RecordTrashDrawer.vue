<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  isLoading: boolean
  deletedRecords: Record<string, any>[]
  trashCount: number
  pageSize: number
  totalCount: number
  pkColumn: string
  pvColumn?: ColumnType
  deletedAtColumn: string | null
  deletedByColumn: string | null
  deletedByColumnObj?: ColumnType | null
  previewColumns: ColumnType[]
  retentionDays: number
}

const props = defineProps<Props>()

const isOpen = defineModel<boolean>('isOpen', { required: true })

const currentPage = defineModel<number>('currentPage', { required: true })

const selectedRowIds = defineModel<string[]>('selectedRowIds', { required: true })

const emits = defineEmits<{
  loadDeletedRecords: []
  loadTrashCount: []
  restoreRecords: [rowIds: string[]]
  permanentDeleteRecords: [rowIds: string[]]
  emptyTrash: []
}>()

const { t } = useI18n()

const { showWarningModal } = useNcConfirmModal()

function getRowId(record: Record<string, any>) {
  return String(record[props.pkColumn] ?? '')
}

function getPvValue(record: Record<string, any>) {
  if (props.pvColumn) return record[props.pvColumn.title!]
  const first = props.previewColumns[0]
  return first ? record[first.title!] : getRowId(record)
}

function getDeletedAt(record: Record<string, any>) {
  return props.deletedAtColumn ? record[props.deletedAtColumn] : ''
}

function getDeletedBy(record: Record<string, any>) {
  return props.deletedByColumn ? record[props.deletedByColumn] : ''
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('trash.justNow')
  if (diffMins < 60) return t('trash.minutesAgo', { count: diffMins })
  if (diffHours < 24) return t('trash.hoursAgo', { count: diffHours })
  if (diffDays < 7) return t('trash.daysAgo', { count: diffDays })
  return dayjs(d).format('YYYY-MM-DD')
}

function isSelected(record: Record<string, any>) {
  return selectedRowIds.value.includes(getRowId(record))
}

function toggleSelect(record: Record<string, any>) {
  const id = getRowId(record)
  if (selectedRowIds.value.includes(id)) {
    selectedRowIds.value = selectedRowIds.value.filter((r) => r !== id)
  } else {
    selectedRowIds.value = [...selectedRowIds.value, id]
  }
}

function toggleSelectAll() {
  if (selectedRowIds.value.length === props.deletedRecords.length) {
    selectedRowIds.value = []
  } else {
    selectedRowIds.value = props.deletedRecords.map(getRowId)
  }
}

function handleEmptyTrash() {
  showWarningModal({
    title: t('trash.emptyTrash'),
    content: t('trash.confirmEmpty'),
    okCallback: async () => {
      emits('emptyTrash')
    },
  })
}

function handlePermanentDelete(rowIds: string[]) {
  showWarningModal({
    title: t('trash.deleteForever'),
    content: t('trash.confirmDeleteForever', { count: rowIds.length }),
    okCallback: async () => {
      emits('permanentDeleteRecords', rowIds)
    },
  })
}

function handlePageChange(page: number) {
  currentPage.value = page
  selectedRowIds.value = []
  emits('loadDeletedRecords')
}

watch(isOpen, (val) => {
  if (val) {
    currentPage.value = 1
    selectedRowIds.value = []
    emits('loadDeletedRecords')
  }
})
</script>

<template>
  <NcModal
    v-model:visible="isOpen"
    :show-separator="true"
    size="lg"
    wrap-class-name="nc-modal-record-trash"
  >
    <template #header>
      <div class="flex w-full items-center px-4 py-2 justify-between">
        <div class="flex items-center gap-3 flex-1">
          <GeneralIcon icon="ncTrash" class="text-nc-content-gray-emphasis h-5 w-5" />
          <span class="text-nc-content-gray-emphasis font-semibold text-xl">
            {{ $t('trash.title') }}
          </span>
          <NcBadge v-if="trashCount > 0" color-scheme="red" size="sm">{{ trashCount }}</NcBadge>
        </div>
        <div class="flex justify-end items-center gap-3 flex-1">
          <NcButton type="text" size="small" data-testid="nc-trash-close-btn" @click="isOpen = false">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="flex flex-col h-[calc(100%_-_66px)] overflow-hidden">
      <!-- Toolbar -->
      <div class="flex items-center justify-between h-11 px-4 border-b-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight shrink-0">
        <div class="flex items-center gap-3">
          <NcCheckbox
            v-if="deletedRecords.length"
            :checked="selectedRowIds.length === deletedRecords.length && deletedRecords.length > 0"
            :indeterminate="selectedRowIds.length > 0 && selectedRowIds.length < deletedRecords.length"
            data-testid="nc-trash-select-all"
            @update:checked="toggleSelectAll"
          />
          <span v-if="selectedRowIds.length" class="text-bodySm text-nc-content-gray-emphasis font-medium">
            {{ $t('trash.selectedRecords', { count: selectedRowIds.length }, selectedRowIds.length) }}
          </span>
          <span v-else class="text-captionSm text-nc-content-gray-muted">
            {{ $t('trash.autoExpiry', { days: retentionDays }) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <template v-if="selectedRowIds.length">
            <NcButton v-e="['c:trash:restore:bulk']" size="small" type="secondary" data-testid="nc-trash-restore-selected-btn" @click="() => emits('restoreRecords', selectedRowIds)">
              {{ $t('trash.restore') }}
            </NcButton>
            <NcButton v-e="['c:trash:permanent-delete:bulk']" size="small" type="danger" data-testid="nc-trash-delete-selected-btn" @click="() => handlePermanentDelete(selectedRowIds)">
              {{ $t('trash.deleteForever') }}
            </NcButton>
          </template>
          <NcButton
            v-else-if="deletedRecords.length"
            v-e="['c:trash:empty']"
            size="small"
            type="text"
            class="!text-nc-content-red-dark"
            data-testid="nc-trash-empty-btn"
            @click="handleEmptyTrash"
          >
            {{ $t('trash.emptyTrash') }}
          </NcButton>
        </div>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-auto nc-scrollbar-thin min-h-0">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <GeneralLoader size="large" />
        </div>

        <!-- Empty -->
        <div v-else-if="!deletedRecords.length" class="flex flex-col items-center justify-center h-full gap-2">
          <div class="w-14 h-14 rounded-full bg-nc-bg-gray-light flex items-center justify-center">
            <GeneralIcon icon="ncTrash" class="w-7 h-7 text-nc-content-gray-muted" />
          </div>
          <div class="text-sm font-medium text-nc-content-gray-subtle">{{ $t('trash.noDeletedRecords') }}</div>
          <div class="text-captionSm text-nc-content-gray-muted">{{ $t('trash.deletedRecordsWillAppearHere') }}</div>
        </div>

        <!-- Records -->
        <template v-else>
          <div
            v-for="record in deletedRecords"
            :key="getRowId(record)"
            class="nc-trash-item-wrapper group border-b-1 border-nc-border-gray-medium cursor-pointer"
            :class="isSelected(record) ? 'bg-nc-bg-brand-soft' : 'hover:bg-nc-bg-gray-extralight'"
            :data-testid="`nc-trash-row-${getRowId(record)}`"
            @click="toggleSelect(record)"
          >
            <div class="flex items-center gap-3 px-4 py-3">
              <NcCheckbox
                :checked="isSelected(record)"
                @click.stop
                @update:checked="toggleSelect(record)"
              />

              <!-- Record content -->
              <div class="flex-1 flex flex-col gap-1.5 justify-center overflow-hidden min-w-0">
                <div class="font-semibold text-nc-content-brand text-sm leading-5 truncate">
                  <SmartsheetPlainCell
                    v-if="pvColumn && record[pvColumn.title!] != null"
                    :column="pvColumn"
                    :model-value="record[pvColumn.title!]"
                  />
                  <span v-else>{{ getPvValue(record) || '—' }}</span>
                </div>
                <div v-if="previewColumns.length" class="flex items-center gap-4">
                  <div v-for="col in previewColumns" :key="col.title" class="w-1/6 max-w-32 overflow-hidden">
                    <SmartsheetPlainCell
                      v-if="record[col.title!] != null"
                      :column="col"
                      :model-value="record[col.title!]"
                      class="text-nc-content-gray-subtle2 text-small truncate"
                      show-tooltip
                    />
                    <span v-else class="text-nc-content-gray-muted text-small">-</span>
                  </div>
                </div>
              </div>

              <!-- Actions (hover or selected) -->
              <div
                class="flex items-center gap-2 shrink-0"
                :class="isSelected(record) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity duration-150'"
                @click.stop
              >
                <NcButton
                  v-e="['c:trash:restore:single']"
                  size="small"
                  type="secondary"
                  :data-testid="`nc-trash-restore-btn-${getRowId(record)}`"
                  @click="() => emits('restoreRecords', [getRowId(record)])"
                >
                  {{ $t('trash.restore') }}
                </NcButton>
                <NcButton
                  v-e="['c:trash:permanent-delete:single']"
                  size="small"
                  type="text"
                  class="!text-nc-content-red-dark"
                  :data-testid="`nc-trash-delete-btn-${getRowId(record)}`"
                  @click="() => handlePermanentDelete([getRowId(record)])"
                >
                  <GeneralIcon icon="ncTrash" class="h-4 w-4" />
                </NcButton>
              </div>

              <!-- Deleted metadata (always visible, at end) -->
              <div class="flex flex-col items-end shrink-0 gap-1.5 min-w-28">
                <span v-if="getDeletedAt(record)" class="text-captionSm text-nc-content-gray-muted whitespace-nowrap">
                  {{ formatDate(getDeletedAt(record)) }}
                </span>
                <div v-if="deletedByColumn && deletedByColumnObj && getDeletedBy(record)" class="text-captionSm text-nc-content-gray-subtle2 whitespace-nowrap flex items-center gap-1">
                  <span>{{ $t('trash.deletedBy') }}</span>
                  <SmartsheetPlainCell
                    :column="deletedByColumnObj"
                    :model-value="getDeletedBy(record)"
                    class="truncate max-w-24"
                    show-tooltip
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalCount > pageSize"
        class="flex items-center justify-center h-11 border-t-1 border-nc-border-gray-medium shrink-0"
      >
        <NcPagination
          v-e="['c:trash:paginate']"
          :current="currentPage"
          :total="totalCount"
          :page-size="pageSize"
          data-testid="nc-trash-pagination"
          @update:current="handlePageChange"
        />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-trash-item-wrapper:last-child {
  @apply border-b-0;
}
</style>

<style lang="scss">
.nc-modal-record-trash {
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
