<template>
  <v-menu offset-y>
    <template v-slot:activator="{ on, attrs }">
      <v-badge
        :value="filters.length"
        color="primary"
        dot
        overlap
      >
        <v-btn :disabled="isLocked" v-on="on" outlined small text
               :class=" { 'primary lighten-5 grey--text text--darken-3' : filters.length}">
          <v-icon small class="mr-1" color="grey  darken-3">mdi-filter</v-icon>
          Filter
          <v-icon small color="#777">mdi-menu-down</v-icon>

        </v-btn>
      </v-badge>
    </template>
    <column-filter v-model="filters" :field-list="fieldList">
      <div class="d-flex align-center mx-2" @click.stop>
        <v-checkbox
          hide-details
          dense
          id="col-filter-checkbox"
          type="checkbox"
          color="grey"
          v-model="autosave">
          <template v-slot:label>
            <span class="grey--text caption">Auto apply</span>
          </template>

        </v-checkbox>

        <v-spacer></v-spacer>
        <v-btn v-show="!autosave" color="primary" @click="$emit('input', filters)" small class="caption ml-2">Apply
          changes
        </v-btn>
      </div>
    </column-filter>
  </v-menu>
</template>

<script>
import ColumnFilter from "@/components/project/spreadsheet/components/columnFilter";

export default {
  name: "columnFilterMenu",
  components: {ColumnFilter},
  props: ['fieldList', 'isLocked', 'value'],
  data: () => ({
    filters: [],
  }),
  computed: {
    autosave: {
      set(v) {
        this.$store.commit('windows/MutAutoApplyFilter', v)
      }, get() {
        return this.$store.state.windows.autoApplyFilter;
      }
    }
  },
  methods: {},
  created() {
    this.filters = this.autosave ? this.value || [] : JSON.parse(JSON.stringify(this.value || []));
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
        this.filters = JSON.parse(JSON.stringify(this.value || []));
      }
    },
    value(v) {
      this.filters = this.autosave ? v || [] : JSON.parse(JSON.stringify(v || []));
    }
  }
}
</script>

<style scoped>
</style>
