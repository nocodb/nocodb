<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { clearRowColouringCache } from '../../../../../components/smartsheet/grid/canvas/utils/canvas'
import { SmartsheetToolbarRowColorFilterUsingFilterPanel } from '#components'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const { isUIAllowed } = useRoles()

const hasPermission = computed(() => !isLocked.value && isUIAllowed('rowColourUpdate'))

const { isMobileMode } = useGlobal()

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

const open = ref(false)

const rowColoringMode = computed({
  set: (value) => {
    rowColorInfo.value.mode = value
  },
  get: () => {
    return rowColorInfo.value.mode
  },
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
        class="nc-coloring-menu-btn nc-toolbar-btn !border-0 !h-7"
        :show-as-disabled="isLocked"
      >
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
        v-model:is-open="open"
        @change="onChangeRowColoringMode"
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
            :disabled="!hasPermission"
            :is-locked-view="isLocked"
          />
        </template>
      </SmartsheetToolbarRowColorFilterTypeOption>
    </template>
  </NcDropdown>
</template>
