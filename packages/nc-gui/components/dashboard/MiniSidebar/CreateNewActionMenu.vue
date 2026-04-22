<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles, type TableType, ViewTypes, viewTypeAlias } from 'nocodb-sdk'

const { $e } = useNuxtApp()

const { isUIAllowed, orgRoles, workspaceRoles } = useRoles()

const { openedProject } = storeToRefs(useBases())

const { base, isSharedBase } = storeToRefs(useBase())

const tablesStore = useTablesStore()
const { openTableCreateDialog: _openTableCreateDialog } = tablesStore
const { activeTable } = storeToRefs(tablesStore)

const { openNewScriptModal } = useScriptStore()

const { openNewWorkflowModal } = useWorkflowStore()

const { openNewDashboardModal } = useDashboardStore()

const { createDocument } = useDocumentsStore()

const viewsStore = useViewsStore()
const { loadViews, onOpenViewCreateModal } = viewsStore
const { activeView, isListViewEnabled } = storeToRefs(viewsStore)
const { showUpgradeToUseListView } = viewsStore

const { isAiFeaturesEnabled } = useNocoAi()

const { isEEFeatureBlocked, showEEFeatures, showUpgradeToUseTimelineView, blockListView, blockTimelineView, blockDocs } =
  useEeConfig()

const { activeSidebarTab } = storeToRefs(useSidebarStore())

const isDataTab = computed(() => activeSidebarTab.value === 'data')

const isWorkflowsTab = computed(() => activeSidebarTab.value === 'workflows')

const isVisibleCreateNew = ref(false)

const baseCreateDlg = ref(false)

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
  try {
    await loadViews({
      tableId: activeTable.value?.id as string,
      baseId: base.value.id!,
    })
  } catch (e) {
    console.log('error', e)
  }

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
    sourceId: activeTable.value?.source_id,
  })
}

function openTableCreateDialog() {
  _openTableCreateDialog({
    baseId: base.value?.id,
    sourceId: base.value!.sources?.[0].id,
  })
}

const hasBaseCreateAccess = computed(() => {
  if (isEeUI) {
    return isUIAllowed('baseCreate')
  }

  return isUIAllowed('baseCreate', { roles: workspaceRoles ?? orgRoles })
})

const isBaseHomePage = computed(() => {
  return !!openedProject.value
})

const hasTableCreateAccess = computed(() => {
  if (!base.value || !isBaseHomePage.value) return true

  return isUIAllowed('tableCreate', {
    roles: base.value?.project_role || base.value.workspace_role,
    source: base.value?.sources?.[0],
  })
})

const hasViewCreateAccess = computed(() => {
  if (!base.value || !isBaseHomePage.value) return true

  return isUIAllowed('viewCreateOrEdit')
})

const hasScriptCreateAccess = computed(() => {
  if (!base.value || !isBaseHomePage.value) return true

  return isUIAllowed('scriptCreateOrEdit')
})

const hasWorkflowCreateAccess = computed(() => {
  if (!base.value || !isBaseHomePage.value) return true

  return isUIAllowed('workflowCreateOrEdit')
})

const hasDashboardCreateAccess = computed(() => {
  if (!base.value || !isBaseHomePage.value) return true

  return isUIAllowed('dashboardCreate')
})

const hasDocumentCreateAccess = computed(() => {
  if (!base.value || !isBaseHomePage.value) return true

  return isUIAllowed('documentCreate')
})
</script>

<template>
  <div v-if="!isSharedBase" class="nc-mini-sidebar-btn-full-width">
    <NcDropdown
      v-model:visible="isVisibleCreateNew"
      placement="rightBottom"
      overlay-class-name="!min-w-48 nc-create-new-dropdown"
      :align="{ offset: [12, 3] }"
    >
      <div class="w-full py-1 flex items-center justify-center">
        <div
          class="nc-mini-sidebar-plus-btn border-1 w-7 h-7 flex-none rounded-full overflow-hidden transition-all duration-300 flex items-center justify-center bg-nc-bg-gray-medium cursor-pointer"
          :class="{
            'border-nc-border-gray-dark': !isVisibleCreateNew,
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
          <template v-if="isEeUI && showEEFeatures">
            <NcTooltip
              :title="
                !isWorkflowsTab
                  ? $t('tooltip.switchToWorkflowsTab', { type: $t('general.workflow').toLowerCase() })
                  : !isBaseHomePage
                  ? $t('tooltip.navigateToBaseToCreateWorkflow')
                  : !hasWorkflowCreateAccess
                  ? $t('tooltip.youDontHaveAccessToCreateNewWorkflow')
                  : ''
              "
              :disabled="isWorkflowsTab && isBaseHomePage && hasWorkflowCreateAccess"
              placement="right"
            >
              <NcMenuItem
                data-testid="mini-sidebar--workflow-create"
                :disabled="!isWorkflowsTab || !isBaseHomePage || !hasWorkflowCreateAccess"
                inner-class="w-full"
                @click="openNewWorkflowModal({ baseId: openedProject?.id })"
              >
                <GeneralIcon icon="ncAutomation" />
                <div class="flex-1">
                  {{ $t('general.workflow') }}
                </div>
                <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" show-as-lock remove-click />
              </NcMenuItem>
            </NcTooltip>
            <NcTooltip
              :title="
                !isWorkflowsTab
                  ? $t('tooltip.switchToWorkflowsTab', { type: $t('general.script').toLowerCase() })
                  : !isBaseHomePage
                  ? $t('tooltip.navigateToBaseToCreateScript')
                  : !hasScriptCreateAccess
                  ? $t('tooltip.youDontHaveAccessToCreateNewScript')
                  : ''
              "
              :disabled="isWorkflowsTab && isBaseHomePage && hasScriptCreateAccess"
              placement="right"
            >
              <NcMenuItem
                data-testid="mini-sidebar--script-create"
                :disabled="!isWorkflowsTab || !isBaseHomePage || !hasScriptCreateAccess"
                inner-class="w-full"
                @click="openNewScriptModal({ baseId: openedProject?.id })"
              >
                <GeneralIcon icon="ncScript" />
                <div class="flex-1">
                  {{ $t('general.script') }}
                </div>

                <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" show-as-lock remove-click />
              </NcMenuItem>
            </NcTooltip>
            <NcDivider />
          </template>

          <!-- Data tab items (reads bottom-up: Table → Document → Dashboard → View) -->
          <NcTooltip
            :title="
              !isDataTab
                ? $t('tooltip.switchToDataTab', { type: $t('objects.view').toLowerCase() })
                : !base || !activeTable
                ? $t('tooltip.navigateToTableToCreateView')
                : !hasViewCreateAccess
                ? $t('tooltip.youDontHaveAccessToCreateNewView')
                : ''
            "
            :disabled="isDataTab && !!base && !!activeTable && hasViewCreateAccess"
            placement="right"
          >
            <NcSubMenu
              class="py-0"
              data-testid="mini-sidebar-view-create"
              variant="small"
              :disabled="!isDataTab || !base || !activeTable || !hasViewCreateAccess"
            >
              <template #title>
                <GeneralIcon icon="grid" />
                {{ $t('objects.view') }}
              </template>
              <NcMenuItem data-testid="mini-sidebar-view-create-grid" @click.stop="onOpenModal({ type: ViewTypes.GRID })">
                <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" />
                <div>{{ $t('objects.viewType.grid') }}</div>
              </NcMenuItem>
              <NcTooltip :title="$t('tooltip.sourceDataIsReadonly')" :disabled="!activeSource?.is_data_readonly && !isSqlView">
                <NcMenuItem
                  :disabled="!!activeSource?.is_data_readonly || isSqlView"
                  data-testid="mini-sidebar-view-create-form"
                  @click="onOpenModal({ type: ViewTypes.FORM })"
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
              <NcMenuItem data-testid="mini-sidebar-view-create-gallery" @click="onOpenModal({ type: ViewTypes.GALLERY })">
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
              <NcMenuItem
                v-if="isEeUI && showEEFeatures"
                data-testid="mini-sidebar-view-create-map"
                @click="onOpenModal({ type: ViewTypes.MAP })"
              >
                <GeneralViewIcon :meta="{ type: ViewTypes.MAP }" class="!w-4 !h-4" />
                <div>{{ $t('objects.viewType.map') }}</div>
              </NcMenuItem>
              <NcMenuItem
                v-if="isListViewEnabled"
                data-testid="mini-sidebar-view-create-list"
                inner-class="w-full"
                @click="showUpgradeToUseListView({ successCallback: () => onOpenModal({ type: ViewTypes.LIST }) })"
              >
                <GeneralViewIcon :meta="{ type: ViewTypes.LIST }" />
                <div class="flex-1">{{ $t('objects.viewType.list') }}</div>

                <PaymentUpgradeBadge
                  v-if="blockListView"
                  :feature="PlanFeatureTypes.FEATURE_LIST_VIEW"
                  :plan-title="PlanTitles.BUSINESS"
                  remove-click
                  show-as-lock
                />
              </NcMenuItem>
              <NcMenuItem
                v-if="isEeUI && showEEFeatures"
                data-testid="mini-sidebar-view-create-timeline"
                inner-class="w-full"
                @click="showUpgradeToUseTimelineView({ successCallback: () => onOpenModal({ type: ViewTypes.TIMELINE }) })"
              >
                <GeneralViewIcon :meta="{ type: ViewTypes.TIMELINE }" class="!w-4 !h-4" />
                <div class="flex-1">{{ $t('objects.viewType.timeline') }}</div>

                <PaymentUpgradeBadge
                  v-if="blockTimelineView"
                  :feature="PlanFeatureTypes.FEATURE_TIMELINE_VIEW"
                  :plan-title="PlanTitles.BUSINESS"
                  remove-click
                  show-as-lock
                />
              </NcMenuItem>
              <template v-if="isAiFeaturesEnabled">
                <NcDivider />
                <NcMenuItem data-testid="mini-sidebar-view-create-ai" @click="onOpenModal({ type: 'AI' })">
                  <GeneralIcon icon="ncAutoAwesome" class="!w-4 !h-4 text-nc-fill-purple-dark" />
                  <div>{{ $t('labels.useNocoAI') }}</div>
                </NcMenuItem>
              </template>
            </NcSubMenu>
          </NcTooltip>

          <template v-if="isEeUI && showEEFeatures">
            <NcTooltip
              :title="
                !isDataTab
                  ? $t('tooltip.switchToDataTab', { type: $t('general.dashboard').toLowerCase() })
                  : !isBaseHomePage
                  ? $t('tooltip.navigateToBaseToCreateDashboard')
                  : !hasDashboardCreateAccess
                  ? $t('tooltip.youDontHaveAccessToCreateNewDashboard')
                  : ''
              "
              :disabled="isDataTab && isBaseHomePage && hasDashboardCreateAccess"
              placement="right"
            >
              <NcMenuItem
                data-testid="mini-sidebar--dashboard-create"
                :disabled="!isDataTab || !isBaseHomePage || !hasDashboardCreateAccess"
                inner-class="w-full"
                @click="openNewDashboardModal({ baseId: openedProject?.id })"
              >
                <GeneralIcon icon="dashboards" />

                <div class="flex-1">
                  {{ $t('general.dashboard') }}
                </div>

                <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" show-as-lock remove-click />
              </NcMenuItem>
            </NcTooltip>

            <NcTooltip
              :title="
                !isDataTab
                  ? $t('tooltip.switchToDataTab', { type: $t('objects.document').toLowerCase() })
                  : !isBaseHomePage
                  ? $t('tooltip.navigateToBaseToCreateDocument')
                  : !hasDocumentCreateAccess
                  ? $t('tooltip.youDontHaveAccessToCreateNewDocument')
                  : ''
              "
              :disabled="isDataTab && isBaseHomePage && hasDocumentCreateAccess"
              placement="right"
            >
              <NcMenuItem
                data-testid="mini-sidebar--document-create"
                :disabled="!isDataTab || !isBaseHomePage || !hasDocumentCreateAccess"
                inner-class="w-full"
                @click="createDocument(openedProject?.id)"
              >
                <GeneralIcon icon="ncFileText" />
                <div class="flex-1">
                  {{ $t('objects.document') }}
                </div>

                <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !blockDocs" show-as-lock remove-click />
              </NcMenuItem>
            </NcTooltip>
          </template>

          <NcTooltip
            :title="
              !isDataTab
                ? $t('tooltip.switchToDataTab', { type: $t('objects.table').toLowerCase() })
                : !isBaseHomePage
                ? $t('tooltip.navigateToBaseToCreateTable')
                : !hasTableCreateAccess
                ? $t('tooltip.youDontHaveAccessToCreateNewTable')
                : ''
            "
            :disabled="isDataTab && isBaseHomePage && hasTableCreateAccess"
            placement="right"
          >
            <NcMenuItem
              data-testid="mini-sidebar-table-create"
              :disabled="!isDataTab || !isBaseHomePage || !hasTableCreateAccess"
              @click="openTableCreateDialog"
            >
              <GeneralIcon icon="table" />
              {{ $t('objects.table') }}
            </NcMenuItem>
          </NcTooltip>

          <NcMenuItem v-if="hasBaseCreateAccess" data-testid="mini-sidebar-base-create" @click="baseCreateDlg = true">
            <GeneralIcon icon="ncBaseOutline" class="h-4 w-4" />
            {{ $t('objects.project') }}
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" is-create-new-action-menu />
  </div>
</template>

<style lang="scss">
.nc-mini-sidebar-plus-btn svg {
  stroke-width: 2.5;
}

.nc-create-new-dropdown.nc-create-new-dropdown {
  overflow: visible !important;

  &::before {
    content: '';
    position: absolute;
    left: -6px;
    bottom: 11px;
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 7px solid var(--nc-border-gray-medium);
  }

  &::after {
    content: '';
    position: absolute;
    left: -5px;
    bottom: 13px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid var(--nc-bg-default);
  }
}
</style>
