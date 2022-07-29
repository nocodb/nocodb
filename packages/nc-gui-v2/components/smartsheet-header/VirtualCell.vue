<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { ColumnInj } from '~/context'
import { provide } from '#imports'

const { column } = defineProps<{ column: ColumnType & { meta: any } }>()
provide(ColumnInj, column)
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
    <!--
      todo: implement delete or edit column

          <v-menu
            v-if="!isLocked && !isVirtual && !isPublicView && _isUIAllowed('edit-column') && !isForm"
            offset-y
            open-on-hover
            left
            transition="slide-y-transition"
          >
            <template #activator="{ on }">
              <v-icon v-if="!isLocked && !isForm" small v-on="on"> mdi-menu-down </v-icon>
            </template>
            <v-list dense>
              <v-list-item dense @click="editColumnMenu = true">
                <x-icon small class="mr-1 nc-column-edit" color="primary"> mdi-pencil </x-icon>
                <span class="caption">
                  &lt;!&ndash; Edit &ndash;&gt;
                  {{ $t('general.edit') }}
                </span>
              </v-list-item>
              <v-list-item @click="columnDeleteDialog = true">
                <x-icon small class="mr-1 nc-column-delete" color="error"> mdi-delete-outline </x-icon>
                <span class="caption">
                  &lt;!&ndash; Delete &ndash;&gt;
                  {{ $t('general.delete') }}
                </span>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-dialog v-model="columnDeleteDialog" max-width="500" persistent>
            <v-card>
              <v-card-title class="grey darken-2 subheading white&#45;&#45;text"> Confirm </v-card-title>
              <v-divider />
              <v-card-text class="mt-4 title">
                Do you want to delete <span class="font-weight-bold">'{{ column.title }}'</span> column ?
              </v-card-text>
              <v-divider />
              <v-card-actions class="d-flex pa-4">
                <v-spacer />
                <v-btn small @click="columnDeleteDialog = false">
                  &lt;!&ndash; Cancel &ndash;&gt;
                  {{ $t('general.cancel') }}
                </v-btn>
                <v-btn v-t="['a:column:delete']" small color="error" @click="deleteColumn"> Confirm </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          <v-menu v-model="editColumnMenu" offset-y content-class="" left transition="slide-y-transition">
            <template #activator="{ on }">
              <span v-on="on" />
            </template>
            <edit-virtual-column
              v-if="editColumnMenu"
              v-model="editColumnMenu"
              :nodes="nodes"
              :edit-column="true"
              :column="column"
              :meta="meta"
              :sql-ui="sqlUi"
              v-on="$listeners"
            />
          </v-menu> -->
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
