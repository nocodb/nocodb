<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import { ColumnInj } from '~/context'
import { useHasMany } from '#imports'

const column = inject(ColumnInj)
const value = inject('value')
const active = false

const { childMeta, loadChildMeta, primaryValueProp } = useHasMany(column as ColumnType)
await loadChildMeta()

/* // import ApiFactory from '@/components/project/spreadsheet/apis/apiFactory'
import { RelationTypes, UITypes, isSystemColumn } from 'nocodb-sdk'
import DlgLabelSubmitCancel from '~/components/utils/DlgLabelSubmitCancel'
import Pagination from '~/components/project/spreadsheet/components/Pagination'
import ListItems from '~/components/project/spreadsheet/components/virtualCell/components/ListItems'
import ListChildItems from '~/components/project/spreadsheet/components/virtualCell/components/ListChildItems'
import listChildItemsModal from '~/components/project/spreadsheet/components/virtualCell/components/ListChildItemsModal'
import { parseIfInteger } from '@/helpers'
import ItemChip from '~/components/project/spreadsheet/components/virtualCell/components/ItemChip'

// todo: handling add new record for new row

export default {
  name: 'HasManyCell',
  components: {
    ListChildItems,
    ItemChip,
    ListItems,
    Pagination,
    DlgLabelSubmitCancel,
    ListChildItemsModal: listChildItemsModal,
  },
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
    nodes: [Object],
    row: [Object],
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
    newRecordModal: false,
    childListModal: false,
    // childMeta: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
    selectedChild: null,
    expandFormModal: false,
    isNewChild: false,
    localState: [],
  }),
  computed: {
    childMeta() {
      return this.metas
        ? this.metas[this.column.colOptions.fk_related_model_id]
        : this.$store.state.meta.metas[this.column.colOptions.fk_related_model_id]
    },
    // todo : optimize
    childApi() {},
    childPrimaryCol() {
      return this.childMeta && (this.childMeta.columns.find((c) => c.pv) || {}).title
    },
    primaryCol() {
      return this.meta && (this.meta.columns.find((c) => c.pv) || {}).title
    },
    childPrimaryKey() {
      return this.childMeta && (this.childMeta.columns.find((c) => c.pk) || {}).title
    },
    childForeignKey() {
      return (
        this.childMeta && (this.childMeta.columns.find((c) => c.id === this.column.colOptions.fk_child_column_id) || {}).title
      )
    },
    childForeignKeyVal() {
      return this.meta && this.meta.columns
        ? this.meta.columns
            .filter((c) => c.title === this.childForeignKey)
            .map((c) => this.row[c.title] || '')
            .join('___')
        : ''
    },
    isVirtualRelation() {
      return this.column && this.column.colOptions.virtual // (this.childMeta && (!!this.childMeta.columns.find(c => c.column_name === this.hm.column_name && this.hm.type === 'virtual'))) || false
    },
    isByPass() {
      if (this.isVirtualRelation) {
        return false
      }
      // if child fk references a column in parent which is not pk,
      // then this column has to be filled
      // if (((this.meta && this.meta.columns.find(c => !c.pk && c.id === this.hm.rcn)) || false)) {
      //   return this.childForeignKeyVal === ''
      // }
      if ((this.meta && this.meta.columns.find((c) => !c.pk && c.id === this.column.fk_parent_column_id)) || false) {
        return this.childForeignKeyVal === ''
      }
      return false
    },
    disabledChildColumns() {
      return { [this.childForeignKey]: true }
    },
    // todo:
    form() {
      return this.selectedChild && !this.isPublic
        ? () => import('~/components/project/spreadsheet/components/ExpandedForm')
        : 'span'
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
    parentId() {
      return (
        (this.meta &&
          this.meta.columns &&
          (this.meta.columns
            .filter((c) => c.title === this.childForeignKey)
            .map((c) => this.row[c.title] || '')
            .join('___') ||
            this.meta.columns
              .filter((c) => c.pk)
              .map((c) => this.row[c.title])
              .join('___'))) ||
        ''
      )
    },
  },
  watch: {
    isNew(n, o) {
      if (!n && o) {
        this.saveLocalState()
      }
    },
  },
  async mounted() {
    await this.loadChildMeta()

    if (this.isNew && this.value) {
      this.localState = [...this.value]
    }
  },
  created() {
    this.loadChildMeta()
  },
  methods: {
    onChildSave() {
      if (this.isNew) {
        this.addChildToParent(this.selectedChild)
      } else {
        this.$emit('loadTableData')
      }
    },
    async showChildListModal() {
      await this.loadChildMeta()
      this.childListModal = true
    },
    async deleteChild(child) {
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
          try {
            await this.$api.data.delete(this.childMeta.id, id)
            this.dialogShow = false
            this.$emit('loadTableData')
            if ((this.childListModal || this.isForm) && this.$refs.childList) {
              this.$refs.childList.loadData()
            }
          } catch (e) {
            this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
          }
        }
      }
    },
    async unlinkChild(child) {
      if (this.isNew) {
        this.localState.splice(this.localState.indexOf(child), 1)
        this.$emit('update:localState', [...this.localState])
        return
      }

      await this.loadChildMeta()
      const column = this.childMeta.columns.find((c) => c.id === this.column.colOptions.fk_child_column_id)

      if (column.rqd) {
        this.$toast.info('Unlink is not possible, instead add to another record.').goAway(3000)
        return
      }
      const id = this.childMeta.columns
        .filter((c) => c.pk)
        .map((c) => child[c.title])
        .join('___')
      await this.$api.dbTableRow.nestedRemove(
        NOCO,
        this.projectName,
        this.meta.title,
        this.parentId,
        RelationTypes.HAS_MANY,
        this.column.title,
        id,
      )

      this.$emit('loadTableData')
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        this.$refs.childList.loadData()
      }
      // }
      // }
    },
    async loadChildMeta() {
      // todo: optimize
      if (!this.childMeta) {
        await this.$store.dispatch('meta/ActLoadMeta', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          id: this.column.colOptions.fk_related_model_id,
        })
      }
    },
    async showNewRecordModal() {
      await this.loadChildMeta()
      this.newRecordModal = true
    },
    async addChildToParent(child) {
      if (this.isNew && this.localState.every((it) => it[this.childForeignKey] !== child[this.childPrimaryKey])) {
        this.localState.push(child)
        this.$emit('update:localState', [...this.localState])
        this.$emit('saveRow')
        this.newRecordModal = false
        return
      }

      const id = this.childMeta.columns
        .filter((c) => c.pk)
        .map((c) => child[c.title])
        .join('___')
      this.newRecordModal = false
      await this.$api.dbTableRow.nestedAdd(NOCO, this.projectName, this.meta.title, this.parentId, 'hm', this.column.title, id)

      this.$emit('loadTableData')
      if ((this.childListModal || this.isForm) && this.$refs.childList) {
        await this.$refs.childList.loadData()
      }
    },
    async editChild(child) {
      await this.loadChildMeta()
      this.isNewChild = false
      this.expandFormModal = true
      this.selectedChild = child
      setTimeout(() => {
        this.$refs.expandedForm && this.$refs.expandedForm.reload()
      }, 500)
    },
    async insertAndAddNewChildRecord() {
      this.newRecordModal = false
      await this.loadChildMeta()
      this.isNewChild = true
      this.selectedChild = {
        [this.childForeignKey]: parseIfInteger(this.parentId),
        [(
          this.childMeta.columns.find(
            (c) =>
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions &&
              this.column.colOptions &&
              c.colOptions.fk_child_column_id === this.column.colOptions.fk_child_column_id &&
              c.colOptions.fk_parent_column_id === this.column.colOptions.fk_parent_column_id &&
              c.colOptions.type === RelationTypes.BELONGS_TO,
          ) || {}
        ).title]: this.row,
      }
      this.expandFormModal = true
      if (!this.isNew) {
        setTimeout(() => {
          this.$refs.expandedForm &&
            this.$refs.expandedForm.$set(this.$refs.expandedForm.changedColumns, this.childForeignKey, true)
        }, 500)
      }
    },
    getCellValue(cellObj) {
      if (cellObj) {
        if (this.childMeta && this.childPrimaryCol) {
          return cellObj[this.childPrimaryCol]
        }
        return Object.values(cellObj)[1]
      }
    },
    async saveLocalState(row) {
      let child
      // eslint-disable-next-line no-cond-assign
      while ((child = this.localState.pop())) {
        if (row) {
          const pid = this.meta.columns
            .filter((c) => c.pk)
            .map((c) => row[c.title])
            .join('___')
          const id = this.childMeta.columns
            .filter((c) => c.pk)
            .map((c) => child[c.title])
            .join('___')

          await this.$api.dbTableRow.nestedAdd(NOCO, this.projectName, this.meta.title, pid, 'hm', this.column.title, id)
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
        <ItemChip v-for="(ch, i) in value || localState" :key="i" :value="ch[primaryValueProp]" />

        <!--
                    :active="active"     :item="ch"
                    :value="getCellValue(ch)"
                    :readonly="isLocked || isPublic"
                    @edit="editChild"
                    @unlink="unlinkChild "        -->

        <!--          <span
                    v-if="!isLocked && value && value.length === 10"
                    class="caption pointer ml-1 grey&#45;&#45;text"
                    @click="showChildListModal"
                    >more...
                  </span> -->
      </template>
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
          :size="10"
          :meta="childMeta"
          :primary-col="childPrimaryCol"
          :primary-key="childPrimaryKey"
          :api="childApi"
          :parent-meta="meta"
          :column="column"
          :query-params="{
            ...childQueryParams,
            // check if it needs to bypass to
            // avoid foreign key constraint violation in real relation
            isByPass,
            where:
              // show all for new record
              isNew
                ? null
                : // filter out those selected items
                  `~not(${childForeignKey},eq,${parentId})` +
                  // allow the child with empty key
                  `~or(${childForeignKey},is,null)`,
          }"
          :is-public="isPublic"
          :password="password"
          :row-id="parentId"
          @add-new-record="insertAndAddNewChildRecord"
          @add="addChildToParent"
        />

        <ListChildItems
          :is="isForm ? 'list-child-items' : 'list-child-items-modal'"
          v-if="childMeta && (childListModal || isForm)"
          ref="childList"
          v-model="childListModal"
          v-model:local-state="localState"
          :is-form="isForm"
          :is-new="isNew"
          :size="10"
          :meta="childMeta"
          :parent-meta="meta"
          :password="password"
          :primary-col="childPrimaryCol"
          :primary-key="childPrimaryKey"
          :api="childApi"
          :column="column"
          :query-params="{
            ...childQueryParams,
            where: `(${childForeignKey},eq,${parentId})`,
          }"
          :is-public="isPublic"
          :row-id="parentId"
          type="hm"
          @new-record="showNewRecordModal"
          @edit="editChild"
          @unlink="unlinkChild"
          @delete="deleteChild"
        />

        <DlgLabelSubmitCancel
          v-if="dialogShow"
          type="primary"
          :actions-mtd="confirmAction"
          :dialog-show="dialogShow"
          :heading="confirmMessage"
        />

        <v-dialog v-model="expandFormModal" :overlay-opacity="0.8" width="1000px" max-width="100%" class="mx-auto">
          <component
            :is="form"
            v-if="selectedChild"
            ref="expandedForm"
            v-model="selectedChild"
            :db-alias="nodes.dbAlias"
            :has-many="childMeta.hasMany"
            :belongs-to="childMeta.belongsTo"
            :table="childMeta.table_name"
            v-model:is-new="isNewChild"
            :old-row="{ ...selectedChild }"
            :meta="childMeta"
            :primary-value-column="childPrimaryCol"
            :api="childApi"
            :available-columns="childAvailableColumns"
            icon-color="warning"
            :nodes="nodes"
            :query-params="childQueryParams"
            :disabled-columns="disabledChildColumns"
            :breadcrumbs="breadcrumbs"
            @cancel="
              selectedChild = null
              expandFormModal = false
            "
            @input="onChildSave"
          />
        </v-dialog>
      -->
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
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
