<script setup lang="ts">
import {type ColumnType, extractFilterFromXwhere, type TableType} from 'nocodb-sdk'

const isLocked = inject(IsLockedInj, ref(false))

const activeView = inject(ActiveViewInj, ref())

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)


const router = useRouter()
const route = router.currentRoute
const meta = inject(MetaInj, ref())

const aliasColObjMap = computed(() => {
  const colObj = (meta.value as TableType)?.columns?.reduce((acc, col) => {
    acc[col.title] = col;
    return acc;
  }, {});
  return colObj;
})

const filtersFromUrlParams = computed(() => {
  if (route.value.query.where) {
    return extractFilterFromXwhere(route.value.query.where, aliasColObjMap.value, false)?.filters
  }
})

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

const open = ref(false)

const allFilters = ref({})

provide(AllFiltersInj, allFilters)

useMenuCloseOnEsc(open)

const draftFilter = ref({})
const queryFilterOpen = ref(false)

eventBus.on(async (event, column: ColumnType) => {
  if (!column) return

  if (event === SmartsheetStoreEvents.FILTER_ADD) {
    draftFilter.value = { fk_column_id: column.id }
    open.value = true
  }
})

const combinedFilterLength = computed(() => {
  return filtersLength.value + (filtersFromUrlParams.value?.filters?.length || 0)
})
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-filter-menu nc-toolbar-dropdown overflow-hidden"
    class="!xs:hidden"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode">
      <template #title>
        {{ $t('activity.filter') }}
      </template>

      <NcButton
        v-e="['c:filter']"
        class="nc-filter-menu-btn nc-toolbar-btn !border-0 !h-7"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.filter" class="h-4 w-4" />
            <!-- Filter -->
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">{{
              $t('activity.filter')
            }}</span>
          </div>

          <span v-if="combinedFilterLength" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">{{
            combinedFilterLength
          }}</span>

          <!--    show a warning icon with tooltip if query filter error is there -->
          <template v-if="filtersFromUrlParams?.errors?.length">
            <GeneralIcon icon="ncAlertCircle" class="nc-error-icon w-3.5" />
          </template>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div>
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
        <SmartsheetToolbarColumnFilter
            ref="filterComp"
            v-model="filtersFromUrlParams"
            v-model:is-open="open"
            class="nc-table-toolbar-menu"
            :auto-save="false"
            data-testid="nc-filter-menu"
            :is-view-filter="false"
        >
        </SmartsheetToolbarColumnFilter>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-query-filter.readonly .nc-cell-field,
.nc-query-filter.readonly {
  input,
  .text-nc-content-gray-muted {
    @apply !text-gray-400;
  }
}
</style>

<style lang="scss" scoped>
.nc-error-alert {
  border: 1px solid var(--nc-border-grey-medium);
  border-radius: var(--measurements-radius-small);

  .nc-error-msg {
    color: var(--nc-content-grey-muted);
    line-height: 20px;
  }

  .nc-error-title {
    font-size: 16px;
    line-height: 24px;
  }
}

.nc-error-icon {
  color: var(--nc-content-red-dark);
}

.nc-info-icon {
  color: var(--nc-content-grey-muted);
}

.nc-chevron-icon {
  color: var(--nc-content-grey-subtle);
}
</style>
