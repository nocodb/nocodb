<script setup lang="ts">
// todo: move to persisted state
import { useState } from '#app'
import { IsLockedInj } from '~/context'
import MdiFilterIcon from '~icons/mdi/filter-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'

const autoApplyFilter = useState('autoApplyFilter', () => false)
const isLocked = inject(IsLockedInj)

// todo: emit from child
const filters = []

// todo: implement
const applyChanges = () => {}
</script>

<template>
  <a-dropdown :trigger="['click']">
    <v-badge :value="filters.length" color="primary" dot overlap>
      <a-button v-t="['c:filter']" class="nc-filter-menu-btn nc-toolbar-btn" :disabled="isLocked" size="small">
        <div class="flex align-center gap-1">
          <MdiFilterIcon class="text-grey" />
          <!-- Filter -->
          <span class="text-capitalize">{{ $t('activity.filter') }}</span>
          <MdiMenuDownIcon class="text-grey" />
        </div>
      </a-button>
    </v-badge>
    <template #overlay>
      <SmartsheetToolbarColumnFilter />
    </template>
  </a-dropdown>
</template>
