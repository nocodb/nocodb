<template>
  <div>
    <v-lazy>
    <has-many-cell
      v-if="hm"
      :row="row"
      :value="row[hm._tn]"
      :meta="meta"
      :hm="hm"
      :nodes="nodes"
      :active="active"
      :sql-ui="sqlUi"
      :is-new="isNew"
      v-on="$listeners"
    />
    <many-to-many-cell
      v-else-if="mm"
      :row="row"
      :value="row[mm._rtn]"
      :meta="meta"
      :mm="mm"
      :nodes="nodes"
      :sql-ui="sqlUi"
      :active="active"
      :is-new="isNew"
      v-on="$listeners"
    />
    <belongs-to-cell
      :disabled-columns="disabledColumns"
      v-else-if="bt"
      :active="active"
      :row="row"
      :value="row[bt._rtn]"
      :meta="meta"
      :bt="bt"
      :nodes="nodes"
      :api="api"
      :sql-ui="sqlUi"
      :is-new="isNew"
      v-on="$listeners"
    />
    </v-lazy>
  </div>
</template>

<script>
import hasManyCell from "@/components/project/spreadsheet/components/virtualCell/hasManyCell";
import manyToManyCell from "@/components/project/spreadsheet/components/virtualCell/manyToManyCell";
import belongsToCell from "@/components/project/spreadsheet/components/virtualCell/belogsToCell";

export default {
  name: "virtual-cell",
  components: {
    belongsToCell,
    manyToManyCell,
    hasManyCell
  },
  props: {
    column: [Object],
    row: [Object],
    nodes: [Object],
    meta: [Object],
    api: [Object, Function],
    active: Boolean,
    sqlUi: [Object, Function],
    isNew: {
      type: Boolean,
      default: false
    },
    disabledColumns:Object
  },
  computed: {
    hm() {
      return this.column && this.column.hm;
    },
    bt() {
      return this.column && this.column.bt;
    },
    mm() {
      return this.column && this.column.mm;
    }
  }
}
</script>

<style scoped>

</style>
