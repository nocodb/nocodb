<script setup lang="ts">
import { PlanFeatureTypes, ROW_COLORING_MODE, UITypes, ViewLockType } from 'nocodb-sdk'
import { clearRowColouringCache } from '../../../../../components/smartsheet/grid/canvas/utils/canvas'
import { SmartsheetToolbarRowColorFilterUsingFilterPanel } from '#components'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const { isUIAllowed } = useRoles()

const { isUserViewOwner } = useViewsStore()

const isPersonalViewOwner = computed(
  () => activeView.value?.lock_type === ViewLockType.Personal && isUserViewOwner(activeView.value),
)

const hasPermission = computed(() => !isLocked.value && (isUIAllowed('rowColourUpdate') || isPersonalViewOwner.value))

const { isMobileMode } = useGlobal()

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const {
  rowColorInfo,
  filterPerViewLimit,
  isLoadingFilter,
  onDropdownOpen,
  onChangeRowColoringMode,
  onRemoveRowColoringMode,
  onRowColorSelectChange,
  onRowColorConditionAdd,
  onRowColorConditionDelete,
  onRowColorConditionUpdate,
  onRowColorConditionCopy,
  onRowColorConditionFilterAdd,
  onRowColorConditionFilterUpdate,
  onRowColorConditionFilterAddGroup,
  onRowColorConditionFilterDelete,
  onRowColorConditionFilterCopy,
  filterColumns,
  targetFieldColumns,
} = useViewRowColorOption({
  meta,
  view: activeView,
})

const { showUpgradeToUseRowColoring, isEEFeatureBlocked } = useEeConfig()

const openLocal = ref(false)

const open = computed({
  get: () => {
    return openLocal.value
  },
  set: (value) => {
    if (value && showUpgradeToUseRowColoring()) return

    openLocal.value = value
  },
})

const rowColoringMode = computed({
  set: (value) => {
    rowColorInfo.value.mode = value
  },
  get: () => {
    return rowColorInfo.value.mode
  },
})

const rowColoringCount = computed(() => {
  if (rowColoringMode.value === ROW_COLORING_MODE.SELECT) {
    return 0
  }
  return rowColorInfo.value?.conditions?.length || 0
})

const selectColumns = computed(() => {
  return (meta?.value?.columns || []).filter((c) => c.uidt === UITypes.SingleSelect)
})

watch(open, (value) => {
  if (!value) {
    clearRowColouringCache()
  }
})
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    overlay-class-name="nc-dropdown-coloring-menu nc-toolbar-dropdown overflow-hidden"
    class="!xs:hidden"
    @update:visible="onDropdownOpen"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode">
      <template #title>
        {{ $t('general.colour') }}
      </template>
      <NcButton
        v-e="['c:coloring']"
        type="secondary"
        size="small"
        class="nc-coloring-menu-btn nc-toolbar-btn !border-0 !h-7 group"
        :class="{
          '!bg-nc-bg-maroon-light !hover:bg-nc-bg-maroon-dark': rowColoringMode,
        }"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.ncPaintRoller" class="h-4 w-4" />

            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">
              {{ $t('general.colour') }}
            </span>
          </div>
          <LazyPaymentUpgradeBadge
            :feature="PlanFeatureTypes.FEATURE_ROW_COLOUR"
            :feature-enabled-callback="() => !isEEFeatureBlocked"
            show-as-lock
            remove-click
          />
          <span
            v-if="rowColoringCount"
            class="bg-nc-bg-maroon-dark group-hover:bg-nc-maroon-200 text-nc-maroon-700 nc-toolbar-btn-chip"
            >{{ rowColoringCount }}</span
          >
        </div>
      </NcButton>
    </NcTooltip>
    <template #overlay>
      <SmartsheetToolbarRowColorFilterTypeOption
        v-model:row-coloring-mode="rowColoringMode"
        v-model:is-open="open"
        :columns="selectColumns"
        @change="onChangeRowColoringMode"
      >
        <template #select>
          <SmartsheetToolbarRowColorFilterUsingSingleSelectPanel
            v-model="rowColorInfo"
            :columns="selectColumns"
            :filter-per-view-limit="filterPerViewLimit"
            :is-loading-filter="isLoadingFilter"
            @change="onRowColorSelectChange"
            @remove="onRemoveRowColoringMode"
          />
        </template>
        <template #filter>
          <SmartsheetToolbarRowColorFilterUsingFilterPanel
            v-model="rowColorInfo"
            :columns="filterColumns"
            :target-field-columns="targetFieldColumns"
            :filter-per-view-limit="filterPerViewLimit"
            :is-loading-filter="isLoadingFilter"
            :handler="{
              conditionAdd: onRowColorConditionAdd,
              conditionDelete: onRowColorConditionDelete,
              conditionUpdate: onRowColorConditionUpdate,
              conditionCopy: onRowColorConditionCopy,
              allConditionDeleted: onRemoveRowColoringMode,
              filters: {
                addFilter: onRowColorConditionFilterAdd,
                addFilterGroup: onRowColorConditionFilterAddGroup,
                deleteFilter: onRowColorConditionFilterDelete,
                rowChange: onRowColorConditionFilterUpdate,
                copyFilter: onRowColorConditionFilterCopy,
              },
            }"
            :disabled="!hasPermission"
            :is-locked-view="isLocked"
          />
        </template>
      </SmartsheetToolbarRowColorFilterTypeOption>
    </template>
  </NcDropdown>
</template>
