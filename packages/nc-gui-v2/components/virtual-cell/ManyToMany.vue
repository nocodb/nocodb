<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import { ColumnInj } from '~/context'
import { useManyToMany } from '#imports'

const column = inject(ColumnInj)
const value = inject('value')
const active = false
const isLocked = false

const { childMeta, loadChildMeta, primaryValueProp } = useManyToMany(column as ColumnType)
await loadChildMeta()

/* import { RelationTypes, UITypes, isSystemColumn } from 'nocodb-sdk'
import DlgLabelSubmitCancel from '~/components/utils/DlgLabelSubmitCancel'
import ListItems from '~/components/project/spreadsheet/components/virtualCell/components/ListItems'
import ListChildItems from '~/components/project/spreadsheet/components/virtualCell/components/ListChildItems'
import listChildItemsModal from '~/components/project/spreadsheet/components/virtualCell/components/ListChildItemsModal'
import { parseIfInteger } from '@/helpers'
import ItemChip from '~/components/project/spreadsheet/components/virtualCell/components/ItemChip'

export default {
  name: 'ManyToManyCell',
  components: { ListChildItems, ItemChip, ListItems, DlgLabelSubmitCancel, ListChildItemsModal: listChildItemsModal },
  props: {
    isLocked: Boolean,
    breadcrumbs: {
      type: Array,
      default() {
        return []
      },
    },
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
    required: Boolean,
    isPublic: Boolean,
    metas: Object,
    password: String,
    column: Object,
  },
  data: () => ({
    isNewChild: false,
    newRecordModal: false,
    childListModal: false,
    // childMeta: null,
    // assocMeta: null,
    childList: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
    selectedChild: null,
    expandFormModal: false,
    localState: [],
  }),
  computed: {
    getCellValue() {
      return (cellObj) => {
        if (cellObj) {
          if (this.childPrimaryCol) {
            return cellObj[this.childPrimaryCol]
          }
          return Object.values(cellObj)[1]
        }
      }
    },
    childMeta() {
      return this.metas
        ? this.metas[this.column.colOptions.fk_related_model_id]
        : this.$store.state.meta.metas[this.column.colOptions.fk_related_model_id]
    },
    assocMeta() {
      return this.metas
        ? this.metas[this.column.colOptions.fk_mm_model_id]
        : this.$store.state.meta.metas[this.column.colOptions.fk_mm_model_id]
    },
    // todo : optimize
    childApi() {
      // return this.childMeta && this.$ncApis.get({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   id: this.column.colOptions.fk_related_model_id
      // })
      //
      // return this.childMeta && this.childMeta.title
      //   ? ApiFactory.create(
      //     this.$store.getters['project/GtrProjectType'],
      //     this.childMeta.title,
      //     this.childMeta.columns,
      //     this,
      //     this.childMeta
      //   )
      //   : null
    },
    // todo : optimize
    assocApi() {
      // return this.childMeta && this.$ncApis.get({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   id: this.column.colOptions.fk_mm_model_id
      // })
      // return this.assocMeta && this.assocMeta.title
      //   ? ApiFactory.create(
      //     this.$store.getters['project/GtrProjectType'],
      //     this.assocMeta.title,
      //     this.assocMeta.columns,
      //     this,
      //     this.assocMeta
      //   )
      //   : null
    },
    childPrimaryCol() {
      return this.childMeta && (this.childMeta.columns.find((c) => c.pv) || {}).title
    },
    childPrimaryKey() {
      return this.childMeta && (this.childMeta.columns.find((c) => c.pk) || {}).title
    },
    parentPrimaryKey() {
      return this.meta && (this.meta.columns.find((c) => c.pk) || {}).title
    },
    childQueryParams() {
      if (!this.childMeta) {
        return {}
      }
      // todo: use reduce
      return {
        hm:
          (this.childMeta &&
            this.childMeta.v &&
            this.childMeta.v
              .filter((v) => v.hm)
              .map(({ hm }) => hm.table_name)
              .join()) ||
          '',
        bt:
          (this.childMeta &&
            this.childMeta.v &&
            this.childMeta.v
              .filter((v) => v.bt)
              .map(({ bt }) => bt.rtn)
              .join()) ||
          '',
        mm:
          (this.childMeta &&
            this.childMeta.v &&
            this.childMeta.v
              .filter((v) => v.mm)
              .map(({ mm }) => mm.rtn)
              .join()) ||
          '',
      }
    },
    conditionGraph() {
      // if (!this.childMeta || !this.assocMeta) { return null }
      // return {
      //   [this.assocMeta.table_name]: {
      //     relationType: 'hm',
      //     [this.assocMeta.columns.find(c => c.column_name === this.mm.vcn).column_name]: {
      //       eq: this.row[this.parentPrimaryKey]
      //     }
      //   }
      // }
    },
    childAvailableColumns() {
      if (!this.childMeta) {
        return []
      }

      const columns = []
      if (this.childMeta.columns) {
        columns.push(...this.childMeta.columns.filter((c) => !isSystemColumn(c)))
      }
      return columns
    },
    // todo:
    form() {
      return this.selectedChild && !this.isPublic
        ? () => import('~/components/project/spreadsheet/components/ExpandedForm')
        : 'span'
    },
  },
  watch: {
    async isNew(n, o) {
      if (!n && o) {
        await this.saveLocalState()
      }
    },
  },
  async mounted() {
    if (this.isForm) {
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()])
    }

    if (this.isNew && this.value) {
      this.localState = [...this.value]
    }
  },
  created() {
    this.loadChildMeta()
    this.loadAssociateTableMeta()
  },
  methods: {
    async onChildSave(child) {
      if (this.isNewChild) {
        this.isNewChild = false
        await this.addChildToParent(child)
      } else {
        this.$emit('loadTableData')
      }
    },
    async showChildListModal() {
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()])
      this.childListModal = true
    },
    async unlinkChild(child) {
      if (this.isNew) {
        this.localState.splice(this.localState.indexOf(child), 1)
        this.$emit('update:localState', [...this.localState])
        return
      }
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()])
      const cid = this.childMeta.columns
        .filter((c) => c.pk)
        .map((c) => child[c.title])
        .join('___')
      const pid = this.meta.columns
        .filter((c) => c.pk)
        .map((c) => this.row[c.title])
        .join('___')

      await this.$api.dbTableRow.nestedRemove(NOCO, this.projectName, this.meta.title, pid, 'mm', this.column.title, cid)

      this.$emit('loadTableData')
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        this.$refs.childList.loadData()
      }
    },
    async removeChild(child) {
      this.dialogShow = true
      this.confirmMessage = 'Do you want to delete the record?'
      this.confirmAction = async (act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          const id = this.childMeta.columns
            .filter((c) => c.pk)
            .map((c) => child[c.title])
            .join('___')
          await this.childApi.delete(id)
          this.dialogShow = false
          this.$emit('loadTableData')
          if ((this.childListModal || this.isForm) && this.$refs.childList) {
            this.$refs.childList.loadData()
          }
        }
      }
    },
    async loadChildMeta() {
      // todo: optimize
      if (!this.childMeta) {
        await this.$store.dispatch('meta/ActLoadMeta', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          // tn: this.mm.rtn,
          id: this.column.colOptions.fk_related_model_id,
        })
        // const parentTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // }, 'tableXcModelGet', {
        //   tn: this.mm.rtn
        // }]);
        // this.childMeta = JSON.parse(parentTableData.meta)
      }
    },
    async loadAssociateTableMeta() {
      // todo: optimize
      if (!this.assocMeta) {
        await this.$store.dispatch('meta/ActLoadMeta', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          id: this.column.colOptions.fk_mm_model_id,
        })
        // const assocTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // }, 'tableXcModelGet', {
        //   tn: this.mm.vtn
        // }]);
        // this.assocMeta = JSON.parse(assocTableData.meta)
      }
    },
    async showNewRecordModal() {
      await Promise.all([this.loadChildMeta(), this.loadAssociateTableMeta()])
      this.newRecordModal = true
      // this.list = await this.c hildApi.paginatedList({})
    },
    async addChildToParent(child) {
      if (this.isNew && this.localState.every((it) => it[this.childForeignKey] !== child[this.childPrimaryKey])) {
        this.localState.push(child)
        this.$emit('update:localState', [...this.localState])
        this.$emit('saveRow')
        this.newRecordModal = false
        return
      }
      const cid = this.childMeta.columns
        .filter((c) => c.pk)
        .map((c) => child[c.title])
        .join('___')
      const pid = this.meta.columns
        .filter((c) => c.pk)
        .map((c) => this.row[c.title])
        .join('___')

      // const vcidCol = this.assocMeta.columns.find(c => c.id === this.column.colOptions.fk_mm_parent_column_id).title
      // const vpidCol = this.assocMeta.columns.find(c => c.id === this.column.colOptions.fk_mm_child_column_id).title

      await this.$api.dbTableRow.nestedAdd(NOCO, this.projectName, this.meta.title, pid, 'mm', this.column.title, cid)

      try {
        this.$emit('loadTableData')
      } catch (e) {
        // todo: handle
        console.log(e)
      }
      this.newRecordModal = false
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        this.$refs.childList.loadData()
      }
    },

    async insertAndAddNewChildRecord() {
      this.newRecordModal = false
      await this.loadChildMeta()
      this.isNewChild = true
      this.selectedChild = {
        [this.childForeignKey]: this.parentId,
        [(
          this.childMeta.columns.find(
            (c) =>
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions &&
              this.column.colOptions &&
              c.colOptions.fk_child_column_id === this.column.colOptions.fk_parent_column_id &&
              c.colOptions.fk_parent_column_id === this.column.colOptions.fk_child_column_id &&
              c.colOptions.fk_mm_model_id === this.column.colOptions.fk_mm_model_id &&
              c.colOptions.type === RelationTypes.MANY_TO_MANY,
          ) || {}
        ).title]: [this.row],
      }
      this.expandFormModal = true
      setTimeout(() => {
        this.$refs.expandedForm &&
          this.$refs.expandedForm.$set(this.$refs.expandedForm.changedColumns, this.childForeignKey, true)
      }, 500)
    },
    async editChild(child) {
      await this.loadChildMeta()
      this.isNewChild = false
      this.selectedChild = child
      this.expandFormModal = true
      setTimeout(() => {
        this.$refs.expandedForm && this.$refs.expandedForm.reload()
      }, 500)
    },
    async saveLocalState(row) {
      let child
      // eslint-disable-next-line no-cond-assign
      while ((child = this.localState.pop())) {
        if (row) {
          const cid = this.childMeta.columns
            .filter((c) => c.pk)
            .map((c) => child[c.title])
            .join('___')
          const pid = this.meta.columns
            .filter((c) => c.pk)
            .map((c) => row[c.title])
            .join('___')

          await this.$api.dbTableRow.nestedAdd(NOCO, this.projectName, this.meta.title, pid, 'mm', this.column.title, cid)
        } else {
          await this.addChildToParent(child)
        }
      }
      this.$emit('newRecordsSaved')
    },
  },
} */
</script>

<template>
  <div class="d-flex d-100 chips-wrapper" :class="{ active }">
    <!--    <template v-if="!isForm"> -->
    <div class="chips d-flex align-center img-container flex-grow-1 hm-items flex-nowrap">
      <template v-if="value || localState">
        <ItemChip v-for="(v, j) in value || localState" :key="j" :item="v" :value="v[primaryValueProp]" />

        <!--                           :active="active"
       :readonly="isLocked || isPublic"
            @edit="editChild"
            @unlink="unlinkChild" -->
      </template>
      <span v-if="!isLocked && value && value.length === 10" class="caption pointer ml-1 grey--text" @click="showChildListModal"
        >more...</span
      >
    </div>
    <!--      <div -->
    <!--        v-if="!isLocked" -->
    <!--        class="actions align-center justify-center px-1 flex-shrink-1" -->
    <!--        :class="{ 'd-none': !active, 'd-flex': active }" -->
    <!--      > -->
    <!--        <x-icon -->
    <!--          v-if="_isUIAllowed('xcDatatableEditable') && (isForm || !isPublic)" -->
    <!--          small -->
    <!--          :color="['primary', 'grey']" -->
    <!--          @click="showNewRecordModal" -->
    <!--        > -->
    <!--          mdi-plus -->
    <!--        </x-icon> -->
    <!--        <x-icon x-small :color="['primary', 'grey']" class="ml-2" @click="showChildListModal"> mdi-arrow-expand </x-icon> -->
    <!--      </div> -->
    <!--    </template> -->

    <!--    <ListItems
      v-if="newRecordModal"
      v-model="newRecordModal"
      :hm="true"
      :size="10"
      :column="column"
      :meta="childMeta"
      :primary-col="childPrimaryCol"
      :primary-key="childPrimaryKey"
      :parent-meta="meta"
      :api="api"
      :mm="mm"
      :tn="mm && mm.rtn"
      :parent-id="row && row[parentPrimaryKey]"
      :is-public="isPublic"
      :query-params="childQueryParams"
      :password="password"
      :row-id="row && row[parentPrimaryKey]"
      @add-new-record="insertAndAddNewChildRecord"
      @add="addChildToParent"
    />

    <ListChildItems
      :is="isForm ? 'list-child-items' : 'list-child-items-modal'"
      v-if="childMeta && assocMeta && (isForm || childListModal)"
      ref="childList"
      v-model="childListModal"
      :is-form="isForm"
      :is-new="isNew"
      :size="10"
      :meta="childMeta"
      :parent-meta="meta"
      :primary-col="childPrimaryCol"
      :primary-key="childPrimaryKey"
      :api="childApi"
      :mm="mm"
      :parent-id="row && row[parentPrimaryKey]"
      :query-params="{ ...childQueryParams, conditionGraph }"
      :local-state="localState"
      :is-public="isPublic"
      :row-id="row && row[parentPrimaryKey]"
      :column="column"
      type="mm"
      :password="password"
      @new-record="showNewRecordModal"
      @edit="editChild"
      @unlink="unlinkChild"
    />
    <DlgLabelSubmitCancel
      v-if="dialogShow"
      type="primary"
      :actions-mtd="confirmAction"
      :dialog-show="dialogShow"
      :heading="confirmMessage"
    />

    &lt;!&ndash; todo : move to list item component &ndash;&gt;
    <v-dialog
      v-if="selectedChild && !isPublic"
      v-model="expandFormModal"
      :overlay-opacity="0.8"
      width="1000px"
      max-width="100%"
      class="mx-auto"
    >
      <component
        :is="form"
        v-if="selectedChild"
        ref="expandedForm"
        v-model="selectedChild"
        :db-alias="nodes.dbAlias"
        :has-many="childMeta.hasMany"
        :belongs-to="childMeta.belongsTo"
        v-model:is-new="isNewChild"
        :table="childMeta.table_name"
        :old-row="{ ...selectedChild }"
        :meta="childMeta"
        :primary-value-column="childPrimaryCol"
        :available-columns="childAvailableColumns"
        icon-color="warning"
        :nodes="nodes"
        :query-params="childQueryParams"
        :breadcrumbs="breadcrumbs"
        @cancel="
          selectedChild = null
          expandFormModal = false
        "
        @input="onChildSave"
      />
    </v-dialog> -->
  </div>
</template>

<style scoped lang="scss">
.items-container {
  overflow-x: visible;
  max-height: min(500px, 60vh);
  overflow-y: auto;
}

.primary-value {
  .primary-key {
    display: none;
    margin-left: 0.5em;
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
    box-shadow: 0 0 0.2em var(--v-textColor-lighten5);
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

.chips-wrapper {
  .chips {
    max-width: 100%;
  }

  &.active {
    .chips {
      max-width: calc(100% - 44px);
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
