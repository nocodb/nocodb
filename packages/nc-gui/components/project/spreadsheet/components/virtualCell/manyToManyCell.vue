<template>
  <div class="d-flex d-100 chips-wrapper" :class="{active}">
    <template v-if="!isForm">
      <div class="chips d-flex align-center img-container flex-grow-1 hm-items">
        <template v-if="(value || localState)">
          <item-chip v-for="(v,j) in (value || localState)"
                     :active="active"
                     :item="v"
                     :value="Object.values(v)[2]"
                     :key="j"
                     @edit="editChild"
                     @unlink="unlinkChild"
          ></item-chip>

        </template>
      </div>
      <div class="actions align-center justify-center px-1 flex-shrink-1" :class="{'d-none': !active, 'd-flex':active }">
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
      :api="api"
      :mm="mm"
      :parent-id="row && row[parentPrimaryKey]"
      @add-new-record="insertAndAddNewChildRecord"
      @add="addChildToParent"
      :query-params="childQueryParams"/>

    <list-child-items
      :is="isForm ? 'list-child-items' : 'list-child-items-modal'"
      :isForm="isForm"
      ref="childList"
      v-if="childMeta && assocMeta && (isForm || childListModal)"
      v-model="childListModal"
      :is-new="isNew"
      :size="10"
      :meta="childMeta"
      :parent-meta="meta"
      :primary-col="childPrimaryCol"
      :primary-key="childPrimaryKey"
      :api="childApi"
      :mm="mm"
      :parent-id="row && row[parentPrimaryKey]"
      :query-params="{...childQueryParams, conditionGraph }"
      :local-state="localState"
      @new-record="showNewRecordModal"
      @edit="editChild"
      @unlink="unlinkChild"
    />
    <v-dialog
      :overlay-opacity="0.8"
      v-if="selectedChild"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
      v-model="showExpandModal">
      <expanded-form
        v-if="selectedChild"
        :db-alias="nodes.dbAlias"
        :has-many="childMeta.hasMany"
        :belongs-to="childMeta.belongsTo"
        @cancel="selectedChild = null"
        @input="$emit('loadTableData');showChildListModal();"
        :table="childMeta.tn"
        v-model="selectedChild"
        :old-row="{...selectedChild}"
        :meta="childMeta"
        :sql-ui="sqlUi"
        :primary-value-column="childPrimaryCol"
        :api="childApi"
      ></expanded-form>
    </v-dialog>


    <dlg-label-submit-cancel
      type="primary"
      v-if="dialogShow"
      :actionsMtd="confirmAction"
      :dialogShow="dialogShow"
      :heading="confirmMessage"
    >
    </dlg-label-submit-cancel>

    <!-- todo : move to listitem component -->
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
        @cancel="selectedChild = null"
        @input="onChildSave"
      ></component>

    </v-dialog>


  </div>
</template>

<script>
import ApiFactory from "@/components/project/spreadsheet/apis/apiFactory";
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";
import ListItems from "@/components/project/spreadsheet/components/virtualCell/components/listItems";
import ItemChip from "@/components/project/spreadsheet/components/virtualCell/components/item-chip";
import ListChildItems from "@/components/project/spreadsheet/components/virtualCell/components/listChildItems";
import listChildItemsModal from "@/components/project/spreadsheet/components/virtualCell/components/listChildItemsModal";

export default {
  name: "many-to-many-cell",
  components: {ListChildItems, ItemChip, ListItems, DlgLabelSubmitCancel, listChildItemsModal },
  props: {
    value: [Object, Array],
    meta: [Object],
    mm: Object,
    nodes: [Object],
    row: [Object],
    api: [Object, Function],
    sqlUi: [Object, Function],
    active: Boolean,
    isNew: Boolean,
    isForm: Boolean,
  },
  data: () => ({
    isNewChild: false,
    newRecordModal: false,
    childListModal: false,
    childMeta: null,
    assocMeta: null,
    childList: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
    selectedChild: null,
    expandFormModal: false,
    localState: []
  }),
  async mounted() {
    if (this.isForm) {
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()]);
    }
  },
  methods: {
    async onChildSave(child) {
      if (this.isNewChild) {
        await this.addChildToParent(child)
      } else {
        this.$emit('loadTableData')
      }
    },
    async showChildListModal() {
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()]);
      this.childListModal = true;
    }, async unlinkChild(child) {
      if (this.isNew) {
        this.localState.splice(this.localState.indexOf(child), 1)
        return;
      }
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()]);

      const _pcn = this.meta.columns.find(c => c.cn === this.mm.cn)._cn;
      const _ccn = this.childMeta.columns.find(c => c.cn === this.mm.rcn)._cn;

      const apcn = this.assocMeta.columns.find(c => c.cn === this.mm.vcn).cn;
      const accn = this.assocMeta.columns.find(c => c.cn === this.mm.vrcn).cn;

      const id = this.assocMeta.columns.filter((c) => c.cn === apcn || c.cn === accn).map(c => c.cn === apcn ? this.row[_pcn] : child[_ccn]).join('___');
      await this.assocApi.delete(id)
      this.$emit('loadTableData')
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        this.$refs.childList.loadData();
      }
    },
    async removeChild(child) {
      this.dialogShow = true;
      this.confirmMessage =
        'Do you want to delete the record?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          const id = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
          await this.childApi.delete(id)
          this.dialogShow = false;
          this.$emit('loadTableData')
          if ((this.childListModal || this.isForm) && this.$refs.childList) {
            this.$refs.childList.loadData();
          }
        }
      }
    },
    async loadChildMeta() {
      // todo: optimize
      if (!this.childMeta) {
        const parentTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.mm.rtn
        }]);
        this.childMeta = JSON.parse(parentTableData.meta)
      }
    },
    async loadAssociateTableMeta() {
      // todo: optimize
      if (!this.assocMeta) {
        const assocTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcModelGet', {
          tn: this.mm.vtn
        }]);
        this.assocMeta = JSON.parse(assocTableData.meta)
      }
    },
    async showNewRecordModal() {
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()]);
      this.newRecordModal = true;
      // this.list = await this.c hildApi.paginatedList({})
    },
    async addChildToParent(child) {
      if (this.isNew) {
        this.localState.push(child)
        this.newRecordModal = false;
        return
      }

      const cid = this.childMeta.columns.filter((c) => c.pk).map(c => child[c._cn]).join('___');
      const pid = this.meta.columns.filter((c) => c.pk).map(c => this.row[c._cn]).join('___');

      const vcidCol = this.assocMeta.columns.find(c => c.cn === this.mm.vrcn)._cn;
      const vpidCol = this.assocMeta.columns.find(c => c.cn === this.mm.vcn)._cn;
      try {
        await this.assocApi.insert({
          [vcidCol]: cid,
          [vpidCol]: pid
        });

        this.$emit('loadTableData')
      } catch (e) {
        // todo: handle
        console.log(e)
      }
      this.newRecordModal = false;
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        this.$refs.childList.loadData();
      }

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
    }, async editChild(child) {
      await this.loadChildMeta();
      this.isNewChild = false;
      this.selectedChild = child;
      this.expandFormModal = true;
      setTimeout(() => {
        this.$refs.expandedForm && this.$refs.expandedForm.reload()
      }, 500)
    },
  },
  computed: {
    childApi() {
      return this.childMeta && this.childMeta._tn ?
        ApiFactory.create(
          this.$store.getters['project/GtrProjectType'],
          this.childMeta._tn,
          this.childMeta.columns,
          this
        ) : null;
    },
    assocApi() {
      return this.assocMeta && this.assocMeta._tn ?
        ApiFactory.create(
          this.$store.getters['project/GtrProjectType'],
          this.assocMeta._tn,
          this.assocMeta.columns,
          this
        ) : null;
    },
    childPrimaryCol() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pv) || {})._cn
    },
    childPrimaryKey() {
      return this.childMeta && (this.childMeta.columns.find(c => c.pk) || {})._cn
    },
    parentPrimaryKey() {
      return this.meta && (this.meta.columns.find(c => c.pk) || {})._cn
    },
    childQueryParams() {
      if (!this.childMeta) return {}
      return {
        childs: (this.childMeta && this.childMeta.hasMany && this.childMeta.hasMany.map(hm => hm.tn).join()) || '',
        parents: (this.childMeta && this.childMeta.belongsTo && this.childMeta.belongsTo.map(hm => hm.rtn).join()) || '',
        many: (this.childMeta && this.childMeta.manyToMany && this.childMeta.manyToMany.map(mm => mm.rtn).join()) || ''
      }
    },
    conditionGraph() {
      if (!this.childMeta || !this.assocMeta) return null;
      return {
        [this.assocMeta.tn]: {
          "relationType": "hm",
          [this.assocMeta.columns.find(c => c.cn === this.mm.vcn).cn]: {
            "eq": this.row[this.parentPrimaryKey]
          }
        }
      }
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
    // todo:
    form() {
      return this.selectedChild ? () => import("@/components/project/spreadsheet/components/expandedForm") : 'span';
    },
  },
  watch: {
    async isNew(n, o) {
      if (!n && o) {
        let child;
        while (child = this.localState.pop()) {
          await this.addChildToParent(child)
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


.child-list-modal {
  position: relative;

  .remove-child-icon {
    position: absolute;
    right: 10px;
    top: 10px;
    bottom: 10px;
    opacity: 0;
  }

  &:hover .remove-child-icon {
    opacity: 1;
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

.chips-wrapper{
  .chips{
    max-width: 100%;
  }
  &.active{
    .chips{
      max-width: calc(100% - 60px);
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
