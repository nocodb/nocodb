<script setup lang="ts">
import { type ColumnType, type LinkToAnotherRecordType, UITypesName, ViewLockType, ViewSettingOverrideOptions } from 'nocodb-sdk'
import { PlanLimitTypes, RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import rfdc from 'rfdc'
import { getColumnUidtByID as sortGetColumnUidtByID } from '~/utils/sortUtils'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const isLocked = inject(IsLockedInj, ref(false))
const reloadDataHook = inject(ReloadViewDataHookInj)
const isPublic = inject(IsPublicInj, ref(false))
const clone = rfdc()
const { eventBus, isList } = useSmartsheetStoreOrThrow()

const listViewStore = isList.value ? useListViewStoreOrThrow() : undefined
const isListConfigured = computed(
  () => (listViewStore?.isConfigured.value ?? false) && (listViewStore?.levels.value?.length ?? 0) > 1,
)
const { getMetaByKey } = useMetas()

const {
  sorts,
  saveOrUpdate,
  loadSorts,
  addSort: _addSort,
  deleteSort,
  canSyncSort,
} = useViewSorts(view, () => reloadDataHook?.trigger())

const { showSystemFields, metaColumnById } = useViewColumnsOrThrow()

const { appearanceConfig: filteredOrSortedAppearanceConfig } = useColumnFilteredOrSorted()

const showCreateSort = ref(false)

const { appInfo, isMobileMode } = useGlobal()

const { getPlanLimit } = useWorkspace()

const isCalendar = inject(IsCalendarInj, ref(false))

const { isUserViewOwner } = useViewsStore()

const isRestrictedEditor = computed(() => !isPublic.value && (isLocked.value || !canSyncSort.value))

// True when user is viewing a personal view they don't own
const isPersonalViewNonOwner = computed(() => view.value?.lock_type === ViewLockType.Personal && !isUserViewOwner(view.value))

const displayedSorts = computed(() => {
  if (!isList.value || !isListConfigured.value || !listViewStore?.selectedLevelId.value) {
    return sorts.value
  }
  return sorts.value.filter((s) => s.fk_level_id === listViewStore!.selectedLevelId.value)
})

const displayedExistingSorts = computed(() => displayedSorts.value.filter((s) => s.id))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const smartsheetEventHandler = (event: SmartsheetStoreEvents, payload) => {
  if (
    event === SmartsheetStoreEvents.SORT_RELOAD ||
    validateViewConfigOverrideEvent(event, ViewSettingOverrideOptions.SORT, payload)
  ) {
    loadSorts()
  }
}

eventBus.on(smartsheetEventHandler)

onBeforeUnmount(() => {
  eventBus.off(smartsheetEventHandler)
})

const levelTableColumns = computed(() => {
  if (!isList.value || !isListConfigured.value || !listViewStore?.selectedLevel.value) {
    return meta.value?.columns || []
  }
  const level = listViewStore.selectedLevel.value
  if (level.fk_model_id === meta.value?.id) {
    return meta.value?.columns || []
  }
  const tableMeta = getMetaByKey(meta.value?.base_id, level.fk_model_id)
  return tableMeta?.columns || []
})

const columns = computed(() =>
  clone(levelTableColumns.value).map((c) => {
    const isDisabled = [UITypes.QrCode, UITypes.Barcode, UITypes.ID, UITypes.Button].includes(c.uidt)

    if (isDisabled) {
      c.ncItemDisabled = true
      c.ncItemTooltip = `Sorting is not supported for ${UITypesName[c.uidt]} field`
    }

    return c
  }),
)

const columnByID = computed(() =>
  columns.value.reduce((obj, col) => {
    obj[col.id!] = col

    return obj
  }, {} as Record<string, ColumnType>),
)

const availableColumns = computed(() => {
  return columns.value
    ?.filter((c: ColumnType) => {
      if (c.uidt === UITypes.Links) {
        return true
      }
      if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
        return (
          /** hide system columns if not enabled */
          showSystemFields.value
        )
      } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID || c.uidt === UITypes.Button) {
        return false
      } else {
        /** ignore hasmany and manytomany relations if it's using within sort menu */
        return !(
          isLinksOrLTAR(c) &&
          ![RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes((c.colOptions as LinkToAnotherRecordType).type)
        )
        /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
      }
    })
    .filter((c) => !(displayedSorts.value ?? []).find((s) => s.fk_column_id === c.id))
})

const getColumnUidtByID = (key?: string) => {
  return sortGetColumnUidtByID(key, columnByID.value)
}

const open = ref(false)

useMenuCloseOnEsc(open)

const addSort = (column: ColumnType) => {
  _addSort(true, column)

  const createdSort = sorts.value[sorts.value.length - 1]

  if (isList.value && listViewStore?.selectedLevelId.value) {
    createdSort.fk_level_id = listViewStore.selectedLevelId.value
  }

  saveOrUpdate(createdSort, sorts.value.length - 1)

  showCreateSort.value = false
}

watch(open, () => {
  if (!open.value) {
    showCreateSort.value = false
  }
})

const getSortIndex = (sort: any) => sorts.value.findIndex((s) => s === sort)

watch(
  () => view?.value?.id,
  (viewId) => {
    if (viewId) {
      loadSorts()
    }
  },
  { immediate: true },
)
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-sort-menu nc-toolbar-dropdown overflow-hidden"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode" :class="{ 'nc-active-btn': sorts?.length }">
      <template #title>
        {{ $t('activity.sort') }}
      </template>
      <NcButton
        v-e="['c:sort']"
        :class="{
          '!border-1 !rounded-md': isCalendar,
          '!border-0': !isCalendar,
          [filteredOrSortedAppearanceConfig.SORTED.toolbarBgClass]: sorts?.length,
        }"
        class="nc-sort-menu-btn nc-toolbar-btn !h-7 group"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.sort" class="h-4 w-4 text-inherit" />

            <!-- Sort -->
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">
              {{ $t('activity.sort') }}
            </span>
          </div>
          <span
            v-if="sorts?.length"
            class="nc-toolbar-btn-chip"
            :class="{
              [filteredOrSortedAppearanceConfig.SORTED.toolbarChipBgClass]: true,
              [filteredOrSortedAppearanceConfig.SORTED.toolbarTextClass]: true,
            }"
            >{{ sorts.length }}</span
          >
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div
        :class="{
          'nc-locked-view': isLocked,
        }"
      >
        <div
          v-if="isList && isListConfigured"
          :class="{
            'max-w-64': !displayedSorts.length && !isPersonalViewNonOwner,
          }"
          class="px-2 py-2 border-b-1"
        >
          <SmartsheetToolbarListLevelSelector />
        </div>
        <SmartsheetToolbarCreateSort
          v-if="!displayedSorts.length && !isPersonalViewNonOwner"
          :sorts="displayedSorts"
          :is-parent-open="open"
          @created="addSort"
        />
        <div
          v-else
          class="pt-2 pb-2 pl-4 nc-filter-list max-h-[max(80vh,30rem)] xs:nc-min-w-screen-95 sm:min-w-102"
          data-testid="nc-sorts-menu"
        >
          <div class="sort-grid max-h-120 nc-scrollbar-thin pr-4 my-2 py-1" @click.stop>
            <template v-if="!isRestrictedEditor">
              <div
                v-for="sort of displayedSorts"
                :key="sort.id || sort.fk_column_id"
                class="flex first:mb-0 !mb-1.5 !last:mb-0 items-center"
              >
                <SmartsheetToolbarFieldListAutoCompleteDropdown
                  v-model="sort.fk_column_id"
                  class="flex caption nc-sort-field-select !w-44 flex-grow"
                  :columns="columns"
                  is-sort
                  :meta="meta"
                  :disabled="false"
                  @click.stop
                  @update:model-value="saveOrUpdate(sort, getSortIndex(sort))"
                />

                <NcSelect
                  v-model:value="sort.direction"
                  class="flex flex-grow-1 w-full nc-sort-dir-select"
                  :label="$t('labels.operation')"
                  dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir !rounded-lg"
                  :disabled="false"
                  @click.stop
                  @select="saveOrUpdate(sort, getSortIndex(sort))"
                >
                  <a-select-option
                    v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(sort.fk_column_id))"
                    :key="j"
                    v-e="['c:sort:operation:select']"
                    :value="option.value"
                  >
                    <div class="w-full flex items-center justify-between gap-2">
                      <div class="truncate flex-1">{{ option.text }}</div>
                      <component
                        :is="iconMap.check"
                        v-if="sort.direction === option.value"
                        id="nc-selected-item-icon"
                        class="text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>

                <NcTooltip placement="top" title="Remove" class="flex-none">
                  <NcButton
                    v-e="['c:sort:delete']"
                    size="small"
                    type="secondary"
                    :shadow="false"
                    :disabled="false"
                    class="nc-sort-item-remove-btn !max-w-8 !border-l-transparent !rounded-l-none"
                    @click.stop="deleteSort(sort, getSortIndex(sort))"
                  >
                    <component :is="iconMap.deleteListItem" />
                  </NcButton>
                </NcTooltip>
              </div>
            </template>
            <template v-else>
              <!-- Restricted editors (locked / non-owned personal) see the
                   saved sorts as read-only — the temp/local sort path is
                   intentionally gone now that editors have direct write
                   access on collab + own personal views. -->
              <!-- Existing Sorts (Read Only) -->
              <div
                v-for="(sort, i) of displayedExistingSorts"
                :key="`existing-${i}`"
                class="flex first:mb-0 !mb-1.5 !last:mb-0 items-center opacity-70"
              >
                <SmartsheetToolbarFieldListAutoCompleteDropdown
                  :model-value="sort.fk_column_id"
                  class="flex caption nc-sort-field-select !w-44 flex-grow"
                  :columns="meta.columns || columns"
                  is-sort
                  :meta="meta"
                  disabled
                  show-all-columns
                />

                <NcSelect
                  :value="sort.direction"
                  class="flex flex-grow-1 w-full nc-sort-dir-select"
                  :label="$t('labels.operation')"
                  dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir !rounded-lg"
                  :disabled="true"
                >
                  <a-select-option
                    v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(sort.fk_column_id))"
                    :key="j"
                    :value="option.value"
                  >
                    <div class="w-full flex items-center justify-between gap-2">
                      <div class="truncate flex-1">{{ option.text }}</div>
                      <component
                        :is="iconMap.check"
                        v-if="sort.direction === option.value"
                        id="nc-selected-item-icon"
                        class="text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>

                <NcTooltip placement="top" title="Remove" class="flex-none">
                  <NcButton
                    v-e="['c:sort:delete']"
                    size="small"
                    type="secondary"
                    :shadow="false"
                    :disabled="true"
                    class="nc-sort-item-remove-btn !max-w-8 !border-l-transparent !rounded-l-none"
                  >
                    <component :is="iconMap.deleteListItem" />
                  </NcButton>
                </NcTooltip>
              </div>
            </template>
          </div>

          <div v-if="!isRestrictedEditor" class="flex items-center justify-between empty:hidden pr-4 mt-1 mb-2">
            <NcDropdown
              v-if="availableColumns.length"
              v-model:visible="showCreateSort"
              :trigger="['click']"
              :disabled="false"
              overlay-class-name="nc-toolbar-dropdown"
            >
              <template v-if="appInfo.ee && !isPublic">
                <NcButton
                  v-if="displayedSorts.length < getPlanLimit(PlanLimitTypes.LIMIT_SORT_PER_VIEW) + 10"
                  v-e="['c:sort:add']"
                  :class="{
                    '!text-nc-content-brand': !isLocked,
                  }"
                  type="text"
                  size="small"
                  :disabled="false"
                  @click.stop="showCreateSort = true"
                >
                  <div class="flex gap-1 items-center">
                    <component :is="iconMap.plus" />
                    <!-- Add Sort Option -->
                    {{ $t('activity.addSort') }}
                  </div>
                </NcButton>
                <span v-else></span>
              </template>
              <template v-else>
                <NcButton
                  v-e="['c:sort:add']"
                  :class="{
                    '!text-nc-content-brand': !isLocked,
                  }"
                  type="text"
                  size="small"
                  :disabled="false"
                  @click.stop="showCreateSort = true"
                >
                  <div class="flex gap-1 items-center">
                    <component :is="iconMap.plus" />
                    <!-- Add Sort Option -->
                    {{ $t('activity.addSort') }}
                  </div>
                </NcButton>
              </template>
              <template #overlay>
                <SmartsheetToolbarCreateSort :sorts="displayedSorts" :is-parent-open="showCreateSort" @created="addSort" />
              </template>
            </NcDropdown>
            <LazyGeneralCopyFromAnotherViewActionBtn
              v-if="view && !isList"
              :view="view"
              :default-options="[ViewSettingOverrideOptions.SORT]"
              @open="open = false"
            />
          </div>
        </div>
        <GeneralLockedViewFooter
          v-if="isLocked"
          :class="{
            '-mt-2': displayedSorts.length,
          }"
          @on-open="open = false"
        />
        <div
          v-else-if="view && !displayedSorts.length"
          class="flex items-center justify-end empty:hidden pl-3 pr-2 py-1.5 border-t-1 border-nc-border-gray-medium"
        >
          <LazyGeneralCopyFromAnotherViewActionBtn
            v-if="!isList"
            :view="view"
            :default-options="[ViewSettingOverrideOptions.SORT]"
            @open="open = false"
          />
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
:deep(.selector-level) {
  &:has(.level-three) {
    @apply max-w-20;
  }
  &:has(.level-two) {
    @apply max-w-23;
  }
}

:deep(.nc-sort-field-select) {
  @apply !w-44;
  .ant-select-selector {
    @apply !rounded-none !rounded-l-lg !border-r-0 !border-nc-border-gray-medium !shadow-none !w-44;

    &.ant-select-focused:not(.ant-select-disabled) {
      @apply !border-r-transparent;
    }

    .field-selection-tooltip-wrapper {
      @apply !max-w-30;
    }
  }
}

:deep(.nc-select:not(.ant-select-disabled):hover) {
  &,
  .ant-select-selector {
    @apply bg-nc-bg-gray-extralight;
  }
}

:deep(.nc-sort-dir-select) {
  .ant-select-selector {
    @apply !rounded-none !border-nc-border-gray-medium !shadow-none;
  }
}
</style>
