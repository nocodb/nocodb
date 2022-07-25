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
  <v-menu offset-y eager transition="slide-y-transition">
    <template #activator="{ props }">
      <v-badge :value="filters.length" color="primary" dot overlap>
        <a-button
          v-t="['c:filter']"
          class="nc-filter-menu-btn px-2 nc-remove-border"
          :disabled="isLocked"
          outlined
          size="small"
          text
          :class="{
            'primary lighten-5 grey--text text--darken-3': filters.length,
          }"
          v-bind="props"
          ><div class="flex align-center gap-1 text-sm">
            <MdiFilterIcon class="text-grey" />
            <!-- Filter -->
            <span class="text-capitalize">{{ $t('activity.filter') }}</span>
            <MdiMenuDownIcon class="text-grey" />
          </div>
        </a-button>
      </v-badge>
    </template>
    <SmartsheetToolbarColumnFilter>
      <!--      <div class="d-flex align-center mx-2" @click.stop>
        <v-checkbox
          id="col-filter-checkbox"
          v-model="autoApplyFilter"
          class="col-filter-checkbox"
          hide-details
          dense
          type="checkbox"
          color="grey"
        >
          <template #label>
            <span class="grey&#45;&#45;text caption">
              {{ $t('msg.info.filterAutoApply') }}
              &lt;!&ndash; Auto apply &ndash;&gt;
            </span>
          </template>
        </v-checkbox>

        <v-spacer />
        <v-btn v-show="!autoApplyFilter" color="primary" small class="caption ml-2" @click="applyChanges"> Apply changes </v-btn>
      </div> -->
    </SmartsheetToolbarColumnFilter>
  </v-menu>
</template>
