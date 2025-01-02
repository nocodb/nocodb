<script lang="ts" setup>
import { type ViewType, viewTypeAlias } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'

const props = defineProps<{
  // Prop used to align the dropdown to the left in sidebar
  alignLeftLevel: number | undefined
  source: Source
}>()

const { $e } = useNuxtApp()

const alignLeftLevel = toRef(props, 'alignLeftLevel')

const { refreshCommandPalette } = useCommandPalette()
const viewsStore = useViewsStore()
const { loadViews, navigateToView } = viewsStore

const { isFeatureEnabled } = useBetaFeatureToggle()

const table = inject(SidebarTableInj)!
const base = inject(ProjectInj)!

const isViewListLoading = ref(false)
const toBeCreateType = ref<ViewTypes | 'AI'>()

const isOpen = ref(false)

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
    tableId: table.value.id!,
  })

  isOpen.value = false
  isViewListLoading.value = false

  const isDlgOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isDlgOpen,
    title,
    type,
    'tableId': table.value.id,
    'selectedViewId': copyViewId,
    calendarRange,
    groupingFieldColumnId,
    coverImageColumnId,
    'baseId': base.value.id,
    'onUpdate:modelValue': closeDialog,
    'onCreated': async (view?: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews({
        tableId: table.value.id!,
        force: true,
      })

      table.value.meta = {
        ...(table.value.meta as object),
        hasNonDefaultViews: true,
      }

      if (view) {
        navigateToView({
          view,
          tableId: table.value.id!,
          baseId: base.value.id!,
          doNotSwitchTab: true,
        })
      }

      $e('a:view:create', { view: view?.type || type })
    },
  })

  function closeDialog() {
    isOpen.value = false
    isDlgOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" :overlay-class-name="overlayClassName" destroy-popup-on-hide @click.stop="isOpen = true">
    <slot />
    <template #overlay>
      <NcMenu class="max-w-48" variant="medium">
        <NcMenuItem @click.stop="onOpenModal({ type: ViewTypes.GRID })">
          <div class="item" data-testid="sidebar-view-create-grid">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" />
              <div>{{ $t('objects.viewType.grid') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.GRID && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>

        <NcTooltip :title="$t('tooltip.sourceDataIsReadonly')" :disabled="!source.is_data_readonly">
          <NcMenuItem :disabled="!!source.is_data_readonly" @click="onOpenModal({ type: ViewTypes.FORM })">
            <div class="item" data-testid="sidebar-view-create-form">
              <div class="item-inner">
                <GeneralViewIcon
                  :meta="{ type: ViewTypes.FORM }"
                  :class="{
                    'opacity-50': !!source.is_data_readonly,
                  }"
                />
                <div>{{ $t('objects.viewType.form') }}</div>
              </div>

              <GeneralLoader v-if="toBeCreateType === ViewTypes.FORM && isViewListLoading" />
              <GeneralIcon
                v-else
                class="plus"
                icon="plus"
                :class="{
                  '!text-current': !!source.is_data_readonly,
                }"
              />
            </div>
          </NcMenuItem>
        </NcTooltip>
        <NcMenuItem @click="onOpenModal({ type: ViewTypes.GALLERY })">
          <div class="item" data-testid="sidebar-view-create-gallery">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GALLERY }" />
              <div>{{ $t('objects.viewType.gallery') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.GALLERY && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>
        <NcMenuItem data-testid="sidebar-view-create-kanban" @click="onOpenModal({ type: ViewTypes.KANBAN })">
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.KANBAN }" />
              <div>{{ $t('objects.viewType.kanban') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.KANBAN && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>
        <NcMenuItem data-testid="sidebar-view-create-calendar" @click="onOpenModal({ type: ViewTypes.CALENDAR })">
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.CALENDAR }" class="!w-4 !h-4" />
              <div>{{ $t('objects.viewType.calendar') }}</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.CALENDAR && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>
        <template v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)">
          <NcDivider />
          <NcMenuItem data-testid="sidebar-view-create-ai" @click="onOpenModal({ type: 'AI' })">
            <div class="item">
              <div class="item-inner">
                <GeneralIcon icon="ncAutoAwesome" class="!w-4 !h-4 text-nc-fill-purple-dark" />
                <div>{{ $t('labels.aiSuggested') }}</div>
              </div>
            </div>
          </NcMenuItem>
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.item {
  @apply flex flex-row items-center w-36 justify-between;
}

.item-inner {
  @apply flex flex-row items-center gap-x-1.75;
}

.plus {
  @apply text-gray-500;
}
</style>

<style lang="scss">
.nc-view-create-dropdown {
  @apply !max-w-43 !min-w-43;
}

.nc-view-create-dropdown-left-1 {
  @apply !left-18;
}

.nc-view-create-dropdown-left-2 {
  @apply !left-23.5;
}
</style>
