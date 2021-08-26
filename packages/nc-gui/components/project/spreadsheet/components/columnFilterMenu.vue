<template>
  <v-menu offset-y>
    <template #activator="{ on, }">
      <v-badge
        :value="filters.length"
        color="primary"
        dot
        overlap
      >
        <v-btn
          class="nc-filter-menu-btn"
          :disabled="isLocked"
          outlined
          small
          text
          :class=" { 'primary lighten-5 grey--text text--darken-3' : filters.length}"
          v-on="on"
        >
          <v-icon small class="mr-1" color="grey  darken-3">
            mdi-filter
          </v-icon>
          Filter
          <v-icon small color="#777">
            mdi-menu-down
          </v-icon>
        </v-btn>
      </v-badge>
    </template>
    <column-filter v-model="filters" :field-list="fieldList">
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
            <span class="grey--text caption">Auto apply</span>
          </template>
        </v-checkbox>

        <v-spacer />
        <v-btn v-show="!autosave" color="primary" small class="caption ml-2" @click="$emit('input', filters)">
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
  props: ['fieldList', 'isLocked', 'value'],
  data: () => ({
    filters: []
  }),
  computed: {
    autosave: {
      set(v) {
        this.$store.commit('windows/MutAutoApplyFilter', v)
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
  methods: {}
}
</script>

<style scoped>
/deep/ .col-filter-checkbox .v-input--selection-controls__input {
  transform: scale(.7);
}
</style>
