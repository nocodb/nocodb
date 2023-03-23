<script setup lang="ts">
import { nextTick } from '@vue/runtime-core'
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  getSortDirectionOptions,
  iconMap,
  inject,
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

const { eventBus } = useSmartsheetStoreOrThrow()

const { sorts, saveOrUpdate, loadSorts, addSort: _addSort, deleteSort } = useViewSorts(view, () => reloadDataHook?.trigger())

const removeIcon = ref<HTMLElement>()

const addSort = () => {
  _addSort()
  nextTick(() => {
    removeIcon.value?.[removeIcon.value?.length - 1]?.$el?.scrollIntoView()
  })
}

const { isMobileMode } = useGlobal()

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

const getColumnUidtByID = (key?: string) => {
  if (!key) return ''
  return columnByID.value[key]?.uidt || ''
}

watch(
  () => view.value?.id,
  (viewId) => {
    if (viewId) loadSorts()
  },
  { immediate: true },
)

const open = ref(false)

useMenuCloseOnEsc(open)
</script>

<template>
  <a-dropdown v-model:visible="open" offset-y class="" :trigger="['click']" overlay-class-name="nc-dropdown-sort-menu">
    <div :class="{ 'nc-badge nc-active-btn': sorts?.length }">
      <a-button v-e="['c:sort']" class="nc-sort-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-1">
          <PhSortAscendingThin />

          <!-- Sort -->
          <span v-if="!isMobileMode" class="text-capitalize !text-xs font-weight-normal">{{ $t('activity.sort') }}</span>
          <component :is="iconMap.arrowDown" class="text-grey !text-0.5rem" />

          <span v-if="sorts?.length" class="nc-count-badge">{{ sorts.length }}</span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        :class="{ ' min-w-[400px]': sorts.length }"
        class="bg-gray-50 p-6 shadow-lg menu-filter-dropdown max-h-[max(80vh,500px)] overflow-auto !border"
        data-testid="nc-sorts-menu"
      >
        <div v-if="sorts?.length" class="sort-grid mb-2 max-h-420px overflow-y-auto" @click.stop>
          <template v-for="(sort, i) of sorts" :key="i">
            <component :is="iconMap.closeBox"
              ref="removeIcon"
              class="nc-sort-item-remove-btn text-grey self-center"
              small
              @click.stop="deleteSort(sort, i)"
            />

            <LazySmartsheetToolbarFieldListAutoCompleteDropdown
              v-model="sort.fk_column_id"
              class="caption nc-sort-field-select"
              :columns="columns"
              is-sort
              @click.stop
              @update:model-value="saveOrUpdate(sort, i)"
            />

            <a-select
              ref=""
              v-model:value="sort.direction"
              class="shrink grow-0 nc-sort-dir-select !text-xs"
              :label="$t('labels.operation')"
              dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir"
              @click.stop
              @select="saveOrUpdate(sort, i)"
            >
              <a-select-option
                v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(sort.fk_column_id))"
                :key="j"
                :value="option.value"
              >
                <span>{{ option.text }}</span>
              </a-select-option>
            </a-select>
          </template>
        </div>

        <a-button class="text-capitalize mb-1 mt-4" type="primary" ghost @click.stop="addSort">
          <div class="flex gap-1 items-center">
            <component :is="iconMap.plus" />
            <!-- Add Sort Option -->
            {{ $t('activity.addSort') }}
          </div>
        </a-button>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.sort-grid {
  display: grid;
  grid-template-columns: 22px auto 150px;
  @apply gap-[12px];
}
</style>
