<script setup lang="ts">
import FieldListAutoCompleteDropdown from './FieldListAutoCompleteDropdown.vue'
import { computed, inject } from '#imports'
import { ActiveViewInj, IsLockedInj, MetaInj, ReloadViewDataHookInj } from '~/components'
import useViewSorts from '~/composables/useViewSorts'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import MdiSortIcon from '~icons/mdi/sort'
import MdiDeleteIcon from '~icons/mdi/close-box'

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)
const isLocked = inject(IsLockedInj)
const reloadDataHook = inject(ReloadViewDataHookInj)

const { sorts, saveOrUpdate, loadSorts, addSort, deleteSort } = useViewSorts(view, () => reloadDataHook?.trigger())

const columns = computed(() => meta?.value?.columns || [])

watch(
  () => view?.value?.id,
  () => {
    loadSorts()
  },
  { immediate: true },
)
</script>

<template>
  <v-menu offset-y transition="slide-y-transition">
    <template #activator="{ props }">
      <v-badge :value="sorts && sorts.length" color="primary" dot overlap>
        <v-btn
          v-t="['c:sort']"
          class="nc-sort-menu-btn px-2 nc-remove-border"
          :disabled="isLocked"
          small
          text
          outlined
          :class="{
            'primary lighten-5 grey&#45;&#45;text text&#45;&#45;darken-3': sorts && sorts.length,
          }"
          v-bind="props"
        >
          <MdiSortIcon class="mr-1 text-grey" />
          <!-- Sort -->
          <span class="text-capitalize">{{ $t('activity.sort') }}</span>
          <MdiMenuDownIcon class="text-grey" />
        </v-btn>
      </v-badge>
    </template>
    <div class="backgroundColor pa-2 menu-filter-dropdown bg-background min-w-[400px]">
      <div class="sort-grid" @click.stop>
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
            @update:modelValue="saveOrUpdate(sort, i)"
          />
          <v-select
            v-model="sort.direction"
            class="flex-shrink-1 flex-grow-0 caption nc-sort-dir-select"
            :items="['asc', 'desc']"
            :label="$t('labels.operation')"
            density="compact"
            variant="solo"
            hide-details
            @click.stop
            @update:modelValue="saveOrUpdate(sort, i)"
          />
          <!--            <template #item="{ item }"> -->
          <!--              <span class="caption font-weight-regular">{{ item.text }}</span> -->
          <!--            </template> -->
          <!--          </v-select> -->
        </template>
      </div>
      <v-btn small class="elevation-0 text-grey text-capitalize text-sm my-3" @click.stop="addSort">
        <!-- todo:        <v-icon small color="grey"> mdi-plus </v-icon> -->
        <!-- Add Sort Option -->
        {{ $t('activity.addSort') }}
      </v-btn>
    </div>
  </v-menu>
</template>

<style scoped>
.sort-grid {
  display: grid;
  grid-template-columns: 22px auto 150px;
  column-gap: 6px;
  row-gap: 6px;
}
</style>
