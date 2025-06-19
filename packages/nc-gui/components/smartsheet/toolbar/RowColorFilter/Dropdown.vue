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
  onRemoveRowColoringMode,
  onRowColorSelectChange,
  onRowColorConditionAdd,
  onRowColorConditionDelete,
  onRowColorConditionUpdate,
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
  <NcDropdown @open="onDropdownOpen">
    <NcButton type="text" size="small" class="nc-toolbar-btn !border-0 !h-7">
      <div class="flex items-center gap-1 min-h-5">
        <div class="flex items-center gap-2">
          <component :is="iconMap.ncPaintRoller" class="h-4 w-4" />

          <!-- Group By -->
          <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">Coloring</span>
        </div>
        <!-- <span v-if="groupedByColumnIds?.length" class="bg-brand-50 text-brand-500 nc-toolbar-btn-chip">{{
          groupedByColumnIds.length
        }}</span> -->
      </div>
    </NcButton>
    <template #overlay>
      <SmartsheetToolbarRowColorFilterTypeOption v-model:row-coloring-mode="rowColoringMode">
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
            :handler="{
              conditionAdd: onRowColorConditionAdd,
              conditionDelete: onRowColorConditionDelete,
              conditionUpdate: onRowColorConditionUpdate,
              allConditionDeleted: onRemoveRowColoringMode,
            }"
          />
        </template>
      </SmartsheetToolbarRowColorFilterTypeOption>
    </template>
  </NcDropdown>
</template>
