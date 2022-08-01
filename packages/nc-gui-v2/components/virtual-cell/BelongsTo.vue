<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import { ColumnInj } from '~/context'
import { useBelongsTo } from '#imports'

const column = inject(ColumnInj)
const value = inject('value')
const active = false
const localState = null

const { parentMeta, loadParentMeta, primaryValueProp } = useBelongsTo(column as ColumnType)
await loadParentMeta()
// import ApiFactory from '@/components/project/spreadsheet/apis/apiFactory'
/* import { RelationTypes, UITypes, isSystemColumn } from 'nocodb-sdk'
import ListItems from '~/components/project/spreadsheet/components/virtualCell/components/ListItems'
import ListChildItems from '~/components/project/spreadsheet/components/virtualCell/components/ListChildItems'
import ItemChip from '~/components/project/spreadsheet/components/virtualCell/components/ItemChip'
import { parseIfInteger } from '@/helpers'

export default {
  name: 'BelongsToCell',
  components: { ListChildItems, ItemChip, ListItems },
  props: {
    isLocked: Boolean,
    breadcrumbs: {
      type: Array,
      default() {
        return []
      },
    },
    isForm: Boolean,
    value: [Array, Object],
    meta: [Object],
    nodes: [Object],
    row: [Object],
    api: [Object, Function],
    sqlUi: [Object, Function],
    active: Boolean,
    isNew: Boolean,
    disabledColumns: Object,
    isPublic: Boolean,
    metas: Object,
    password: String,
    column: Object,
  },
  data: () => ({
    newRecordModal: false,
    parentListModal: false,
    // parentMeta: null,
    list: null,
    childList: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
    selectedParent: null,
    isNewParent: false,
    expandFormModal: false,
    localState: null,
    pid: null,
  }),
  computed: {
    parentMeta() {
      return this.metas
        ? this.metas[this.column.colOptions.fk_related_model_id]
        : this.$store.state.meta.metas[this.column.colOptions.fk_related_model_id]
    },
    // todo : optimize
    parentApi() {},
    parentId() {
      return (
        this.pid ??
        (this.value &&
          this.parentMeta &&
          this.parentMeta.columns
            .filter((c) => c.pk)
            .map((c) => this.value[c.title])
            .join('___'))
      )
    },
    rowId() {
      return (
        this.row &&
        this.meta &&
        this.meta.columns
          .filter((c) => c.pk)
          .map((c) => this.row[c.title])
          .join('___')
      )
    },
    parentPrimaryCol() {
      return this.parentMeta && (this.parentMeta.columns.find((c) => c.pv) || {}).title
    },
    parentPrimaryKey() {
      return this.parentMeta && (this.parentMeta.columns.find((c) => c.pk) || {}).title
    },
    parentReferenceKey() {
      return (
        this.parentMeta && (this.parentMeta.columns.find((c) => c.id === this.column.colOptions.fk_parent_column_id) || {}).title
      )
    },
    btWhereClause() {
      // if parent reference key is pk, then filter out the selected value
      // else, filter out the selected value + empty values (as we can't set an empty value)
      const prk = this.parentReferenceKey
      const selectedValue =
        this.meta && this.meta.columns
          ? this.meta.columns
              .filter((c) => c.id === this.column.colOptions.fk_child_column_id)
              .map((c) => this.row[c.title] || '')
              .join('___')
          : ''
      return `(${prk},not,${selectedValue})~or(${prk},is,null)`
    },
    parentQueryParams() {
      if (!this.parentMeta) {
        return {}
      }
      // todo: use reduce
      return {}
    },
    parentAvailableColumns() {
      if (!this.parentMeta) {
        return []
      }

      const columns = []
      if (this.parentMeta.columns) {
        columns.push(...this.parentMeta.columns.filter((c) => !isSystemColumn(c)))
      }
      return columns
    },
    // todo:
    form() {
      return this.selectedParent && !this.isPublic
        ? () => import('~/components/project/spreadsheet/components/ExpandedForm')
        : 'span'
    },
    cellValue() {
      if (this.value || this.localState) {
        if (this.parentMeta && this.parentPrimaryCol) {
          return (this.value || this.localState)[this.parentPrimaryCol]
        }
        return Object.values(this.value || this.localState)[1]
      }
      return null
    },
  },
  watch: {
    isNew(n, o) {
      if (!n && o) {
        this.localState = null
        this.$emit('update:localState', this.localState)
      }
    },
  },
  async mounted() {
    if (this.isNew && this.value) {
      this.localState = this.value
    }
    if (this.isForm) {
      await this.loadParentMeta()
    }
  },
  created() {
    this.loadParentMeta()
  },
  methods: {
    async onParentSave(parent) {
      if (this.isNewParent) {
        await this.addChildToParent(parent)
      } else {
        this.$emit('loadTableData')
      }
    },
    async insertAndMapNewParentRecord() {
      await this.loadParentMeta()
      this.newRecordModal = false
      this.isNewParent = true
      this.selectedParent = {
        [(
          this.parentMeta.columns.find(
            (c) =>
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions &&
              this.column.colOptions &&
              c.colOptions.fk_child_column_id === this.column.colOptions.fk_child_column_id &&
              c.colOptions.fk_parent_column_id === this.column.colOptions.fk_parent_column_id &&
              c.colOptions.type === RelationTypes.HAS_MANY,
          ) || {}
        ).title]: [this.row],
      }
      this.expandFormModal = true
    },

    async unlink(parent) {
      const column = this.meta.columns.find((c) => c.id === this.column.colOptions.fk_child_column_id)
      const _cn = column.title
      if (this.isNew) {
        this.$emit('updateCol', this.row, _cn, null)
        this.localState = null
        this.$emit('update:localState', this.localState)
        return
      }
      if (column.rqd) {
        this.$toast.info('Unlink is not possible, instead map to another parent.').goAway(3000)
        return
      }
      const id = this.meta.columns
        .filter((c) => c.pk)
        .map((c) => this.row[c.title])
        .join('___')

      // todo: audit
      await this.$api.dbTableRow.nestedRemove(
        NOCO,
        this.projectName,
        this.meta.title,
        id,
        'bt',
        this.column.title,
        parent[this.parentPrimaryKey],
      )

      this.$emit('loadTableData')
      if (this.isForm && this.$refs.childList) {
        this.$refs.childList.loadData()
      }
    },
    async showParentListModal() {
      this.parentListModal = true
      await this.loadParentMeta()
      const pid = this.meta.columns
        .filter((c) => c.pk)
        .map((c) => this.row[c.title])
        .join('___')
      const _cn = this.parentMeta.columns.find((c) => c.column_name === this.hm.column_name).title
      this.childList = await this.parentApi.paginatedList({
        where: `(${_cn},eq,${pid})`,
      })
    },
    async removeChild(child) {
      this.dialogShow = true
      this.confirmMessage = 'Do you want to delete the record?'
      this.confirmAction = async (act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          const id = this.parentMeta.columns
            .filter((c) => c.pk)
            .map((c) => child[c.title])
            .join('___')
          await this.parentApi.delete(id)
          this.pid = null
          this.dialogShow = false
          this.$emit('loadTableData')
          if (this.isForm && this.$refs.childList) {
            this.$refs.childList.loadData()
          }
        }
      }
    },
    async loadParentMeta() {
      // todo: optimize
      if (!this.parentMeta) {
        await this.$store.dispatch('meta/ActLoadMeta', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          id: this.column.colOptions.fk_related_model_id,
        })
      }
    },
    async showNewRecordModal() {
      await this.loadParentMeta()
      this.newRecordModal = true
    },
    async addChildToParent(parent) {
      const pid = this._extractRowId(parent, this.parentMeta)
      const id = this._extractRowId(this.row, this.meta)
      const _cn = this.meta.columns.find((c) => c.id === this.column.colOptions.fk_child_column_id).title

      if (this.isNew) {
        const _rcn = this.parentMeta.columns.find((c) => c.id === this.column.colOptions.fk_parent_column_id).title
        this.localState = parent
        this.$emit('update:localState', this.localState)
        this.$emit('updateCol', this.row, _cn, parent[_rcn])
        this.newRecordModal = false
        return
      }
      await this.$api.dbTableRow.nestedAdd(NOCO, this.projectName, this.meta.title, id, 'bt', this.column.title, pid)

      this.pid = pid

      this.newRecordModal = false

      this.$emit('loadTableData')
      if (this.isForm && this.$refs.childList) {
        this.$refs.childList.loadData()
      }
    },
    async editParent(parent) {
      await this.loadParentMeta()
      this.isNewParent = false
      this.selectedParent = parent
      this.expandFormModal = true
      setTimeout(() => {
        this.$refs.expandedForm && this.$refs.expandedForm.reload()
      }, 500)
    },
  },
} */
</script>

<template>
  <div class="d-flex d-100 chips-wrapper" :class="{ active }">
    <!--    <template v-if="!isForm"> -->
    <div class="chips d-flex align-center img-container flex-grow-1 hm-items">
      <template v-if="value || localState">
        <ItemChip :active="active" :item="value" :value="value[primaryValueProp]" />
        <!--                      :readonly="isLocked || (isPublic && !isForm)"
                    @edit="editParent"
                    @unlink="unlink" -->
      </template>
    </div>
    <!--      <div
            v-if="!isLocked && _isUIAllowed('xcDatatableEditable') && (isForm || !isPublic)"
            class="action align-center justify-center px-1 flex-shrink-1"
            :class="{ 'd-none': !active, 'd-flex': active }"
          >
            <x-icon small :color="['primary', 'grey']" @click="showNewRecordModal">
              {{ value ? 'mdi-arrow-expand' : 'mdi-plus' }}
            </x-icon>
          </div> -->
    <!--    </template> -->
    <!--    <ListItems
          v-if="newRecordModal"
          :key="parentId"
          v-model="newRecordModal"
          :size="10"
          :meta="parentMeta"
          :column="column"
          :primary-col="parentPrimaryCol"
          :primary-key="parentPrimaryKey"
          :parent-meta="meta"
          :api="parentApi"
          :query-params="{
            ...parentQueryParams,
            where: isNew ? null : `${btWhereClause}`,
          }"
          :is-public="isPublic"
          :tn="bt && bt.rtn"
          :password="password"
          :row-id="rowId"
          @add-new-record="insertAndMapNewParentRecord"
          @add="addChildToParent"
        />

        <ListChildItems
          v-if="parentMeta && isForm"
          ref="childList"
          :is-form="isForm"
          :local-state="localState ? [localState] : []"
          :is-new="isNew"
          :size="10"
          :parent-meta="parentMeta"
          :meta="parentMeta"
          :primary-col="parentPrimaryCol"
          :primary-key="parentPrimaryKey"
          :api="parentApi"
          :query-params="{
            ...parentQueryParams,
            where: `(${parentPrimaryKey},eq,${parentId})`,
          }"
          :bt="value"
          :is-public="isPublic"
          :row-id="parentId"
          @new-record="showNewRecordModal"
          @edit="editParent"
          @unlink="unlink"
        />

        <v-dialog
          v-if="!isPublic && selectedParent"
          v-model="expandFormModal"
          :overlay-opacity="0.8"
          width="1000px"
          max-width="100%"
          class="mx-auto"
        >
          <component
            :is="form"
            v-if="selectedParent"
            ref="expandedForm"
            v-model="selectedParent"
            v-model:is-new="isNewParent"
            :db-alias="nodes.dbAlias"
            :has-many="parentMeta.hasMany"
            :belongs-to="parentMeta.belongsTo"
            :table="parentMeta.table_name"
            :old-row="{ ...selectedParent }"
            :meta="parentMeta"
            :sql-ui="sqlUi"
            :primary-value-column="parentPrimaryCol"
            :api="parentApi"
            :available-columns="parentAvailableColumns"
            :nodes="nodes"
            :query-params="parentQueryParams"
            icon-color="warning"
            :breadcrumbs="breadcrumbs"
            @cancel="
              selectedParent = null
              expandFormModal = false
            "
            @input="onParentSave"
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

.child-card {
  cursor: pointer;

  &:hover {
    box-shadow: 0 0 0.2em var(--v-textColor-lighten5);
  }
}

.hm-items {
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
      max-width: calc(100% - 22px);
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
 * @author Md Ishtiaque Zafar <ishtiaque.zafar92@gmail.com>
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
