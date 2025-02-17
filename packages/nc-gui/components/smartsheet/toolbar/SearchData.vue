<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'

const reloadData = inject(ReloadViewDataHookInj)!

const activeView = inject(ActiveViewInj, ref())

const { meta, eventBus } = useSmartsheetStoreOrThrow()

const router = useRouter()

const route = router.currentRoute

const { search, loadFieldQuery } = useFieldQuery()

const isDropdownOpen = ref(false)

const showSearchBox = ref(false)

const globalSearchRef = ref<HTMLInputElement>()

const globalSearchWrapperRef = ref<HTMLInputElement>()

const { isMobileMode } = useGlobal()

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
      loadFieldQuery(activeView.value?.id)
    }
  },
  { immediate: true },
)

function onPressEnter() {
  reloadData.trigger({ shouldShowLoading: false, offset: 0 })
}

const displayColumnLabel = computed(() => {
  if (search.value.field) {
    // use search field label if specified
    return columns.value?.find((column) => column.id === search.value.field)?.title
  }
  // use primary value label by default
  const pvColumn = columns.value?.find((column) => column.pv)
  search.value.field = pvColumn?.id as string
  return pvColumn?.title
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
}

const handleShowSearchInput = () => {
  showSearchBox.value = true

  nextTick(() => {
    globalSearchRef.value?.focus()
  })
}

onClickOutside(globalSearchWrapperRef, (e) => {
  const targetEl = e.target as HTMLElement
  if (search.value.query || targetEl.closest('.nc-dropdown-toolbar-search-field-option')) {
    return
  }

  showSearchBox.value = false
})

onMounted(() => {
  if (search.value.query && !showSearchBox.value) {
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
</script>

<template>
  <div ref="globalSearchWrapperRef" class="nc-global-search-wrapper">
    <a-button
      v-if="!search.query && !showSearchBox"
      class="nc-toolbar-btn !rounded-lg !h-7 !px-1.5"
      data-testid="nc-global-search-show-input"
      @click="handleShowSearchInput"
    >
      <GeneralIcon icon="search" class="h-4 w-4 text-gray-700 group-hover:text-black" />
    </a-button>
    <div
      v-else
      class="flex flex-row border-1 rounded-lg h-7 xs:(h-10 ml-0) ml-1 border-gray-200 overflow-hidden focus-within:border-primary"
      :class="{ 'border-primary': search.query.length !== 0 }"
    >
      <NcDropdown
        v-model:visible="isDropdownOpen"
        :trigger="['click']"
        overlay-class-name="nc-dropdown-toolbar-search-field-option"
      >
        <div
          class="flex items-center group px-2 cursor-pointer border-r-1 border-gray-200 hover:bg-gray-100"
          :class="{ 'bg-gray-50 ': isDropdownOpen }"
          @click="isDropdownOpen = !isDropdownOpen"
        >
          <GeneralIcon icon="search" class="ml-1 mr-2 h-3.5 w-3.5 text-gray-500 group-hover:text-black" />
          <div v-if="!isMobileMode" class="w-16 text-xs font-medium text-gray-400 truncate">
            {{ displayColumnLabel ?? '' }}
          </div>
          <div class="xs:(text-gray-600) group-hover:text-gray-700 sm:(text-gray-400)">
            <component :is="iconMap.arrowDown" class="text-sm text-inherit" />
          </div>
        </div>
        <template #overlay>
          <SmartsheetToolbarFieldListWithSearch
            :is-parent-open="isDropdownOpen"
            :selected-option-id="search.field"
            show-selected-option
            :options="columns"
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
          class="text-xs w-40 h-full nc-view-search-data"
          :placeholder="`${$t('general.searchIn')} ${displayColumnLabel ?? ''}`"
          :bordered="false"
          data-testid="search-data-input"
          @press-enter="onPressEnter"
        >
        </a-input>
      </form>
    </div>
  </div>
</template>

<style scoped>
:deep(input::placeholder) {
  @apply !text-gray-400;
  line-height: 0.8rem !important;
  font-size: 0.8rem !important;
}
</style>
