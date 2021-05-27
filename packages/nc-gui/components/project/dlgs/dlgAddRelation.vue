<template>
  <v-row justify="center">
    <v-dialog
      persistent
      @keydown.esc="mtdDialogCancel()"
      @keydown.enter="mtdDialogSubmit(relation)"
      v-model="dialogShow"
      max-width="600"
    >
      <template v-slot:activator="{ on }">
        <p class="hidden" v-on="on"></p>
      </template>
      <v-card class="elevation-20">
        <v-card-title class="grey darken-2 subheading" style="height:30px">
          <!-- {{ this.heading }} for {{ this.column.cn }} -->
        </v-card-title>
        <v-form v-model="valid">
          <v-card-text class="pt-4 pl-4">
            <p class="headline">
              {{ this.heading }} for {{ this.column.cn }}
            </p>
            <v-row justify="space-between"
            >
              <v-col class="pa-1" cols="6">
                <v-autocomplete

                  :loading="isRefTablesLoading"
                  label="Select Reference Table"
                  :full-width="false"
                  v-model="relation.parentTable"
                  :items="refTables"
                  item-text="tn"
                  required
                  dense
                ></v-autocomplete>
              </v-col
              >
              <v-col class="pa-1" cols="6">
                <v-autocomplete
                  :loading="isRefColumnsLoading"
                  label="Select Reference Column"
                  :full-width="false"
                  v-model="relation.parentColumn"
                  :items="refColumns"
                  item-text="cn"
                  required
                  dense
                  ref="parentColumnRef"
                ></v-autocomplete>
              </v-col
              >
            </v-row>

            <v-row justify="space-between"
            >
              <v-col class="pa-1" cols="6">
                <v-autocomplete
                  label="On Update"
                  :full-width="false"
                  v-model="relation.onUpdate"
                  :items="onUpdateDeleteOptions"
                  required
                  dense
                  :disabled="relation.type !== 'real'"
                ></v-autocomplete>
              </v-col>
              <v-col class="pa-1" cols="6">
                <v-autocomplete
                  label="On Delete"
                  :full-width="false"
                  v-model="relation.onDelete"
                  :items="onUpdateDeleteOptions"
                  required
                  dense
                  :disabled="relation.type !== 'real'"
                ></v-autocomplete>
              </v-col>
            </v-row>


            <v-row>

              <v-col class="pa-1">
                <v-checkbox
                  false-value="real"
                  true-value="virtual"
                  label="Virtual Relation"
                  :full-width="false"
                  v-model="relation.type"
                  required
                  class="mt-0"
                  dense
                ></v-checkbox>
              </v-col>
            </v-row>
          </v-card-text>
          <v-divider></v-divider>

          <v-card-actions class="pa-4">
            <v-spacer></v-spacer>
            <v-btn class="" @click="mtdDialogCancel()">
              Cancel
            </v-btn>
            <v-btn
              class="primary "
              @click="mtdDialogSubmit(relation)"
              :disabled="!valid"
            ><u class="shortkey">S</u>ubmit
            </v-btn
            >
          </v-card-actions>
        </v-form
        >
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import {mapGetters, mapActions} from "vuex";

export default {
  data() {
    return {
      valid: false,
      onUpdateDeleteOptions: [
        "NO ACTION",
        "CASCADE",
        "RESTRICT",
        "SET NULL",
        "SET DEFAULT"
      ],
      relation: {
        childColumn: this.column.cn,
        childTable: this.nodes.tn,
        parentTable: this.column.rtn || "",
        parentColumn: this.column.rcn || "",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        updateRelation: this.column.rtn ? true : false,
        type: 'real'
      },
      isRefTablesLoading: false,
      isRefColumnsLoading: false,
      refColumns: [],
      refTables: [],
      relationColumnChanged: false
    };
  },
  methods: {
    async loadColumnList() {
      if (!this.relation.parentTable) return;
      this.isRefColumnsLoading = true;
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.columnList({
      //   tn: this.relation.parentTable
      // });


      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'columnList', {   tn: this.relation.parentTable})


      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', {tn: this.relation.parentTable}])


      const columns = result.data.list;
      this.refColumns = JSON.parse(JSON.stringify(columns));

      if (this.relation.updateRelation && !this.relationColumnChanged) {
        //only first time when editing add defaault value to this field
        this.relation.parentColumn = this.column.rcn;
        this.relationColumnChanged = true;
      } else {
        //find pk column and assign to parentColumn
        const pkKeyColumns = this.refColumns.filter(el => el.pk);
        this.relation.parentColumn = (pkKeyColumns[0] || {}).cn || "";
      }

      this.isRefColumnsLoading = false;
    },
    async loadTablesList() {
      this.isRefTablesLoading = true;
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.tableList();


      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'tableList');


      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableList']);


      const tables = result.data.list;

      this.refTables = JSON.parse(JSON.stringify(tables));
      this.isRefTablesLoading = false;
    }
  },
  computed: {...mapGetters({sqlMgr: "sqlMgr/sqlMgr"})},

  beforeCreated() {
  },
  async created() {
    await this.loadTablesList();

    if (!this.relation.parentTable) {
      let tn = (this.refTables[0] || {}).tn || "";
      if (tn === "nc_evolutions" || tn === "_evolutions") {
        tn = (this.refTables[1] || {}).tn || "";
      }
      this.relation.parentTable = tn;
    }
    if (this.column.rtn) {
      this.relation.parentTable = this.column.rtn;
    }
  },
  mounted() {
  },
  beforeDestroy() {
  },
  destroy() {
  },
  validate({params}) {
    return true;
  },
  head() {
    return {};
  },
  props: [
    "nodes",
    "column",
    "heading",
    "dialogShow",
    "mtdDialogCancel",
    "mtdDialogSubmit"
  ],
  watch: {
    "relation.parentTable": function () {
      this.loadColumnList();
    }
  },
  directives: {},
  components: {}
};
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
