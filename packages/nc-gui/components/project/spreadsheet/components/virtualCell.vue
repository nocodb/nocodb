<template>
  <div class="nc-virtual-cell">
    <v-lazy>
      <has-many-cell
        v-if="hm"
        ref="cell"
        :row="row"
        :value="row[column.title]"
        :meta="meta"
        :hm="hm"
        :nodes="nodes"
        :active="active"
        :sql-ui="sqlUi"
        :is-new="isNew"
        :is-form="isForm"
        :breadcrumbs="breadcrumbs"
        :is-locked="isLocked"
        :required="required"
        :is-public="isPublic"
        :metas="metas"
        :column="column"
        :password="password"
        v-on="$listeners"
      />
      <many-to-many-cell
        v-else-if="mm"
        ref="cell"
        :is-public="isPublic"
        :row="row"
        :value="row[column.title]"
        :meta="meta"
        :nodes="nodes"
        :sql-ui="sqlUi"
        :active="active"
        :is-new="isNew"
        :api="api"
        :is-form="isForm"
        :breadcrumbs="breadcrumbs"
        :is-locked="isLocked"
        :required="required"
        :column="column"
        :metas="metas"
        :password="password"
        v-on="$listeners"
      />
      <belongs-to-cell
        v-else-if="bt"
        ref="cell"
        :is-public="isPublic"
        :disabled-columns="disabledColumns"
        :active="active"
        :row="row"
        :value="row[column.title]"
        :meta="meta"
        :nodes="nodes"
        :api="api"
        :sql-ui="sqlUi"
        :is-new="isNew"
        :is-form="isForm"
        :breadcrumbs="breadcrumbs"
        :is-locked="isLocked"
        :metas="metas"
        :column="column"
        :password="password"
        v-on="$listeners"
      />
      <lookup-cell
        v-else-if="lookup"
        :disabled-columns="disabledColumns"
        :active="active"
        :row="row"
        :value="row[column.title]"
        :meta="meta"
        :metas="metas"
        :nodes="nodes"
        :api="api"
        :sql-ui="sqlUi"
        :is-new="isNew"
        :is-form="isForm"
        :column="column"
        :is-locked="isLocked"
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
    <span v-if="hint" class="nc-hint">{{ hint }}</span>
    <div v-if="isLocked" class="nc-locked-overlay" />
  </div>
</template>

<script>
import { UITypes } from 'nocodb-sdk'
import RollupCell from './virtualCell/rollupCell'
import FormulaCell from './virtualCell/formulaCell'
import hasManyCell from './virtualCell/hasManyCell'
import LookupCell from './virtualCell/lookupCell'
import manyToManyCell from './virtualCell/manyToManyCell'
import belongsToCell from './virtualCell/belongsToCell'

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
    disabledColumns: Object,
    hint: String,
    isLocked: Boolean,
    required: Boolean,
    isPublic: Boolean,
    metas: Object,
    password: String
  },
  computed: {
    hm() {
      return this.column && this.column.uidt === UITypes.LinkToAnotherRecord && this.column.colOptions.type === 'hm'
    },
    bt() {
      return this.column && (this.column.uidt === UITypes.ForeignKey || this.column.uidt === UITypes.LinkToAnotherRecord) && this.column.colOptions.type === 'bt'
    },
    mm() {
      return this.column && this.column.uidt === UITypes.LinkToAnotherRecord && this.column.colOptions.type === 'mm'
    },
    lookup() {
      return this.column && this.column.uidt === UITypes.Lookup
    },
    formula() {
      return this.column && this.column.uidt === UITypes.Formula
    },
    rollup() {
      return this.column && this.column.uidt === UITypes.Rollup
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
.nc-hint {
  font-size: .61rem;
  color: grey;
}

.nc-virtual-cell {
  position: relative;
}

.nc-locked-overlay {
  position: absolute;
  z-index: 2;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
}
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
