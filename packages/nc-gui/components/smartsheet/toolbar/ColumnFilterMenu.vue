<script setup lang="ts">
import { type ColumnType, type TableType, extractFilterFromXwhere } from 'nocodb-sdk'

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
    acc[col.title] = col
    return acc
  }, {})
  return colObj
})

const filtersFromUrlParams = computed(() => {
  if (route.value.query.where) {
    return extractFilterFromXwhere(route.value.query.where, aliasColObjMap.value, false)
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
          <span v-if="filtersLength" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">{{ filtersLength }}</span>

          <!--    show a warning icon with tooltip if query filter error is there -->
          <template v-if="filtersFromUrlParams?.errors?.length">
            <NcTooltip :title="filtersFromUrlParams.errors?.[0]?.message" placement="top">
              <GeneralIcon icon="ncAlertCircle" class="text-orange-500 w-3.5" />
            </NcTooltip>
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
        <template v-if="filtersFromUrlParams">
          <a-divider class="!my-1" />
          <div class="px-2 pb-2">
            <div class="p-2 leading-5 font-semibold mb-3 inline-flex gap-2">
              {{ $t('title.urlFilters') }}
              <div
                v-if="filtersFromUrlParams?.filters?.length"
                class="bg-[#F0F3FF] px-1 rounded rounded-6px font-medium text-brand-500 h-5"
              >
                {{ filtersFromUrlParams.filters.length }}
              </div>
            </div>

            <SmartsheetToolbarColumnFilter
              v-if="filtersFromUrlParams.filters"
              :key="route.query?.where"
              ref="filterComp"
              v-model="filtersFromUrlParams.filters"
              v-model:is-open="open"
              class="px-2 pb-2"
              :auto-save="false"
              :is-view-filter="false"
              read-only
              query-filter
            >
            </SmartsheetToolbarColumnFilter>

            <a-alert v-else-if="filtersFromUrlParams?.errors?.length" type="warning !mx-2 !mb-2">
              <template #message>
                <div class="flex flex-row items-center gap-3">
                  <GeneralIcon icon="ncAlertCircle" class="text-orange-500 w-6 h-6" />
                  <span class="font-weight-bold">{{ filtersFromUrlParams.errors?.[0]?.message }}</span>
                </div>
              </template>
            </a-alert>
          </div>
        </template>
      </div>
    </template>
  </NcDropdown>
</template>
