<template>
  <div class="d-flex align-center">
    <v-tooltip bottom>
      <template #activator="{ on }">
        <v-icon v-if="type === 'hm'" color="warning" x-small class="mr-1" v-on="on"> mdi-table-arrow-right </v-icon>
        <v-icon v-else-if="type === 'bt'" color="info" x-small class="mr-1" v-on="on"> mdi-table-arrow-left </v-icon>
        <v-icon v-else-if="type === 'mm'" color="pink" x-small class="mr-1" v-on="on"> mdi-table-network </v-icon>
        <v-icon v-else-if="type === 'formula'" x-small class="mr-1" v-on="on"> mdi-math-integral </v-icon>
        <template v-else-if="type === 'lk'">
          <v-icon v-if="relationType === 'hm'" color="warning" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
          <v-icon v-else-if="relationType === 'bt'" color="info" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
          <v-icon v-else-if="relationType === 'mm'" color="pink" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
        </template>
        <template v-else-if="type === 'rl'">
          <v-icon v-if="relationType === 'hm'" color="warning" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
          <v-icon v-else-if="relationType === 'bt'" color="info" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
          <v-icon v-else-if="relationType === 'mm'" color="pink" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
        </template>

        <span class="name" style="white-space: nowrap" :title="column.title" v-on="on" v-html="alias" />
        <span v-if="column.rqd || required" class="error--text text--lighten-1" v-on="on">&nbsp;*</span>
      </template>
      <span class="caption" v-html="tooltipMsg" />
    </v-tooltip>
    <v-spacer />

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
            <!--Edit-->
            {{ $t('general.edit') }}
          </span>
        </v-list-item>
        <v-list-item @click="columnDeleteDialog = true">
          <x-icon small class="mr-1 nc-column-delete" color="error"> mdi-delete-outline </x-icon>
          <span class="caption">
            <!--Delete-->
            {{ $t('general.delete') }}
          </span>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-dialog v-model="columnDeleteDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="grey darken-2 subheading white--text"> Confirm </v-card-title>
        <v-divider />
        <v-card-text class="mt-4 title">
          Do you want to delete <span class="font-weight-bold">'{{ column.title }}'</span> column ?
        </v-card-text>
        <v-divider />
        <v-card-actions class="d-flex pa-4">
          <v-spacer />
          <v-btn small @click="columnDeleteDialog = false">
            <!-- Cancel -->
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
    </v-menu>
  </div>
</template>
<script>
import { UITypes } from 'nocodb-sdk';
import { getUIDTIcon } from '../helpers/uiTypes';
import EditVirtualColumn from '~/components/project/spreadsheet/components/EditVirtualColumn';

export default {
  name: 'VirtualHeaderCell',
  components: { EditVirtualColumn },
  props: ['column', 'nodes', 'meta', 'isForm', 'isPublicView', 'sqlUi', 'required', 'isLocked', 'isVirtual'],
  data: () => ({
    columnDeleteDialog: false,
    editColumnMenu: false,
    rollupIcon: getUIDTIcon('Rollup'),
    rels: ['bt', 'hm', 'mm'],
  }),
  computed: {
    alias() {
      // return this.column.lk ? `${this.column.lk._lcn} <small class="grey--text text--darken-1">(from ${this.column.lk._ltn})</small>` : this.column.title
      return this.column.title;
    },
    type() {
      if (this.column?.colOptions?.type) {
        return this.column.colOptions.type;
      }
      if (this.column?.colOptions?.formula) {
        return 'formula';
      }
      if (this.column.uidt === UITypes.Lookup) {
        return 'lk';
      }
      if (this.column.uidt === UITypes.Rollup) {
        return 'rl';
      }
      return '';
    },
    relation() {
      if (this.rels.includes(this.type)) {
        return this.column;
      } else if (this.column.colOptions?.fk_relation_column_id) {
        return this.meta.columns.find(c => c.id === this.column.colOptions?.fk_relation_column_id);
      }
      return undefined;
    },
    relationType() {
      return this.relation?.colOptions?.type;
    },
    relationMeta() {
      if (this.rels.includes(this.type)) {
        return this.getMeta(this.column.colOptions.fk_related_model_id);
      } else if (this.relation) {
        return this.getMeta(this.relation.colOptions.fk_related_model_id);
      }
      return undefined;
    },
    childColumn() {
      if (this.relationMeta?.columns) {
        if (this.type === 'rl') {
          const ch = this.relationMeta.columns.find(c => c.id === this.column.colOptions.fk_rollup_column_id);
          return ch;
        }
        if (this.type === 'lk') {
          const ch = this.relationMeta.columns.find(c => c.id === this.column.colOptions.fk_lookup_column_id);
          return ch;
        }
      }
      return '';
    },
    childTable() {
      if (this.relationMeta?.title) {
        return this.relationMeta.title;
      }
      return '';
    },
    parentTable() {
      if (this.rels.includes(this.type)) {
        return this.meta.title;
      }
      return '';
    },
    parentColumn() {
      if (this.rels.includes(this.type)) {
        return this.column.title;
      }
      return '';
    },
    tooltipMsg() {
      if (!this.column) {
        return '';
      }
      if (this.type === 'hm') {
        return `'${this.parentTable}' has many '${this.childTable}'`;
      } else if (this.type === 'mm') {
        return `'${this.childTable}' & '${this.parentTable}' have <br>many to many relation`;
      } else if (this.type === 'bt') {
        return `'${this.column.title}' belongs to '${this.childTable}'`;
      } else if (this.type === 'lk') {
        return `'${this.childColumn.title}' from '${this.childTable}' (${this.childColumn.uidt})`;
      } else if (this.type === 'formula') {
        return `Formula - ${this.column.colOptions.formula}`;
      } else if (this.type === 'rl') {
        return `'${this.childColumn.title}' of '${this.childTable}' (${this.childColumn.uidt})`;
      }
      return '';
    },
  },
  methods: {
    getMeta(id) {
      return this.$store.state.meta.metas[id] || {};
    },
    async deleteColumn() {
      try {
        await this.$api.dbTableColumn.delete(this.column.id);

        if (this.column.uidt === UITypes.LinkToAnotherRecord && this.column.colOptions) {
          this.$store
            .dispatch('meta/ActLoadMeta', { force: true, id: this.column.colOptions.fk_related_model_id })
            .then(() => {});
        }

        this.$emit('saved');
        this.columnDeleteDialog = false;
      } catch (e) {
        this.$toast.error(await this._extractSdkResponseErrorMsg(e)).goAway(3000);
      }
    },
  },
};
</script>

<style scoped>
.name {
  max-width: calc(100% - 40px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Mert Ersoy <mertmit99@gmail.com>
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
