<template>
  <v-container>
    <h1>Relation List</h1>
    <v-btn
      color="primary"
      @click="loadRelationList"
    >
      <v-icon left>
        refresh
      </v-icon>
      <!-- Reload -->
      {{ $t('general.reload') }}
    </v-btn>
    <v-btn
      small
      class=" text-right"
      @click="deleteTable('showDialog')"
    >
      {{ $t('activity.deleteTable') }}
    </v-btn>
    <v-btn @click="throwError()">
      error
    </v-btn>
    <v-row>
      <v-col cols="6">
        <v-data-table
          :headers="relationHeaders"
          :items="relations"
          footer-props.items-per-page-options="30"
        >
          <template #item="props">
            <td>{{ props.item.cstn }}</td>
            <td>{{ props.item.rtn }}</td>
          </template>
        </v-data-table>
      </v-col>
      <v-col cols="6">
        <v-data-table
          :headers="columnHeaders"
          :items="columns"
          footer-props.items-per-page-options="30"
        >
          <template #items="props">
            <td>{{ props.item.column_name }}</td>
          </template>
        </v-data-table>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  data() {
    return {
      relations: [],
      columns: [],
      relationHeaders: [
        {
          text: 'Relation',
          sortable: false
        },
        {
          text: 'Referenced Table',
          sortable: false
        }
      ],
      columnHeaders: [
        {
          text: 'Column',
          sortable: false
        }
      ],
      max25chars: v => v.length <= 25 || 'Input too long!'
    }
  },
  methods: {
    throwError() {
      throw new Error('new erroror ')
    },
    async loadRelationList() {
      if (this.newTable) { return }

      // console.log("env: this.nodes.env", this.nodes.env, this.nodes.dbAlias);
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.relationList({
      //   table_name: this.nodes.table_name
      // });
      //

      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'relationList', {   table_name: this.nodes.table_name})

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'relationList', { table_name: this.nodes.table_name }])

      // console.log(result, "relations");
      this.relations = result.data.list
      // this.loadColumnList(result.data.list[0].rtn);
    },
    async loadColumnList(table_name = '') {
      // console.log("env: this.nodes.env", this.nodes.env, this.nodes.dbAlias);
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.columnList({
      //   table_name
      // });

      // const result = await this.sqlMgr.sqlOp({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'columnList', {
      //   table_name
      // });

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', {
        table_name
      }])

      this.columns = result.data.list
    }
  },
  computed: { ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }) },

  beforeCreated() {
  },
  watch: {},
  created() {
    this.loadRelationList()
  },
  mounted() {
  },
  beforeDestroy() {
  },
  destroy() {
  },
  directives: {},
  components: {},
  validate({ params }) {
    return true
  },
  head() {
    return {}
  },
  props: ['nodes', 'newTable', 'deleteTable']
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
