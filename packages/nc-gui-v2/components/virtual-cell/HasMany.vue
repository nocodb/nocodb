<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import ItemChip from './components/ItemChip.vue'
import { ColumnInj, ValueInj } from '~/context'
import { useHasMany } from '#imports'

const column = inject(ColumnInj)
const value = inject(ValueInj)
const row = inject(RowInj)

const listItemsDlg = ref(false)
const childListDlg = ref(false)

const { relatedTableMeta, loadRelatedTableMeta, relatedTablePrimaryValueProp, unlink } = useProvideLTARStore(
  column as Required<ColumnType>,
  row,
)
await loadRelatedTableMeta()

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
  <div class="flex align-center gap-1 w-full chips-wrapper group">
    <!--    <template v-if="!isForm"> -->
    <div class="chips flex align-center img-container flex-grow hm-items flex-nowrap min-w-0 overflow-hidden">
      <template v-if="value">
        <ItemChip v-for="(ch, i) in value" :key="i" :value="ch[relatedTablePrimaryValueProp]" @unlink="unlink(ch)" />
        <span v-if="value?.length === 10" class="caption pointer ml-1 grey--text" @click="childListDlg = true">more... </span>
      </template>
    </div>

    <MdiExpandIcon class="hidden group-hover:inline w-[20px] text-gray-500/50 hover:text-gray-500" @click="childListDlg = true" />
    <MdiPlusIcon class="hidden group-hover:inline w-[20px] text-gray-500/50 hover:text-gray-500" @click="listItemsDlg = true" />
    <ListItems v-model="listItemsDlg" />
    <ListChildItems v-model="childListDlg" />

  </div>
</template>
