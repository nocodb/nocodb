<script setup lang="ts">
// todo: move to persisted state
import { useState } from '#app'
import { IsLockedInj } from '~/context'
import MdiFilterIcon from '~icons/mdi/filter-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import ColumnFilter from './ColumnFilter.vue'

const autoApplyFilter = useState('autoApplyFilter', () => false)
const isLocked = inject(IsLockedInj)

// todo: emit from child
const filtersLength = ref(0)
// todo: sync with store
const autosave = ref(true)

const filterComp = ref<typeof ColumnFilter>()

// todo: implement
const applyChanges = async () => {
  await filterComp?.value?.applyChanges()
}
</script>

<template>
  <a-dropdown :trigger="['click']">
    <div :class="{ 'nc-badge nc-active-btn': filtersLength }">
      <a-button v-t="['c:filter']" class="text-xs nc-filter-menu-btn nc-toolbar-btn" :disabled="isLocked" size="small">
        <div class="flex align-center gap-1">
          <MdiFilterIcon class="text-grey" />
          <!-- Filter -->
          <span class="text-capitalize nc-filter-menu-btn">{{ $t('activity.filter') }}</span>
          <MdiMenuDownIcon class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <SmartsheetToolbarColumnFilter ref="filterComp" class="nc-table-toolbar-menu" @update:filters-length="filtersLength = $event" :auto-save="autosave" >
        <div class="d-flex align-end mt-2 min-h-[30px]" @click.stop>
          <a-checkbox
            id="col-filter-checkbox"
            v-model:checked="autosave"
            class="col-filter-checkbox"
            hide-details
            dense
          >
            <span class="text-grey text-xs">
              {{ $t('msg.info.filterAutoApply') }}
              <!-- Auto apply -->
            </span>
          </a-checkbox>

          <div class="flex-1"/>
          <a-button v-show="!autosave" size="small" class="text-xs ml-2" @click="applyChanges">
            Apply changes
          </a-button>
        </div>
      </SmartsheetToolbarColumnFilter>
    </template>
  </a-dropdown>
</template>
