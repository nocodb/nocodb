<template>
  <div class="d-flex align-center">
    <v-tooltip bottom>
      <template #activator="{on}">
        <v-icon v-if="column.hm" color="warning" x-small class="mr-1" v-on="on">
          mdi-table-arrow-right
        </v-icon>
        <v-icon v-else-if="column.bt" color="info" x-small class="mr-1" v-on="on">
          mdi-table-arrow-left
        </v-icon>
        <v-icon v-else-if="column.mm" color="pink" x-small class="mr-1" v-on="on">
          mdi-table-network
        </v-icon>
        <v-icon v-else-if="column.formula" x-small class="mr-1" v-on="on">
          mdi-math-integral
        </v-icon>
        <template v-else-if="column.lk">
          <v-icon v-if="column.lk.type === 'hm'" color="warning" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
          <v-icon v-else-if="column.lk.type === 'bt'" color="info" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
          <v-icon v-else-if="column.lk.type === 'mm'" color="pink" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
        </template>
        <template v-else-if="column.rollup">
          <v-icon v-if="column.rollup.type === 'hm'" color="warning" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
          <v-icon v-else-if="column.rollup.type === 'bt'" color="info" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
          <v-icon v-else-if="column.rollup.type === 'mm'" color="pink" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
        </template>

        <span class="name  flex-grow-1" :title="column._cn" v-on="on" v-html="alias">
          <span v-if="column.rqd" class="error--text text--lighten-1" v-on="on">&nbsp;*</span>
        </span>
      </template>
      <span class="caption" v-html="tooltipMsg" />
    </v-tooltip>
    <v-spacer />

    <v-menu
      v-if="!isPublicView && _isUIAllowed('edit-column') && !isForm"
      offset-y
      open-on-hover
      left
    >
      <template #activator="{on}">
        <v-icon v-if="!isForm" small v-on="on">
          mdi-menu-down
        </v-icon>
      </template>
      <v-list dense>
        <v-list-item v-if="!column.lk" dense @click="editColumnMenu = true">
          <x-icon small class="mr-1" color="primary">
            mdi-pencil
          </x-icon>
          <span class="caption">Edit</span>
        </v-list-item>
        <!--  <v-list-item dense @click="setAsPrimaryValue">
            <x-icon small class="mr-1" color="primary">mdi-key-star</x-icon>
            <v-tooltip bottom>
              <template v-slot:activator="{on}">
                <span class="caption" v-on="on">Set as Primary value</span>
              </template>
              <span class="caption font-weight-bold">Primary value will be shown in place of primary key</span>
            </v-tooltip>
          </v-list-item> -->
        <v-list-item @click="columnDeleteDialog = true">
          <x-icon small class="mr-1" color="error">
            mdi-delete-outline
          </x-icon>
          <span class="caption">Delete</span>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-dialog
      v-model="columnDeleteDialog"
      max-width="500"
      persistent
    >
      <v-card>
        <v-card-title class="grey darken-2 subheading white--text">
          Confirm
        </v-card-title>
        <v-divider />
        <v-card-text class="mt-4 title">
          Do you want to delete <span class="font-weight-bold">'{{
            column._cn
          }}'</span> column ?
        </v-card-text>
        <v-divider />
        <v-card-actions class="d-flex pa-4">
          <v-spacer />
          <v-btn small @click="columnDeleteDialog = false">
            Cancel
          </v-btn>
          <v-btn small color="error" @click="deleteColumn">
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-menu v-model="editColumnMenu" offset-y content-class="elevation-0" left>
      <template #activator="{on}">
        <span v-on="on" />
      </template>
      <edit-virtual-column
        v-if="editColumnMenu"
        v-model="editColumnMenu"
        :nodes="nodes"
        :edit-column="true"
        :column="column"
        :meta="meta"
        :sql-ui="sqlUi"
        v-on="$listeners"
      />
    </v-menu>
  </div>
</template>
<script>
import { getUIDTIcon } from '../helpers/uiTypes'
import EditVirtualColumn from '@/components/project/spreadsheet/components/editVirtualColumn'

export default {
  name: 'VirtualHeaderCell',
  components: { EditVirtualColumn },
  props: ['column', 'nodes', 'meta', 'isForm', 'isPublicView', 'sqlUi'],
  data: () => ({
    columnDeleteDialog: false,
    editColumnMenu: false,
    rollupIcon: getUIDTIcon('Rollup')
  }),
  computed: {
    alias() {
      return this.column.lk ? `${this.column.lk._lcn} <small class="grey--text text--darken-1">(from ${this.column.lk._ltn})</small>` : this.column._cn
    },
    type() {
      if (this.column.bt) {
        return 'bt'
      }
      if (this.column.hm) {
        return 'hm'
      }
      if (this.column.mm) {
        return 'mm'
      }
      return ''
    },
    childColumn() {
      if (this.column.bt) {
        return this.column.bt.cn
      }
      if (this.column.hm) {
        return this.column.hm.cn
      }
      if (this.column.mm) {
        return this.column.mm.rcn
      }
      return ''
    },
    childTable() {
      if (this.column.bt) {
        return this.column.bt.tn
      }
      if (this.column.hm) {
        return this.column.hm.tn
      }
      if (this.column.mm) {
        return this.column.mm.rtn
      }
      return ''
    },
    parentTable() {
      if (this.column.bt) {
        return this.column.bt.rtn
      }
      if (this.column.hm) {
        return this.column.hm.rtn
      }
      if (this.column.mm) {
        return this.column.mm.tn
      }
      return ''
    },
    parentColumn() {
      if (this.column.bt) {
        return this.column.bt.rcn
      }
      if (this.column.hm) {
        return this.column.hm.rcn
      }
      if (this.column.mm) {
        return this.column.mm.cn
      }
      return ''
    },
    tooltipMsg() {
      if (!this.column) {
        return ''
      }
      if (this.column.hm) {
        return `'${this.column.hm._rtn}' has many '${this.column.hm._tn}'`
      } else if (this.column.mm) {
        return `'${this.column.mm._tn}' & '${this.column.mm._rtn}' have <br>many to many relation`
      } else if (this.column.bt) {
        return `'${this.column.bt._tn}' belongs to '${this.column.bt._rtn}'`
      } else if (this.column.lk) {
        return `'${this.column.lk._lcn}' from '${this.column.lk._ltn}' (${this.column.lk.type})`
      } else if (this.column.formula) {
        return `Formula - ${this.column.formula.value}`
      } else if (this.column.rollup) {
        return `${this.column.rollup.fn} of ${this.column.rollup._rlcn} (${this.column.rollup._rltn})`
      }
      return ''
    }
  },
  methods: {
    async deleteRelation() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcRelationColumnDelete', {
          type: this.type,
          childColumn: this.childColumn,
          childTable: this.childTable,
          parentTable: this.parentTable,
          parentColumn: this.parentColumn,
          assocTable: this.column.mm && this.column.mm.vtn
        }])
        this.$emit('saved')
        this.columnDeleteDialog = false
      } catch (e) {
        console.log(e)
      }
    },
    async deleteLookupColumn() {
      try {
        await this.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.nodes.dbAlias,
          env: this.nodes.env,
          tn: this.meta.tn,
          force: true
        })
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.tn]))

        // remove lookup from virtual columns
        meta.v = meta.v.filter(cl => cl.cn !== this.column.cn ||
          cl.type !== this.column.type ||
          cl._cn !== this.column._cn ||
          cl.tn !== this.column.tn)

        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }])
        this.$emit('saved')
        this.columnDeleteDialog = false
      } catch (e) {
        console.log(e)
      }
    },
    async deleteFormulaColumn() {
      try {
        await this.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.nodes.dbAlias,
          env: this.nodes.env,
          tn: this.meta.tn,
          force: true
        })
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.tn]))
        // remove formula from virtual columns
        meta.v = meta.v.filter(cl => !cl.formula || cl._cn !== this.column._cn)

        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }])
        this.$emit('saved')
        this.columnDeleteDialog = false
      } catch (e) {
        console.log(e)
      }
    },
    async deleteRollupColumn() {
      try {
        await this.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.nodes.dbAlias,
          env: this.nodes.env,
          tn: this.meta.tn,
          force: true
        })
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.tn]))

        // remove rollup from virtual columns
        meta.v = meta.v.filter(cl => !cl.rollup || cl._cn !== this.column._cn)

        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }])
        this.$emit('saved')
        this.columnDeleteDialog = false
      } catch (e) {
        console.log(e)
      }
    },
    async deleteColumn() {
      if (this.column.lk) {
        await this.deleteLookupColumn()
      } else if (this.column.formula) {
        await this.deleteFormulaColumn()
      } else if (this.column.rollup) {
        await this.deleteRollupColumn()
      } else {
        await this.deleteRelation()
      }
    }
  }
}
</script>

<style scoped>
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
