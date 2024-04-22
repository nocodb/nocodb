<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveViewInj,
  AllFiltersInj,
  IsLockedInj,
  SmartsheetStoreEvents,
  computed,
  iconMap,
  inject,
  ref,
  useGlobal,
  useMenuCloseOnEsc,
  useSmartsheetStoreOrThrow,
  useViewFilters,
  watch,
} from '#imports'

const isLocked = inject(IsLockedInj, ref(false))

const activeView = inject(ActiveViewInj, ref())

const { isMobileMode } = useGlobal()

const filterComp = ref<typeof ColumnFilter>()

const { nestedFilters, eventBus } = useSmartsheetStoreOrThrow()

// todo: avoid duplicate api call by keeping a filter store
const { nonDeletedFilters, loadFilters } = useViewFilters(
  activeView!,
  undefined,
  computed(() => true),
  () => false,
  nestedFilters.value,
  true,
)

const filtersLength = ref(0)

watch(
  () => activeView?.value?.id,
  async (viewId) => {
    if (viewId) {
      await loadFilters(undefined, false, true)
      filtersLength.value = nonDeletedFilters.value.length || 0
    }
  },
  { immediate: true },
)

const open = ref(false)

const allFilters = ref({})

provide(AllFiltersInj, allFilters)

useMenuCloseOnEsc(open)

const draftFilter = ref({})

eventBus.on(async (event, column: ColumnType) => {
  if (!column) return

  if (event === SmartsheetStoreEvents.FILTER_ADD) {
    draftFilter.value = { fk_column_id: column.id }
    open.value = true
  }
})
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-filter-menu nc-toolbar-dropdown"
    class="!xs:hidden"
  >
    <div :class="{ 'nc-active-btn': filtersLength }">
      <a-button v-e="['c:filter']" class="nc-filter-menu-btn nc-toolbar-btn txt-sm" :disabled="isLocked">
        <div class="flex items-center gap-2">
          <component :is="iconMap.filter" class="h-4 w-4" />
          <!-- Filter -->
          <span v-if="!isMobileMode" class="text-capitalize !text-sm font-medium">{{ $t('activity.filter') }}</span>

          <span v-if="filtersLength" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">{{ filtersLength }}</span>
        </div>
      </a-button>
    </div>

    <template #overlay>
      <SmartsheetToolbarColumnFilter
        ref="filterComp"
        v-model:draft-filter="draftFilter"
        class="nc-table-toolbar-menu"
        :auto-save="true"
        data-testid="nc-filter-menu"
        @update:filters-length="filtersLength = $event"
      >
      </SmartsheetToolbarColumnFilter>
    </template>
  </NcDropdown>
</template>
