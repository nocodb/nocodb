<script lang="ts" setup>
import { viewTypeAlias, ViewTypes, type TableType } from 'nocodb-sdk'

const { $e } = useNuxtApp()

const { isFeatureEnabled } = useBetaFeatureToggle()

const isVisibleCreateNew = ref(false)

const baseCreateDlg = ref(false)

const { openedProject } = storeToRefs(useBases())
const { base, isSharedBase } = storeToRefs(useBase())

const tablesStore = useTablesStore()
const { openTableCreateDialog: _openTableCreateDialog } = tablesStore
const { activeTable } = storeToRefs(tablesStore)

const { openNewScriptModal } = useAutomationStore()

const viewsStore = useViewsStore()
const { loadViews, onOpenViewCreateModal } = viewsStore
const { activeView } = storeToRefs(viewsStore)

const isViewListLoading = ref(false)
const toBeCreateType = ref<ViewTypes | 'AI'>()

const isSqlView = computed(() => (activeTable.value as TableType)?.type === 'view')

const activeSource = computed(() => {
  return base.value.sources?.find((s) => s.id === activeView.value?.source_id)
})

async function onOpenModal({
  title = '',
  type,
  copyViewId,
  groupingFieldColumnId,
  calendarRange,
  coverImageColumnId,
}: {
  title?: string
  type: ViewTypes | 'AI'
  copyViewId?: string
  groupingFieldColumnId?: string
  calendarRange?: Array<{
    fk_from_column_id: string
    fk_to_column_id: string | null // for ee only
  }>
  coverImageColumnId?: string
}) {
  if (isViewListLoading.value) return

  $e('c:view:create:mini-sidebar', { view: type === 'AI' ? type : viewTypeAlias[type] })

  toBeCreateType.value = type

  isViewListLoading.value = true
  await loadViews({
    tableId: activeTable.value.id!,
  })

  isVisibleCreateNew.value = false
  isViewListLoading.value = false

  onOpenViewCreateModal({
    title,
    type,
    copyViewId,
    groupingFieldColumnId,
    calendarRange,
    coverImageColumnId,
    baseId: base.value.id!,
    tableId: activeTable.value.id!,
  })
}

function openTableCreateDialog() {
  let sourceId = base.value!.sources?.[0].id

  _openTableCreateDialog({
    baseId: base.value?.id,
    sourceId: sourceId,
  })
}
</script>

<template>
  <div v-if="!isSharedBase" class="nc-mini-sidebar-btn-full-width">
    <NcDropdown v-model:visible="isVisibleCreateNew" :overlay-class-name="`!min-w-48 !left-2`">
      <div class="w-full h-full flex items-center justify-center">
        <div
          class="border-1 w-7 h-7 flex-none rounded-full overflow-hidden transition-all duration-300 flex items-center justify-center bg-nc-bg-gray-medium"
          :class="{
            'border-nc-gray-medium': !isVisibleCreateNew,
            'active border-primary shadow-selected': isVisibleCreateNew,
          }"
        >
          <GeneralIcon icon="ncPlus" />
        </div>
      </div>

      <template #overlay>
        <NcMenu variant="small" @click="isVisibleCreateNew = false">
          <NcMenuItemLabel>
            <span class="normal-case">
              {{ $t('labels.createNew') }}
            </span>
          </NcMenuItemLabel>
          <NcMenuItem data-testid="mini-sidebar-base-create" @click="baseCreateDlg = true">
            <GeneralIcon icon="ncBaseOutline" class="h-4 w-4" />
            {{ $t('objects.project') }}
          </NcMenuItem>
          <NcTooltip
            title="Navigate to a base to a create table"
            :disabled="!!openedProject"
            placement="right"
            @click="openTableCreateDialog"
          >
            <NcMenuItem data-testid="mini-sidebar-table-create" :disabled="!openedProject">
              <GeneralIcon icon="table" />
              {{ $t('objects.table') }}
            </NcMenuItem>
          </NcTooltip>
          <NcTooltip title="Navigate to a table to a create view" :disabled="!(!base || !activeTable)" placement="right">
            <NcSubMenu class="py-0" data-testid="mini-sidebar-view-create" variant="small" :disabled="!base || !activeTable">
              <template #title>
                <GeneralIcon icon="grid" />
                {{ $t('objects.view') }}
              </template>
              <NcMenuItem @click.stop="onOpenModal({ type: ViewTypes.GRID })" data-testid="mini-sidebar-view-create-grid">
                <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" />
                <div>{{ $t('objects.viewType.grid') }}</div>
              </NcMenuItem>
              <NcTooltip :title="$t('tooltip.sourceDataIsReadonly')" :disabled="!activeSource?.is_data_readonly && !isSqlView">
                <NcMenuItem
                  :disabled="!!activeSource?.is_data_readonly || isSqlView"
                  @click="onOpenModal({ type: ViewTypes.FORM })"
                  data-testid="mini-sidebar-view-create-form"
                >
                  <GeneralViewIcon
                    :meta="{ type: ViewTypes.FORM }"
                    :class="{
                      'opacity-50': !!activeSource?.is_data_readonly || isSqlView,
                    }"
                  />
                  <div>{{ $t('objects.viewType.form') }}</div>
                </NcMenuItem>
              </NcTooltip>
              <NcMenuItem @click="onOpenModal({ type: ViewTypes.GALLERY })" data-testid="mini-sidebar-view-create-gallery">
                <GeneralViewIcon :meta="{ type: ViewTypes.GALLERY }" />
                <div>{{ $t('objects.viewType.gallery') }}</div>
              </NcMenuItem>
              <NcMenuItem data-testid="mini-sidebar-view-create-kanban" @click="onOpenModal({ type: ViewTypes.KANBAN })">
                <GeneralViewIcon :meta="{ type: ViewTypes.KANBAN }" />
                <div>{{ $t('objects.viewType.kanban') }}</div>
              </NcMenuItem>
              <NcMenuItem data-testid="mini-sidebar-view-create-calendar" @click="onOpenModal({ type: ViewTypes.CALENDAR })">
                <GeneralViewIcon :meta="{ type: ViewTypes.CALENDAR }" class="!w-4 !h-4" />
                <div>{{ $t('objects.viewType.calendar') }}</div>
              </NcMenuItem>
              <template v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)">
                <NcDivider />
                <NcMenuItem data-testid="mini-sidebar-view-create-ai" @click="onOpenModal({ type: 'AI' })">
                  <GeneralIcon icon="ncAutoAwesome" class="!w-4 !h-4 text-nc-fill-purple-dark" />
                  <div>{{ $t('labels.aiSuggested') }}</div>
                </NcMenuItem>
              </template>
            </NcSubMenu>
          </NcTooltip>

          <NcDivider />
          <NcTooltip
            title="Navigate to a base to a create automation"
            :disabled="!!openedProject"
            placement="right"
            @click="openNewScriptModal({ baseId: openedProject?.id })"
          >
            <NcMenuItem data-testid="mini-sidebar--script-create" :disabled="!openedProject">
              <GeneralIcon icon="ncPlay" />
              {{ $t('general.automation') }}
            </NcMenuItem>
          </NcTooltip>
          <NcDivider />
          <NcTooltip title="Navigate to a view to a create record" :disabled="!!activeView" placement="right">
            <NcMenuItem data-testid="mini-sidebar-record-create" :disabled="!activeView" class="capitalize">
              <GeneralIcon icon="ncPlus" />
              {{ $t('objects.record') }}
            </NcMenuItem>
          </NcTooltip>
        </NcMenu>
      </template>
    </NcDropdown>
    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
  </div>
</template>
