<script setup lang="ts">
// todo: move to persisted state
import { useState } from '#app'
import { IsLockedInj } from '~/context'
import MdiFilterIcon from '~icons/mdi/filter-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'

const autoApplyFilter = useState('autoApplyFilter', () => false)
const isLocked = inject(IsLockedInj)

// todo: emit from child
const filtersLength = ref(0)

// todo: implement
const applyChanges = () => {}
</script>

<template>
  <a-dropdown :trigger="['click']">
    <div :class="{ 'nc-badge nc-active-btn': filtersLength }">
      <a-button v-t="['c:filter']" class="nc-filter-menu-btn nc-toolbar-btn" :disabled="isLocked" size="small">
        <div class="flex align-center gap-1">
          <MdiFilterIcon class="text-grey" />
          <!-- Filter -->
          <span class="text-capitalize nc-filter-menu-btn">{{ $t('activity.filter') }}</span>
          <MdiMenuDownIcon class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <SmartsheetToolbarColumnFilter @update:filters-length="filtersLength = $event" />
    </template>
  </a-dropdown>
</template>
