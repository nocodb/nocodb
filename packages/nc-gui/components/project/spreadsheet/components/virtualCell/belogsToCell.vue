<template>
  <div class="d-flex d-100 chips-wrapper" :class="{active}">
    <template v-if="!isForm">
      <div class="chips d-flex align-center img-container flex-grow-1 hm-items">
        <template v-if="value || localState">
          <item-chip
            :active="active"
            :item="value"
            :value="cellValue"
            @edit="editParent"
            @unlink="unlink"
          />
        </template>
      </div>
      <div
        class="action align-center justify-center px-1 flex-shrink-1"
        :class="{'d-none': !active, 'd-flex':active }"
      >
        <x-icon small :color="['primary','grey']" @click="showNewRecordModal">
          {{
            value ? 'mdi-arrow-expand' : 'mdi-plus'
          }}
        </x-icon>
      </div>
    </template>
    <list-items
      v-if="newRecordModal"
      :key="parentId"
      v-model="newRecordModal"
      :size="10"
      :meta="parentMeta"
      :primary-col="parentPrimaryCol"
      :primary-key="parentPrimaryKey"
      :api="parentApi"
      :query-params="parentQueryParams"
      @add-new-record="insertAndMapNewParentRecord"
      @add="addChildToParent"
    />

    <list-child-items
      v-if="parentMeta && isForm"
      ref="childList"
      :is-form="isForm"
      :local-state="localState? [localState] : []"
      :is-new="isNew"
      :size="10"
      :parent-meta="parentMeta"
      :meta="parentMeta"
      :primary-col="parentPrimaryCol"
      :primary-key="parentPrimaryKey"
      :api="parentApi"
      :query-params="{
        ...parentQueryParams,
        where: `(${parentPrimaryKey},eq,${parentId})`
      }"
      :bt="value"
      @new-record="showNewRecordModal"
      @edit="editParent"
      @unlink="unlink"
    />

    <v-dialog
      v-if="selectedParent"
      v-model="expandFormModal"
      :overlay-opacity="0.8"
      width="1000px"
      max-width="100%"
      class=" mx-auto"
    >
      <component
        :is="form"
        v-if="selectedParent"
        ref="expandedForm"
        v-model="selectedParent"
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
        :is-new.sync="isNewParent"
        icon-color="warning"
        :breadcrumbs="breadcrumbs"
        @cancel="selectedParent = null"
        @input="onParentSave"
      />
    </v-dialog>
  </div>
</template>

<script>
import ApiFactory from '@/components/project/spreadsheet/apis/apiFactory'
import ListItems from '@/components/project/spreadsheet/components/virtualCell/components/listItems'
import ListChildItems from '@/components/project/spreadsheet/components/virtualCell/components/listChildItems'
import ItemChip from '~/components/project/spreadsheet/components/virtualCell/components/itemChip'

export default {
  name: 'BelongsToCell',
  components: { ListChildItems, ItemChip, ListItems },
  props: {
    breadcrumbs: {
      type: Array,
      default() {
        return []
      }
    },
    isForm: Boolean,
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
    pid: null
  }),
  computed: {
    parentMeta() {
      return this.$store.state.meta.metas[this.bt.rtn]
    },
    parentApi() {
      return this.parentMeta && this.parentMeta._tn
        ? ApiFactory.create(this.$store.getters['project/GtrProjectType'],
          this.parentMeta && this.parentMeta._tn, this.parentMeta && this.parentMeta.columns, this, this.parentMeta)
        : null
    },
    parentId() {
      return this.pid ?? (this.value && this.parentMeta && this.parentMeta.columns.filter(c => c.pk).map(c => this.value[c._cn]).join('___'))
    },
    parentPrimaryCol() {
      return this.parentMeta && (this.parentMeta.columns.find(c => c.pv) || {})._cn
    },
    parentPrimaryKey() {
      return this.parentMeta && (this.parentMeta.columns.find(c => c.pk) || {})._cn
    },
    parentQueryParams() {
      if (!this.parentMeta) { return {} }
      // todo: use reduce
      return {
        hm: (this.parentMeta && this.parentMeta.v && this.parentMeta.v.filter(v => v.hm).map(({ hm }) => hm.tn).join()) || '',
        bt: (this.parentMeta && this.parentMeta.v && this.parentMeta.v.filter(v => v.bt).map(({ bt }) => bt.rtn).join()) || '',
        mm: (this.parentMeta && this.parentMeta.v && this.parentMeta.v.filter(v => v.mm).map(({ mm }) => mm.rtn).join()) || ''
      }
    },
    parentAvailableColumns() {
      const hideCols = ['created_at', 'updated_at']
      if (!this.parentMeta) { return [] }

      const columns = []
      if (this.parentMeta.columns) {
        columns.push(...this.parentMeta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn) && !((this.parentMeta.v || []).some(v => v.bt && v.bt.cn === c.cn))))
      }
      if (this.parentMeta.v) {
        columns.push(...this.parentMeta.v.map(v => ({ ...v, virtual: 1 })))
      }
      return columns
    },
    // todo:
    form() {
      return this.selectedParent ? () => import('@/components/project/spreadsheet/components/expandedForm') : 'span'
    },
    cellValue() {
      if (this.value || this.localState) {
        if (this.parentMeta && this.parentPrimaryCol) {
          return (this.value || this.localState)[this.parentPrimaryCol]
        }
        return Object.values(this.value || this.localState)[1]
      }
      return null
    }
  },
  watch: {
    isNew(n, o) {
      if (!n && o) {
        this.localState = null
      }
    }
  },
  async mounted() {
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
      this.selectedParent = {}
      this.expandFormModal = true
    },

    async unlink() {
      const column = this.meta.columns.find(c => c.cn === this.bt.cn)
      const _cn = column._cn
      if (this.isNew) {
        this.$emit('updateCol', this.row, _cn, null)
        this.localState = null
        return
      }
      if (column.rqd) {
        this.$toast.info('Unlink is not possible, instead map to another parent.').goAway(3000)
        return
      }
      const id = this.meta.columns.filter(c => c.pk).map(c => this.row[c._cn]).join('___')
      await this.api.update(id, { [_cn]: null }, this.row)
      this.$emit('loadTableData')
      if (this.isForm && this.$refs.childList) {
        this.$refs.childList.loadData()
      }
    },
    async showParentListModal() {
      this.parentListModal = true
      await this.loadParentMeta()
      const pid = this.meta.columns.filter(c => c.pk).map(c => this.row[c._cn]).join('___')
      const _cn = this.parentMeta.columns.find(c => c.cn === this.hm.cn)._cn
      this.childList = await this.parentApi.paginatedList({
        where: `(${_cn},eq,${pid})`
      })
    },
    async removeChild(child) {
      this.dialogShow = true
      this.confirmMessage =
        'Do you want to delete the record?'
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          const id = this.parentMeta.columns.filter(c => c.pk).map(c => child[c._cn]).join('___')
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
          tn: this.bt.rtn
        })
        // const parentTableData = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias
        // }, 'tableXcModelGet', {
        //   tn: this.bt.rtn
        // }]);
        // this.parentMeta = JSON.parse(parentTableData.meta)
      }
    },
    async showNewRecordModal() {
      await this.loadParentMeta()
      this.newRecordModal = true
    },
    async addChildToParent(parent) {
      const pid = this.parentMeta.columns.filter(c => c.pk).map(c => parent[c._cn]).join('___')
      const id = this.meta.columns.filter(c => c.pk).map(c => this.row[c._cn]).join('___')
      const _cn = this.meta.columns.find(c => c.cn === this.bt.cn)._cn

      if (this.isNew) {
        this.localState = parent
        this.$emit('updateCol', this.row, _cn, +pid || pid)
        this.newRecordModal = false
        return
      }

      await this.api.update(id, {
        [_cn]: +pid
      }, {
        [_cn]: this.value && this.value[this.parentPrimaryKey]
      })
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
