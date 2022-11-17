<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  getSortDirectionOptions,
  inject,
  ref,
  useViewSorts,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const isLocked = inject(IsLockedInj, ref(false))
const reloadDataHook = inject(ReloadViewDataHookInj)

const { sorts, saveOrUpdate, loadSorts, addSort, deleteSort } = useViewSorts(view, () => reloadDataHook?.trigger())

const columns = computed(() => meta.value?.columns || [])

const columnByID = computed(() =>
  columns.value.reduce((obj, col) => {
    obj[col.id!] = col

    return obj
  }, {} as Record<string, ColumnType>),
)

watch(
  () => view.value?.id,
  (viewId) => {
    if (viewId) loadSorts()
  },
  { immediate: true },
)
</script>

<template>
  <a-dropdown offset-y class="" :trigger="['click']" overlay-class-name="nc-dropdown-sort-menu">
    <div :class="{ 'nc-badge nc-active-btn': sorts?.length }">
      <a-button v-e="['c:sort']" class="nc-sort-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-1">
          <MdiSort />

          <!-- Sort -->
          <span class="text-capitalize !text-sm font-weight-normal">{{ $t('activity.sort') }}</span>
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        class="bg-gray-50 p-6 shadow-lg menu-filter-dropdown min-w-[400px] max-h-[max(80vh,500px)] overflow-auto !border"
        data-testid="nc-sorts-menu"
      >
        <div v-if="sorts?.length" class="sort-grid mb-2" @click.stop>
          <template v-for="(sort, i) in sorts || []" :key="i">
            <MdiCloseBox class="nc-sort-item-remove-btn text-grey self-center" small @click.stop="deleteSort(sort, i)" />

            <LazySmartsheetToolbarFieldListAutoCompleteDropdown
              v-model="sort.fk_column_id"
              class="caption nc-sort-field-select"
              :columns="columns"
              is-sort
              @click.stop
              @update:model-value="saveOrUpdate(sort, i)"
            />

            <a-select
              v-model:value="sort.direction"
              class="shrink grow-0 nc-sort-dir-select !text-xs"
              :label="$t('labels.operation')"
              dropdown-class-name="sort-dir-dropdown nc-dropdown-sort-dir"
              @click.stop
              @select="saveOrUpdate(sort, i)"
            >
              <a-select-option
                v-for="(option, j) in getSortDirectionOptions(columnByID[sort.fk_column_id]?.uidt)"
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
            <MdiPlus />
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
