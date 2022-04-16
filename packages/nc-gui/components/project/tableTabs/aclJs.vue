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
          v-ge="['acl','reload']"
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
          v-ge="['acl','open-folder']"
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
          v-ge="['acl','save']"
          outlined
          :tooltip="$t('tooltip.saveChanges')"
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
        :placeholder="`Search ${nodes.table_name} routes`"
        prepend-inner-icon="search"
        outlined
      />

      <v-simple-table v-if="data1" dense>
        <thead>
          <tr>
            <th colspan="2" class="text-center" rowspan="3">
              <div class="d-flex justify-center">
                <v-tooltip bottom>
                  <template #activator="{ on }">
                    <v-checkbox
                      v-model="allToggle"
                      v-ge="['acl','toggle-checkbox']"
                      class="mt-1 flex-shrink-1"
                      dense
                      v-on="on"
                    />
                  </template>
                  <span>{{ allToggle ? 'Disable' : 'Enable' }} all {{ nodes.table_name }} routes for all roles</span>
                </v-tooltip>
                <span class="title">{{ nodes.table_name }} Routes</span>
              </div>
            </th>
            <th
              v-for="role in roles"
              :key="role"
              :colspan="methods.length"
              style="border-left: 1px solid grey;border-bottom: 1px solid grey"
            >
              <div class="d-flex align-center justify-center">
                <span>{{ role }}</span>
              </div>
            </th>
          </tr>
          <tr>
            <!--          <th colspan="2"></th>-->
            <template v-for="role in roles">
              <template v-for="(method,i) in methods">
                <th
                  :key="`${method}_${role}`"
                  width="25"
                  class="caption px-1"
                  :style="i ? '' : 'border-left: 1px solid grey'"
                >
                  {{ method }}
                </th>
              </template>
            </template>
          </tr>
          <tr>
            <template v-for="role in roles">
              <template v-for="(method,i) in methods">
                <th
                  :key="`${method}_${role}`"
                  width="25"
                  class="caption px-1"
                  :style="i ? '' : 'border-left: 1px solid grey'"
                >
                  <v-tooltip bottom>
                    <template #activator="{ on }">
                      <v-checkbox
                        v-model="columnToggle[`${method}_${role}`]"
                        v-ge="['acl','toggle-checkbox']"
                        class="mt-0"
                        dense
                        v-on="on"
                        @change="toggleColumn(role,method,columnToggle[`${method}_${role}`])"
                      />
                    </template>

                    <span>{{ columnToggle[`${method}_${role}`] ? 'Disable' : 'Enable' }} all {{ method }} routes for {{ role }}</span>
                  </v-tooltip>
                </th>
              </template>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(route,path) in data1" v-show="!search || path.toLowerCase().indexOf(search.toLowerCase()) > -1" :key="path">
            <td width="20" class="px-0">
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-checkbox
                    v-model="rowToggle[path]"
                    v-ge="['acl','toggle-checkbox']"
                    class="mt-0 ml-3"
                    dense
                    v-on="on"
                    @change="toggleRow(path,rowToggle[path])"
                  />
                </template>

                <span>{{ rowToggle[path] ? 'Disable' : 'Enable' }} this route for all roles</span>
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
            <template v-for="role in roles">
              <template v-for="(method,i) in methods">
                <td :key="`${path}_${method}_${role}`" :style="i ? '' : 'border-left: 1px solid grey'" class="pa-1">
                  <v-checkbox
                    v-if="data1[path][method]"
                    v-model="data1[path][method][role]"
                    v-ge="['acl','toggle-checkbox']"
                    class="mt-0"
                    dense
                    :color="methodColor[method]"
                    :input-value="data1[path][method][role]"
                    @change="toggleCell(path,method,role,data1[path][method][role])"
                  />
                  <span
                    v-else
                    @dblclick="$set(data1[path],method , {})"
                  >
                    <v-checkbox
                      v-ge="['acl','toggle-checkbox']"
                      class="mt-0"
                      dense
                      :disabled="true"
                    /></span>
                </td>
              </template>
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

// const {fs, importFresh,shell,path} = require("electron").remote.require('./libs');

export default {
  name: 'AclJs',

  props: ['nodes'],
  data() {
    return {
      disableSaveButton: true,
      search: '',
      policyPath: '',
      columnToggle: {},
      rowToggle: {},
      // allToggle: false,
      methodColor: {
        get: 'green',
        post: 'orange',
        put: 'deep-orange',
        patch: 'pink lighten-1',
        delete: 'red darken-3'
      },
      roles: [
        'creator',
        'editor',
        'guest'
      ],
      methods: [
        'get', 'post', 'put', 'patch', 'delete'
      ],
      data1: null
    }
  },
  methods: {

    openFolder() {
      // shell.openItem(path.dirname(this.policyPath))
    },
    toggleColumn(role, method, checked) {
      for (const [path, methods] of Object.entries(this.data1)) {
        if (methods[method]) {
          this.$set(methods[method], role, checked)
          this.toggleCell(path, method, role, checked)
        }
      }
    },
    toggleRow(path, checked) {
      for (const [method, roles] of Object.entries(this.data1[path])) {
        for (const role in roles) {
          this.$set(roles, role, checked)
          this.toggleCell(path, method, role, checked)
        }
      }
    },
    toggleAll(checked) {
      this.disableSaveButton = false
      for (const path in this.data1) {
        this.rowToggle[path] = checked
      }
      for (const role of this.roles) {
        for (const method of this.methods) {
          this.columnToggle[`${method}_${role}`] = checked
        }
      }

      for (const methods of Object.values(this.data1)) {
        for (const method of Object.values(methods)) {
          for (const role of this.roles) {
            this.$set(method, role, checked)
          }
        }
      }
    },
    toggleCell(path, method, role, checked) {
      this.disableSaveButton = false
      this.$set(this.columnToggle, `${method}_${role}`, Object.values(this.data1).some(methods => methods[method] && methods[method][role]))
      this.$set(this.rowToggle, path, Object.values(this.data1[path]).some(roles => Object.values(roles).some(v => v)))
    },
    initColumnCheckBox() {
      for (const role of this.roles) {
        for (const method of this.methods) {
          this.columnToggle[`${method}_${role}`] = Object.values(this.data1).some(methods => methods[method] && methods[method][role])
        }
      }
    },
    initRowCheckBox() {
      for (const path in this.data1) {
        this.rowToggle[path] = Object.values(this.data1[path]).filter(roles => Object.entries(roles).filter(([role, v]) => {
          if (!this.roles.includes(role)) { this.roles = [...this.roles, role] }
          return v
        }).length).length
      }
    },
    async aclInit() {
      this.disableSaveButton = true
      this.policyPath = await this.sqlMgr.projectGetPolicyPath({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias,
        table_name: this.nodes.table_name
      })
      try {
        // this.data1 = JSON.parse(JSON.stringify((await this.sqlMgr.importFresh({path: this.policyPath})).permissions));
        this.data1 = JSON.parse(JSON.stringify((await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'importFresh', { path: this.policyPath }])).permissions))
        this.initColumnCheckBox()
        this.initRowCheckBox()
      } catch (e) {
        console.log(e)
      }
    },
    async save() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'writeFile', {
          path: this.policyPath,
          data: `module.exports.permissions = ${JSON.stringify(this.data1, 0, 2)}`
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
        return this.data1 && Object.values(this.data1).some(methods => Object.values(methods).some(roles => Object.values(roles).some(v => v)))
      },
      set(checked) {
        this.toggleAll(checked)
      }
    }
  },
  watch: {},
  async created() {
    this.aclInit()
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
