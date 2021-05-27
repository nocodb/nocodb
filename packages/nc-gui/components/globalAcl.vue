<template>
  <div>


    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <v-toolbar-title>
        <v-breadcrumbs :items="[{
          text: this.nodes.env,
          disabled: true,
          href: '#'
        },
        {
          text: 'Global ACL',
          disabled: true,
          href: '#'
        }]" divider=">" small>
          <template v-slot:divider>
            <v-icon small color="grey lighten-2">forward</v-icon>
          </template>
        </v-breadcrumbs>

      </v-toolbar-title>
      <v-spacer></v-spacer>
      <x-btn outlined tooltip="Reload ACL"
             color="primary"
             small
             v-ge="['acl','reload']"
             @click="loadAcls"
      >
        <v-icon small left>refresh</v-icon>
        Reload
      </x-btn>

      <x-btn outlined tooltip="Save Changes"
             color="primary"
             class="primary"
             small
             :disabled="disableSaveButton"
             v-ge="['acl','save']">
        <v-icon small left>save</v-icon>
        Save
      </x-btn>

    </v-toolbar>

    <v-text-field dense hide-details class="ma-2" :placeholder="`Search routes`"
                  prepend-inner-icon="search" v-model="search"
                  outlined></v-text-field>


    <v-simple-table v-if="true" dense v-slot:default>
      <thead>
      <tr>
        <th>Table</th>
        <th v-for="role in roles" :colspan="methods.length">{{ role }}</th>
        <th width="25"></th>
      </tr>
      <tr>
        <th></th>
        <template v-for="role in roles">
          <template v-for="method in methods">
            <th width="25" :key="`${role}-${method}`">{{ method }}</th>
          </template>
        </template>

        <th></th>
      </tr>
      <tr>
        <th></th>
        <template v-for="role in roles">
          <template v-for="method in methods">
            <th width="25" :key="`${role}-${method}`">
              <v-checkbox
                dense
                hide-details

              ></v-checkbox>
            </th>
          </template>
        </template>

        <th width="25"></th>
      </tr>

      </thead>
      <tbody>
      <template v-for="(acl,table) in groupedData">
        <tr :key="table + 'row'">
          <td class="font-weight-bold">{{ table }}</td>
          <template v-for="role in roles">
            <template v-for="method in methods">
              <td width="25" :key="`${role}-${method}`">
                <v-checkbox
                  dense
                  hide-details
                ></v-checkbox>
              </td>
            </template>
          </template>
          <td width="25">
            <v-icon small @click="expandedRow=table" v-if="expandedRow !== table">mdi-chevron-down</v-icon>
            <v-icon small v-else @click="expandedRow=null">mdi-chevron-up</v-icon>
          </td>
        </tr>
        <template v-if="expandedRow === table" v-for="(item,i) in groupedData[table]">
          <tr :key="`${table}-row-${i}`" v-if="item.path">
            <td class="caption">{{ item.path }}</td>
            <template v-for="role in roles">
              <template v-for="method in methods">
                <td width="25" :key="`${role}-${method}`">
                  <v-checkbox
                    dense
                    hide-details
                  ></v-checkbox>
                </td>
              </template>
            </template>
            <td width="25"></td>
          </tr>
        </template>

      </template>
      </tbody>
    </v-simple-table>


    <v-simple-table  dense v-slot:default>
      <thead>
      <tr>
        <th>Table</th>
        <th v-for="role in roles" :colspan="methods.length">{{ role }}</th>
        <th width="25"></th>
      </tr>
      <tr>
        <th></th>
        <template v-for="role in roles">
          <template v-for="method in methods">
            <th width="25" :key="`${role}-${method}`">{{ method }}</th>
          </template>
        </template>

        <th></th>
      </tr>
      <tr>
        <th></th>
        <template v-for="role in roles">
          <template v-for="method in methods">
            <th width="25" :key="`${role}-${method}`">
              <v-checkbox
                dense
                hide-details

              ></v-checkbox>
            </th>
          </template>
        </template>

        <th width="25"></th>
      </tr>

      </thead>
      <tbody>
      <template v-for="(acl,table) in groupedData">
        <tr :key="table + 'row'">
          <td>{{ table }}</td>
          <template v-for="role in roles">
            <template v-for="method in methods">
              <td width="25" :key="`${role}-${method}`">
                <v-checkbox
                  dense
                  hide-details
                ></v-checkbox>
              </td>
            </template>
          </template>
          <td width="25">
            <v-icon small @click="expandedRow=table" v-if="expandedRow !== table">mdi-chevron-down</v-icon>
            <v-icon small v-else @click="expandedRow=null">mdi-chevron-up</v-icon>
          </td>
        </tr>
        <tr v-if="expandedRow === table" :key="table + 'exp'" class="expansion-row">
          <td :colspan="methods.length * roles.length + 2" class="pa-1">

            <acl-ts-file-db-child
              key="acl"
              :search="search"
              v-if="groupedData"
              :nodes="nodes" :policies="groupedData[table]"></acl-ts-file-db-child>

          </td>
        </tr>
      </template>
      </tbody>
    </v-simple-table>


    <!--    <v-data-table-->
    <!--      :headers="headers"-->
    <!--      :items="acls"-->
    <!--      item-key="name"-->
    <!--      show-expand-->
    <!--      class="elevation-1"-->
    <!--    >-->

    <!--      <template v-slot:expanded-item="{ headers, item }">-->
    <!--        <td :colspan="headers.length">More info about {{ item }}</td>-->
    <!--      </template>-->


    <!--      &lt;!&ndash;      <template v-slot:item="{ headers, item }">&ndash;&gt;-->
    <!--      &lt;!&ndash;      <tr>&ndash;&gt;-->
    <!--      &lt;!&ndash;        <td>test</td>&ndash;&gt;-->
    <!--      &lt;!&ndash;      </tr>&ndash;&gt;-->
    <!--      &lt;!&ndash;      </template>&ndash;&gt;-->

    <!--      &lt;!&ndash;      <template v-slot:header="{ headers, item }">&ndash;&gt;-->
    <!--      &lt;!&ndash;        <tr>&ndash;&gt;-->
    <!--      &lt;!&ndash;          <th>test</th>&ndash;&gt;-->
    <!--      &lt;!&ndash;        </tr>&ndash;&gt;-->
    <!--      &lt;!&ndash;      </template>&ndash;&gt;-->


    <!--    </v-data-table>-->


    <!--    <v-virtual-scroll-->
    <!--      :items="data"-->
    <!--      :item-height="50"-->
    <!--      height="100%"-->
    <!--    >-->
    <!--      <template v-slot="{ item }">-->
    <!--    <acl-ts-file-db-child-->
    <!--      v-if="data"-->
    <!--      :nodes="nodes" :policies="data"></acl-ts-file-db-child>-->
    <!--      </template>-->
    <!--    </v-virtual-scroll>-->


    <!--    <v-tabs-->
    <!--      v-model="aclTabs"-->
    <!--    >-->
    <!--      <template v-for="table in tables">-->
    <!--        <v-tab :key="table">{{ table }}</v-tab>-->
    <!--        &lt;!&ndash;        <v-tab-item :key="table">&ndash;&gt;-->
    <!--        &lt;!&ndash;              <acl-ts-file-db-child&ndash;&gt;-->
    <!--        &lt;!&ndash;                v-if="i === aclTabs"&ndash;&gt;-->
    <!--        &lt;!&ndash;                key="acl"&ndash;&gt;-->
    <!--        &lt;!&ndash;                :nodes="nodes" :policies="item"></acl-ts-file-db-child>&ndash;&gt;-->
    <!--        &lt;!&ndash;        </v-tab-item>&ndash;&gt;-->
    <!--      </template>-->

    <!--    </v-tabs>-->

    <!--    <acl-ts-file-db-child-->
    <!--      key="acl"-->
    <!--      v-if="groupedData"-->
    <!--      :nodes="nodes" :policies="acls[aclTabs]"></acl-ts-file-db-child>-->
  </div>
</template>

<script>

import AclTsFileChild from "@/components/project/tableTabs/aclTsFileChild";
import AclTsFileDbChild from "@/components/project/tableTabs/aclTsFileDbChild";

export default {
  components: {AclTsFileDbChild, AclTsFileChild},
  props: ['nodes'],
  name: "global-acl",
  data: () => ({
    loading: false,
    edited: false,
    data: null,
    groupedData: null,
    aclTabs: null,
    expandedRow: null,
    search: '',
    roles: [
      'creator',
      'editor',
      'guest'
    ],
    methods: [
      'get', 'post', 'put', 'delete'
    ],
  }),
  async created() {
    await this.loadAcls();
  },
  methods: {
    async loadAcls() {
      try {
        const data = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.$store.state.project.authDbAlias
        }, 'xcRoutesPolicyGet'])).data.list;

        const groupedData = {};

        for (const item of data) {
          groupedData[item.tn] = groupedData[item.tn] || [];
          groupedData[item.tn].push(item);
        }

        this.groupedData = groupedData;

        // for()

        this.data = data;

      } catch (e) {
        this.$toast.error('Failed loading role list').goAway(3000);
      }

      this.edited = false;
    },


  },
  computed: {
    tables() {
      return this.groupedData ? Object.keys(this.groupedData) : [];
    },
    acls() {
      return this.groupedData ? Object.values(this.groupedData) : [];
    },
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  table {
    .expansion-row {
      &, td {
        height: auto !important;
        background: transparent !important;
      }
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
