<script setup lang="ts">
import { PlanLimitTypes, RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  getSortDirectionOptions,
  iconMap,
  inject,
  isEeUI,
  ref,
  useMenuCloseOnEsc,
  useSmartsheetStoreOrThrow,
  useViewSorts,
  watch,
} from '#imports'

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
      } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID) {
        return false
      } else {
        /** ignore hasmany and manytomany relations if it's using within sort menu */
        return !(isLinksOrLTAR(c) && (c.colOptions as LinkToAnotherRecordType).type !== RelationTypes.BELONGS_TO)
        /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
      }
    })
    .filter((c) => !sorts.value.find((s) => s.fk_column_id === c.id))
})

const getColumnUidtByID = (key?: string) => {
  if (!key) return ''
  return columnByID.value[key]?.uidt || ''
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
    overlay-class-name="nc-dropdown-sort-menu nc-toolbar-dropdown"
  >
    <div :class="{ 'nc-active-btn': sorts?.length }">
      <a-button v-e="['c:sort']" class="nc-sort-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-2">
          <component :is="iconMap.sort" class="h-4 w-4" />

          <!-- Sort -->
          <span v-if="!isMobileMode" class="text-capitalize !text-sm font-medium">{{ $t('activity.sort') }}</span>

          <span v-if="sorts?.length" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">{{ sorts.length }}</span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <SmartsheetToolbarCreateSort v-if="!sorts.length" :is-parent-open="open" @created="addSort" />
      <div
        v-else
        :class="{ 'min-w-102': sorts.length }"
        class="py-6 pl-6 nc-filter-list max-h-[max(80vh,30rem)]"
        data-testid="nc-sorts-menu"
      >
        <div
          class="sort-grid max-h-120 nc-scrollbar-md"
          :class="{ 'pb-3 pr-3.5': sorts?.length, '!pb-0': !availableColumns.length }"
          @click.stop
        >
          <template v-for="(sort, i) of sorts" :key="i">
            <SmartsheetToolbarFieldListAutoCompleteDropdown
              v-model="sort.fk_column_id"
              class="flex caption nc-sort-field-select min-w-40 flex-grow"
              :columns="columns"
              is-sort
              @click.stop
              @update:model-value="saveOrUpdate(sort, i)"
            />

            <NcSelect
              v-model:value="sort.direction"
              class="shrink grow-0 nc-sort-dir-select"
              :label="$t('labels.operation')"
              dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir"
              @click.stop
              @select="saveOrUpdate(sort, i)"
            >
              <a-select-option
                v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(sort.fk_column_id))"
                :key="j"
                v-e="['c:sort:operation:select']"
                :value="option.value"
              >
                <span>{{ option.text }}</span>
              </a-select-option>
            </NcSelect>

            <NcButton
              v-e="['c:sort:delete']"
              type="text"
              size="small"
              class="nc-sort-item-remove-btn !max-w-8"
              @click.stop="deleteSort(sort, i)"
            >
              <component :is="iconMap.deleteListItem" />
            </NcButton>
          </template>
        </div>

        <NcDropdown
          v-if="availableColumns.length"
          v-model:visible="showCreateSort"
          :trigger="['click']"
          overlay-class-name="nc-toolbar-dropdown"
        >
          <template v-if="isEeUI && !isPublic">
            <NcButton
              v-if="sorts.length < getPlanLimit(PlanLimitTypes.SORT_LIMIT)"
              v-e="['c:sort:add']"
              class="!text-brand-500"
              type="text"
              size="small"
              @click.stop="showCreateSort = true"
            >
              <div class="flex gap-1 items-center">
                <component :is="iconMap.plus" />
                <!-- Add Sort Option -->
                {{ $t('activity.addSort') }}
              </div>
            </NcButton>
          </template>
          <template v-else>
            <NcButton v-e="['c:sort:add']" class="!text-brand-500" type="text" size="small" @click.stop="showCreateSort = true">
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
    </template>
  </NcDropdown>
</template>

<style scoped>
.sort-grid {
  display: grid;
  grid-template-columns: auto 150px auto;
  @apply gap-x-2 gap-y-3;
}
</style>
