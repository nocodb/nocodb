<script setup lang="ts">
import { CURRENT_USER_TOKEN, type ColumnType, type FilterType, ViewLockType, ViewSettingOverrideOptions } from 'nocodb-sdk'
import type ColumnFilter from '~/components/smartsheet/toolbar/ColumnFilter.vue'

const isLocked = inject(IsLockedInj, ref(false))

const activeView = inject(ActiveViewInj, ref())

const meta = inject(MetaInj, ref())

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const reloadViewDataEventHook = inject(ReloadViewDataHookInj, createEventHook())

const { isMobileMode } = useGlobal()

const { isUserViewOwner } = useViewsStore()

const filterComp = ref<typeof ColumnFilter>()

const {
  allFilters: smatsheetAllFilters,
  nestedFilters,
  eventBus,
  filtersFromUrlParams,
  whereQueryFromUrl,
  filtersFromUrlParamsReadableErrors,
  isList,
} = useSmartsheetStoreOrThrow()

const listViewStore = isList.value ? useListViewStoreOrThrow() : undefined
const isListConfigured = computed(
  () => (listViewStore?.isConfigured.value ?? false) && (listViewStore?.levels.value?.length ?? 0) > 1,
)

const { appearanceConfig: filteredOrSortedAppearanceConfig, userColumnIds } = useColumnFilteredOrSorted()

const { blockToggleFilter } = useEeConfig()

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
const enabledFiltersLength = ref(0)
// If view is locked OR user lacks permission to sync filters (Editor), show restricted UI
const isRestrictedEditor = computed(() => isLocked.value || !canSyncFilter.value)

// True when user is viewing a personal view they don't own
const isPersonalViewNonOwner = computed(
  () => activeView.value?.lock_type === ViewLockType.Personal && !isUserViewOwner(activeView.value),
)

// Show temp filters only for collaborative views, not for personal views
// For personal views, non-assigned users should not see temp filters at all
const showTempFilters = computed(() => {
  // If user has full access, don't need temp filters section (they have full editor)
  if (!isRestrictedEditor.value) return false
  // If restricted AND it's a personal view, hide temp filters (non-assigned user)
  if (activeView.value?.lock_type === 'personal') return false
  // If restricted AND it's NOT a personal view, show temp filters (editor on collaborative view)
  return true
})

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
      enabledFiltersLength.value = nonDeletedFilters.value.filter((f) => f.enabled !== false && f.enabled !== 0).length
    }
  },
  { immediate: true },
)

const existingFilters = computed(() => {
  return (nestedFilters.value || []).filter((f) => f.id && f.status !== 'delete')
})

// We need to cast nestedFilters to any to avoid type check errors in setter for now
const localFilters = computed({
  get: () => {
    // Strictly return new/local filters (no ID)
    return (nestedFilters.value || []).filter((f) => !f.id)
  },
  set: (val: any[]) => {
    // Merge logic: keep existing (with ID), replace local (no ID)
    const existing = (nestedFilters.value || []).filter((f) => f.id)
    // Ensure we don't duplicate if val somehow contains IDs (shouldn't happen)
    const newLocal = val.filter((f) => !f.id)

    nestedFilters.value = [...existing, ...newLocal]
  },
})

const open = ref(false)

const allFilters = ref({})

const filterKey = ref(1)

provide(AllFiltersInj, allFilters)

useMenuCloseOnEsc(open)

const draftFilter = ref<Record<string, any>>(
  isList.value && listViewStore?.selectedLevelId.value ? { fk_level_id: listViewStore.selectedLevelId.value } : {},
)
const queryFilterOpen = ref(false)
const viewFilterOpen = ref(true)

if (isList.value && listViewStore) {
  watch(
    () => listViewStore!.selectedLevelId.value,
    (levelId) => {
      draftFilter.value = levelId ? { fk_level_id: levelId } : {}
    },
  )
}

const smartsheetEventListener = async (event: string, payload?: any) => {
  if (validateViewConfigOverrideEvent(event, ViewSettingOverrideOptions.FILTER_CONDITION, payload) && activeView?.value?.id) {
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
    draftFilter.value = {
      fk_column_id: column.id,
      ...(isList.value && listViewStore?.selectedLevelId.value ? { fk_level_id: listViewStore.selectedLevelId.value } : {}),
    }
    open.value = true
  }
}

eventBus.on(smartsheetEventListener)

onBeforeUnmount(() => {
  eventBus.off(smartsheetEventListener)
})

const combinedFilterLength = computed(() => {
  if (isRestrictedEditor.value) {
    return (filtersLength.value || 0) + (localFilters.value?.length || 0)
  }
  return filtersLength.value
})

/** Display format: "enabled/total" when some filters are disabled, otherwise just "total".
 *  When toggle filters are blocked (Free plan), always show just the total count. */
const filterCountDisplay = computed(() => {
  const total = combinedFilterLength.value
  if (!total) return ''

  // If toggle filter feature is blocked, just show the total count
  if (blockToggleFilter.value) return `${total}`

  // For restricted editors, enabledFiltersLength tracks persisted (creator) filters only.
  // Also count enabled local/temp filters so the badge reflects the full picture.
  let enabled = enabledFiltersLength.value
  if (isRestrictedEditor.value) {
    enabled += (localFilters.value || []).filter((f) => f.enabled !== false && f.enabled !== 0).length
  }

  if (enabled < total) {
    return `${enabled}/${total}`
  }
  return `${total}`
})

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
  nonDeletedFilters,
  () => {
    filtersLength.value = nonDeletedFilters.value.length || 0
    enabledFiltersLength.value = nonDeletedFilters.value.filter((f) => f.enabled !== false && f.enabled !== 0).length
  },
  { deep: true },
)

// Watch allFilters (populated by ColumnFilter.vue via AllFiltersInj) to keep
// enabled count in sync when individual filters are toggled on/off.
// Count root-level items only — filter groups count as 1.
// Skip for restricted editors: they have two ColumnFilter instances (read-only + temp)
// that both write to allFilters['root'], corrupting the count.
watch(
  allFilters,
  () => {
    if (isRestrictedEditor.value) return

    const rootFilters = (allFilters.value as Record<string, FilterType[]>).root
    if (rootFilters?.length) {
      filtersLength.value = rootFilters.length
      enabledFiltersLength.value = rootFilters.filter((f) => f.enabled !== false && f.enabled !== 0).length
    }
  },
  { deep: true },
)

// ----- EE: AI Filter Prediction -----
//
// Handles AI-generated filter predictions from the AiFilterPrompt component.
// The AI returns { action, filters } where:
//   - action: 'add' (append to existing), 'replace' (clear all + add new), 'clear' (remove all)
//   - filters: array of { column (title), comparison_op, comparison_sub_op, value, logical_op }
// This handler resolves column titles → fk_column_id, builds draft FilterType objects,
// and manages the filter list via ColumnFilter's exposed addFilter/deleteFilter/filters.

/**
 * Delete all existing filters in the current view (iterates in reverse to avoid index shifting).
 */
const clearAllFilters = async () => {
  if (!filterComp.value?.filters?.length) return

  // Snapshot the current filters to avoid issues if the reactive array mutates during iteration.
  // Delete in reverse order so indices remain valid as filters are removed.
  const filtersSnapshot = [...filterComp.value.filters]
  for (let i = filtersSnapshot.length - 1; i >= 0; i--) {
    await filterComp.value.deleteFilter(filtersSnapshot[i], i)
  }
}

/**
 * Add an array of AI-generated filters to the view.
 * Resolves column titles to fk_column_id and calls addFilter for each.
 */
const addAiFilters = async (
  aiFilters: {
    column: string
    comparison_op: string
    comparison_sub_op: string | null
    value: string | null
    logical_op: string
  }[],
) => {
  if (!filterComp.value || !meta.value?.columns) return

  for (const aiFilter of aiFilters) {
    // Resolve column title from AI response to the actual column ID
    const column = meta.value.columns.find((col: ColumnType) => col.title === aiFilter.column)
    if (!column?.id) continue

    // Build a draft filter with all AI-provided properties.
    // logical_op is included so the AI can specify 'or' for "either/or" queries.
    const draft: Partial<FilterType> = {
      fk_column_id: column.id,
      comparison_op: aiFilter.comparison_op as FilterType['comparison_op'],
      value: aiFilter.value,
      logical_op: aiFilter.logical_op as FilterType['logical_op'],
    }

    // Only set comparison_sub_op for Date/DateTime filters that use dynamic ranges
    if (aiFilter.comparison_sub_op) {
      draft.comparison_sub_op = aiFilter.comparison_sub_op as FilterType['comparison_sub_op']
    }

    // Use isCopyFilter=true (second arg) to skip selectFilterField(), which would
    // otherwise reset comparison_op to the column's default and clear value to null.
    // The AI draft already has the correct operator, value, and logical_op.
    await filterComp.value.addFilter(draft, true)
  }
}

/**
 * Main dispatcher for AI filter predictions.
 * Called by AiFilterPrompt's @applyFilters event with { action, filters }.
 * Routes to clearAllFilters/addAiFilters based on the AI-determined action.
 */
const handleAiFilters = async (payload: {
  action: 'add' | 'replace' | 'clear'
  filters: {
    column: string
    comparison_op: string
    comparison_sub_op: string | null
    value: string | null
    logical_op: string
  }[]
}) => {
  if (!filterComp.value) return

  const { action, filters: aiFilters } = payload

  if (action === 'clear') {
    // Remove all existing filters
    await clearAllFilters()
  } else if (action === 'replace') {
    // Remove all existing filters, then add the new ones
    await clearAllFilters()
    await addAiFilters(aiFilters)
  } else {
    // Default: append new filters to existing ones
    await addAiFilters(aiFilters)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="open" overlay-class-name="nc-dropdown-filter-menu nc-toolbar-dropdown overflow-hidden">
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
              {{ filterCountDisplay }}
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

    <template #overlay>
      <div :key="filterKey">
        <div v-if="isList && isListConfigured" class="px-2 py-2 border-b-1">
          <SmartsheetToolbarListLevelSelector />
        </div>
        <template v-if="!isRestrictedEditor">
          <!-- EE: AI Filter Prompt — natural-language input that generates filter conditions via AI -->
          <SmartsheetToolbarAiFilterPrompt :is-parent-open="open" @apply-filters="handleAiFilters" />

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
        </template>
        <template v-else>
          <template v-if="!!filtersLength">
            <div class="px-2 mt-2">
              <div
                class="leading-5 font-semibold inline-flex w-full items-center cursor-pointer px-2"
                :class="{ 'pb-3': !viewFilterOpen }"
                @click="viewFilterOpen = !viewFilterOpen"
              >
                <div class="flex-grow gap-2 flex">
                  {{ $t('title.viewFilters') }}

                  <div>
                    <NcTooltip :title="$t('msg.viewFilter')" placement="top">
                      <GeneralIcon icon="ncInfo" class="nc-info-icon !w-3.5 !h-3.5" />
                    </NcTooltip>
                  </div>
                </div>
                <div class="p-2">
                  <GeneralIcon
                    icon="ncChevronDown"
                    class="nc-chevron-icon transition-all cursor-pointer w-4 h-4"
                    :class="{ 'transform rotate-180': viewFilterOpen }"
                  />
                </div>
              </div>
              <div
                class="overflow-hidden transition-all duration-300 -mt-2"
                :class="{ 'max-h-0': !viewFilterOpen, 'max-h-[1000px] overflow-auto': viewFilterOpen }"
              >
                <SmartsheetToolbarColumnFilter
                  :key="`existing-${filterKey}`"
                  v-model:is-open="open"
                  class="nc-table-toolbar-menu !pl-2 !w-full"
                  :model-value="existingFilters"
                  :auto-save="false"
                  :is-view-filter="!isPersonalViewNonOwner && !isLocked"
                  read-only
                  @update:filters-length="filtersLength = $event || 0"
                >
                </SmartsheetToolbarColumnFilter>
              </div>
            </div>
            <a-divider v-if="showTempFilters" class="!my-1" />
          </template>
          <template v-if="showTempFilters">
            <SmartsheetToolbarColumnFilter
              ref="filterComp"
              v-model="localFilters"
              v-model:draft-filter="draftFilter"
              v-model:is-open="open"
              class="nc-table-toolbar-menu"
              :auto-save="false"
              data-testid="nc-filter-menu"
              :is-view-filter="false"
              :is-temp-filters="true"
            >
            </SmartsheetToolbarColumnFilter>
          </template>
          <GeneralLockedViewFooter v-if="isLocked || isPersonalViewNonOwner" @on-open="open = false" />
        </template>
        <template v-if="filtersFromUrlParams">
          <a-divider class="!my-1" />
          <div class="px-2 pb-2">
            <div
              class="leading-5 font-semibold inline-flex w-full items-center cursor-pointer px-2"
              :class="{ 'pb-0': !queryFilterOpen }"
              @click="queryFilterOpen = !queryFilterOpen"
            >
              <div class="flex-grow gap-2 flex">
                {{ $t('title.urlFilters') }}
                <div
                  v-if="filtersFromUrlParams?.filters?.length"
                  class="bg-nc-bg-brand px-1 rounded rounded-6px font-medium text-nc-content-brand h-5"
                >
                  {{ filtersFromUrlParams.filters.length }}
                </div>

                <div>
                  <NcTooltip :title="$t('msg.urlFilter')" placement="top">
                    <GeneralIcon icon="ncInfo" class="nc-info-icon !w-3.5 !h-3.5" />
                  </NcTooltip>
                </div>
              </div>
              <div class="p-2">
                <GeneralIcon
                  icon="ncChevronDown"
                  class="nc-chevron-icon transition-all cursor-pointer w-4 h-4"
                  :class="{ 'transform rotate-180': queryFilterOpen }"
                />
              </div>
            </div>
            <div
              class="overflow-hidden transition-all duration-300 mt-1"
              :class="{ 'max-h-0': !queryFilterOpen, 'max-h-[1000px] overflow-auto': queryFilterOpen }"
            >
              <SmartsheetToolbarColumnFilter
                v-if="filtersFromUrlParams.filters"
                :key="whereQueryFromUrl"
                ref="filterComp"
                v-model="filtersFromUrlParams.filters"
                v-model:is-open="open"
                class="nc-query-filter readonly px-2 pb-2"
                :auto-save="false"
                :is-view-filter="false"
                read-only
                query-filter
              >
              </SmartsheetToolbarColumnFilter>

              <div
                v-else-if="filtersFromUrlParams?.errors?.length"
                class="px-2 transition-margin duration-500"
                :class="{ 'mb-2': queryFilterOpen }"
              >
                <NcAlert
                  type="error"
                  message="Error"
                  :description="$t('msg.urlFilterError')"
                  :copy-text="filtersFromUrlParamsReadableErrors"
                  :copy-btn-tooltip="$t('tooltip.copyErrorMessage')"
                />
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </NcDropdown>
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
