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
        :api="api"
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

// todo: optimize parent/child meta extraction

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
    disabledColumns: Object
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
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
