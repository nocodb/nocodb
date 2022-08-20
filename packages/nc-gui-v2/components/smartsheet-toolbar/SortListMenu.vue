<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import FieldListAutoCompleteDropdown from './FieldListAutoCompleteDropdown.vue'
import { getSortDirectionOptions } from '~/utils/sortUtils'
import { computed, inject, useViewSorts } from '#imports'
import { ActiveViewInj, IsLockedInj, MetaInj, ReloadViewDataHookInj } from '~/context'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import MdiSortIcon from '~icons/mdi/sort'
import MdiDeleteIcon from '~icons/mdi/close-box'
import MdiAddIcon from '~icons/mdi/plus'

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)
const isLocked = inject(IsLockedInj)
const reloadDataHook = inject(ReloadViewDataHookInj)

const { sorts, saveOrUpdate, loadSorts, addSort, deleteSort } = useViewSorts(view, () => reloadDataHook?.trigger())

const columns = computed(() => meta?.value?.columns || [])
const columnByID = computed<Record<string, ColumnType>>(() =>
  columns?.value?.reduce((obj: any, col: any) => {
    obj[col.id] = col
    return obj
  }, {}),
)

watch(
  () => (view?.value as any)?.id,
  () => {
    loadSorts()
  },
  { immediate: true },
)
</script>

<template>
  <a-dropdown offset-y class="" :trigger="['click']">
    <div :class="{ 'nc-badge nc-active-btn': sorts?.length }">
      <a-button v-t="['c:sort']" class="nc-sort-menu-btn nc-toolbar-btn" :disabled="isLocked"
        ><div class="flex items-center gap-1">
          <MdiSortIcon />
          <!-- Sort -->
          <span class="text-capitalize !text-sm font-weight-normal">{{ $t('activity.sort') }}</span>
          <MdiMenuDownIcon class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div class="bg-gray-50 p-6 shadow-lg menu-filter-dropdown min-w-[400px] max-h-[max(80vh,500px)] overflow-auto !border">
        <div v-if="sorts?.length" class="sort-grid mb-2" @click.stop>
          <template v-for="(sort, i) in sorts || []" :key="i">
            <MdiDeleteIcon class="nc-sort-item-remove-btn text-grey self-center" small @click.stop="deleteSort(sort, i)" />

            <FieldListAutoCompleteDropdown
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
              @click.stop
              @update:value="saveOrUpdate(sort, i)"
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
            <MdiAddIcon />
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
