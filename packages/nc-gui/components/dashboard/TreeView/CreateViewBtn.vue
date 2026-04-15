<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles, type TableType, ViewTypes, viewTypeAlias } from 'nocodb-sdk'
import type { NcDropdownPlacement } from '#imports'

const props = defineProps<{
  // Prop used to align the dropdown to the left in sidebar
  alignLeftLevel: number | undefined
  source: Source
  placement?: NcDropdownPlacement
}>()

const { $e } = useNuxtApp()

const alignLeftLevel = toRef(props, 'alignLeftLevel')

const viewsStore = useViewsStore()
const { loadViews, onOpenViewCreateModal } = viewsStore
const { isListViewEnabled } = storeToRefs(viewsStore)
const { showUpgradeToUseListView } = viewsStore

const { isAiFeaturesEnabled } = useNocoAi()

const { blockListView, blockTimelineView, showEEFeatures, showUpgradeToUseTimelineView } = useEeConfig()

const table = inject(SidebarTableInj)!
const base = inject(ProjectInj)!

const isViewListLoading = ref(false)
const toBeCreateType = ref<ViewTypes | 'AI'>()

const isOpen = ref(false)

const isSqlView = computed(() => (table.value as TableType)?.type === 'view')

const isSyncedTable = computed(() => (table.value as TableType)?.synced)

const isPgSource = computed(() => props.source?.type === 'pg')

const overlayClassName = computed(() => {
  if (alignLeftLevel.value === 1) return 'nc-view-create-dropdown nc-view-create-dropdown-left-1'

  if (alignLeftLevel.value === 2) return 'nc-view-create-dropdown nc-view-create-dropdown-left-2'

  return 'nc-view-create-dropdown'
})

/**
 * Opens a modal for creating or editing a view.
 *
 * @param options - The options for opening the modal.
 * @param options.title - The title of the modal. Default is an empty string.
 * @param options.type - The type of view to create or edit.
 * @param options.copyViewId - The ID of the view to copy, if creating a copy.
 * @param options.groupingFieldColumnId - The ID of the column to use for grouping, if applicable.
 * @param options.calendarRange - The date range for calendar views.
 * @param options.coverImageColumnId - The ID of the column to use for cover images, if applicable.
 *
 * @returns A Promise that resolves when the modal operation is complete.
 *
 * @remarks
 * This function opens a modal dialog for creating or editing a view.
 * It handles the dialog state, view creation, and navigation to the newly created view.
 * After creating a view, it refreshes the command palette and reloads the views.
 *
 * @see {@link packages/nc-gui/components/smartsheet/topbar/ViewListDropdown.vue} for a similar implementation of view creation dialog.
 * If this function is updated, consider updating the other implementations as well.
 */
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

  $e('c:view:create:navdraw', { view: type === 'AI' ? type : viewTypeAlias[type] })

  toBeCreateType.value = type

  isViewListLoading.value = true
  await loadViews({
    tableId: table.value?.id as string,
    baseId: base.value.id!,
  })

  isOpen.value = false
  isViewListLoading.value = false

  onOpenViewCreateModal({
    title,
    type,
    copyViewId,
    groupingFieldColumnId,
    calendarRange,
    coverImageColumnId,
    baseId: base.value.id!,
    tableId: table.value.id!,
    sourceId: table.value?.source_id,
  })
}
</script>

<template>
  <NcDropdown
    v-model:visible="isOpen"
    :overlay-class-name="overlayClassName"
    :placement="placement || 'bottomLeft'"
    destroy-popup-on-hide
    @click.stop="isOpen = true"
  >
    <slot />
    <template #overlay>
      <NcMenu class="max-w-fit" variant="small">
        <NcMenuItem inner-class="w-full" @click.stop="onOpenModal({ type: ViewTypes.GRID })">
          <div class="item" data-testid="sidebar-view-create-grid">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" />
              <div>{{ $t('objects.viewType.grid') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.GRID && isViewListLoading" />
          </div>
        </NcMenuItem>

        <NcTooltip
          :title="isSyncedTable ? $t('tooltip.formViewCreationNotSupportedForSyncedTable') : $t('tooltip.sourceDataIsReadonly')"
          :disabled="!source.is_data_readonly && !isSqlView && !isSyncedTable"
          class="w-full"
        >
          <NcMenuItem
            :disabled="!!source.is_data_readonly || isSqlView || isSyncedTable"
            inner-class="w-full"
            @click="onOpenModal({ type: ViewTypes.FORM })"
          >
            <div class="item" data-testid="sidebar-view-create-form">
              <div class="item-inner">
                <GeneralViewIcon
                  :meta="{ type: ViewTypes.FORM }"
                  :class="{
                    '!opacity-50': !!source.is_data_readonly || isSqlView || isSyncedTable,
                  }"
                />
                <div>{{ $t('objects.viewType.form') }}</div>
              </div>

              <GeneralLoader v-if="toBeCreateType === ViewTypes.FORM && isViewListLoading" />
            </div>
          </NcMenuItem>
        </NcTooltip>
        <NcMenuItem inner-class="w-full" @click="onOpenModal({ type: ViewTypes.GALLERY })">
          <div class="item" data-testid="sidebar-view-create-gallery">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GALLERY }" />
              <div>{{ $t('objects.viewType.gallery') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.GALLERY && isViewListLoading" />
          </div>
        </NcMenuItem>
        <NcMenuItem
          inner-class="w-full"
          data-testid="sidebar-view-create-kanban"
          @click="onOpenModal({ type: ViewTypes.KANBAN })"
        >
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.KANBAN }" />
              <div>{{ $t('objects.viewType.kanban') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.KANBAN && isViewListLoading" />
          </div>
        </NcMenuItem>
        <NcMenuItem
          inner-class="w-full"
          data-testid="sidebar-view-create-calendar"
          @click="onOpenModal({ type: ViewTypes.CALENDAR })"
        >
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.CALENDAR }" class="!w-4 !h-4" />
              <div>{{ $t('objects.viewType.calendar') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.CALENDAR && isViewListLoading" />
          </div>
        </NcMenuItem>
        <NcMenuItem
          v-if="isEeUI && showEEFeatures"
          inner-class="w-full"
          data-testid="sidebar-view-create-map"
          @click="
            () => {
              isOpen = false
              onOpenModal({ type: ViewTypes.MAP })
            }
          "
        >
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.MAP }" />
              <div>{{ $t('objects.viewType.map') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.MAP && isViewListLoading" />
          </div>
        </NcMenuItem>
        <NcTooltip
          v-if="isListViewEnabled"
          :title="$t('tooltip.listViewOnlyPg')"
          :disabled="isPgSource"
          placement="right"
          class="w-full"
        >
          <NcMenuItem
            :disabled="!isPgSource"
            inner-class="w-full"
            data-testid="sidebar-view-create-list"
            @click="
              isPgSource &&
                showUpgradeToUseListView({
                  successCallback: () => {
                    onOpenModal({ type: ViewTypes.LIST })
                  },
                })
            "
          >
            <div class="item">
              <div class="item-inner">
                <GeneralViewIcon :meta="{ type: ViewTypes.LIST }" :class="{ '!opacity-50': !isPgSource }" />
                <div>{{ $t('objects.viewType.list') }}</div>
              </div>

              <template v-if="blockListView">
                <PaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_LIST_VIEW"
                  :plan-title="PlanTitles.BUSINESS"
                  remove-click
                  show-as-lock
                />
              </template>
              <template v-else>
                <GeneralLoader v-if="toBeCreateType === ViewTypes.LIST && isViewListLoading" />
              </template>
            </div>
          </NcMenuItem>
        </NcTooltip>
        <NcMenuItem
          v-if="isEeUI && showEEFeatures"
          inner-class="w-full"
          data-testid="sidebar-view-create-timeline"
          @click="
            () => {
              isOpen = false
              showUpgradeToUseTimelineView({
                successCallback: () => {
                  onOpenModal({ type: ViewTypes.TIMELINE })
                },
              })
            }
          "
        >
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.TIMELINE }" class="!w-4 !h-4" />
              <div>{{ $t('objects.viewType.timeline') }}</div>
            </div>

            <template v-if="blockTimelineView">
              <PaymentUpgradeBadge
                :feature="PlanFeatureTypes.FEATURE_TIMELINE_VIEW"
                :plan-title="PlanTitles.BUSINESS"
                show-as-lock
                remove-click
              />
            </template>
            <template v-else>
              <GeneralLoader v-if="toBeCreateType === ViewTypes.TIMELINE && isViewListLoading" />
            </template>
          </div>
        </NcMenuItem>

        <template v-if="isEeUI && showEEFeatures">
          <!-- Section -->
          <NcDivider />

          <DashboardTreeViewCreateViewBtnSectionMenu @close="isOpen = false" />
        </template>

        <template v-if="isAiFeaturesEnabled">
          <NcDivider />
          <NcTooltip :title="`Auto suggest views for ${table?.title || 'the current table'}`" placement="right" class="w-full">
            <NcMenuItem data-testid="sidebar-view-create-ai" @click="onOpenModal({ type: 'AI' })">
              <div class="item">
                <div class="item-inner">
                  <GeneralIcon icon="ncAutoAwesome" class="!w-4 !h-4 text-nc-fill-purple-dark" />
                  <div>{{ $t('labels.useNocoAI') }}</div>
                </div>
              </div>
            </NcMenuItem>
          </NcTooltip>
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-view-create-dropdown {
  @apply !min-w-43;
  .item {
    @apply flex flex-row items-center w-full justify-between gap-x-1.75;
  }

  .item-inner {
    @apply flex flex-row items-center gap-x-1.75;
  }
}

.nc-view-create-dropdown-left-1 {
  @apply !left-18;
}

.nc-view-create-dropdown-left-2 {
  @apply !left-23.5;
}
</style>
