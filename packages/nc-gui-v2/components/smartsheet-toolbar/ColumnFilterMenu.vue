<script setup lang="ts">
import type ColumnFilter from './ColumnFilter.vue'
import { ActiveViewInj, IsLockedInj, IsPublicInj, computed, inject, ref, useGlobal, useViewFilters, watchEffect } from '#imports'

const isLocked = inject(IsLockedInj, ref(false))

const activeView = inject(ActiveViewInj)

const isPublic = inject(IsPublicInj, ref(false))

const { filterAutoSave } = useGlobal()

const filterComp = ref<typeof ColumnFilter>()

// todo: avoid duplicate api call by keeping a filter store
const { filters, loadFilters } = useViewFilters(
  activeView,
  undefined,
  computed(() => false),
)

const filtersLength = ref(0)

watchEffect(async () => {
  if (activeView?.value) {
    await loadFilters()

    filtersLength.value = filters.value.length || 0
  }
})

const applyChanges = async () => await filterComp.value?.applyChanges()
</script>

<template>
  <a-dropdown :trigger="['click']">
    <div :class="{ 'nc-badge nc-active-btn': filtersLength }">
      <a-button v-t="['c:filter']" class="nc-filter-menu-btn nc-toolbar-btn txt-sm" :disabled="isLocked">
        <div class="flex align-center gap-1">
          <MdiFilterOutline />
          <!-- Filter -->
          <span class="text-capitalize !text-sm font-weight-medium">{{ $t('activity.filter') }}</span>
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <SmartsheetToolbarColumnFilter
        ref="filterComp"
        class="nc-table-toolbar-menu shadow-lg"
        :auto-save="filterAutoSave"
        @update:filters-length="filtersLength = $event"
      >
        <div v-if="!isPublic" class="d-flex align-end mt-2 min-h-[30px]" @click.stop>
          <a-checkbox id="col-filter-checkbox" v-model:checked="filterAutoSave" class="col-filter-checkbox" hide-details dense>
            <span class="text-grey text-xs">
              {{ $t('msg.info.filterAutoApply') }}
              <!-- Auto apply -->
            </span>
          </a-checkbox>

          <div class="flex-1" />
          <a-button v-show="!filterAutoSave" size="small" class="text-xs ml-2" @click="applyChanges"> Apply changes </a-button>
        </div>
      </SmartsheetToolbarColumnFilter>
    </template>
  </a-dropdown>
</template>
