<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'

const reloadData = inject(ReloadViewDataHookInj)!

const activeView = inject(ActiveViewInj, ref())

const { meta, eventBus, isGrid, isGallery, totalRowsWithSearchQuery, totalRowsWithoutSearchQuery } = useSmartsheetStoreOrThrow()

const { lastOpenedViewId } = storeToRefs(useViewsStore())

const { isGroupBy } = useViewGroupByOrThrow()

const router = useRouter()

const route = router.currentRoute

const { search, loadFieldQuery } = useFieldQuery()

const { isMobileMode } = useGlobal()

const isDropdownOpen = ref(false)

const showSearchBox = ref(!!isMobileMode.value)

const globalSearchRef = ref<HTMLInputElement>()

const globalSearchWrapperRef = ref<HTMLInputElement>()

const isSearchButtonVisible = computed(() => {
  return !search.value.query && !showSearchBox.value
})

const isSearchResultVisible = computed(() => {
  return (
    !isDropdownOpen.value &&
    search.value.query?.trim() &&
    !isMobileMode.value &&
    ((isGrid.value && !isGroupBy.value) || isGallery.value)
  )
})

const columns = computed(
  () =>
    (meta.value as TableType)?.columns?.filter(
      (column) =>
        !isSystemColumn(column) && ![UITypes.Links, UITypes.Rollup, UITypes.DateTime, UITypes.Date].includes(column?.uidt),
    ) ?? [],
)

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

function onPressEnter() {
  reloadData.trigger({ shouldShowLoading: false, offset: 0 })
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
    })
  }, 300)
}

const handleEscapeKey = () => {
  if (isDropdownOpen.value) return
  search.value.query = ''
  if (!isMobileMode.value) {
    showSearchBox.value = false
  }
}

const handleClickOutside = (e: MouseEvent | KeyboardEvent) => {
  const targetEl = e.target as HTMLElement
  if (search.value.query || targetEl.closest('.nc-dropdown-toolbar-search, .nc-dropdown-toolbar-search-field-option')) {
    return
  }

  if (!isMobileMode.value) {
    showSearchBox.value = false
  }
}

onClickOutside(globalSearchWrapperRef, handleClickOutside)

onMounted(() => {
  if ((search.value.query || isMobileMode.value) && !showSearchBox.value) {
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
    <a-button
      v-if="isSearchButtonVisible"
      class="nc-toolbar-btn !rounded-lg !h-7 !px-1.5"
      data-testid="nc-global-search-show-input"
      @click="handleShowSearchInput"
    >
      <GeneralIcon icon="search" class="h-4 w-4 text-gray-700 group-hover:text-black" />
    </a-button>
    <LazySmartsheetToolbarSearchDataWrapperDropdown v-else :visible="true">
      <div
        :class="{
          'border-1 rounded-lg border-gray-200 overflow-hidden focus-within:(border-primary shadow-selected)': isMobileMode,
          'border-primary shadow-selected': isMobileMode && search.query.length !== 0,
        }"
      >
        <div class="flex flex-row h-8">
          <NcDropdown
            v-model:visible="isDropdownOpen"
            :trigger="['click']"
            overlay-class-name="nc-dropdown-toolbar-search-field-option"
          >
            <div class="flex items-center gap-2 group px-2 cursor-pointer" @click="isDropdownOpen = !isDropdownOpen">
              <GeneralIcon icon="search" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
              <div class="h-5 flex items-center gap-1 px-1 rounded-md text-nc-content-brand bg-nc-bg-brand">
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

          <form class="p-0" @submit.prevent>
            <a-input
              v-if="search.query || showSearchBox"
              ref="globalSearchRef"
              v-model:value="search.query"
              name="globalSearchQuery"
              size="small"
              class="!text-bodyDefaultSm !w-40 h-full nc-view-search-data !pl-0"
              :placeholder="`${$t('general.searchIn')} ${displayColumnLabel ?? ''}`"
              :bordered="false"
              autocomplete="off"
              data-testid="search-data-input"
              @press-enter="onPressEnter"
            >
            </a-input>
          </form>
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
