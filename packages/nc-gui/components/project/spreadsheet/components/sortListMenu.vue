<template>
  <v-menu offset-y>
    <template #activator="{ on }">
      <v-badge
        :value="sortList.length"
        color="primary"
        dot
        overlap
      >
        <v-btn
          class="nc-sort-menu-btn"
          :disabled="isLocked"
          small
          text
          outlined
          :class=" { 'primary lighten-5 grey--text text--darken-3' : sortList.length}"
          v-on="on"
        >
          <v-icon small class="mr-1" color="#777">
            mdi-sort
          </v-icon>
          Sort
          <v-icon small color="#777">
            mdi-menu-down
          </v-icon>
        </v-btn>
      </v-badge>
    </template>
    <div class="backgroundColor pa-2" style="min-width: 330px">
      <div class="sort-grid" @click.stop>
        <template v-for="(sort,i) in sortList" dense>
          <v-icon :key="i + 'icon'" small @click.stop="sortList.splice(i,1)">
            mdi-close-box
          </v-icon>

          <v-select
            :key="i + 'sel1'"
            v-model="sort.field"
            class="caption nc-sort-field-select"
            :items="fieldList"
            label="Field"
            solo
            flat
            dense
            hide-details
            @click.stop
          >
            <template #item="{item}">
              <span class="caption font-weight-regular">{{ item }}</span>
            </template>
          </v-select>
          <v-select
            :key="i + 'sel2'"
            v-model="sort.order"
            class="flex-shrink-1 flex-grow-0 caption nc-sort-dir-select"
            :items="[{text : 'A -> Z', value: ''},{text : 'Z -> A', value: '-'}]"
            label="Operation"
            solo
            flat
            dense
            hide-details
            @click.stop
          >
            <template #item="{item}">
              <span class="caption font-weight-regular">{{ item.text }}</span>
            </template>
          </v-select>
        </template>
      </div>
      <v-btn small class="elevation-0 grey--text my-3" @click.stop="addSort">
        <v-icon small color="grey">
          mdi-plus
        </v-icon>
        Add Sort Option
      </v-btn>
    </div>
  </v-menu>
</template>

<script>
export default {
  name: 'SortListMenu',
  props: ['fieldList', 'value', 'isLocked'],
  data: () => ({
    sortList: []
  }),
  watch: {
    sortList: {
      handler(v) {
        this.$emit('input', v)
      },
      deep: true
    },
    value(v) {
      this.sortList = v || []
    }
  },
  created() {
    this.filters = this.value || []
  },
  methods: {
    addSort() {
      this.sortList.push({
        field: '',
        order: ''
      })
      this.filters = this.filters.slice()
    }
  }
}
</script>

<style scoped>

.sort-grid {
  display: grid;
  grid-template-columns:22px auto 100px;
  column-gap: 6px;
  row-gap: 6px;
}

</style>
