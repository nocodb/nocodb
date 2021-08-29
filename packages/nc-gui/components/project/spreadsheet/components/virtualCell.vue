<template>
  <div>
    <v-lazy>
      <has-many-cell
        v-if="hm"
        ref="cell"
        :row="row"
        :value="row[`${hm._tn}List`]"
        :meta="meta"
        :hm="hm"
        :nodes="nodes"
        :active="active"
        :sql-ui="sqlUi"
        :is-new="isNew"
        :is-form="isForm"
        :breadcrumbs="breadcrumbs"
        v-on="$listeners"
      />
      <many-to-many-cell
        v-else-if="mm"
        ref="cell"
        :row="row"
        :value="row[`${mm._rtn}MMList`]"
        :meta="meta"
        :mm="mm"
        :nodes="nodes"
        :sql-ui="sqlUi"
        :active="active"
        :is-new="isNew"
        :api="api"
        :is-form="isForm"
        :breadcrumbs="breadcrumbs"
        v-on="$listeners"
      />
      <belongs-to-cell
        v-else-if="bt"
        ref="cell"
        :disabled-columns="disabledColumns"
        :active="active"
        :row="row"
        :value="row[`${bt._rtn}Read`]"
        :meta="meta"
        :bt="bt"
        :nodes="nodes"
        :api="api"
        :sql-ui="sqlUi"
        :is-new="isNew"
        :is-form="isForm"
        :breadcrumbs="breadcrumbs"
        v-on="$listeners"
      />
      <lookup-cell
        v-else-if="lookup"
        :disabled-columns="disabledColumns"
        :active="active"
        :row="row"
        :meta="meta"
        :nodes="nodes"
        :api="api"
        :sql-ui="sqlUi"
        :is-new="isNew"
        :is-form="isForm"
        :column="column"
        v-on="$listeners "
      />
      <formula-cell
        v-else-if="formula"
        :row="row"
        :column="column"
      />
      <rollup-cell
        v-else-if="rollup"
        :row="row"
        :column="column"
      />
    </v-lazy>
  </div>
</template>

<script>
import RollupCell from './virtualCell/rollupCell'
import FormulaCell from '@/components/project/spreadsheet/components/virtualCell/formulaCell'
import hasManyCell from '@/components/project/spreadsheet/components/virtualCell/hasManyCell'
import LookupCell from '@/components/project/spreadsheet/components/virtualCell/lookupCell'
import manyToManyCell from '@/components/project/spreadsheet/components/virtualCell/manyToManyCell'
import belongsToCell from '@/components/project/spreadsheet/components/virtualCell/belogsToCell'

// todo: optimize parent/child meta extraction

export default {
  name: 'VirtualCell',
  components: {
    RollupCell,
    FormulaCell,
    LookupCell,
    belongsToCell,
    manyToManyCell,
    hasManyCell
  },
  props: {
    breadcrumbs: {
      type: Array,
      default() {
        return []
      }
    },
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
    isForm: {
      type: Boolean,
      default: false
    },
    disabledColumns: Object
  },
  computed: {
    hm() {
      return this.column && this.column.hm
    },
    bt() {
      return this.column && this.column.bt
    },
    mm() {
      return this.column && this.column.mm
    },
    lookup() {
      return this.column && this.column.lk
    },
    formula() {
      return this.column && this.column.formula
    },
    rollup() {
      return this.column && this.column.rollup
    }
  },
  methods: {
    async save(row) {
      if (row && this.$refs.cell && this.$refs.cell.saveLocalState) {
        try {
          await this.$refs.cell.saveLocalState(row)
        } catch (e) {
        }
      }
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
