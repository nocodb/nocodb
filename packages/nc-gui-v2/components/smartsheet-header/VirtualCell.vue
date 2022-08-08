<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ColumnInj, MetaInj } from '~/context'
import { provide } from '#imports'

const { column } = defineProps<{ column: ColumnType & { meta: any } }>()

provide(ColumnInj, column)

const meta = inject(MetaInj)

useProvideColumnCreateStore(meta as Ref<TableType>, column)

// import { UITypes } from 'nocodb-sdk'
// import { getUIDTIcon } from '../helpers/uiTypes'
// import EditVirtualColumn from '~/components/project/spreadsheet/components/EditVirtualColumn'
//
// export default {
//   name: 'VirtualHeaderCell',
//   components: { EditVirtualColumn },
//   props: ['column', 'nodes', 'meta', 'isForm', 'isPublicView', 'sqlUi', 'required', 'isLocked', 'isVirtual'],
//   data: () => ({
//     columnDeleteDialog: false,
//     editColumnMenu: false,
//     rollupIcon: getUIDTIcon('Rollup'),
//     rels: ['bt', 'hm', 'mm']
//   }),
//   computed: {
//     alias() {
//       // return this.column.lk ? `${this.column.lk._lcn} <small class="grey--text text--darken-1">(from ${this.column.lk._ltn})</small>` : this.column.title
//       return this.column.title
//     },
//     type() {
//       if (this.column?.colOptions?.type) {
//         return this.column.colOptions.type
//       }
//       if (this.column?.colOptions?.formula) {
//         return 'formula'
//       }
//       if (this.column.uidt === UITypes.Lookup) {
//         return 'lk'
//       }
//       if (this.column.uidt === UITypes.Rollup) {
//         return 'rl'
//       }
//       return ''
//     },
//     relation() {
//       if (this.rels.includes(this.type)) {
//         return this.column
//       } else if (this.column.colOptions?.fk_relation_column_id) {
//         return this.meta.columns.find(c => c.id === this.column.colOptions?.fk_relation_column_id)
//       }
//       return undefined
//     },
//     relationType() {
//       return this.relation?.colOptions?.type
//     },
//     relationMeta() {
//       if (this.rels.includes(this.type)) {
//         return this.getMeta(this.column.colOptions.fk_related_model_id)
//       } else if (this.relation) {
//         return this.getMeta(this.relation.colOptions.fk_related_model_id)
//       }
//       return undefined
//     },
//     childColumn() {
//       if (this.relationMeta?.columns) {
//         if (this.type === 'rl') {
//           const ch = this.relationMeta.columns.find(c => c.id === this.column.colOptions.fk_rollup_column_id)
//           return ch
//         }
//         if (this.type === 'lk') {
//           const ch = this.relationMeta.columns.find(c => c.id === this.column.colOptions.fk_lookup_column_id)
//           return ch
//         }
//       }
//       return ''
//     },
//     childTable() {
//       if (this.relationMeta?.title) {
//         return this.relationMeta.title
//       }
//       return ''
//     },
//     parentTable() {
//       if (this.rels.includes(this.type)) {
//         return this.meta.title
//       }
//       return ''
//     },
//     parentColumn() {
//       if (this.rels.includes(this.type)) {
//         return this.column.title
//       }
//       return ''
//     },
//     tooltipMsg() {
//       if (!this.column) {
//         return ''
//       }
//       if (this.type === 'hm') {
//         return `'${this.parentTable}' has many '${this.childTable}'`
//       } else if (this.type === 'mm') {
//         return `'${this.childTable}' & '${this.parentTable}' have <br>many to many relation`
//       } else if (this.type === 'bt') {
//         return `'${this.column.title}' belongs to '${this.childTable}'`
//       } else if (this.type === 'lk') {
//         return `'${this.childColumn.title}' from '${this.childTable}' (${this.childColumn.uidt})`
//       } else if (this.type === 'formula') {
//         return `Formula - ${this.column.colOptions.formula}`
//       } else if (this.type === 'rl') {
//         return `'${this.childColumn.title}' of '${this.childTable}' (${this.childColumn.uidt})`
//       }
//       return ''
//     }
//   },
//   methods: {
//     getMeta(id) {
//       return this.$store.state.meta.metas[id] || {}
//     },
//     async deleteColumn() {
//       try {
//         await this.$api.dbTableColumn.delete(this.column.id)
//
//         if (this.column.uidt === UITypes.LinkToAnotherRecord && this.column.colOptions) {
//           this.$store.dispatch('meta/ActLoadMeta', { force: true, id: this.column.colOptions.fk_related_model_id }).then(() => {})
//         }
//
//         this.$emit('saved')
//         this.columnDeleteDialog = false
//       } catch (e) {
//         this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000)
//       }
//     }
//   }
// }
</script>

<template>
  <div class="d-flex align-center">
    <!--    <v-tooltip bottom>
          <template #activator="{ on }">
          todo: bring tooltip
          -->
    <SmartsheetHeaderVirtualCellIcon v-if="column" />
    <span class="name" style="white-space: nowrap" :title="column.title"> {{ column.title }}</span>
    <span v-if="column.rqd" class="error--text text--lighten-1">&nbsp;*</span>

    <!--    <span class="caption" v-html="tooltipMsg" /> -->

    <!--    </v-tooltip> -->
    <v-spacer />

    <SmartsheetHeaderMenu :virtual="true" />
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
