<script setup lang="ts">
import type { FilterType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import FieldListAutoCompleteDropdown from './FieldListAutoCompleteDropdown.vue'
import { useNuxtApp } from '#app'
import { inject, useViewFilters } from '#imports'
import { comparisonOpList } from '~/utils/filterUtils'
import { ActiveViewInj, MetaInj, ReloadViewDataHookInj } from '~/context'
import MdiDeleteIcon from '~icons/mdi/close-box'
import MdiAddIcon from '~icons/mdi/plus'
const { nested = false, parentId } = defineProps<{ nested?: boolean; parentId?: string }>()

const meta = inject(MetaInj)
const activeView = inject(ActiveViewInj)
const reloadDataHook = inject(ReloadViewDataHookInj)

const { $e } = useNuxtApp()

const { filters, deleteFilter, saveOrUpdate, loadFilters, addFilter } = useViewFilters(activeView, parentId, () => {
  reloadDataHook?.trigger()
})

const filterUpdateCondition = (filter: FilterType, i: number) => {
  saveOrUpdate(filter, i)

  $e('a:filter:update', {
    logical: filter.logical_op,
    comparison: filter.comparison_op,
  })
}

// todo : filter based on type
// const filterComparisonOp = (f) =>
//   comparisonOp.filter((op) => {
//     // if (
//     //   f &&
//     //   f.fk_column_id &&
//     //   this.columnsById[f.fk_column_id] &&
//     //   this.columnsById[f.fk_column_id].uidt === UITypes.LinkToAnotherRecord &&
//     //   this.columnsById[f.fk_column_id].uidt === UITypes.Lookup
//     // ) {
//     //   return !['notempty', 'empty', 'notnull', 'null'].includes(op.value)
//     // }
//     return true
//   })

const columns = computed(() => meta?.value?.columns)
const types = computed(() => {
  if (!meta?.value?.columns?.length) {
    return {}
  }
  return meta?.value?.columns?.reduce((obj: any, col: any) => {
    switch (col.uidt) {
      case UITypes.Number:
      case UITypes.Decimal:
        obj[col.title] = obj[col.column_name] = 'number'
        break
      case UITypes.Checkbox:
        obj[col.title] = obj[col.column_name] = 'boolean'
        break
    }
    return obj
  }, {})
})

watch(
  () => (activeView?.value as any)?.id,
  (n, o) => {
    if (n !== o) loadFilters()
  },
  { immediate: true },
)
</script>

<template>
  <div class="bg-white shadow pa-2 menu-filter-dropdown" :style="{ width: nested ? '100%' : '630px' }">
    <div v-if="filters && filters.length" class="grid" @click.stop>
      <template v-for="(filter, i) in filters" :key="filter.id || i">
        <template v-if="filter.status !== 'delete'">
          <div v-if="filter.is_group" :key="i" style="grid-column: span 4; padding: 6px" class="elevation-4">
            <div class="d-flex" style="gap: 6px; padding: 0 6px">
              <!--              <v-icon
                v-if="!filter.readOnly"
                :key="`${i}_3`"
                small
                class="nc-filter-item-remove-btn"
                @click.stop="deleteFilter(filter, i)"
              >
                mdi-close-box
              </v-icon> -->
              <MdiDeleteIcon
                v-if="!filter.readOnly"
                small
                class="nc-filter-item-remove-btn"
                @click.stop="deleteFilter(filter, i)"
              />

              <span v-else :key="`${i}_1`" />

              <a-select
                v-model:value="filter.logical_op"
                class="flex-shrink-1 flex-grow-0 elevation-0 caption"
                :items="['and', 'or']"
                density="compact"
                variant="solo"
                hide-details
                placeholder="Group op"
                @click.stop
                @change="saveOrUpdate(filter, i)"
              >
                <!--                <template #item="{ item }"> -->
                <!--                  <span class="caption font-weight-regular">{{ item }}</span> -->
                <!--                </template> -->
              </a-select>
            </div>
            <!--            <column-filter
              v-if="filter.id || shared"
              ref="nestedFilter"
              v-model="filter.children"
              :parent-id="filter.id"
              :view-id="viewId"
              nested
              :meta="meta"
              :shared="shared"
              :web-hook="webHook"
              :hook-id="hookId"
              @updated="$emit('updated')"
              @input="$emit('input', filters)"
            /> -->
          </div>
          <template v-else>
            <!--                        <v-icon
                                      v-if="!filter.readOnly"
                                      :key="`${i}_3`"
                                      small
                                      class="nc-filter-item-remove-btn"
                                      @click.stop="deleteFilter(filter, i)"
                                    >
                                      mdi-close-box
                                    </v-icon> -->

            <MdiDeleteIcon
              v-if="!filter.readOnly"
              class="nc-filter-item-remove-btn text-grey align-self-center"
              @click.stop="deleteFilter(filter, i)"
            />
            <span v-else />

            <span v-if="!i" class="text-xs d-flex align-center">{{ $t('labels.where') }}</span>

            <a-select
              v-else
              v-model:value="filter.logical_op"
              class="h-full"
              :options="[
                { value: 'and', text: 'AND' },
                { value: 'or', text: 'OR' },
              ]"
              hide-details
              :disabled="filter.readOnly"
              @click.stop
              @change="filterUpdateCondition(filter, i)"
            />

            <FieldListAutoCompleteDropdown
              :key="`${i}_6`"
              v-model="filter.fk_column_id"
              class="caption text-sm nc-filter-field-select"
              :columns="columns"
              :disabled="filter.readOnly"
              @click.stop
              @change="saveOrUpdate(filter, i)"
            />

            <a-select
              v-model:value="filter.comparison_op"
              class="caption nc-filter-operation-select text-sm"
              :options="comparisonOpList"
              :placeholder="$t('labels.operation')"
              density="compact"
              variant="solo"
              :disabled="filter.readOnly"
              hide-details
              @change="filterUpdateCondition(filter, i)"
            /><!--
            todo: filter based on column type

            item-value="value"
            item-text="text"
            :items="filterComparisonOp(filter)" -->

            <!--              <template #item="{ item }"> -->
            <!--                <span class="caption font-weight-regular">{{ item.text }}</span> -->
            <!--              </template> -->
            <!--            </v-select> -->
            <span v-if="['null', 'notnull', 'empty', 'notempty'].includes(filter.comparison_op)" :key="`span${i}`" />
            <a-checkbox
              v-else-if="types[filter.field] === 'boolean'"
              v-model:value="filter.value"
              dense
              :disabled="filter.readOnly"
              @change="saveOrUpdate(filter, i)"
            />
            <a-input
              v-else
              :key="`${i}_7`"
              v-model="filter.value"
              class="caption text-sm nc-filter-value-select"
              :disabled="filter.readOnly"
              @click.stop
              @input="saveOrUpdate(filter, i)"
            />
          </template>
        </template>
      </template>
    </div>

    <a-button small class="elevation-0 text-sm text-capitalize text-grey my-3" @click.stop="addFilter">
      <div class="flex align-center gap-1">
        <!--      <v-icon small color="grey"> mdi-plus </v-icon> -->
        <MdiAddIcon />
        <!-- Add Filter -->
        {{ $t('activity.addFilter') }}
      </div>
    </a-button>
    <slot />
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 30px 130px auto auto auto;
  column-gap: 6px;
  row-gap: 6px;
}
</style>
