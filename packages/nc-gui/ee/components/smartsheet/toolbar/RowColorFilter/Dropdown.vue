<script setup lang="ts">
import { PlanLimitTypes, UITypes } from 'nocodb-sdk'
import { SmartsheetToolbarRowColorFilterUsingFilterPanel } from '#components'

const meta = inject(MetaInj, ref())
const activeView = inject(ActiveViewInj, ref())
const { getPlanLimit } = useWorkspace()

const { isMobileMode } = useGlobal()

const baseStore = useBase()
const { getBaseType, baseMeta } = baseStore

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const {
  rowColorInfo,
  filterPerViewLimit,
  onDropdownOpen,
  onChangeRowColoringMode,
  onRemoveRowColoringMode,
  onRowColorSelectChange,
  onRowColorConditionAdd,
  onRowColorConditionDelete,
  onRowColorConditionUpdate,
  onRowColorConditionFilterAdd,
  onRowColorConditionFilterUpdate,
  onRowColorConditionFilterAddGroup,
  onRowColorConditionFilterDelete,
  filterColumns,
} = useViewRowColorOption({
  meta,
  view: activeView,
})
const rowColoringMode = computed({
  set: (value) => {
    rowColorInfo.value.mode = value
  },
  get: () => {
    return rowColorInfo.value.mode
  },
})
</script>

<template>
  <NcDropdown
    @update:visible="onDropdownOpen"
    v-model:visible="open"
    overlay-class-name="nc-dropdown-coloring-menu nc-toolbar-dropdown overflow-hidden"
    class="!xs:hidden"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode">
      <template #title>
        {{ $t('general.colour') }}
      </template>
      <NcButton v-e="['c:coloring']" type="secondary" size="small" class="nc-coloring-menu-btn nc-toolbar-btn !border-0 !h-7">
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.ncPaintRoller" class="h-4 w-4" />

            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">
              {{ $t('general.colour') }}
            </span>
          </div>
        </div>
      </NcButton>
    </NcTooltip>
    <template #overlay>
      <SmartsheetToolbarRowColorFilterTypeOption
        v-model:row-coloring-mode="rowColoringMode"
        @change="onChangeRowColoringMode"
        v-model:is-open="open"
      >
        <template #select>
          <SmartsheetToolbarRowColorFilterUsingSingleSelectPanel
            v-model="rowColorInfo"
            :columns="meta?.columns.filter((k) => k.uidt === UITypes.SingleSelect)"
            :filter-per-view-limit="filterPerViewLimit"
            @change="onRowColorSelectChange"
            @remove="onRemoveRowColoringMode"
          />
        </template>
        <template #filter>
          <SmartsheetToolbarRowColorFilterUsingFilterPanel
            v-model="rowColorInfo"
            :columns="filterColumns"
            :filter-per-view-limit="filterPerViewLimit"
            :handler="{
              conditionAdd: onRowColorConditionAdd,
              conditionDelete: onRowColorConditionDelete,
              conditionUpdate: onRowColorConditionUpdate,
              allConditionDeleted: onRemoveRowColoringMode,
              filters: {
                addFilter: onRowColorConditionFilterAdd,
                addFilterGroup: onRowColorConditionFilterAddGroup,
                deleteFilter: onRowColorConditionFilterDelete,
                rowChange: onRowColorConditionFilterUpdate,
              },
            }"
          />
        </template>
      </SmartsheetToolbarRowColorFilterTypeOption>
    </template>
  </NcDropdown>
</template>
