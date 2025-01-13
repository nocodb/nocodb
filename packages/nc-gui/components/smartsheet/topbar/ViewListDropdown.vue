<script lang="ts" setup>
import { type ViewType, ViewTypes, viewTypeAlias } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { base } = storeToRefs(useBase())

const { activeTable } = storeToRefs(useTablesStore())

const viewsStore = useViewsStore()

const { activeView, views } = storeToRefs(viewsStore)

const { loadViews, navigateToView } = viewsStore

const { refreshCommandPalette } = useCommandPalette()

const { isFeatureEnabled } = useBetaFeatureToggle()

const isOpen = ref<boolean>(false)

const activeSource = computed(() => {
  return base.value.sources?.find((s) => s.id === activeView.value?.source_id)
})

/**
 * Handles navigation to a selected view.
 *
 * @param view - The view to navigate to.
 * @returns A Promise that resolves when the navigation is complete.
 *
 * @remarks
 * This function is called when a user selects a view from the dropdown list.
 * It checks if the view has a valid ID and then navigates to the selected view.
 * If the view is a form and it's already active, it performs a hard reload.
 */
const handleNavigateToView = async (view: ViewType) => {
  if (!view?.id) return

  await navigateToView({
    view,
    tableId: activeTable.value.id!,
    baseId: base.value.id!,
    hardReload: view.type === ViewTypes.FORM && activeView.value?.id === view.id,
    doNotSwitchTab: true,
  })
}

/**
 * Filters the view options based on the input string.
 *
 * @param input - The search input string.
 * @param view - The view object to be filtered.
 * @returns True if the view matches the filter criteria, false otherwise.
 *
 * @remarks
 * This function is used to filter the list of views in the dropdown.
 * It checks if the input string matches either the default view title (translated) or the view's title.
 * The matching is case-insensitive.
 */
const filterOption = (input = '', view: ViewType) => {
  if (view.is_default && t('title.defaultView').toLowerCase().includes(input)) {
    return true
  }

  return view.title?.toLowerCase()?.includes(input.toLowerCase())
}

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
 * @see {@link packages/nc-gui/components/dashboard/TreeView/CreateViewBtn.vue} for a similar implementation of view creation dialog.
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
    fk_to_column_id: string | null
  }>
  coverImageColumnId?: string
}) {
  isOpen.value = false

  $e('c:view:create:topbar', { view: type === 'AI' ? type : viewTypeAlias[type] })

  const isDlgOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isDlgOpen,
    title,
    type,
    'tableId': activeTable.value.id,
    'selectedViewId': copyViewId,
    calendarRange,
    groupingFieldColumnId,
    coverImageColumnId,
    'onUpdate:modelValue': closeDialog,
    'baseId': base.value.id,
    'onCreated': async (view?: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews({
        tableId: activeTable.value.id!,
        force: true,
      })

      activeTable.value.meta = {
        ...(activeTable.value.meta as object),
        hasNonDefaultViews: true,
      }

      if (view) {
        navigateToView({
          view,
          tableId: activeTable.value.id!,
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
  <NcDropdown v-if="activeView" v-model:visible="isOpen">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-model:open="isOpen"
        :value="activeView.id"
        :list="views"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search views"
        :filter-option="filterOption"
        @change="handleNavigateToView"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralViewIcon :meta="{ type: option?.type }" class="min-w-4 text-lg flex" />
              </template>
            </LazyGeneralEmojiPicker>
          </div>
          <NcTooltip class="truncate flex-1" show-on-truncate-only>
            <template #title>
              {{ option?.is_default ? $t('title.defaultView') : option?.title }}
            </template>
            {{ option?.is_default ? $t('title.defaultView') : option?.title }}
          </NcTooltip>
          <GeneralIcon
            v-if="option.id === activeView.id"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>

        <template v-if="!isMobileMode && isUIAllowed('viewCreateOrEdit')" #listFooter>
          <NcDivider class="!mt-0 !mb-2" />
          <div class="overflow-hidden mb-2">
            <a-menu class="nc-viewlist-menu">
              <a-sub-menu popup-class-name="nc-viewlist-submenu-popup ">
                <template #title>
                  <div class="flex items-center justify-between gap-2 text-sm font-weight-500 !text-brand-500">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="plus" />
                      <div>
                        {{
                          $t('general.createEntity', {
                            entity: $t('objects.view'),
                          })
                        }}
                      </div>
                    </div>
                    <GeneralIcon icon="arrowRight" class="text-base text-gray-600 group-hover:text-gray-800" />
                  </div>
                </template>

                <template #expandIcon> </template>

                <a-menu-item @click.stop="onOpenModal({ type: ViewTypes.GRID })">
                  <div class="nc-viewlist-submenu-popup-item" data-testid="topbar-view-create-grid">
                    <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" />
                    {{ $t('objects.viewType.grid') }}
                  </div>
                </a-menu-item>

                <NcTooltip
                  :title="$t('tooltip.sourceDataIsReadonly')"
                  :disabled="!activeSource?.is_data_readonly"
                  placement="right"
                >
                  <a-menu-item :disabled="!!activeSource?.is_data_readonly" @click="onOpenModal({ type: ViewTypes.FORM })">
                    <div
                      class="nc-viewlist-submenu-popup-item"
                      data-testid="topbar-view-create-form"
                      :class="{
                        'opacity-50': !!activeSource?.is_data_readonly,
                      }"
                    >
                      <GeneralViewIcon :meta="{ type: ViewTypes.FORM }" />
                      {{ $t('objects.viewType.form') }}
                    </div>
                  </a-menu-item>
                </NcTooltip>
                <a-menu-item @click="onOpenModal({ type: ViewTypes.GALLERY })">
                  <div class="nc-viewlist-submenu-popup-item" data-testid="topbar-view-create-gallery">
                    <GeneralViewIcon :meta="{ type: ViewTypes.GALLERY }" />
                    {{ $t('objects.viewType.gallery') }}
                  </div>
                </a-menu-item>
                <a-menu-item data-testid="topbar-view-create-kanban" @click="onOpenModal({ type: ViewTypes.KANBAN })">
                  <div class="nc-viewlist-submenu-popup-item">
                    <GeneralViewIcon :meta="{ type: ViewTypes.KANBAN }" />
                    {{ $t('objects.viewType.kanban') }}
                  </div>
                </a-menu-item>
                <a-menu-item data-testid="topbar-view-create-calendar" @click="onOpenModal({ type: ViewTypes.CALENDAR })">
                  <div class="nc-viewlist-submenu-popup-item">
                    <GeneralViewIcon :meta="{ type: ViewTypes.CALENDAR }" class="!w-4 !h-4" />
                    {{ $t('objects.viewType.calendar') }}
                  </div>
                </a-menu-item>

                <template v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)">
                  <NcDivider />
                  <a-menu-item data-testid="sidebar-view-create-ai" @click="onOpenModal({ type: 'AI' })">
                    <div class="nc-viewlist-submenu-popup-item">
                      <GeneralIcon icon="ncAutoAwesome" class="!w-4 !h-4 text-nc-fill-purple-dark" />
                      <div>{{ $t('labels.aiSuggested') }}</div>
                    </div>
                  </a-menu-item>
                </template>
              </a-sub-menu>
            </a-menu>
          </div>
        </template>
      </LazyNcList>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-viewlist-menu {
  @apply !border-r-0;

  .ant-menu-submenu {
    @apply !mx-2;

    .ant-menu-submenu-title {
      @apply flex items-center gap-2 py-1.5 px-2 my-0 h-auto hover:bg-gray-100 cursor-pointer rounded-md;

      .ant-menu-title-content {
        @apply w-full;
      }
    }
  }
}

.nc-viewlist-submenu-popup {
  @apply !rounded-lg border-1 border-gray-50;

  .ant-menu.ant-menu-sub {
    @apply p-2 !rounded-lg !shadow-lg shadow-gray-200;
  }

  .ant-menu-item {
    @apply h-auto !my-0 text-sm !leading-5 py-2 px-2 hover:!bg-gray-100 cursor-pointer rounded-md;

    .ant-menu-title-content {
      @apply w-full px-0;
    }

    .nc-viewlist-submenu-popup-item {
      @apply flex items-center gap-2 !text-gray-800;
    }

    &.ant-menu-item-selected {
      @apply bg-transparent;
    }
  }
}
.nc-viewlist-submenu-popup .ant-dropdown-menu.ant-dropdown-menu-sub {
  @apply !rounded-lg !shadow-lg shadow-gray-200;
}
</style>
