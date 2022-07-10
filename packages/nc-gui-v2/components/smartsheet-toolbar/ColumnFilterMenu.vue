<script setup lang="ts">
// todo: move to persisted state
import { useState } from '#app'
import { IsLockedInj } from '~/components'
import Smartsheet from '~/components/tabs/Smartsheet.vue'

const autoApplyFilter = useState('autoApplyFilter', () => false)
const isLocked = inject(IsLockedInj)

// todo: emit from child
const filters = []

// todo: implement
const applyChanges = () => {}

/* import ColumnFilter from '~/components/project/spreadsheet/components/ColumnFilter'

export default {
  name: 'ColumnFilterMenu',
  components: { ColumnFilter },
  props: ['fieldList', 'isLocked', 'value', 'meta', 'viewId', 'shared'],
  data: () => ({
    filters: [],
  }),
  computed: {
    autosave: {
      set(v) {
        this.$store.commit('settings/MutAutoApplyFilter', v)
        this.$e('a:filter:auto-apply', { flag: v })
      },
      get() {
        return this.$store.state.settings.autoApplyFilter
      },
    },
  },
  watch: {
    filters: {
      handler(v) {
        if (this.autosave) {
          this.$emit('input', v)
        }
      },
      deep: true,
    },
    autosave(v) {
      if (!v) {
        this.filters = JSON.parse(JSON.stringify(this.value || []))
      }
    },
    value(v) {
      this.filters = this.autosave ? v || [] : JSON.parse(JSON.stringify(v || []))
    },
  },
  created() {
    this.filters = this.autosave ? this.value || [] : JSON.parse(JSON.stringify(this.value || []))
  },
  methods: {
    applyChanges() {
      this.$emit('input', this.filters)
      if (this.$refs.filter) {
        this.$refs.filter.applyChanges()
      }
      this.$e('a:filter:apply')
    },
  },
} */
</script>

<template>
  <v-menu offset-y eager transition="slide-y-transition">
    <template #activator="props">
      <v-badge :value="filters.length" color="primary" dot overlap>
        <v-btn
          v-t="['c:filter']"
          class="nc-filter-menu-btn px-2 nc-remove-border"
          :disabled="isLocked"
          outlined
          small
          text
          :class="{
            'primary lighten-5 grey--text text--darken-3': filters.length,
          }"
          v-bind="props"
        >
          <v-icon small class="mr-1" color="grey  darken-3"> mdi-filter-outline</v-icon>
          <!-- Filter -->
          {{ $t('activity.filter') }}
          <v-icon small color="#777"> mdi-menu-down</v-icon>
        </v-btn>
      </v-badge>
    </template>
    <SmartsheetToolbarColumnFilter ref="filter">
      <!--
      v-model="filters"
      :shared="shared"
      :view-id="viewId"
      :field-list="fieldList"
      :meta="meta" -->
      <!--      v-on="$listeners" -->

      <div class="d-flex align-center mx-2" @click.stop>
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
            <span class="grey--text caption">
              {{ $t('msg.info.filterAutoApply') }}
              <!-- Auto apply -->
            </span>
          </template>
        </v-checkbox>

        <v-spacer />
        <v-btn v-show="!autoApplyFilter" color="primary" small class="caption ml-2" @click="applyChanges"> Apply changes </v-btn>
      </div>
    </SmartsheetToolbarColumnFilter>
  </v-menu>
</template>

<style scoped>
/*/deep/ .col-filter-checkbox .v-input--selection-controls__input {
  transform: scale(0.7);
}*/
</style>
