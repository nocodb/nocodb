<!-- eslint-disable -->
<template>
  <div>
    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <v-toolbar-title>
        <v-breadcrumbs
          :items="[{
                     text: nodes.env,
                     disabled: true,
                     href: '#'
                   },
                   {
                     text: 'Global ACL',
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
      <x-btn
        v-ge="['acl','reload']"
        outlined
        tooltip="Reload ACL"
        color="primary"
        small
        @click="loadAcls"
      >
        <v-icon small left>
          refresh
        </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>

      <x-btn
        v-ge="['acl','save']"
        outlined
        :tooltip="$t('tooltip.saveChanges')"
        color="primary"
        class="primary"
        small
        :disabled="disableSaveButton"
      >
        <v-icon small left>
          save
        </v-icon>
        <!-- Save -->
        {{ $t('general.save') }}
      </x-btn>
    </v-toolbar>

    <v-text-field
      v-model="search"
      dense
      hide-details
      class="ma-2"
      :placeholder="`Search routes`"
      prepend-inner-icon="search"
      outlined
    />

    <v-simple-table v-if="true" v-slot dense>
      <thead>
        <tr>
          <th>Table</th>
          <th v-for="role in roles" :colspan="methods.length">
            {{ role }}
          </th>
          <th width="25" />
        </tr>
        <tr>
          <th />
          <template v-for="role in roles">
            <template v-for="method in methods">
              <th :key="`${role}-${method}`" width="25">
                {{ method }}
              </th>
            </template>
          </template>

          <th />
        </tr>
        <tr>
          <th />
          <template v-for="role in roles">
            <template v-for="method in methods">
              <th :key="`${role}-${method}`" width="25">
                <v-checkbox
                  dense
                  hide-details
                />
              </th>
            </template>
          </template>

          <th width="25" />
        </tr>
      </thead>
      <tbody>
        <template v-for="(acl,table) in groupedData">
          <tr :key="table + 'row'">
            <td class="font-weight-bold">
              {{ table }}
            </td>
            <template v-for="role in roles">
              <template v-for="method in methods">
                <td :key="`${role}-${method}`" width="25">
                  <v-checkbox
                    dense
                    hide-details
                  />
                </td>
              </template>
            </template>
            <td width="25">
              <v-icon v-if="expandedRow !== table" small @click="expandedRow=table">
                mdi-chevron-down
              </v-icon>
              <v-icon v-else small @click="expandedRow=null">
                mdi-chevron-up
              </v-icon>
            </td>
          </tr>
          <template v-for="(item,i) in groupedData[table]" v-if="expandedRow === table">
            <tr v-if="item.path" :key="`${table}-row-${i}`">
              <td class="caption">
                {{ item.path }}
              </td>
              <template v-for="role in roles">
                <template v-for="method in methods">
                  <td :key="`${role}-${method}`" width="25">
                    <v-checkbox
                      dense
                      hide-details
                    />
                  </td>
                </template>
              </template>
              <td width="25" />
            </tr>
          </template>
        </template>
      </tbody>
    </v-simple-table>

    <v-simple-table v-slot dense>
      <thead>
        <tr>
          <th>Table</th>
          <th v-for="role in roles" :colspan="methods.length">
            {{ role }}
          </th>
          <th width="25" />
        </tr>
        <tr>
          <th />
          <template v-for="role in roles">
            <template v-for="method in methods">
              <th :key="`${role}-${method}`" width="25">
                {{ method }}
              </th>
            </template>
          </template>

          <th />
        </tr>
        <tr>
          <th />
          <template v-for="role in roles">
            <template v-for="method in methods">
              <th :key="`${role}-${method}`" width="25">
                <v-checkbox
                  dense
                  hide-details
                />
              </th>
            </template>
          </template>

          <th width="25" />
        </tr>
      </thead>
      <tbody>
        <template v-for="(acl,table) in groupedData">
          <tr :key="table + 'row'">
            <td>{{ table }}</td>
            <template v-for="role in roles">
              <template v-for="method in methods">
                <td :key="`${role}-${method}`" width="25">
                  <v-checkbox
                    dense
                    hide-details
                  />
                </td>
              </template>
            </template>
            <td width="25">
              <v-icon v-if="expandedRow !== table" small @click="expandedRow=table">
                mdi-chevron-down
              </v-icon>
              <v-icon v-else small @click="expandedRow=null">
                mdi-chevron-up
              </v-icon>
            </td>
          </tr>
          <tr v-if="expandedRow === table" :key="table + 'exp'" class="expansion-row">
            <td :colspan="methods.length * roles.length + 2" class="pa-1">
              <acl-ts-file-db-child
                v-if="groupedData"
                key="acl"
                :search="search"
                :nodes="nodes"
                :policies="groupedData[table]"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </v-simple-table>
  </div>
</template>

<script>
/* eslint-disable */

import AclTsFileDbChild from '@/components/project/tableTabs/aclTsFileDbChild'

export default {
  name: 'GlobalAcl',
  components: { AclTsFileDbChild },
  props: ['nodes'],
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
    ]
  }),
  computed: {
    tables () {
      return this.groupedData ? Object.keys(this.groupedData) : []
    },
    acls () {
      return this.groupedData ? Object.values(this.groupedData) : []
    }
  },
  async created () {
    await this.loadAcls()
  },
  methods: {
    async loadAcls () {
      try {
        const data = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.$store.state.project.authDbAlias
        }, 'xcRoutesPolicyGet'])).data.list

        const groupedData = {}

        for (const item of data) {
          groupedData[item.table_name] = groupedData[item.table_name] || []
          groupedData[item.table_name].push(item)
        }

        this.groupedData = groupedData

        // for()

        this.data = data
      } catch (e) {
        this.$toast.error('Failed loading role list').goAway(3000)
      }

      this.edited = false
    }

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
