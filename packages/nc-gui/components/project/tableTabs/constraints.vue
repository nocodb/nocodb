<template>
  <div class="">
    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <v-toolbar-title>
        <v-breadcrumbs
          :items="[{
                     text: nodes.env,
                     disabled: true,
                     href: '#'
                   },{
                     text: nodes.dbAlias,
                     disabled: true,
                     href: '#'
                   },
                   {
                     text: nodes.table_name + ' (table)',
                     disabled: true,
                     href: '#'
                   }]"
          divider=">"
          small
        >
          <template #divider>
            <v-icon small color="grey lighten-2">
              forward
            </v-icon>
          </template>
        </v-breadcrumbs>
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        small
        color="primary"
        class="primary"
        @click="loadConstraintList"
      >
        <v-icon left>
          refresh
        </v-icon>
        Refresh
      </v-btn>
      <v-btn
        small
        color="error "
        class="error text-right"
        @click="deleteTable('showDialog')"
      >
        {{ $t('activity.deleteTable') }}
      </v-btn>
      <v-btn
        icon
        class="text-right"
      >
        <v-icon>mdi-help-circle-outline</v-icon>
      </v-btn>
    </v-toolbar>

    <v-data-table
      dense
      :headers="headers"
      :items="constraints"
      footer-props.items-per-page-options="30"
    >
      <template #item="props">
        <td>{{ props.item.cstn }}</td>
        <td>{{ props.item.cst }}</td>
        <td>{{ props.item.column_name }}</td>
        <td>{{ props.item.op }}</td>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  data() {
    return {
      constraints: [],
      headers: [
        {
          text: 'Constraint',
          sortable: false
        },
        { text: 'Constraint Type', sortable: false },
        { text: 'Column Name', sortable: false },
        { text: 'Constraint Ordinal Position', sortable: false }
      ]
    }
  },
  methods: {
    async loadConstraintList() {
      if (this.newTable) { return }
      // console.log("env: this.nodes.env", this.nodes.env, this.nodes.dbAlias);
      const client = await this.sqlMgr.projectGetSqlClient({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      })
      const result = await client.constraintList({
        tn: this.nodes.table_name
      })
      // console.log("cons", result.data.list);
      this.constraints = result.data.list
    }
  },
  computed: { ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }) },

  beforeCreated() {
  },
  watch: {},
  created() {
    this.loadConstraintList()
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
