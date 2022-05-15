<!-- eslint-disable -->
<template>
  <div>
    <v-card style="">
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
                       text: nodes.table_name + ' (ACL)',
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
          v-ge="['acl-gql','reload']"
          outlined
          tooltip="Reload ACL"
          color="primary"
          small
          @click="aclInit"
        >
          <v-icon small left>
            refresh
          </v-icon>
          <!-- Reload -->
          {{ $t('general.reload') }}
        </x-btn>
        <x-btn
          v-ge="['acl-gql','open-folder']"
          tooltip="Open ACL Folder"
          icon="mdi-folder-open"
          outlined
          small
          color="primary"
          @click="openFolder"
        >
          Open Folder
        </x-btn>
        <x-btn
          v-ge="['acl-gql','save']"
          outlined
          tooltip="Save ACL"
          color="primary"
          class="primary"
          small
          :disabled="disableSaveButton"
          @click="save"
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
        :placeholder="`Search ${nodes.table_name} resolvers`"
        prepend-inner-icon="search"
        outlined
      />

      <v-simple-table v-if="data1" dense>
        <thead>
          <tr>
            <th colspan="2" class="text-center" rowspan="2">
              <div class="d-flex justify-center">
                <v-tooltip bottom>
                  <template #activator="{ on }">
                    <v-checkbox
                      v-model="allToggle"
                      v-ge="['acl-gql','open-folder']"
                      small
                      class="mt-1 flex-shrink-1"
                      dense
                      v-on="on"
                    />
                  </template>
                  <span>{{ allToggle ? 'Disable' : 'Enable' }} all {{ nodes.table_name }} resolvers for all roles</span>
                </v-tooltip>
                <span class="title">{{ nodes.table_name }} Resolvers</span>
              </div>
            </th>
            <th
              v-for="role in roles"
              :key="role"
              style="border-left: 1px solid grey;border-bottom: 1px solid grey"
            >
              <div class="d-flex align-center justify-center">
                <span>{{ role }}</span>
              </div>
            </th>
          </tr>
          <tr>
            <th
              v-for="role in roles"
              :key="role"
              class="pa-1"
              style="border-left: 1px solid grey;border-bottom: 1px solid grey"
            >
              <div class="d-flex justify-center">
                <v-tooltip bottom>
                  <template #activator="{ on }">
                    <v-checkbox
                      v-model="columnToggle[role]"
                      v-ge="['acl-gql','open-folder']"
                      small
                      class="mt-0"
                      dense
                      v-on="on"
                      @change="toggleColumn(role,columnToggle[role])"
                    />
                  </template>
                  <span>
                    <span>{{ columnToggle[role] ? 'Disable' : 'Enable' }} all resolvers for {{ role }}</span></span>
                </v-tooltip>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(resolver,path) in data1" v-show="!search || path.toLowerCase().indexOf(search.toLowerCase()) > -1" :key="path">
            <td width="20" class="pl-6 pr-3">
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-checkbox
                    v-model="rowToggle[path]"
                    v-ge="['acl-gql','open-folder']"
                    small
                    class="mt-0 ml-3"
                    dense
                    v-on="on"
                    @change="toggleRow(path,rowToggle[path])"
                  />
                </template>

                <span>{{ rowToggle[path] ? 'Disable' : 'Enable' }} this resolver for all roles</span>
              </v-tooltip>
            </td>
            <td class="pl-0">
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <span v-on="on">{{ path }}</span>
                </template>
                <span>{{ path }}</span>
              </v-tooltip>
            </td>
            <template v-for="(role) in roles">
              <td :key="`${path}_${role}`" style="border-left: 1px solid grey" class="pa-1">
                <div class="d-flex justify-center">
                  <v-checkbox
                    v-model="data1[path][role]"
                    v-ge="['acl-gql','open-folder']"
                    small
                    class="mt-0"
                    dense
                    @change="toggleCell(path,role,data1[path][role])"
                  />
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </v-simple-table>

      <v-alert v-else outlined type="info">
        Permission file not found
      </v-alert>
    </v-card>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

// const {fs, importFresh, shell, path} = require("electron").remote.require('./libs');

export default {
  name: 'AclTsFileGql',

  props: ['nodes'],
  data() {
    return {
      disableSaveButton: true,
      search: '',
      policyPath: '',
      columnToggle: {},
      rowToggle: {},
      roles: [
        'creator',
        'editor',
        'guest'
      ],
      data1: null
    }
  },
  methods: {
    openFolder() {
      // shell.openItem(path.dirname(this.policyPath))
    },
    toggleColumn(role, checked) {
      for (const [resolver, roles] of Object.entries(this.data1)) {
        this.$set(roles, role, checked)
        this.toggleCell(resolver, role, checked)
      }
    },
    toggleRow(resolver, checked) {
      for (const role in this.data1[resolver]) {
        this.$set(this.data1[resolver], role, checked)
        this.toggleCell(resolver, role, checked)
      }
    },
    toggleAll(checked) {
      this.disableSaveButton = false
      for (const path in this.data1) {
        this.rowToggle[path] = checked
      }
      for (const role of this.roles) {
        this.columnToggle[role] = checked
      }

      for (const roles of Object.values(this.data1)) {
        for (const role of this.roles) {
          this.$set(roles, role, checked)
        }
      }
    },
    toggleCell(resolver, role, checked) {
      this.disableSaveButton = false
      this.$set(this.columnToggle, role, Object.values(this.data1).some(roles => roles[role]))
      this.$set(this.rowToggle, resolver, Object.values(this.data1[resolver]).some(enabled => enabled))
    },
    initColumnCheckBox() {
      for (const role of this.roles) {
        this.columnToggle[role] = Object.values(this.data1).some(roles => roles[role])
      }
    },
    initRowCheckBox() {
      for (const path in this.data1) {
        this.rowToggle[path] = Object.entries(this.data1[path]).filter(([role, v]) => {
          if (!this.roles.includes(role)) { this.roles = [...this.roles, role] }
          return v
        }).length
      }
    },
    async aclInit() {
      this.disableSaveButton = true
      // this.policyPath = await this.sqlMgr.projectGetGqlPolicyPath({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias,
      //   tn: this.nodes.table_name
      // });
      this.policyPath = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectGetGqlPolicyPath', {
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        table_name: this.nodes.table_name
      }])
      try {
        console.log(this.policyPath, this.data1)
        // this.data1 = JSON.parse(JSON.stringify(await this.sqlMgr.importFresh({path: this.policyPath})));
        this.data1 = JSON.parse(JSON.stringify(await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'importFresh', { path: this.policyPath }])))
        this.initColumnCheckBox()
        this.initRowCheckBox()
      } catch (e) {
        console.log(e)
      }
    },
    async save() {
      try {
        // this.sqlMgr.writeFile({path: this.policyPath, data: `module.exports = ${JSON.stringify(this.data1, 0, 2)}`})
        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'writeFile', {
          path: this.policyPath,
          data: `module.exports = ${JSON.stringify(this.data1, 0, 2)}`
        }])
        this.disableSaveButton = true
        this.$toast.success(`${this.policyPath} updated successfully`).goAway(3000)
      } catch (e) {
        console.log(e)
        this.$toast.error(`${this.policyPath} updating failed`).goAway(3000)
      }
    }
  },
  computed: {
    ...mapGetters({ sqlMgr: 'sqlMgr/sqlMgr' }),
    allToggle: {
      get() {
        return this.data1 && Object.values(this.data1).some(roles => Object.values(roles).some(v => v))
      },
      set(checked) {
        this.toggleAll(checked)
      }
    }
  },
  watch: {},
  async created() {
    await this.aclInit()
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
