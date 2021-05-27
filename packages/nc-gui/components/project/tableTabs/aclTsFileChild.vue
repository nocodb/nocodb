<template>
  <div>
    <v-card style="" v-if="filteredGroupedData.length">

      <!--      <v-toolbar flat height="42" class="toolbar-border-bottom">-->
      <!--        <v-toolbar-title>-->
      <!--          <v-breadcrumbs :items="[{-->
      <!--          text: this.nodes.env,-->
      <!--          disabled: true,-->
      <!--          href: '#'-->
      <!--        },{-->
      <!--          text: this.nodes.dbAlias,-->
      <!--          disabled: true,-->
      <!--          href: '#'-->
      <!--        },-->
      <!--        {-->
      <!--          text: this.nodes.tn + ' (ACL)',-->
      <!--          disabled: true,-->
      <!--          href: '#'-->
      <!--        }]" divider=">" small>-->
      <!--            <template v-slot:divider>-->
      <!--              <v-icon small color="grey lighten-2">forward</v-icon>-->
      <!--            </template>-->
      <!--          </v-breadcrumbs>-->

      <!--        </v-toolbar-title>-->
      <!--        <v-spacer></v-spacer>-->
      <!--        <x-btn outlined tooltip="Reload ACL"-->
      <!--               color="primary"-->
      <!--               small-->
      <!--               v-ge="['acl','reload']"-->
      <!--               @click="aclInit"-->
      <!--        >-->
      <!--          <v-icon small left>refresh</v-icon>-->
      <!--          Reload-->
      <!--        </x-btn>-->
      <!--        <x-btn tooltip="Open ACL Folder"-->
      <!--               icon="mdi-folder-open"-->
      <!--               outlined-->
      <!--               small-->
      <!--               color="primary"-->
      <!--               v-ge="['acl','open-folder']"-->
      <!--               @click="openFolder">-->
      <!--          Open Folder-->
      <!--        </x-btn>-->
      <!--        <x-btn outlined tooltip="Save Changes"-->
      <!--               color="primary"-->
      <!--               class="primary"-->
      <!--               small-->
      <!--               @click="save"-->
      <!--               :disabled="disableSaveButton"-->
      <!--               v-ge="['acl','save']">-->
      <!--          <v-icon small left>save</v-icon>-->
      <!--          Save-->
      <!--        </x-btn>-->

      <!--      </v-toolbar>-->

      <!--      <v-text-field dense hide-details class="ma-2" :placeholder="`Search ${nodes.tn} routes`"-->
      <!--                    prepend-inner-icon="search" v-model="search"-->
      <!--                    outlined></v-text-field>-->
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
              <span class="title">{{routesName}} Routes</span>
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
        <tr v-for="[path,route] in filteredGroupedData"
        >

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
                  v-if="route[method]" class="mt-0" dense
                  :color="methodColor[method]"
                  :input-value="route[method].acl[role]"
                  v-model="route[method].acl[role]"
                  @change="toggleCell(path,method,role,route[method].acl[role])">
                </v-checkbox>
                <span
                  v-else>
<!--          todo:        @dblclick="$set(data1[path],method , {})"-->
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


  // const {fs, importFresh, shell, path} = require("electron").remote.require('./libs');

  export default {
    name: "acl-ts-file-child",

    props: ["nodes", "policyPath", "search"],
    methods: {

      async aclInit() {
        this.disableSaveButton = true;

        try {
          console.log(this.policyPath, this.data1)
          // this.data1 = JSON.parse(JSON.stringify(await this.sqlMgr.importFresh({path: this.policyPath})));
          this.data1 = JSON.parse(JSON.stringify(await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'importFresh', {path: this.policyPath}])));
          this.groupRoutes();
          this.initColumnCheckBox();
          this.initRowCheckBox();
        } catch (e) {
          console.log(e)
        }
      },
      groupRoutes() {
        const groupedData = {};
        for (const route of this.data1) {
          groupedData[route.path] = groupedData[route.path] || {};
          groupedData[route.path][route.type] = route;
        }
        this.groupedData = groupedData;
      },
      toggleColumn(role, method, checked) {
        for (let [path, methods] of Object.entries(this.groupedData)) {
          if (methods[method]) {
            this.$set(methods[method].acl, role, checked)
            this.toggleCell(path, method, role, checked)
          }
        }
      },
      toggleRow(path, checked) {
        for (let [method, route] of Object.entries(this.groupedData[path])) {
          for (let role in route.acl) {
            this.$set(route.acl, role, checked)
            this.toggleCell(path, method, role, checked)
          }
        }
      },
      toggleAll(checked) {
        this.disableSaveButton = false;
        for (let path in this.groupedData) {
          this.rowToggle[path] = checked;
        }
        for (let role of this.roles) {
          for (let method of this.methods) {
            this.columnToggle[`${method}_${role}`] = checked;
          }
        }

        for (let methods of Object.values(this.groupedData)) {
          for (let router of Object.values(methods)) {
            for (let role of this.roles) {
              this.$set(router.acl, role, checked)
            }
          }
        }
      },
      toggleCell(path, method, role, checked) {
        this.disableSaveButton = false;
        this.$set(this.columnToggle, `${method}_${role}`, Object.values(this.groupedData).some(methods => methods[method] && methods[method].acl[role]));
        this.$set(this.rowToggle, path, Object.values(this.groupedData[path]).some(route => Object.values(route.acl).some(v => v)));
      },
      initColumnCheckBox() {
        for (let role of this.roles) {
          for (let method of this.methods) {
            this.columnToggle[`${method}_${role}`] = Object.values(this.groupedData).some(methods => methods[method] && methods[method].acl[role]);
          }
        }
      },
      initRowCheckBox() {
        for (let path in this.groupedData) {
          this.rowToggle[path] = Object.values(this.groupedData[path])
            .filter(route =>
              Object.entries(route.acl).filter(([role, v]) => {
                if (!this.roles.includes(role)) this.roles = [...this.roles, role];
                return v;
              }).length
            ).length;
        }
      },
      async save() {
        try {
          // await this.sqlMgr.writeFile({
          //   path: this.policyPath,
          //   data: `module.exports = ${JSON.stringify(this.data1, null, 2)}`
          // })

          await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'writeFile', {
            path: this.policyPath,
            data: `module.exports = ${JSON.stringify(this.data1, null, 2)}`
          }])
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
        groupedData: null,
        disableSaveButton: true,
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
          'get', 'post', 'put', 'delete'
        ],
        data1: null
      }
    },
    computed: {
      ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"}),
      allToggle: {
        get() {
          return this.groupedData && Object.values(this.groupedData)
            .some(methods => Object.values(methods)
              .some(route => Object.values(route.acl)
                .some(v => v)
              )
            )
        },
        set(checked) {
          this.toggleAll(checked)
        }
      },
      routesName() {
        return this.policyPath && this.policyPath
          .split('/').pop()
          .replace(/\.routes.js$/, '')
          .replace(/(?:^|\.)(\w+)/g, (_, m) => {
            if (m === 'bt') return ' BelongsTo';
            if (m === 'hm') return ' HasMany';
            return ' ' + m[0].toUpperCase() + m.slice(1)
          })
      },
      filteredGroupedData() {
        return this.groupedData ? Object.entries(this.groupedData)
          .filter(([path]) => !this.search || path.toLowerCase().indexOf(this.search.toLowerCase()) > -1) : [];
      }
    },
    async created() {
      await this.aclInit();
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
