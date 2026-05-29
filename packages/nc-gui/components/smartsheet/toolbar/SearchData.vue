<script lang="ts" setup>
import type { ColumnType, TableType, UITypes } from 'nocodb-sdk'

const isSearchExpanded = defineModel<boolean>('searchExpanded', { default: false })

const reloadData = inject(ReloadViewDataHookInj)!

const reloadAggregate = inject(ReloadAggregateHookInj)

const activeView = inject(ActiveViewInj, ref())

const { $e } = useNuxtApp()

const { meta, eventBus, isGrid, isGallery, isList, totalRowsWithSearchQuery, totalRowsWithoutSearchQuery, gridEditEnabled } =
  useSmartsheetStoreOrThrow()

const { lastOpenedViewId } = storeToRefs(useViewsStore())

const { isGroupBy } = useViewGroupByOrThrow()

const router = useRouter()

const route = router.currentRoute

const { search, loadFieldQuery } = useFieldQuery()

const { isMobileMode } = useGlobal()

const listViewStore = isList.value ? useListViewStoreOrThrow() : undefined
const { getMetaByKey } = useMetas()

function getTableTitle(tableId?: string) {
  if (!tableId) return 'Unknown'
  const baseId = (meta.value as TableType)?.base_id
  const tableMeta = getMetaByKey(baseId, tableId)
  return tableMeta?.title || 'Unknown'
}

const isDropdownOpen = ref(false)

const showSearchBox = ref(false)

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

const shouldCollapseSearch = computed(
  () => freeSpaceForSearch.value > 0 && freeSpaceForSearch.value < EXPANDED_SEARCH_MIN_WIDTH - 20,
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
    ((isGrid.value && !isGroupBy.value) || isGallery.value)
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

watch(
  () => activeView.value?.id,
  (n, o) => {
    if (n !== o) {
      let reset = false

      if (n !== lastOpenedViewId.value) {
        lastOpenedViewId.value = n
        reset = true
      }

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
  reloadData.trigger({ shouldShowLoading: false, offset: 0 })
  reloadAggregate?.trigger()
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
    maxWait: 600,
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
  showSearchBox.value = true

  setTimeout(() => {
    nextTick(() => {
      if (isSearchButtonVisible.value) return

      globalSearchRef.value?.focus()
      globalSearchRef.value?.select()
    })
  }, 300)
}

const handleEscapeKey = () => {
  if (isDropdownOpen.value || gridEditEnabled.value) return

  search.value.query = ''
  showSearchBox.value = false
}

const handleClickOutside = (e: MouseEvent | KeyboardEvent) => {
  const targetEl = e.target as HTMLElement
  if (targetEl?.closest('.nc-dropdown-toolbar-search, .nc-dropdown-toolbar-search-field-option')) {
    return
  }

  // With room, an active query keeps the box open (existing behaviour). When the toolbar is too
  // narrow we instead fold it back to the indicator icon so it stops overlapping the toolbar.
  if (search.value.query && !shouldCollapseSearch.value) {
    return
  }

  showSearchBox.value = false
}

onClickOutside(globalSearchWrapperRef, handleClickOutside)

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
    e.preventDefault()
    handleShowSearchInput()
  } else if (e.key === 'Escape') {
    handleEscapeKey()
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
                <SmartsheetHeaderIcon :column="displayColumn" class="!w-3.5 !h-3.5 !mx-0" />
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
              :class="{
                '!pr-7': !isValidSearchQuery,
              }"
              :placeholder="`${$t('general.searchIn')} ${displayColumnLabel ?? ''}`"
              :bordered="false"
              autocomplete="off"
              data-testid="search-data-input"
              @press-enter="onPressEnter"
            >
            </a-input>
          </form>
          <NcTooltip
            v-if="!isValidSearchQuery"
            :title="$t('msg.error.invalidSearchQuery')"
            class="absolute right-1 top-[50%] transform -translate-y-[50%] flex items-center pr-1"
            placement="topRight"
          >
            <GeneralIcon icon="ncInfo" class="flex-none h-3.5 w-3.5 text-nc-content-red-medium" />
          </NcTooltip>
        </div>
        <div v-if="isSearchResultVisible" class="border-t-1 border-nc-border-gray-medium py-1 px-3 flex gap-3">
          <div class="text-nc-content-gray text-bodySmBold">
            {{ totalRowsWithSearchQuery }} of {{ totalRowsWithoutSearchQuery }}
          </div>
          <div class="text-nc-content-gray-muted text-bodySm">
            {{ $t('title.matchingResultsInRecords', { count: totalRowsWithSearchQuery }) }}
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
