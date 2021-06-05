<template>
  <div class="d-flex align-center">


    <v-icon v-if="column.pk" color="warning" x-small class="mr-1">mdi-key-variant</v-icon>
    <v-icon v-else-if="uiDatatypeIcon" small class="mr-1">{{ uiDatatypeIcon }}</v-icon>

    <v-icon color="purple" small class="mr-1" v-else-if="isForeignKey">mdi-link-variant</v-icon>

    <span v-else-if="isInt" class="font-weight-bold mr-1" style="font-size: 15px">#</span>
    <!--    <v-icon color="grey" class="mr-1" v-if="isInt">mdi-numeric</v-icon>-->
    <v-icon color="grey" class="mr-1 mt-n1" v-else-if="isFloat">mdi-decimal</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isDate">mdi-calendar</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isDateTime">mdi-calendar-clock</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isSet">mdi-checkbox-multiple-marked</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isEnum">mdi-radiobox-marked</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isBoolean">mdi-check-box-outline</v-icon>
    <v-icon color="grey" class="" v-else-if="isString">mdi-alpha-a</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isTextArea">mdi-card-text-outline</v-icon>

    {{ value }}

    <v-spacer>
    </v-spacer>

    <v-menu offset-y open-on-hover left
            v-if="!isPublicView && _isUIAllowed('edit-column')  && !isForm">
      <template v-slot:activator="{on}">
        <v-icon v-on="on" small v-if="!isVirtual">mdi-menu-down</v-icon>
      </template>
      <v-list dense>
        <v-list-item dense @click="editColumnMenu = true">
          <x-icon small class="mr-1" color="primary">mdi-pencil</x-icon>
          <span class="caption">Edit</span>
        </v-list-item>
        <v-list-item dense @click="setAsPrimaryValue">
          <x-icon small class="mr-1" color="primary">mdi-key-star</x-icon>
          <v-tooltip bottom>
            <template v-slot:activator="{on}">
              <span class="caption" v-on="on">Set as Primary value</span>
            </template>
            <span class="caption font-weight-bold">Primary value will be shown in place of primary key</span>
          </v-tooltip>
        </v-list-item>
        <v-list-item @click="columnDeleteDialog = true">
          <x-icon small class="mr-1" color="error">mdi-delete-outline</x-icon>
          <span class="caption">Delete</span>
        </v-list-item>
      </v-list>
    </v-menu>


    <v-menu offset-y v-model="editColumnMenu" content-class="elevation-0" left>
      <template v-slot:activator="{on}">
        <span v-on="on"></span>
      </template>
      <edit-column
        @onRelationDelete="$emit('onRelationDelete')"
        v-if="editColumnMenu"
        :meta="meta"
        :sql-ui="sqlUi"
        :nodes="nodes"
        :edit-column="true"
        :column="column"
        :column-index="columnIndex"
        @saved="$emit('saved')"
        @close="editColumnMenu = false"
      ></edit-column>
    </v-menu>


    <v-dialog v-model="columnDeleteDialog" max-width="500"
              persistent>
      <v-card>
        <v-card-title class="grey darken-2 subheading white--text">Confirm</v-card-title>
        <v-divider></v-divider>
        <v-card-text class="mt-4 title">Do you want to delete <span class="font-weight-bold">'{{
            column.cn
          }}'</span> column ?
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions class="d-flex pa-4">
          <v-spacer></v-spacer>
          <v-btn small @click="columnDeleteDialog = false">Cancel</v-btn>
          <v-btn small color="error" @click="deleteColumn">Confirm</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script>
import cell from "@/components/project/spreadsheet/mixins/cell";
import EditColumn from "@/components/project/spreadsheet/editColumn/editColumn";

export default {
  components: {EditColumn},
  props: ['value', 'column', 'isForeignKey', 'meta', 'nodes', 'columnIndex', 'isForm', 'isPublicView', 'isVirtual'],
  name: "headerCell",
  mixins: [cell],
  data: () => ({
    editColumnMenu: false,
    columnDeleteDialog: false
  }),
  methods: {
    async deleteColumn() {
      try {
        const column = {...this.column, cno: this.column.cn};
        column.altered = 4;
        const columns = this.meta.columns.slice()
        columns[this.columnIndex] = column;
        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, "tableUpdate", {
          tn: this.nodes.tn,
          originalColumns: this.meta.columns,
          columns
        }]);
        this.$emit('saved');
        this.columnDeleteDialog = false;
      } catch (e) {
        console.log(e)
      }
    }, async setAsPrimaryValue() {
      try {
        const meta = JSON.parse(JSON.stringify(this.meta));
        for (const col of meta.columns) {
          if (col.pv) {
            delete col.pv;
          }
          if (col.cn === this.column.cn) {
            col.pv = true;
          }
        }


        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }]);
        this.$toast.success('Successfully updated as primary column').goAway(3000);
      } catch (e) {
        console.log(e)
        this.$toast.error('Failed to update primary column').goAway(3000);
      }
      this.$emit('saved');
      this.columnDeleteDialog = false;

    }
  }
}
</script>

<style scoped>

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
