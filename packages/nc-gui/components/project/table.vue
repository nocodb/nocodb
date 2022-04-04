<template>
  <v-container fluid class="pa-0 ma-0 nc-table-tab" style="height: 100%">
    <v-alert v-if="error" type="error" class="ma-2">
      {{ error }}
    </v-alert>
    <template v-else>
      <v-tabs
        v-model="active"
        :height="relationTabs && relationTabs.length ?38:0"
        class="table-tabs"
        :class="{'hidden-tab':!relationTabs || !relationTabs.length}"
        color="pink"
        @change="onTabChange"
      >
        <template v-if="_isUIAllowed('smartSheet')">
          <v-tab v-show="relationTabs && relationTabs.length" class="">
            <v-icon small>
              mdi-table-edit
            </v-icon>&nbsp;<span
              class="caption text-capitalize  font-weight-bold"
            > {{ nodes.title }}</span>
          </v-tab>
          <v-tab-item
            style="height:100%"
          >
            <rows-xc-data-table
              ref="tabs7"
              :is-view="isView"
              :is-active="isActive"
              :tab-id="tabId"
              :show-tabs="relationTabs && relationTabs.length"
              :table="nodes.table_name"
              :nodes="nodes"
              :new-table="newTableCopy"
              :mtd-new-table-update="mtdNewTableUpdate"
              :delete-table="deleteTable"
              :is-meta-table="isMetaTable"
              :add-new-relation-tab="addNewRelationTab"
            />
          </v-tab-item>
        </template>
      </v-tabs>
    </template>
    <dlgLabelSubmitCancel
      v-if="dialogShow"
      type="error"
      :actions-mtd="deleteTable"
      :dialog-show="dialogShow"
      heading="Click Submit to Delete the Table"
    />
  </v-container>
</template>

<script>
import { mapActions } from 'vuex'
import dlgLabelSubmitCancel from '../utils/dlgLabelSubmitCancel'
import { isMetaTable } from '@/helpers/xutils'
import RowsXcDataTable from '@/components/project/spreadsheet/rowsXcDataTable'

export default {
  components: {
    RowsXcDataTable,
    dlgLabelSubmitCancel
  },
  data() {
    return {
      error: false,
      active: 1,
      newTableCopy: !!this.nodes.newTable,
      dialogShow: false,
      loadIndexList: false,
      loadTriggerList: false,
      loadRelationList: false,
      loadConstraintList: false,
      loadRows: false,
      loadColumnsMock: false,
      relationTabs: [],
      deleteId: null
    }
  },
  methods: {
    async handleKeyDown(event) {
      const activeTabEleKey = `tabs${this.active}`
      if (this.$refs[activeTabEleKey] &&
        this.$refs[activeTabEleKey].handleKeyDown
      ) {
        await this.$refs[activeTabEleKey].handleKeyDown(event)
      }
    },
    ...mapActions({
      removeTableTab: 'tabs/removeTableTab',
      loadTablesFromParentTreeNode: 'project/loadTablesFromParentTreeNode'
    }),
    mtdNewTableUpdate(value) {
      this.newTableCopy = value
    },
    async deleteTable(action = '', id) {
      if (id) {
        this.deleteId = id
      }
      if (action === 'showDialog') {
        this.dialogShow = true
      } else if (action === 'hideDialog') {
        this.dialogShow = false
      } else {
        // todo : check relations and triggers
        try {
          await this.$api.dbTable.delete(this.deleteId)

          this.removeTableTab({
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias,
            table_name: this.nodes.table_name
          })

          await this.loadTablesFromParentTreeNode({
            _nodes: {
              ...this.nodes
            }
          })

          this.$store.commit('meta/MutMeta', {
            key: this.nodes.table_name,
            value: null
          })
          this.$store.commit('meta/MutMeta', {
            key: this.deleteId,
            value: null
          })
        } catch (e) {
          const msg = await this._extractSdkResponseErrorMsg(e)
          this.$toast.error(msg).goAway(3000)
        }
        this.dialogShow = false
        this.$tele.emit('table:delete:submit')
      }
    },
    onTabChange() {
      this.$emit('update:hideLogWindows', this.active === 2)
    }
  },
  computed: {
    isMetaTable() {
      return isMetaTable(this.nodes.table_name)
    }
  },
  mounted() {
    this.onTabChange()
  },
  props: {
    nodes: Object,
    hideLogWindows: Boolean,
    tabId: String,
    isActive: Boolean,
    isView: Boolean
  }
}
</script>

<style scoped>

/*/deep/ .table-tabs > .v-tabs-items {
  border-top: 1px solid #7F828B33;
}*/

/deep/ .scaffoldOnSave .v-input__control {
  margin-top: -2px;
}

.table-tabs, /deep/ .table-tabs > .v-windows {
  height: 100%;
}

/deep/ .v-window-item {
  height: 100%
}

.rel-row-parent {
  text-align: center;
  left: 0;
  padding: 2px 3px;
  text-transform: none;
  display: inline-block;
  position: absolute;
  top: 0;
  font-size: 8px;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 100%;
  overflow: hidden;
  color: grey;
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
