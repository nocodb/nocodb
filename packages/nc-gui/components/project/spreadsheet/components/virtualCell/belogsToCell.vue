<template>
  <div class="d-flex">
    <div class="d-flex align-center img-container flex-grow-1 hm-items">
      <template v-if="value">
        <item-chip
          :active="active"
          :item="value"
          :color="colors[i%colors.length]"
          :value="Object.values(value)[1]"
          :key="i"
          @edit="editParent"
          @unlink="unlink"
        ></item-chip>
      </template>
    </div>
    <div v-if="!isNew" class=" align-center justify-center px-1 flex-shrink-1"
         :class="{'d-none': !active, 'd-flex':active  }">
      <x-icon small :color="['primary','grey']" @click="showNewRecordModal">{{
          value ? 'mdi-arrow-expand' : 'mdi-plus'
        }}
      </x-icon>
    </div>

    <list-items
      v-if="newRecordModal"
      :size="10"
      :meta="parentMeta"
      :primary-col="parentPrimaryCol"
      :primary-key="parentPrimaryKey"
      v-model="newRecordModal"
      :api="parentApi"
      @add-new-record="insertAndMapNewParentRecord"
      @add="addParentToChild"
      :query-params="parentQueryParams"
    />


    <v-dialog
      :overlay-opacity="0.8"
      v-if="selectedParent"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
      v-model="expandFormModal">
      <component
        v-if="selectedParent"
        :is="form"
        :db-alias="nodes.dbAlias"
        :has-many="parentMeta.hasMany"
        :belongs-to="parentMeta.belongsTo"
        :table="parentMeta.tn"
        :old-row="{...selectedParent}"
        :meta="parentMeta"
        :sql-ui="sqlUi"
        :primary-value-column="parentPrimaryCol"
        :api="parentApi"
        :available-columns="parentAvailableColumns"
        :nodes="nodes"
        :query-params="parentQueryParams"
        :is-new="isNewParent"
        icon-color="warning"
        ref="expandedForm"
        v-model="selectedParent"
        @cancel="selectedParent = null"
        @input="onParentSave"
      ></component>

    </v-dialog>


  </div>
</template>

<script>
import colors from "@/mixins/colors";
import ApiFactory from "@/components/project/spreadsheet/apis/apiFactory";
import ListItems from "@/components/project/spreadsheet/components/virtualCell/components/listItems";
import ItemChip from "@/components/project/spreadsheet/components/virtualCell/components/item-chip";

export default {
  name: "belongs-to-cell",
  components: {ItemChip, ListItems},
  mixins: [colors],
  props: {
    value: [Object, Array],
    meta: [Object],
    bt: Object,
    nodes: [Object],
    row: [Object],
    api: [Object, Function],
    sqlUi: [Object, Function],
    active: Boolean,
    isNew: Boolean,
    disabledColumns: Object
  },
  data: () => ({
    newRecordModal: false,
    parentListModal: false,
    parentMeta: null,
    list: null,
    childList: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
    selectedParent: null,
    isNewParent: false,
    expandFormModal: false,
  }),

  methods: {
    async onParentSave(parent) {
      if (this.isNewParent) {
        await this.addParentToChild(parent)
      } else {
        this.$emit('loadTableData')
      }
    },
    async insertAndMapNewParentRecord() {
      await this.loadParentMeta();
      this.newRecordModal = false;
      this.isNewParent = true;
      this.selectedParent = {};
      this.expandFormModal = true;
    },

    async unlink() {
      const column = this.meta.columns.find(c => c.cn === this.bt.cn);
      if (column.rqd) {
        this.$toast.info('Unlink is not possible, instead map to another parent.').goAway(3000)
        return
      }
      const _cn = column._cn;
      const id = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');
      await this.api.update(id, {[_cn]: null}, this.row)
      this.$emit('loadTableData')
    },
    async showParentListModal() {
      this.parentListModal = true;
      await this.loadParentMeta();
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');
      const _cn = this.parentMeta.columns.find(c => c.cn === this.hm.cn)._cn;
      this.childList = await this.parentApi.paginatedList({
        where: `(${_cn},eq,${pid})`
      })
    },
    async removeChild(child) {
      this.dialogShow = true;
      this.confirmMessage =
        'Do you want to delete the record?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          const id = this.parentMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
          await this.parentApi.delete(id)
          this.showParentListModal();
          this.dialogShow = false;
          this.$emit('loadTableData')
        }
      }
    },
    async loadParentMeta() {
      // todo: optimize
      if (!this.parentMeta) {
        const parentTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.bt.rtn
        }]);
        this.parentMeta = JSON.parse(parentTableData.meta)
      }
    },
    async showNewRecordModal() {
      await this.loadParentMeta();
      this.newRecordModal = true;
      // this.list = await this.parentApi.paginatedList({})
    },
    async addParentToChild(parent) {
      const pid = this.parentMeta.columns.filter((c) => c.pk).map(c => parent[c._cn]).join('___');
      const id = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');
      const _cn = this.meta.columns.find(c => c.cn === this.bt.cn)._cn;

      await this.api.update(id, {
        [_cn]: pid
      }, {
        [_cn]: parent[this.parentPrimaryKey]
      });
      this.newRecordModal = false;

      this.$emit('loadTableData')
    },
    async editParent(parent) {
      await this.loadParentMeta();
      this.isNewParent = false;
      this.selectedParent = parent;
      this.expandFormModal = true;
      setTimeout(() => {
        this.$refs.expandedForm && this.$refs.expandedForm.reload()
      }, 500)
    },
  },
  computed: {
    parentApi() {
      return this.parentMeta && this.parentMeta._tn ?
        ApiFactory.create(this.$store.getters['project/GtrProjectType'],
          this.parentMeta && this.parentMeta._tn, this.parentMeta && this.parentMeta.columns, this) : null;
    },
    parentPrimaryCol() {
      return this.parentMeta && (this.parentMeta.columns.find(c => c.pv) || {})._cn
    },
    parentPrimaryKey() {
      return this.parentMeta && (this.parentMeta.columns.find(c => c.pk) || {})._cn
    },
    parentQueryParams() {
      if (!this.parentMeta) return {}
      return {
        childs: (this.parentMeta && this.parentMeta.hasMany && this.parentMeta.hasMany.map(hm => hm.tn).join()) || '',
        parents: (this.parentMeta && this.parentMeta.belongsTo && this.parentMeta.belongsTo.map(hm => hm.rtn).join()) || '',
        many: (this.parentMeta && this.parentMeta.manyToMany && this.parentMeta.manyToMany.map(mm => mm.rtn).join()) || ''
      }
    },
    parentAvailableColumns() {
      const hideCols = ['created_at', 'updated_at'];
      if (!this.parentMeta) return [];

      const columns = [];
      if (this.parentMeta.columns) {
        columns.push(...this.parentMeta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn)))
      }
      if (this.parentMeta.v) {
        columns.push(...this.parentMeta.v.map(v => ({...v, virtual: 1})));
      }
      return columns;
    },
    // todo:
    form() {
      return this.selectedParent ? () => import("@/components/project/spreadsheet/components/expandedForm") : 'span';
    },
  }
}
</script>

<style scoped lang="scss">
.items-container {
  overflow-x: visible;
  max-height: min(500px, 60vh);
  overflow-y: auto;
}

.primary-value {
  .primary-key {
    display: none;
    margin-left: .5em;
  }

  &:hover .primary-key {
    display: inline;
  }
}

.child-card {
  cursor: pointer;

  &:hover {
    box-shadow: 0 0 .2em var(--v-textColor-lighten5)
  }
}

.hm-items {
  //min-width: 200px;
  //max-width: 400px;
  flex-wrap: wrap;
  row-gap: 3px;
  gap: 3px;
  margin: 3px auto;
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
