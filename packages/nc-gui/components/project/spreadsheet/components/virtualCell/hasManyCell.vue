<template>
  <div class="d-flex">
    <template v-if="!isForm">
      <div class="d-flex align-center img-container flex-grow-1 hm-items">
        <template v-if="value||localState">
          <item-chip
            v-for="(ch,i) in (value|| localState)"
            :active="active"
            :item="ch"
            :value="Object.values(ch)[1]"
            :key="i"
            @edit="editChild"
            @unlink="unlinkChild"
          ></item-chip>
        </template>
      </div>
      <div class=" align-center justify-center px-1 flex-shrink-1" :class="{'d-none': !active, 'd-flex':active }">
        <x-icon small :color="['primary','grey']" @click="showNewRecordModal">mdi-plus</x-icon>
        <x-icon x-small :color="['primary','grey']" @click="showChildListModal" class="ml-2">mdi-arrow-expand</x-icon>
      </div>
    </template>

    <list-items
      v-if="newRecordModal"
      :hm="true"
      :size="10"
      :meta="childMeta"
      :primary-col="childPrimaryCol"
      :primary-key="childPrimaryKey"
      v-model="newRecordModal"
      :api="childApi"
      @add-new-record="insertAndAddNewChildRecord"
      @add="addChildToParent"
      :query-params="{
        ...childQueryParams,
        where: isNew ? null :`~not(${childForeignKey},eq,${parentId})~or(${childForeignKey},is,null)`,
      }"/>

    <list-child-items
      :is="isForm ? 'list-child-items' : 'list-child-items-modal'"
      ref="childList"
      v-if="childMeta && (childListModal || isForm)"
      v-model="childListModal"
      :local-state.sync="localState"
      :is-new="isNew"
      :size="10"
      :meta="childMeta"
      :parent-meta="meta"
      :primary-col="childPrimaryCol"
      :primary-key="childPrimaryKey"
      :api="childApi"
      :query-params="{
        ...childQueryParams,
        where:  `(${childForeignKey},eq,${parentId})`
      }"
      @new-record="showNewRecordModal"
      @edit="editChild"
      @unlink="unlinkChild"
      @delete="deleteChild"
    />

    <dlg-label-submit-cancel
      type="primary"
      v-if="dialogShow"
      :actionsMtd="confirmAction"
      :dialogShow="dialogShow"
      :heading="confirmMessage"
    >
    </dlg-label-submit-cancel>

    <v-dialog
      :overlay-opacity="0.8"
      v-if="selectedChild"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
      v-model="expandFormModal">
      <component
        v-if="selectedChild"
        :is="form"
        :db-alias="nodes.dbAlias"
        :has-many="childMeta.hasMany"
        :belongs-to="childMeta.belongsTo"
        @cancel="selectedChild = null"
        @input="$emit('loadTableData')"
        :table="childMeta.tn"
        v-model="selectedChild"
        :old-row="{...selectedChild}"
        :meta="childMeta"
        :sql-ui="sqlUi"
        :primary-value-column="childPrimaryCol"
        :api="childApi"
        :available-columns="childAvailableColumns"
        icon-color="warning"
        :nodes="nodes"
        :query-params="childQueryParams"
        ref="expandedForm"
        :is-new="isNewChild"
        :disabled-columns="disabledChildColumns"
      ></component>

    </v-dialog>

  </div>
</template>

<script>
import ApiFactory from "@/components/project/spreadsheet/apis/apiFactory";
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";
import Pagination from "@/components/project/spreadsheet/components/pagination";
import ListItems from "@/components/project/spreadsheet/components/virtualCell/components/listItems";
import ItemChip from "@/components/project/spreadsheet/components/virtualCell/components/item-chip";
import ListChildItems from "@/components/project/spreadsheet/components/virtualCell/components/listChildItems";
import listChildItemsModal
  from "@/components/project/spreadsheet/components/virtualCell/components/listChildItemsModal";

export default {
  name: "has-many-cell",
  components: {
    ListChildItems,
    ItemChip,
    ListItems,
    Pagination,
    DlgLabelSubmitCancel,
    listChildItemsModal
  },
  props: {
    value: [Object, Array],
    meta: [Object],
    hm: Object,
    nodes: [Object],
    row: [Object],
    sqlUi: [Object, Function],
    active: Boolean,
    isNew: Boolean,
    isForm: Boolean,
  },
  data: () => ({
    newRecordModal: false,
    childListModal: false,
    childMeta: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
    selectedChild: null,
    expandFormModal: false,
    isNewChild: false,
    localState: []
  }),
  async mounted() {
    if (this.isForm) {
      await this.loadChildMeta()
    }
  },
  methods: {
    async showChildListModal() {
      await this.loadChildMeta();
      this.childListModal = true;
    },
    async deleteChild(child) {
      this.dialogShow = true;
      this.confirmMessage =
        'Do you want to delete the record?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
          try {
            await this.childApi.delete(id)
            this.dialogShow = false;
            this.$emit('loadTableData')
            if ((this.childListModal || this.isForm) && this.$refs.childList) {
              this.$refs.childList.loadData();
            }
          } catch (e) {
            this.$toast.error(e.message)
          }
        }
      }
    },
    async unlinkChild(child) {
      if (this.isNew) {
        this.localState.splice(this.localState.indexOf(child), 1)
        return;
      }

      await this.loadChildMeta();
      const column = this.childMeta.columns.find(c => c.cn === this.hm.cn);
      if (column.rqd) {
        this.$toast.info('Unlink is not possible, instead add to another record.').goAway(3000)
        return
      }
      const _cn = column._cn;
      const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
      await this.childApi.update(id, {[_cn]: null}, child)
      this.$emit('loadTableData')
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        this.$refs.childList.loadData();
      }
      // }
      // }
    },
    async loadChildMeta() {
      // todo: optimize
      if (!this.childMeta) {
        const childTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.hm.tn
        }]);
        this.childMeta = JSON.parse(childTableData.meta);
        // this.childQueryParams = JSON.parse(childTableData.query_params);
      }
    },
    async showNewRecordModal() {
      await this.loadChildMeta();
      this.newRecordModal = true;
    },
    async addChildToParent(child) {
      if (this.isNew) {
        this.localState.push(child);
        this.newRecordModal = false;
        return;
      }

      const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
      const _cn = this.childForeignKey;
      this.newRecordModal = false;

      await this.childApi.update(id, {
        [_cn]: this.parentId
      }, {
        [_cn]: child[this.childForeignKey]
      });

      this.$emit('loadTableData')
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        this.$refs.childList.loadData();
      }
    },
    async editChild(child) {
      await this.loadChildMeta();
      this.isNewChild = false;
      this.selectedChild = child;
      this.expandFormModal = true;
      setTimeout(() => {
        this.$refs.expandedForm && this.$refs.expandedForm.reload()
      }, 500)
    },
    async insertAndAddNewChildRecord() {
      this.newRecordModal = false;
      await this.loadChildMeta();
      this.isNewChild = true;
      this.selectedChild = {
        [this.childForeignKey]: this.parentId
      };
      this.expandFormModal = true;
      setTimeout(() => {
        this.$refs.expandedForm && this.$refs.expandedForm.$set(this.$refs.expandedForm.changedColumns, this.childForeignKey, true)
      }, 500)
    }
  },
  computed: {
    childApi() {
      return this.childMeta && this.childMeta._tn ?
        ApiFactory.create(this.$store.getters['project/GtrProjectType'],
          this.childMeta && this.childMeta._tn, this.childMeta && this.childMeta.columns, this) : null;
    },
    childPrimaryCol() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pv) || {})._cn
    },
    primaryCol() {
      return this.meta && (this.meta.columns.find(c => c.pv) || {})._cn
    },
    childPrimaryKey() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pk) || {})._cn
    },
    childForeignKey() {
      return this.childMeta && this.childMeta.columns.find(c => c.cn === this.hm.cn)._cn
    },
    disabledChildColumns() {
      return {[this.childForeignKey]: true}
    },
    // todo:
    form() {
      return this.selectedChild ? () => import("@/components/project/spreadsheet/components/expandedForm") : 'span';
    },
    childAvailableColumns() {
      const hideCols = ['created_at', 'updated_at'];
      if (!this.childMeta) return [];

      const columns = [];
      if (this.childMeta.columns) {
        columns.push(...this.childMeta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn)))
      }
      if (this.childMeta.v) {
        columns.push(...this.childMeta.v.map(v => ({...v, virtual: 1})));
      }
      return columns;
    },
    childQueryParams() {
      if (!this.childMeta) return {}
      return {
        childs: (this.childMeta && this.childMeta.hasMany && this.childMeta.hasMany.map(hm => hm.tn).join()) || '',
        parents: (this.childMeta && this.childMeta.belongsTo && this.childMeta.belongsTo.map(hm => hm.rtn).join()) || '',
        many: (this.childMeta && this.childMeta.manyToMany && this.childMeta.manyToMany.map(mm => mm.rtn).join()) || ''
      }
    },
    parentId() {
      return this.meta && this.meta.columns ? this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___') : '';
    }
  },
  watch: {
     isNew(n, o) {
      debugger
      if (!n && o) {
        debugger
        let child;
        debugger
        while (child = this.localState.pop()) {
           this.addChildToParent(child)
        }
        this.$emit('newRecordsSaved')
      }
    }
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

::v-deep {
  .unlink-icon {
    padding: 0px 1px 2px 1px;
    margin-top: 2px;
    margin-right: -2px;
  }

  .search-field {
    input {
      max-height: 28px !important;
    }

    .v-input__slot {
      min-height: auto !important;
    }
  }
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
