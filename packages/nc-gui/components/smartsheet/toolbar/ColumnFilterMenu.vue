<script setup lang="ts">
import { CURRENT_USER_TOKEN, type ColumnType, type FilterType, ViewLockType, ViewSettingOverrideOptions } from 'nocodb-sdk'
import type ColumnFilter from './ColumnFilter.vue'

const isLocked = inject(IsLockedInj, ref(false))
const isPublic = inject(IsPublicInj, ref(false))

const activeView = inject(ActiveViewInj, ref())

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const reloadViewDataEventHook = inject(ReloadViewDataHookInj, createEventHook())

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const { isUserViewOwner } = useViewsStore()

const filterComp = ref<typeof ColumnFilter>()

const {
  allFilters: smatsheetAllFilters,
  nestedFilters,
  eventBus,
  filtersFromUrlParams,
  whereQueryFromUrl,
  filtersFromUrlParamsReadableErrors,
} = useSmartsheetStoreOrThrow()

const { appearanceConfig: filteredOrSortedAppearanceConfig, userColumnIds } = useColumnFilteredOrSorted()

// todo: avoid duplicate api call by keeping a filter store
const { nonDeletedFilters, loadFilters, canSyncFilter } = useViewFilters(
  activeView!,
  undefined,
  computed(() => true),
  () => false,
  nestedFilters.value,
  true,
)

const filtersLength = ref(0)
// If view is locked OR user lacks permission to sync filters (Editor), show restricted UI.
// Public/shared views always get the interactive UI — their changes are local-only.
const isRestrictedEditor = computed(() => !isPublic.value && (isLocked.value || !canSyncFilter.value))

// True when user is viewing a personal view they don't own
const isPersonalViewNonOwner = computed(
  () => activeView.value?.lock_type === ViewLockType.Personal && !isUserViewOwner(activeView.value),
)

watch(
  () => activeView?.value?.id,
  async (viewId) => {
    if (viewId) {
      await loadFilters({
        hookId: undefined,
        isWebhook: false,
        loadAllFilters: true,
      })
      filtersLength.value = nonDeletedFilters.value.length || 0
    }
  },
  { immediate: true },
)

const existingFilters = computed(() => {
  return (nestedFilters.value || []).filter((f) => f.id && f.status !== 'delete')
})

const open = ref(false)

const allFilters = ref({})

const filterKey = ref(1)

provide(AllFiltersInj, allFilters)

useMenuCloseOnEsc(open)

const draftFilter = ref({})

// ── Section height ──
// On mobile, tabs live in the drawer header and the locked footer in the drawer footer
// — both outside the overlay body. So overlay = sections only → 100%.
// On desktop, tabs & footer share the overlay — measure and subtract.
const desktopTabsRef = ref<HTMLElement | null>(null)
const desktopFooterRef = ref<HTMLElement | null>(null)

const { height: desktopTabsHeight } = useElementBounding(desktopTabsRef)
const { height: desktopFooterHeight } = useElementBounding(desktopFooterRef)

const sectionHeight = computed(() => {
  if (isMobileMode.value) return '100%'

  const total = (desktopTabsHeight.value || 0) + (desktopFooterHeight.value || 0)
  return total ? `calc(100% - ${total}px)` : '100%'
})

// ── Tab navigation ──
// Sections are shown as tabs when more than one section is available.
// This applies to both mobile and desktop, eliminating height conflicts.
type FilterTab = 'filters' | 'viewFilters' | 'urlFilters'

const activeFilterTab = ref<FilterTab>('filters')

const filterTabs = computed(() => {
  const tabs: { key: FilterTab; label: string; count?: number; tooltip?: string }[] = []

  // Restricted editor (locked view / non-owned personal view):
  // one read-only list of the view's saved filters — no local/temp tab.
  if (isRestrictedEditor.value) {
    if (filtersLength.value) {
      tabs.push({
        key: 'viewFilters',
        label: t('title.viewFilters'),
        count: filtersLength.value,
        tooltip: t('msg.viewFilter'),
      })
    }
  } else {
    // Full editor — a single, editable view filters tab.
    tabs.push({
      key: 'filters',
      label: t('activity.filters'),
      count: filtersLength.value,
    })
  }

  // URL filters tab — only when URL params have filters
  if (filtersFromUrlParams.value) {
    tabs.push({
      key: 'urlFilters',
      label: t('title.urlFilters'),
      count: filtersFromUrlParams.value?.filters?.length || 0,
      tooltip: t('msg.urlFilter'),
    })
  }

  return tabs
})

// Show tabs only when there's more than one section
const showFilterTabs = computed(() => filterTabs.value.length > 1)

// Reset to a valid tab when tabs change (e.g., URL filters removed)
watch(filterTabs, (tabs) => {
  if (!tabs.find((tab) => tab.key === activeFilterTab.value)) {
    activeFilterTab.value = tabs[0]?.key || 'filters'
  }
})

const smartsheetEventListener = async (event: string, payload?: any) => {
  if (
    (event === SmartsheetStoreEvents.FILTER_RELOAD ||
      validateViewConfigOverrideEvent(event, ViewSettingOverrideOptions.FILTER_CONDITION, payload)) &&
    activeView?.value?.id
  ) {
    await loadFilters({
      hookId: undefined,
      isWebhook: false,
      loadAllFilters: true,
    })

    filtersLength.value = nonDeletedFilters.value.length || 0

    filterKey.value++
  }

  const column = payload?.column as ColumnType | undefined

  if (!column) return

  if (event === SmartsheetStoreEvents.FILTER_ADD) {
    draftFilter.value = { fk_column_id: column.id }
    open.value = true
  }
}

eventBus.on(smartsheetEventListener)

onBeforeUnmount(() => {
  eventBus.off(smartsheetEventListener)
})

const combinedFilterLength = computed(() => filtersLength.value)

const isCurrentUserFilterPresent = ref(false)

const checkForCurrentUserFilter = (currentFilters: FilterType[] = []) => {
  let hasCurrentUserFilter = false

  const extractFilterArray = (filters: FilterType[]) => {
    if (hasCurrentUserFilter) return

    for (const eachFilter of filters) {
      if (eachFilter.is_group && eachFilter.children?.length) {
        extractFilterArray(eachFilter.children)
      } else if (
        eachFilter.fk_column_id &&
        userColumnIds.value.includes(eachFilter.fk_column_id) &&
        eachFilter.value?.includes(CURRENT_USER_TOKEN)
      ) {
        hasCurrentUserFilter = true
      }
    }
  }

  extractFilterArray([
    ...currentFilters,
    ...(filtersFromUrlParams.value?.errors?.length ? [] : filtersFromUrlParams.value?.filters || []),
  ])
  return hasCurrentUserFilter
}

if (isEeUI) {
  const reloadViewDataListener = async (params: any) => {
    if (params?.isFormFieldFilters) return
    isCurrentUserFilterPresent.value = checkForCurrentUserFilter(Object.values(allFilters.value).flat(Infinity) as FilterType[])
  }

  reloadViewDataEventHook.on(reloadViewDataListener)

  onBeforeUnmount(() => {
    reloadViewDataEventHook.off(reloadViewDataListener)
  })

  watch(
    [smatsheetAllFilters, nestedFilters, allFilters, filtersFromUrlParams],
    () => {
      isCurrentUserFilterPresent.value = checkForCurrentUserFilter(
        !ncIsEmptyObject(allFilters.value)
          ? (Object.values(allFilters.value).flat(Infinity) as FilterType[])
          : [...smatsheetAllFilters.value, ...nestedFilters.value],
      )
    },
    {
      deep: true,
      immediate: true,
    },
  )
}

watch(
  () => nonDeletedFilters.value.length,
  () => {
    filtersLength.value = nonDeletedFilters.value.length || 0
  },
)
</script>

<template>
  <NcDropDrawer
    v-model:visible="open"
    :scrollable-body="false"
    drawer-body-class-name="nc-dropdown-filter-menu nc-toolbar-dropdown !px-0 !pb-0 h-full"
    overlay-class-name="nc-dropdown-filter-menu overflow-hidden"
  >
    <template #default="{ onClick }">
      <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode">
        <template #title>
          {{ $t('activity.filter') }}
        </template>

        <NcButton
          v-e="['c:filter']"
          class="nc-filter-menu-btn nc-toolbar-btn !border-0 !h-7 group"
          size="small"
          type="secondary"
          :show-as-disabled="isLocked"
          :class="{
            [filteredOrSortedAppearanceConfig.FILTERED.toolbarBgClass]: combinedFilterLength,
          }"
          @click="onClick"
        >
          <div class="flex items-center gap-1 min-h-5">
            <div class="flex items-center gap-2">
              <component :is="iconMap.filter" class="h-4 w-4" />
              <!-- Filter -->
              <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">{{
                $t('activity.filter')
              }}</span>
            </div>

            <NcTooltip v-if="combinedFilterLength" :disabled="!isCurrentUserFilterPresent" class="flex">
              <template #title>
                {{ $t('tooltip.filteredByCurrentUser') }}
              </template>
              <span
                class="nc-toolbar-btn-chip inline-flex items-center"
                :class="{
                  [filteredOrSortedAppearanceConfig.FILTERED.toolbarChipBgClass]: true,
                  [filteredOrSortedAppearanceConfig.FILTERED.toolbarTextClass]: true,
                }"
              >
                {{ combinedFilterLength }}
                <span v-if="isCurrentUserFilterPresent" class="ml-1 pb-0.6">{{ '@' }}</span>
              </span>
            </NcTooltip>

            <!-- show a warning icon with tooltip if query filter error is there -->
            <template v-if="filtersFromUrlParams?.errors?.length">
              <NcTooltip :title="$t('msg.urlFilterError')" placement="top">
                <GeneralIcon icon="ncAlertCircle" class="nc-error-icon w-3.5" />
              </NcTooltip>
            </template>
          </div>
        </NcButton>
      </NcTooltip>
    </template>

    <!-- Tab bar in drawer header (mobile only, when multiple tabs) -->
    <template v-if="isMobileMode && showFilterTabs" #drawer-header>
      <SmartsheetToolbarColumnFilterTabs v-model:active-key="activeFilterTab" :tabs="filterTabs" />
    </template>

    <!-- Locked footer in drawer footer (mobile only) -->
    <template v-if="isMobileMode && isRestrictedEditor && (isLocked || isPersonalViewNonOwner)" #drawer-footer>
      <GeneralLockedViewFooter @on-open="open = false" />
    </template>

    <template #overlay>
      <div :key="filterKey" class="xs:(h-full)">
        <!-- Desktop: Tab bar (inline, when multiple tabs) -->
        <div v-if="!isMobileMode && showFilterTabs" ref="desktopTabsRef" class="flex-none">
          <SmartsheetToolbarColumnFilterTabs v-model:active-key="activeFilterTab" :tabs="filterTabs" />
        </div>

        <!-- Section: Main Filters (editable — full editors only) -->
        <div
          v-if="!isRestrictedEditor"
          v-show="!showFilterTabs || activeFilterTab === 'filters'"
          class="xs:(overflow-y-auto nc-scrollbar-thin)"
          :style="{ height: sectionHeight }"
        >
          <SmartsheetToolbarColumnFilter
            ref="filterComp"
            v-model:draft-filter="draftFilter"
            v-model:is-open="open"
            class="nc-table-toolbar-menu"
            :auto-save="true"
            data-testid="nc-filter-menu"
            :is-view-filter="true"
            @update:filters-length="filtersLength = $event"
          >
          </SmartsheetToolbarColumnFilter>
        </div>

        <!-- Section: View Filters (read-only, restricted editors) -->
        <div
          v-if="isRestrictedEditor"
          v-show="!showFilterTabs || activeFilterTab === 'viewFilters'"
          class="xs:(overflow-y-auto nc-scrollbar-thin)"
          :style="{ height: sectionHeight }"
        >
          <SmartsheetToolbarColumnFilter
            v-if="filtersLength"
            :key="`existing-${filterKey}`"
            v-model:is-open="open"
            class="nc-table-toolbar-menu !w-full"
            :model-value="existingFilters"
            :auto-save="false"
            :is-view-filter="!isPersonalViewNonOwner && !isLocked"
            read-only
            @update:filters-length="filtersLength = $event || 0"
          >
          </SmartsheetToolbarColumnFilter>
          <div v-else class="px-4 py-6 text-center text-xs text-nc-content-gray-subtle2">
            {{ $t('msg.info.noFiltersApplied') }}
          </div>
        </div>

        <!-- Section: URL Filters -->
        <div
          v-if="filtersFromUrlParams"
          v-show="!showFilterTabs || activeFilterTab === 'urlFilters'"
          class="xs:(overflow-y-auto nc-scrollbar-thin)"
          :style="{ height: sectionHeight }"
        >
          <SmartsheetToolbarColumnFilter
            v-if="filtersFromUrlParams.filters"
            :key="whereQueryFromUrl"
            ref="filterComp"
            v-model="filtersFromUrlParams.filters"
            v-model:is-open="open"
            class="nc-query-filter readonly"
            :auto-save="false"
            :is-view-filter="false"
            read-only
            query-filter
          >
          </SmartsheetToolbarColumnFilter>

          <div v-else-if="filtersFromUrlParams?.errors?.length">
            <NcAlert
              type="error"
              message="Error"
              :description="$t('msg.urlFilterError')"
              :copy-text="filtersFromUrlParamsReadableErrors"
              :copy-btn-tooltip="$t('tooltip.copyErrorMessage')"
            />
          </div>
        </div>

        <!-- Desktop: Locked footer -->
        <div v-if="!isMobileMode && isRestrictedEditor && (isLocked || isPersonalViewNonOwner)" ref="desktopFooterRef">
          <GeneralLockedViewFooter @on-open="open = false" />
        </div>
      </div>
    </template>
  </NcDropDrawer>
</template>

<style lang="scss">
.nc-query-filter.readonly .nc-cell-field,
.nc-query-filter.readonly {
  input,
  .text-nc-content-gray-muted {
    @apply !text-nc-content-gray-disabled;
  }
}
</style>

<style lang="scss" scoped>
.nc-error-icon {
  color: var(--nc-content-red-dark);
}

.nc-info-icon {
  color: var(--nc-content-gray-muted);
}

.nc-chevron-icon {
  color: var(--nc-content-gray-subtle);
}
</style>
