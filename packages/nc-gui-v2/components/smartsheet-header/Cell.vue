<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { inject } from 'vue'
import { ColumnInj, MetaInj } from '../../context'
import { useProvideColumnCreateStore } from '~/composables/useColumnCreateStore'

const { column } = defineProps<{ column: ColumnType & { meta: any } }>()
provide(ColumnInj, column)
const meta = inject(MetaInj)

// instantiate column update store
useProvideColumnCreateStore(meta as Ref<TableType>, column)

/*
import { UITypes } from 'nocodb-sdk'
import cell from '@/components/project/spreadsheet/mixins/cell'
import EditColumn from '~/components/project/spreadsheet/components/EditColumn'

export default {
  name: 'HeaderCell',
  components: { EditColumn },
  mixins: [cell],
  props: [
    'value',
    'column',
    'isForeignKey',
    'meta',
    'nodes',
    'columnIndex',
    'isForm',
    'isPublicView',
    'isVirtual',
    'required',
    'isLocked',
  ],
  data: () => ({
    editColumnMenu: false,
    columnDeleteDialog: false,
  }),
  methods: {
    showColumnEdit() {
      if (this.column.uidt === UITypes.ID) {
        return this.$toast.info('Primary key column edit is not allowed.').goAway(3000)
      }
      this.editColumnMenu = true
    },
    async deleteColumn() {
      try {
        const column = { ...this.column, cno: this.column.column_name }
        column.altered = 4
        const columns = this.meta.columns.slice()
        columns[this.columnIndex] = column
        await this.$api.dbTableColumn.delete(column.id)

        this.$emit('colDelete')
        this.$emit('saved')
        this.columnDeleteDialog = false
      } catch (e) {
        console.log(e)
      }
    },
    async setAsPrimaryValue() {
      // todo: pass only updated fields
      try {
        await this.$api.dbTableColumn.primaryColumnSet(this.column.id)
        this.$toast.success('Successfully updated as primary column').goAway(3000)
      } catch (e) {
        console.log(e)
        this.$toast.error('Failed to update primary column').goAway(3000)
      }
      this.$emit('saved')
      this.columnDeleteDialog = false
    },
  },
} */
</script>

<template>
  <div class="flex align-center w-full">
    <SmartsheetHeaderCellIcon v-if="column" />
    <span v-if="column" class="name" style="white-space: nowrap" :title="column.title">{{ column.title }}</span>

    <div class="flex-1" />
    <SmartsheetHeaderMenu />
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
