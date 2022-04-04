<template>
  <v-menu offset-y eager>
    <template #activator="{ on, }">
      <v-badge
        :value="filters.length"
        color="primary"
        dot
        overlap
      >
        <v-btn
          v-t="['filter:trigger']"
          class="nc-filter-menu-btn px-2 nc-remove-border"
          :disabled="isLocked"
          outlined
          small
          text
          :class=" { 'primary lighten-5 grey--text text--darken-3' : filters.length}"
          v-on="on"
        >
          <v-icon small class="mr-1" color="grey  darken-3">
            mdi-filter-outline
          </v-icon>
          <!-- Filter -->
          {{ $t('activity.filter') }}
          <v-icon small color="#777">
            mdi-menu-down
          </v-icon>
        </v-btn>
      </v-badge>
    </template>
    <column-filter
      ref="filter"
      v-model="filters"
      :shared="shared"
      :view-id="viewId"
      :field-list="fieldList"
      :meta="meta"
      v-on="$listeners"
    >
      <div class="d-flex align-center mx-2" @click.stop>
        <v-checkbox
          id="col-filter-checkbox"
          v-model="autosave"
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
        <v-btn v-show="!autosave" color="primary" small class="caption ml-2" @click="applyChanges">
          Apply
          changes
        </v-btn>
      </div>
    </column-filter>
  </v-menu>
</template>

<script>
import ColumnFilter from '@/components/project/spreadsheet/components/columnFilter'

export default {
  name: 'ColumnFilterMenu',
  components: { ColumnFilter },
  props: ['fieldList', 'isLocked', 'value', 'meta', 'viewId', 'shared'],
  data: () => ({
    filters: []
  }),
  computed: {
    autosave: {
      set(v) {
        this.$store.commit('windows/MutAutoApplyFilter', v)
        this.$tele.emit(`filter:auto-apply:${v}`)
      },
      get() {
        return this.$store.state.windows.autoApplyFilter
      }
    }
  },
  watch: {
    filters: {
      handler(v) {
        if (this.autosave) {
          this.$emit('input', v)
        }
      },
      deep: true
    },
    autosave(v) {
      if (!v) {
        this.filters = JSON.parse(JSON.stringify(this.value || []))
      }
    },
    value(v) {
      this.filters = this.autosave ? v || [] : JSON.parse(JSON.stringify(v || []))
    }
  },
  created() {
    this.filters = this.autosave ? this.value || [] : JSON.parse(JSON.stringify(this.value || []))
  },
  methods: {
    applyChanges() {
      this.$emit('input', this.filters)
      if (this.$refs.filter) { this.$refs.filter.applyChanges() }
      this.$tele.emit('filter:apply-explicit')
    }
  }
}
</script>

<style scoped>
/deep/ .col-filter-checkbox .v-input--selection-controls__input {
  transform: scale(.7);
}
</style>
