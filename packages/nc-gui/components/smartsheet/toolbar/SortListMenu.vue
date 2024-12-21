<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { PlanLimitTypes, RelationTypes, UITypes, getEquivalentUIType, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const isLocked = inject(IsLockedInj, ref(false))
const reloadDataHook = inject(ReloadViewDataHookInj)
const isPublic = inject(IsPublicInj, ref(false))

const { eventBus } = useSmartsheetStoreOrThrow()

const { sorts, saveOrUpdate, loadSorts, addSort: _addSort, deleteSort } = useViewSorts(view, () => reloadDataHook?.trigger())

const { showSystemFields, metaColumnById } = useViewColumnsOrThrow()

const showCreateSort = ref(false)

const { isMobileMode } = useGlobal()

const { getPlanLimit } = useWorkspace()

const isCalendar = inject(IsCalendarInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.SORT_RELOAD) {
    loadSorts()
  }
})

const columns = computed(() => meta.value?.columns || [])

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
    .filter((c) => !sorts.value.find((s) => s.fk_column_id === c.id))
})

const getColumnUidtByID = (key?: string) => {
  if (!key || !columnByID.value[key]) return ''

  const column = columnByID.value[key]

  let uidt = column.uidt

  if (column.uidt === UITypes.Formula) {
    uidt =
      getEquivalentUIType({
        formulaColumn: column,
      }) || uidt
  }

  return uidt || ''
}

const open = ref(false)

useMenuCloseOnEsc(open)

const addSort = (column: ColumnType) => {
  _addSort(true, column)

  const createdSort = sorts.value[sorts.value.length - 1]
  saveOrUpdate(createdSort, sorts.value.length - 1)

  showCreateSort.value = false
}

watch(open, () => {
  if (!open.value) {
    showCreateSort.value = false
  }
})

onMounted(() => {
  loadSorts()
})
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    class="!xs:hidden"
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
        }"
        class="nc-sort-menu-btn nc-toolbar-btn !h-7"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.sort" class="h-4 w-4 text-inherit" />

            <!-- Sort -->
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">{{
              $t('activity.sort')
            }}</span>
          </div>
          <span v-if="sorts?.length" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">{{ sorts.length }}</span>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div
        :class="{
          'nc-locked-view': isLocked,
        }"
      >
        <SmartsheetToolbarCreateSort v-if="!sorts.length" :is-parent-open="open" :disabled="isLocked" @created="addSort" />
        <div v-else class="pt-2 pb-2 pl-4 nc-filter-list max-h-[max(80vh,30rem)] min-w-102" data-testid="nc-sorts-menu">
          <div class="sort-grid max-h-120 nc-scrollbar-thin pr-4 my-2 py-1" @click.stop>
            <div v-for="(sort, i) of sorts" :key="i" class="flex first:mb-0 !mb-1.5 !last:mb-0 items-center">
              <SmartsheetToolbarFieldListAutoCompleteDropdown
                v-model="sort.fk_column_id"
                class="flex caption nc-sort-field-select !w-44 flex-grow"
                :columns="columns"
                is-sort
                :meta="meta"
                :disabled="isLocked"
                @click.stop
                @update:model-value="saveOrUpdate(sort, i)"
              />

              <NcSelect
                v-model:value="sort.direction"
                class="flex flex-grow-1 w-full nc-sort-dir-select"
                :label="$t('labels.operation')"
                dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir !rounded-lg"
                :disabled="isLocked"
                @click.stop
                @select="saveOrUpdate(sort, i)"
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
                  :disabled="isLocked"
                  class="nc-sort-item-remove-btn !max-w-8 !border-l-transparent !rounded-l-none"
                  @click.stop="deleteSort(sort, i)"
                >
                  <component :is="iconMap.deleteListItem" />
                </NcButton>
              </NcTooltip>
            </div>
          </div>

          <NcDropdown
            v-if="availableColumns.length"
            v-model:visible="showCreateSort"
            :trigger="['click']"
            :disabled="isLocked"
            overlay-class-name="nc-toolbar-dropdown"
          >
            <template v-if="isEeUI && !isPublic">
              <NcButton
                v-if="sorts.length < getPlanLimit(PlanLimitTypes.SORT_LIMIT)"
                v-e="['c:sort:add']"
                class="mt-1 mb-2"
                :class="{
                  '!text-brand-500': !isLocked,
                }"
                type="text"
                size="small"
                :disabled="isLocked"
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
                class="mt-1 mb-2"
                :class="{
                  '!text-brand-500': !isLocked,
                }"
                type="text"
                size="small"
                :disabled="isLocked"
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
              <SmartsheetToolbarCreateSort :is-parent-open="showCreateSort" @created="addSort" />
            </template>
          </NcDropdown>
        </div>
        <GeneralLockedViewFooter
          v-if="isLocked"
          :class="{
            '-mt-2': sorts.length,
          }"
          @on-open="open = false"
        />
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
:deep(.nc-sort-field-select) {
  @apply !w-44;
  .ant-select-selector {
    @apply !rounded-none !rounded-l-lg !border-r-0 !border-gray-200 !shadow-none !w-44;

    &.ant-select-focused:not(.ant-select-disabled) {
      @apply !border-r-transparent;
    }
  }
}

:deep(.nc-select:not(.ant-select-disabled):hover) {
  &,
  .ant-select-selector {
    @apply bg-gray-50;
  }
}

:deep(.nc-sort-dir-select) {
  .ant-select-selector {
    @apply !rounded-none !border-gray-200 !shadow-none;
  }
}
</style>
