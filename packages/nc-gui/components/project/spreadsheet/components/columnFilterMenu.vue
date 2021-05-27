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
  methods: {},
  created() {
    this.filters = this.value || [];
  },
  watch: {
    filters: {
      handler(v) {
        this.$emit('input', v)
      },
      deep: true
    },
    value(v) {
      this.filters = v || [];
    }
  }
}
</script>

<style scoped>
</style>
