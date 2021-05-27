<template>
  <div>
    <v-card style="">

      <v-toolbar flat height="42" class="toolbar-border-bottom">
        <v-toolbar-title>
          <v-breadcrumbs :items="[{
          text: this.nodes.env,
          disabled: true,
          href: '#'
        },{
          text: this.nodes.dbAlias,
          disabled: true,
          href: '#'
        },
        {
          text: this.nodes.tn + ' (ACL)',
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
               @click="aclInit"
        >
          <v-icon small left>refresh</v-icon>
          Reload
        </x-btn>
        <x-btn tooltip="Open ACL Folder"
               icon="mdi-folder-open"
               outlined
               small
               color="primary"
               v-ge="['acl','open-folder']"
               @click="openFolder">
          Open Folder
        </x-btn>
        <x-btn outlined tooltip="Save Changes"
               color="primary"
               class="primary"
               small
               @click="save"
               :disabled="disableSaveButton"
               v-ge="['acl','save']">
          <v-icon small left>save</v-icon>
          Save
        </x-btn>

      </v-toolbar>

      <v-text-field dense hide-details class="ma-2" :placeholder="`Search ${nodes.tn} routes`"
                    prepend-inner-icon="search" v-model="search"
                    outlined></v-text-field>

      <v-simple-table v-if="data1" dense>
        <thead>
        <tr>

          <th colspan="2" class="text-center" rowspan="3">

            <div class="d-flex justify-center">
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-checkbox
                    v-ge="['acl','toggle-checkbox']" v-on="on" class="mt-1 flex-shrink-1" dense
                    v-model="allToggle"></v-checkbox>
                </template>
                <span>{{allToggle ? 'Disable' : 'Enable'}} all {{nodes.tn}} routes for all roles</span>
              </v-tooltip>
              <span class="title">{{nodes.tn}} Routes</span>
            </div>

          </th>
          <th v-for="role in roles" :colspan="methods.length"
              style="border-left: 1px solid grey;border-bottom: 1px solid grey">
            <div class="d-flex align-center justify-center">
              <span>{{role}}</span>
            </div>
          </th>

        </tr>
        <tr>
          <!--          <th colspan="2"></th>-->
          <template v-for="role in roles">
            <template v-for="(method,i) in methods">
              <th width="25" class="caption px-1" :key="`${method}_${role}`"
                  :style="i ? '' : 'border-left: 1px solid grey'">{{method}}
              </th>
            </template>
          </template>
        </tr>
        <tr>
          <template v-for="role in roles">
            <template v-for="(method,i) in methods">
              <th width="25" class="caption px-1" :key="`${method}_${role}`"
                  :style="i ? '' : 'border-left: 1px solid grey'">

                <v-tooltip bottom>
                  <template v-slot:activator="{ on }">
                    <v-checkbox
                      v-ge="['acl','toggle-checkbox']" v-on="on" class="mt-0" dense
                      v-model="columnToggle[`${method}_${role}`]"
                      @change="toggleColumn(role,method,columnToggle[`${method}_${role}`])"></v-checkbox>
                  </template>

                  <span>{{columnToggle[`${method}_${role}`] ? 'Disable' : 'Enable'}} all {{method}} routes for {{role}}</span>
                </v-tooltip>
              </th>
            </template>
          </template>
        </tr>
        </thead>
        <tbody>
        <tr v-for="(route,path) in data1" v-show="!search || path.toLowerCase().indexOf(search.toLowerCase()) > -1">
          <td width="20" class="px-0">

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-checkbox
                  v-ge="['acl','toggle-checkbox']" v-on="on" class="mt-0 ml-3" v-model="rowToggle[path]"
                  @change="toggleRow(path,rowToggle[path])"
                  dense></v-checkbox>
              </template>

              <span>{{rowToggle[path] ? 'Disable' : 'Enable'}} this route for all roles</span>
            </v-tooltip>
          </td>
          <td class="pl-0">

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <span v-on="on">{{path}}</span>
              </template>
              <span>{{path}}</span>
            </v-tooltip>
          </td>
          <template v-for="role in roles">
            <template v-for="(method,i) in methods">
              <td :style="i ? '' : 'border-left: 1px solid grey'" class="pa-1" :key="`${path}_${method}_${role}`">

                <v-checkbox
                  v-ge="['acl','toggle-checkbox']"
                  v-if="data1[path][method]" class="mt-0" dense
                  :color="methodColor[method]"
                  :input-value="data1[path][method][role]"
                  v-model="data1[path][method][role]"
                  @change="toggleCell(path,method,role,data1[path][method][role])"
                ></v-checkbox>
                <span
                  v-else
                  @dblclick="$set(data1[path],method , {})">
                <v-checkbox v-ge="['acl','toggle-checkbox']" class="mt-0" dense
                            :disabled="true">
                </v-checkbox></span>
              </td>
            </template>
          </template>

        </tr>
        </tbody>
      </v-simple-table>

      <v-alert v-else outlined type="info">Permission file not found</v-alert>

    </v-card>
  </div>
</template>

<script>
  import {mapGetters} from "vuex";


  // const {fs, importFresh,shell,path} = require("electron").remote.require('./libs');

  export default {
    name: "acl-js",

    props: ["nodes"],
    methods: {

      openFolder() {
        shell.openItem(path.dirname(this.policyPath));
      },
      toggleColumn(role, method, checked) {
        for (let [path, methods] of Object.entries(this.data1)) {
          if (methods[method]) {
            this.$set(methods[method], role, checked)
            this.toggleCell(path, method, role, checked)
          }
        }
      },
      toggleRow(path, checked) {
        for (let [method, roles] of Object.entries(this.data1[path])) {
          for (let role in roles) {
            this.$set(roles, role, checked)
            this.toggleCell(path, method, role, checked)
          }
        }
      },
      toggleAll(checked) {
        this.disableSaveButton = false;
        for (let path in this.data1) {
          this.rowToggle[path] = checked;
        }
        for (let role of this.roles) {
          for (let method of this.methods) {
            this.columnToggle[`${method}_${role}`] = checked;
          }
        }

        for (let methods of Object.values(this.data1)) {
          for (let method of Object.values(methods)) {
            for (let role of this.roles) {
              this.$set(method, role, checked)
            }
          }
        }
      },
      toggleCell(path, method, role, checked) {
        this.disableSaveButton = false;
        this.$set(this.columnToggle, `${method}_${role}`, Object.values(this.data1).some(methods => methods[method] && methods[method][role]));
        this.$set(this.rowToggle, path, Object.values(this.data1[path]).some(roles => Object.values(roles).some(v => v)));
      },
      initColumnCheckBox() {
        for (let role of this.roles) {
          for (let method of this.methods) {
            this.columnToggle[`${method}_${role}`] = Object.values(this.data1).some(methods => methods[method] && methods[method][role]);
          }
        }
      },
      initRowCheckBox() {
        for (let path in this.data1) {
          this.rowToggle[path] = Object.values(this.data1[path]).filter(roles => Object.entries(roles).filter(([role, v]) => {
            if (!this.roles.includes(role)) this.roles = [...this.roles, role];
            return v;
          }).length).length;
        }
      },
      async aclInit() {
        this.disableSaveButton = true;
        this.policyPath = await this.sqlMgr.projectGetPolicyPath({
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          tn: this.nodes.tn
        });
        try {
          console.log(this.policyPath, this.data1)
          // this.data1 = JSON.parse(JSON.stringify((await this.sqlMgr.importFresh({path: this.policyPath})).permissions));
          this.data1 = JSON.parse(JSON.stringify((await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'importFresh', {path: this.policyPath}])).permissions));
          this.initColumnCheckBox();
          this.initRowCheckBox();
        } catch (e) {
          console.log(e)
        }
      },
      async save() {
        try {
          // await this.sqlMgr.writeFile({
          //   path: this.policyPath,
          //   data: `module.exports.permissions = ${JSON.stringify(this.data1, 0, 2)}`
          // });

          await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'writeFile', {
            path: this.policyPath,
            data: `module.exports.permissions = ${JSON.stringify(this.data1, 0, 2)}`
          }]);

          this.disableSaveButton = true;
          this.$toast.success(`${this.policyPath} updated successfully`).goAway(3000);
        } catch (e) {
          console.log(e);
          this.$toast.error(`${this.policyPath} updating failed`).goAway(3000);
        }
      }
    },
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
          delete: 'red darken-3',
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
    computed: {
      ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"}),
      allToggle: {
        get() {
          return this.data1 && Object.values(this.data1).some(methods => Object.values(methods).some(roles => Object.values(roles).some(v => v)))
        },
        set(checked) {
          this.toggleAll(checked)
        }
      }
    },
    async created() {
      this.aclInit();
    },
    watch: {}
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
