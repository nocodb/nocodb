<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())
const activeView = inject(ActiveViewInj, ref())

const { rowColorInfo, onDropdownOpen, onRemoveRowColoringMode, onRowColorSelectChange } = useViewRowColorOption({
  meta,
  view: activeView,
})
const { isMobileMode } = useGlobal()

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

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
            @change="onRowColorSelectChange"
            @remove="onRemoveRowColoringMode"
          />
        </template>
        <template #filter> FILTER </template>
      </SmartsheetToolbarRowColorFilterTypeOption>
    </template>
  </NcDropdown>
</template>
