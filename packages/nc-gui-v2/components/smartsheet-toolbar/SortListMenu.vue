<script setup lang="ts">
import FieldListAutoCompleteDropdown from './FieldListAutoCompleteDropdown.vue'
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
      <a-button v-t="['c:sort']" size="small" class="nc-sort-menu-btn nc-toolbar-btn" :disabled="isLocked"
        ><div class="flex align-center gap-1">
          <MdiSortIcon class="text-grey" />
          <!-- Sort -->
          <span class="text-capitalize nc-sort-menu-btn">{{ $t('activity.sort') }}</span>
          <MdiMenuDownIcon class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div class="bg-gray-50 shadow p-2 menu-filter-dropdown min-w-[400px] max-h-[max(80vh,500px)] overflow-auto">
        <div v-if="sorts?.length" class="sort-grid mb-2" @click.stop>
          <template v-for="(sort, i) in sorts || []" :key="i">
            <!--          <v-icon :key="`${i}icon`" class="nc-sort-item-remove-btn" small @click.stop="deleteSort(sort)"> mdi-close-box </v-icon> -->
            <MdiDeleteIcon
              class="nc-sort-item-remove-btn text-grey align-self-center"
              small
              @click.stop="deleteSort(sort, i)"
            ></MdiDeleteIcon>
            <FieldListAutoCompleteDropdown
              v-model="sort.fk_column_id"
              class="caption nc-sort-field-select"
              :columns="columns"
              @click.stop
              @update:model-value="saveOrUpdate(sort, i)"
            />
            <a-select
              v-model:value="sort.direction"
              size="small"
              class="flex-shrink-1 flex-grow-0 caption nc-sort-dir-select"
              :items="[
                { text: 'asc', value: 'asc' },
                { text: 'desc', value: 'desc' },
              ]"
              :label="$t('labels.operation')"
              @click.stop
              @update:model-value="saveOrUpdate(sort, i)"
            />
            <!--            <template #item="{ item }"> -->
            <!--              <span class="caption font-weight-regular">{{ item.text }}</span> -->
            <!--            </template> -->
            <!--          </v-select> -->
          </template>
        </div>
        <a-button size="small" class="text-xs text-grey text-capitalize " @click.stop="addSort">
          <div class="flex gap-1 align-center">
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
  column-gap: 6px;
  row-gap: 6px;
}

:deep(.ant-btn, .ant-select, .ant-input, ::placeholder) {
  @apply "!text-xs";
}
</style>
