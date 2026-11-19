<script lang="ts" setup>
import type { ColumnType, TableType, UITypes } from 'nocodb-sdk'

const isSearchExpanded = defineModel<boolean>('searchExpanded', { default: false })

const reloadData = inject(ReloadViewDataHookInj)!

const reloadAggregate = inject(ReloadAggregateHookInj)

const activeView = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const { $e } = useNuxtApp()

const { t } = useI18n()

const { meta, eventBus, isGrid, isGallery, isList, totalRowsWithSearchQuery, totalRowsWithoutSearchQuery, gridEditEnabled } =
  useSmartsheetStoreOrThrow()

const { lastOpenedViewId } = storeToRefs(useViewsStore())

const { isGroupBy } = useViewGroupByOrThrow()

const router = useRouter()

const route = router.currentRoute

const { search, loadFieldQuery, isScoped: isScopedSearch } = useFieldQuery()

const { isMobileMode } = useGlobal()

const listViewStore = isList.value ? useListViewStoreOrThrow() : undefined
const { getMetaByKey } = useMetas()

function getTableTitle(tableId?: string) {
  if (!tableId) return t('general.unknown')
  const baseId = (meta.value as TableType)?.base_id
  const tableMeta = getMetaByKey(baseId, tableId)
  return tableMeta?.title || t('general.unknown')
}

const isDropdownOpen = ref(false)

// Compact hosts (interface toolbar): the selected-field chip shows the label only.
const isFieldListCompact = inject(FieldListCompactInj, ref(false))

const showSearchBox = ref(false)

// Query cleared by Escape; restored (selected) on the next open.
const lastClosedQuery = ref('')

// Query (and field) the shown results are for; Enter on it steps through matches instead of reloading.
const lastSearchedKey = ref('')

// Set by Enter or an arrow; a new query or field clears it.
const isSearchStepping = ref(false)

const globalSearchRef = ref<HTMLInputElement>()

const globalSearchWrapperRef = ref<HTMLInputElement>()

const toolbarElRef = ref<HTMLElement | null>(null)

// The flex-1 spacer that sits immediately to the left of the search box in the toolbar.
const spacerElRef = ref<HTMLElement | null>(null)

// Bumped on every toolbar width change to force the search dropdown to re-align — see usage below.
const realignTick = ref(0)

const { width: spacerWidth } = useElementSize(spacerElRef)

const { width: wrapperWidth } = useElementSize(globalSearchWrapperRef)

// State-independent measure of the space available to the search box: the spacer width plus the
// wrapper's own in-flow width. Expanded, the box is a 0-footprint teleported overlay (wrapper ≈ 0,
// spacer ≈ all free space); collapsed, the wrapper holds the ~28px icon and the spacer shrinks by the
// same amount — so the sum stays constant and the collapse decision below never flaps on toggle.
const freeSpaceForSearch = computed(() => spacerWidth.value + wrapperWidth.value)

// Approx width the expanded search box needs (field selector + input + padding). Quick heuristic —
// can later be refined by measuring the box. Driven off real free space (not raw toolbar width) so it
// does not mis-fire in icon mode, where the toolbar buttons collapse to icons and free up space.
const EXPANDED_SEARCH_MIN_WIDTH = 320

// The count and arrows share the input's row once there is a query.
const SEARCH_RESULT_SLOT_WIDTH = 150

const shouldCollapseSearch = computed(
  () =>
    freeSpaceForSearch.value > 0 &&
    freeSpaceForSearch.value < EXPANDED_SEARCH_MIN_WIDTH + (search.value.query?.trim() ? SEARCH_RESULT_SLOT_WIDTH : 0) - 20,
)

const isSearchButtonVisible = computed(() => {
  // Toolbar too narrow: keep the search collapsed to its icon unless the user explicitly expands it —
  // even with an active query (the icon shows an indicator dot instead of expanding over the toolbar).
  if (shouldCollapseSearch.value) {
    return !showSearchBox.value
  }

  return !search.value.query && !showSearchBox.value
})

const isValidSearchQuery = computed(() => {
  return !search.value.query?.trim() || search.value.isValidFieldQuery
})

const isSearchResultVisible = computed(() => {
  return (
    !isDropdownOpen.value &&
    search.value.query?.trim() &&
    !isMobileMode.value &&
    (isGrid.value || isGallery.value) &&
    !isGroupBy.value
  )
})

const columns = computed(() => {
  if (isList.value && listViewStore?.selectedLevel.value?.fk_model_id) {
    const levelTableId = listViewStore.selectedLevel.value.fk_model_id
    const baseId = (meta.value as TableType)?.base_id
    const levelMeta = getMetaByKey(baseId, levelTableId)
    if (levelMeta?.columns) {
      return (levelMeta.columns as ColumnType[]).filter((column) => isSearchableColumn(column))
    }
  }
  return (meta.value as TableType)?.columns?.filter((column) => isSearchableColumn(column)) ?? []
})

// Grouped grids load rows per group and keep single-field search for now.
const isAllFieldsSearchAvailable = computed(() => isAllFieldsSearchSupported.value && !isGroupBy.value)

// Listed with an upgrade badge on a plan without it, but never selected.
const isAllFieldsUsable = computed(() => isAllFieldsSearchAvailable.value && !blockGlobalSearch.value)

const isAllFieldsSelected = computed(() => isAllFieldsUsable.value && search.value.field === ALL_FIELDS_SEARCH_FIELD)

const allFieldsOption = computed(() => ({ id: ALL_FIELDS_SEARCH_FIELD, title: t('labels.allFields') } as ColumnType))

const fieldOptions = computed(() =>
  isAllFieldsSearchAvailable.value ? [allFieldsOption.value, ...columns.value] : columns.value,
)

// Only an all-fields count is capped; a single-field count is exact.
const isSearchCountCapped = computed(() => isAllFieldsSelected.value && totalRowsWithSearchQuery.value > SEARCH_COUNT_CAP)

const searchCountLabel = computed(() =>
  isSearchCountCapped.value ? `${SEARCH_COUNT_CAP.toLocaleString()}+` : totalRowsWithSearchQuery.value.toLocaleString(),
)

const searchTotalLabel = computed(() => totalRowsWithoutSearchQuery.value.toLocaleString())

const searchCountTooltip = computed(() =>
  t(
    'title.countOfTotalMatchingRecords',
    { matched: searchCountLabel.value, total: searchTotalLabel.value },
    totalRowsWithoutSearchQuery.value,
  ),
)

// Say why a search may be slow or missing rows.
const searchStateMessage = computed(() => {
  if (!isAllFieldsSelected.value) return ''
  switch (searchState.value) {
    case 'indexing':
      return t('msg.info.searchStateIndexing')
    case 'failed':
      return t('msg.info.searchStateFailed')
    case 'too_large_unindexed':
      return t('msg.info.searchStateTooLargeUnindexed')
    case 'too_large':
      return t('msg.info.searchStateTooLarge')
    case 'unsupported':
      return t('msg.info.searchStateUnsupported')
    case 'catching_up':
      return t('msg.info.searchStateCatchingUp')
    case 'term_too_short':
      return t('msg.info.searchStateTermTooShort')
    default:
      return ''
  }
})

// Arrows stay (disabled) at zero matches so the input doesn't change width.
const isSearchNavigationShown = computed(
  () => isAllFieldsSelected.value && isSearchResultVisible.value && isGrid.value && !isGroupBy.value,
)

// Next/previous steps through the grid's rows, which are all matches (all-fields search only).
const isSearchNavigationVisible = computed(() => isSearchNavigationShown.value && totalRowsWithSearchQuery.value > 0)

// "1/900" replaces "900 of 1,000" only after a step; a slash so it never reads as the count.
const searchPositionLabel = computed(() =>
  isSearchStepping.value && isSearchNavigationVisible.value && searchCursorRow.value >= 0
    ? `${(searchCursorRow.value + 1).toLocaleString()}/${searchCountLabel.value}`
    : '',
)

watch(
  () => activeView.value?.id,
  (n, o) => {
    if (n !== o) {
      let reset = false

      // A tree-scoped search (the LTAR embedded viz) owns its own state, so it
      // must keep its hands off the app-global "last opened view": stamping a
      // synthetic viz id there left the PAGE's box resetting itself on its next
      // view switch — the very cross-talk the scope exists to stop.
      if (!isScopedSearch && n !== lastOpenedViewId.value) {
        lastOpenedViewId.value = n
        reset = true
      }

      lastClosedQuery.value = ''
      loadFieldQuery(activeView.value?.id, reset)
    }
  },
  { immediate: true },
)

if (isList.value && listViewStore) {
  watch(
    () => listViewStore!.selectedLevelId.value,
    () => {
      search.value.field = ''
      search.value.query = ''
    },
  )
}

function onPressEnter() {
  $e('a:view:search')
  reloadData.trigger({ shouldShowLoading: false, offset: 0, inPlace: true })
  reloadAggregate?.trigger()
}

// Turned off on the server since this page loaded: with appInfo refreshed the box falls back to the display value field.
watch(searchState, async (state) => {
  if (state !== 'disabled') return
  await loadAppInfo()
  await nextTick()
  if (!appInfo.value.globalSearchEnabled && search.value.query?.trim()) onPressEnter()
})

function searchKey() {
  return `${search.value.field}:${search.value.query?.trim() ?? ''}`
}

function navigateSearch(direction: 1 | -1) {
  isSearchStepping.value = true
  $e('c:view:search:navigate', { direction: direction === 1 ? 'next' : 'previous' })
  // Past the cap only the first SEARCH_COUNT_CAP matches are loaded, so stepping stops at the ends instead of wrapping.
  eventBus.emit(SmartsheetStoreEvents.SEARCH_NAVIGATE, {
    direction,
    viewId: activeView.value?.id,
    wrap: !isSearchCountCapped.value,
  })
}

// Enter runs the search at once; the typing debounce still pending for the same text would run it again.
let enterSearch: { key: string; at: number } | undefined

function onSearchEnter(e: KeyboardEvent) {
  if (isSearchNavigationVisible.value && lastSearchedKey.value === searchKey()) {
    navigateSearch(e.shiftKey ? -1 : 1)
    return
  }
  enterSearch = { key: searchKey(), at: Date.now() }
  onPressEnter()
}

const displayColumn = computed(() => {
  if (search.value.field) {
    // use search field label if specified
    return columns.value?.find((column) => column.id === search.value.field)
  }
  // use primary value label by default
  const pvColumn = columns.value?.find((column) => column.pv)
  search.value.field = pvColumn?.id as string
  return pvColumn
})

watch(searchKey, () => {
  isSearchStepping.value = false
})

// "All fields" is the default where available; elsewhere the box falls back to the display value field.
watch(
  [isAllFieldsUsable, () => search.value.field, columns],
  ([isAvailable, field]) => {
    if (!field && isAvailable) {
      search.value.field = ALL_FIELDS_SEARCH_FIELD
    } else if (!field || (field === ALL_FIELDS_SEARCH_FIELD && !isAvailable)) {
      search.value.field = columns.value?.find((column) => column.pv)?.id ?? ''
    }
  },
  { immediate: true },
)

const searchInputMode = computed(() => {
  if (!displayColumn.value?.uidt) return

  return getInputModeFromUITypes(displayColumn.value?.uidt as UITypes)
})

const displayColumnLabel = computed(() => {
  return displayColumn.value?.title
})

watchDebounced(
  () => search.value.query,
  () => {
    onPressEnter()
  },
  {
    debounce: 500,
  },
)

const onSelectOption = (column: ColumnType) => {
  search.value.field = column.id as string
  isDropdownOpen.value = false

  if (search.value.query?.length) {
    onPressEnter()
  }

  nextTick(() => {
    globalSearchRef.value?.focus()
  })
}

const handleShowSearchInput = () => {
  if (!search.value.query && lastClosedQuery.value) {
    search.value.query = lastClosedQuery.value
  }
  lastClosedQuery.value = ''
  showSearchBox.value = true

  setTimeout(() => {
    nextTick(() => {
      if (isSearchButtonVisible.value) return

      globalSearchRef.value?.focus()
      globalSearchRef.value?.select()
    })
  }, 300)
}

const handleEscapeKey = (e: KeyboardEvent) => {
  if (isDropdownOpen.value) return

  // Outside the box, the first Escape belongs to an in-progress cell edit.
  const isFromSearchBox = !!globalSearchWrapperRef.value?.contains(e.target as Node)
  if (!isFromSearchBox && gridEditEnabled.value) return

  if (search.value.query) lastClosedQuery.value = search.value.query
  search.value.query = ''
  showSearchBox.value = false
}

// Mobile has no Escape key: an empty search box closes on an outside tap.
onClickOutside(globalSearchWrapperRef, (e) => {
  if (!isMobileMode.value || !showSearchBox.value || search.value.query || isDropdownOpen.value) return

  if ((e.target as HTMLElement)?.closest?.('.nc-dropdown-toolbar-search, .nc-dropdown-toolbar-search-field-option')) return

  showSearchBox.value = false
})

// Re-align the search dropdown when the toolbar width changes. Opening/resizing the
// expanded-form, extension or action side panels shrinks the view (and the toolbar
// inside it), which moves the dropdown's anchor. Ant does not re-align a teleported
// popup on a position-only shift of its trigger, so the open dropdown would otherwise
// stay put and overlap the side panel. Bumping `realignTick` makes WrapperDropdown
// nudge the popup's `align` prop, which forces ant to re-align to the moved trigger.
useResizeObserver(toolbarElRef, () => {
  if (isSearchButtonVisible.value) return

  realignTick.value++
})

onMounted(() => {
  toolbarElRef.value = globalSearchWrapperRef.value?.closest('.nc-table-toolbar') ?? null
  spacerElRef.value = (globalSearchWrapperRef.value?.previousElementSibling as HTMLElement) ?? null

  if (search.value.query && !showSearchBox.value && !shouldCollapseSearch.value) {
    showSearchBox.value = true
  }
})

// on filter param changes reload the data
watch(
  () => route.value?.query?.where,
  () => {
    eventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
  },
)

useEventListener('keydown', (e: KeyboardEvent) => {
  // Skip if event originated inside the smart text panel (it has its own search)
  if ((e.target as HTMLElement)?.closest?.('.nc-smart-text-panel')) return

  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    // An open record is DOM, not canvas: leave Ctrl/Cmd+F to the browser's find
    if (isExpandedFormOpenExist()) return
    // Interface record sheet: only a search inside the sheet (LTAR viz) keeps the shortcut
    const recordSheet = document.querySelector('.nc-interface-record-form-sheet-layer')
    if (recordSheet && !recordSheet.contains(globalSearchWrapperRef.value ?? null)) return

    e.preventDefault()
    handleShowSearchInput()
  } else if (e.key === 'Escape') {
    handleEscapeKey(e)
  }
})

watch(
  isSearchButtonVisible,
  (newVal) => {
    isSearchExpanded.value = !newVal

    if (newVal) return

    isDropdownOpen.value = false
  },
  {
    immediate: true,
  },
)

useSearchCommands({
  view: activeView,
  isPublic,
  tableTitle: computed(() => meta.value?.title),
  showSearch: handleShowSearchInput,
  setQuery: (query) => {
    search.value.query = query
  },
})
</script>

<template>
  <div ref="globalSearchWrapperRef" class="nc-global-search-wrapper relative">
    <NcTooltip v-if="isSearchButtonVisible" :disabled="!search.query" placement="bottom">
      <template #title> {{ $t('general.searchIn') }} {{ displayColumnLabel ?? '' }}: {{ search.query }} </template>
      <NcButton
        size="small"
        type="text"
        class="nc-toolbar-btn !rounded-lg !h-7 !px-1.5 relative"
        data-testid="nc-global-search-show-input"
        :aria-label="$t('placeholder.searchRecords')"
        @click="handleShowSearchInput"
      >
        <GeneralIcon icon="search" class="h-4 w-4 text-nc-content-gray-subtle group-hover:text-nc-content-gray-extreme" />
        <span
          v-if="search.query"
          class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-nc-fill-primary"
          data-testid="nc-global-search-active-indicator"
        />
      </NcButton>
    </NcTooltip>
    <LazySmartsheetToolbarSearchDataWrapperDropdown v-else :visible="true" :realign-tick="realignTick">
      <div
        class="overflow-hidden"
        :class="{
          'border-1 rounded-lg border-nc-border-gray-medium focus-within:(border-primary shadow-selected)': isMobileMode,
        }"
      >
        <div
          v-if="isList && listViewStore && listViewStore.levels.value.length > 1"
          class="flex items-center gap-1 px-2 py-1 border-b-1 border-nc-border-gray-medium"
        >
          <div
            v-for="(level, index) in listViewStore.levels.value"
            :key="level.id || index"
            class="px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors truncate"
            :class="{
              'bg-nc-bg-brand text-nc-content-brand': listViewStore.selectedLevelId.value === level.id,
              'text-nc-content-gray-muted hover:bg-nc-bg-gray-medium': listViewStore.selectedLevelId.value !== level.id,
            }"
            @click="listViewStore.setSelectedLevel(level.id ?? null)"
          >
            {{ getTableTitle(level.fk_model_id) }}
          </div>
        </div>
        <div class="flex flex-row h-8 relative">
          <NcDropdown
            v-model:visible="isDropdownOpen"
            :trigger="['click']"
            overlay-class-name="nc-dropdown-toolbar-search-field-option"
          >
            <div class="flex items-center gap-2 group px-2 cursor-pointer" @click="isDropdownOpen = !isDropdownOpen">
              <GeneralIcon icon="search" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
              <div class="h-5 flex items-center gap-1 px-1 rounded-md text-nc-content-brand bg-nc-bg-brand-inverted select-none">
                <SmartsheetHeaderIcon v-if="!isFieldListCompact" :column="displayColumn" class="!w-3.5 !h-3.5 !mx-0" />
                <div v-if="!isMobileMode" class="w-16 text-bodyDefaultSm font-medium truncate">
                  {{ displayColumnLabel ?? '' }}
                </div>

                <div class="flex items-center justify-center px-1">
                  <GeneralIcon
                    icon="chevronDown"
                    class="!text-current flex-none transform transition-transform duration-25 w-3.5 h-3.5"
                    :class="{ '!rotate-180': isDropdownOpen }"
                  />
                </div>
              </div>
            </div>
            <template #overlay>
              <SmartsheetToolbarFieldListWithSearch
                :is-parent-open="isDropdownOpen"
                :selected-option-id="search.field"
                show-selected-option
                :options="columns"
                :input-bordered="false"
                :search-input-placeholder="$t('placeholder.searchFields')"
                toolbar-menu="globalSearch"
                @selected="onSelectOption"
              />
            </template>
          </NcDropdown>

          <form class="p-0 flex-1 flex" @submit.prevent>
            <a-input
              v-if="search.query || showSearchBox"
              ref="globalSearchRef"
              v-model:value="search.query"
              :inputmode="searchInputMode"
              name="globalSearchQuery"
              size="small"
              class="!text-bodyDefaultSm flex-1 md:!w-40 h-full nc-view-search-data !pl-0"
              :placeholder="`${$t('general.searchIn')} ${displayColumnLabel ?? ''}`"
              :bordered="false"
              autocomplete="off"
              data-testid="search-data-input"
              @press-enter="onPressEnter"
            >
            </a-input>
          </form>
          <div
            v-if="!isValidSearchQuery || isSearchResultVisible"
            class="nc-search-result flex-none flex items-center gap-0.5 my-1.5 pl-1.5 pr-1 border-l-1 border-nc-border-gray-medium"
            data-testid="nc-search-result"
          >
            <NcTooltip
              v-if="!isValidSearchQuery"
              :title="$t('msg.error.invalidSearchQuery')"
              placement="topRight"
              class="flex px-1"
            >
              <GeneralIcon icon="ncInfo" class="flex-none h-3.5 w-3.5 text-nc-content-red-medium" />
            </NcTooltip>
            <template v-else>
              <NcTooltip v-if="searchStateMessage" :title="searchStateMessage" placement="bottom" class="flex px-0.5">
                <GeneralIcon
                  icon="alertTriangle"
                  class="flex-none h-3.5 w-3.5 text-nc-content-orange-medium"
                  data-testid="nc-search-state"
                />
              </NcTooltip>
              <NcTooltip placement="bottom" class="flex">
                <template #title>
                  {{ searchCountTooltip }}
                  <template v-if="isSearchCountCapped">
                    <br />
                    {{ $t('msg.info.searchNavigationCapped', { cap: SEARCH_COUNT_CAP.toLocaleString() }) }}
                  </template>
                </template>
                <span
                  class="px-1 text-bodySm whitespace-nowrap tabular-nums"
                  :class="totalRowsWithSearchQuery ? 'text-nc-content-gray-muted' : 'text-nc-content-red-medium'"
                  data-testid="nc-search-count"
                >
                  <span v-if="searchPositionLabel" class="text-nc-content-gray font-semibold">{{ searchPositionLabel }}</span>
                  <i18n-t v-else keypath="title.countOfTotal" tag="span">
                    <template #count>
                      <span :class="{ 'text-nc-content-gray font-semibold': totalRowsWithSearchQuery }">{{
                        searchCountLabel
                      }}</span>
                    </template>
                    <template #total>{{ searchTotalLabel }}</template>
                  </i18n-t>
                </span>
              </NcTooltip>
              <div
                v-if="isSearchNavigationShown"
                class="nc-search-navigation flex items-center"
                data-testid="nc-search-navigation"
              >
                <NcTooltip :title="`${$t('labels.previous')} (Shift + Enter)`" placement="bottom">
                  <NcButton
                    size="xxsmall"
                    type="text"
                    :disabled="!isSearchNavigationVisible"
                    data-testid="nc-search-navigation-previous"
                    @mousedown.prevent
                    @click="navigateSearch(-1)"
                  >
                    <GeneralIcon icon="arrowUp" class="h-3.5 w-3.5" />
                  </NcButton>
                </NcTooltip>
                <NcTooltip :title="`${$t('general.next')} (Enter)`" placement="bottom">
                  <NcButton
                    size="xxsmall"
                    type="text"
                    :disabled="!isSearchNavigationVisible"
                    data-testid="nc-search-navigation-next"
                    @mousedown.prevent
                    @click="navigateSearch(1)"
                  >
                    <GeneralIcon icon="arrowDown" class="h-3.5 w-3.5" />
                  </NcButton>
                </NcTooltip>
              </div>
            </template>
          </div>
        </div>
      </div>
    </LazySmartsheetToolbarSearchDataWrapperDropdown>
  </div>
</template>

<style scoped>
:deep(input::placeholder) {
  @apply !text-gray-400;
  line-height: 0.8rem !important;
  font-size: 0.8rem !important;
}
</style>
