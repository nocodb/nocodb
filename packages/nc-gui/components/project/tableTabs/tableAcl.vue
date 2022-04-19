<template>
  <div class="h-100">
    <v-card style="" class="h-100">
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
                       text: (nodes.title || nodes.view_name|| nodes.table_name) + ' (RBAC)',
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
          tooltip="Reload RBAC"
          color="primary"
          small
          @click="load"
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
          :disabled="!edited"
          @click="save"
        >
          <v-icon small left>
            save
          </v-icon>
          <!-- Save -->
          {{ $t('general.save') }}
        </x-btn>
      </v-toolbar>

      <p class="title mt-6 mb-6">
        Table : <span class="text-capitalize">{{ nodes.title || nodes.view_name }}</span><br>
        <span class="font-weight-thin">Role Based Access Control (RBAC) For Columns</span>
      </p>

      <v-skeleton-loader v-if="loading || !data" type="table" />

      <div v-else class="pb-10">
        <v-overlay v-model="showCustomAcl" absolute>
          <template #default>
            <v-card
              :light="!$store.state.windows.darkTheme"
              class="ma-2"
              style="max-height: 100%; overflow: auto; min-height:70vh"
            >
              <v-card-actions>
                <p class="body-1 mb-0 mr-2">
                  Custom Rules : {{ custoAclTitle[0] }}<span class="grey--text caption">(table)</span>
                  > {{ custoAclTitle[1] }}<span class="grey--text caption">(role)</span> > {{ custoAclTitle[2] }}<span
                    class="grey--text caption"
                  >(operation)</span>
                </p>
                <v-spacer />
                <v-btn
                  outlined
                  small
                  @click="showCustomAcl=false"
                >
                  <!-- Cancel -->
                  {{ $t('general.cancel') }}
                </v-btn>
                <v-btn
                  outlined
                  color="primary"
                  small
                  @click="save"
                >
                  <!-- Save -->
                  {{ $t('general.save') }}
                </v-btn>
              </v-card-actions>
              <v-card-text>
                <custom-acl
                  v-model="customAcl"
                  :nodes="nodes"
                  :table="nodes.table_name || nodes.view_name"
                />
              </v-card-text>
            </v-card>
          </template>
        </v-overlay>
        <v-simple-table dense class=" mx-10">
          <thead>
            <tr>
              <th rowspan="2" class="text-center">
                <!--            <div class="d-flex justify-center align-end">-->
                <!--              <v-checkbox dense v-model="aclAll"></v-checkbox>-->

                <span>Columns x RBAC</span>
              <!--          <v-text-field dense hide-details class="my-2 caption font-weight-regular"
                                                            flat
                                                            outlined
                                                            :placeholder="`Search columns in '${nodes.title|| nodes.view_name}'`"
                                                            prepend-inner-icon="search" v-model="search"
          ></v-text-field>-->
              <!--            </div>-->
              </th>
              <template v-for="role in roles">
                <th
                  v-if="role !== 'creator'"
                  :key="role"
                  :colspan="operations.length"
                  class="text-center"
                >
                  {{ role }}
                </th>
              </template>
            </tr>
            <tr>
              <template v-for="role in roles">
                <template v-if="role !== 'creator'">
                  <th
                    v-for="op in operations"
                    :key="`${role}-${op.name}--11`"
                    :class="` pa-0 caption text-capitalize ${op.color}--text`"
                    class="permission role-op-header"
                  >
                    <v-tooltip bottom>
                      <template #activator="{on}">
                        <div class="d-flex flex-column justify-center align-center d-100 h-100 mt-0" v-on="on">
                          <v-checkbox
                            v-model="aclRoleOpAll[`${role}___${op.name}`]"
                            hide-details
                            class="mt-n1"
                            dense
                            :color="op.color"
                            @change="onAclRoleOpAllChange(aclRoleOpAll[`${role}___${op.name}`],`${role}___${op.name}`)"
                          />
                          <span>{{ op.name }}</span>
                        </div>
                      </template>
                      <span class="caption"><span
                        class="text-capitalize"
                      >{{
                        role
                      }}</span> {{ aclRoleOpAll[`${role}___${op.name}`] ? 'can' : 'can\'t' }} {{
                        op.name
                      }} '{{ nodes.table_name }}' rows</span>
                    </v-tooltip>

                    <v-icon
                      v-if="op.name !== 'delete'"
                      x-small
                      class="custom-acl"
                      @click="(
                        showCustomAcl = true,
                        custoAclTitle = [nodes.table_name,role,op.name],
                        customAcl=(data[role] && data[role][op.name] && data[role][op.name].custom ) || {}
                      )"
                    >
                      mdi-pencil-outline
                    </v-icon>

                    <v-icon
                      v-if="data[role]
                        && data[role][op.name]
                        && data[role][op.name].custom
                        && Object.keys(data[role][op.name].custom).length"
                      x-small
                      class="custom-acl-found"
                    >
                      mdi-filter-menu
                    </v-icon>
                  </th>
                </template>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="column in columns"
              v-show="column.title.toLowerCase().indexOf(search.toLowerCase()) > -1"
              :key="column.title"
              class="caption"
            >
              <td>
                {{ column.title }}
              </td>
              <template v-for="role in roles">
                <template
                  v-if="role !== 'creator'"
                >
                  <td
                    v-for="op in operations"
                    :key="`${role}-${op.name}`"
                    class="pa-0"
                    style="position: relative"
                    :class="`caption text-capitalize`"
                  >
                    <v-tooltip bottom :disabled="op.ignore">
                      <template #activator="{on}">
                        <div
                          class="d-100 h-100 d-flex align-center justify-center permission-checkbox-container"
                          v-on="on"
                        >
                          <v-checkbox
                            v-if="!op.ignore"
                            v-model="aclObj[`${column.title}___${role}___${op.name}`]"
                            class="mt-n1"
                            dense
                            color="primary lighten-2"
                            style=""
                            @change="onPermissionChange(aclObj[`${column.title}___${role}___${op.name}`],`${role}___${op.name}`)"
                          />

                          <v-checkbox
                            v-else
                            class="mt-n1"
                            dense
                            color="primary lighten-2"
                            disabled
                            style=""
                          />
                        </div>
                      </template>

                      <span class="caption"><span
                        class="text-capitalize"
                      >{{
                        role
                      }}</span> {{ aclObj[`${column.title}___${role}___${op.name}`] ? 'can' : 'can\'t' }} {{
                        op.name
                      }} column '{{ column.title }}'</span>
                    </v-tooltip>
                  </td>
                </template>
              </template>
            </tr>
          </tbody>
        </v-simple-table>
      </div>
    </v-card>
  </div>
</template>

<script>

// import debounce from "@/helpers/debounce";
// import CustomAcl from "./customAcl";

import CustomAcl from './customAcl'

export default {
  name: 'TableAcl',
  components: { CustomAcl },
  // components: {CustomAcl},
  props: ['nodes'],
  data: () => ({
    showCustomAcl: false,
    custoAclTitle: null,
    customAcl: {},
    edited: false,
    search: '',
    allOperations: [{
      name: 'create',
      color: 'warning'
    }, {
      name: 'read',
      color: 'success'
    }, {
      name: 'update',
      color: 'info'
    }, {
      name: 'delete',
      color: 'error',
      ignore: true
    }],

    data: null,
    columns: null,
    aclObj: {},
    aclRoleOpAll: {},
    loading: false
  }),
  computed: {
    roles() {
      return (this.data ? Object.keys(this.data) : []).filter(r => r !== 'guest')
    },
    operations() {
      return this.allOperations.filter(({ name }) => this.nodes.table_name || name === 'read')
    }
  },
  async created() {
    await this.load()
  },
  methods: {
    async load() {
      await this.loadColumnList()
      await this.loadAcl()
      this.generateAclObj()
      this.edited = false
    },
    generateAclObj() {
      const aclObj = {}
      const aclRoleOpAll = {}
      console.log(this.data)
      // generate aclObj with merged key value
      for (const [role, roleObj] of Object.entries(this.data)) {
        for (const [operation, acl] of Object.entries(roleObj)) {
          aclRoleOpAll[`${role}___${operation}`] = false
          for (const { _cn: cn } of this.columns) {
            if (typeof acl === 'boolean') {
              aclObj[`${cn}___${role}___${operation}`] = acl
            } else if (acl) {
              aclObj[`${cn}___${role}___${operation}`] = acl.columns[cn]
            }
            if (!aclRoleOpAll[`${role}___${operation}`] && aclObj[`${cn}___${role}___${operation}`]) {
              aclRoleOpAll[`${role}___${operation}`] = true
            }
          }
        }
      }
      this.aclRoleOpAll = aclRoleOpAll
      this.$nextTick(() => {
        this.aclObj = aclObj
      })
    },
    async save() {
      const obj = {}
      for (const [key, isAllowed] of Object.entries(this.aclObj)) {
        const [column, role, operation] = key.split('___')
        if (operation !== 'delete') {
          obj[role] = obj[role] || {}
          obj[role][operation] = obj[role][operation] || {}
          obj[role][operation].columns = obj[role][operation].columns || {}
          obj[role][operation].columns[column] = isAllowed
        }
        if (this.data[role] && this.data[role][operation] && this.data[role][operation].custom) {
          obj[role][operation].custom = this.data[role][operation].custom
        }
      }

      for (const [key, isAllowed] of Object.entries(this.aclRoleOpAll)) {
        const [role, operation] = key.split('___')
        if (operation === 'delete' || !isAllowed) {
          obj[role] = obj[role] || {}
          obj[role][operation] = isAllowed
        }
      }

      if (this.showCustomAcl && this.custoAclTitle) {
        if (!obj[this.custoAclTitle[1]][this.custoAclTitle[2]] || typeof obj[this.custoAclTitle[1]][this.custoAclTitle[2]] !== 'object') {
          obj[this.custoAclTitle[1]][this.custoAclTitle[2]] = {}
        }
        obj[this.custoAclTitle[1]][this.custoAclTitle[2]].custom = this.customAcl
      }

      console.log(obj)
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcAclSave', {
          tn: this.nodes.table_name || this.nodes.view_name,
          acl: obj
        }])
        if (this.showCustomAcl) {
          this.$toast.success('Custom RBAC saved successfully').goAway(3000)
          this.showCustomAcl = false
        } else {
          this.$toast.success('RBAC saved successfully').goAway(3000)
        }
        this.edited = false
        await this.load()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },

    async loadColumnList() {
      // const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // }, 'columnList', {
      //   tn: this.nodes.table_name || this.nodes.view_name
      // }]);
      // this.columns = result.data.list;
      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableXcModelGet', {
        tn: this.nodes.table_name || this.nodes.view_name
      }])

      const meta = JSON.parse(result.meta)
      this.columns = meta.columns
    },
    async loadAcl() {
      this.loading = true
      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'xcAclGet', {
        tn: this.nodes.table_name || this.nodes.view_name
      }])
      this.data = JSON.parse(result.acl)

      this.loading = false
    },
    onAclRoleOpAllChange(isEnabled, name) {
      this.edited = true
      const obj = {}
      for (const key in this.aclObj) {
        if (key.split('___').slice(1).join('___') === name) {
          obj[key] = isEnabled
        } else {
          obj[key] = this.aclObj[key]
        }
      }
      this.aclObj = obj
    },
    onPermissionChange(isEnabled, name) {
      this.edited = true
      if (isEnabled && !this.aclRoleOpAll[name]) {
        this.$set(this.aclRoleOpAll, name, true)
      }
      if (!isEnabled && this.aclRoleOpAll[name]) {
        this.$set(this.aclRoleOpAll, name, Object.entries(this.aclObj).some(([key, enabled]) => key.endsWith(name) && enabled))
      }
    }
  }
  // watch: {
  //   aclRoleOpAll: {
  //     // todo: fix toggle issue
  //     handler(aclRoleOpAll) {
  //       const obj = {};
  //       for (const key in this.aclObj) {
  //         obj[key] = aclRoleOpAll[key.split('___').slice(1).join('___')];
  //       }
  //       this.aclObj = obj;
  //     },
  //     deep: true
  //   }
  //
  // }
}
</script>

<style scoped lang="scss">
tr, th {
  border: 1px solid grey;
}

td, th {
  border-left: 1px solid grey;
}

td:last-child, th:last-child {
  border-right: 1px solid grey;
}

tr:first-child > th:nth-child(n+2) {
  border-bottom: 1px solid grey;
}

th.permission {
  padding-left: 0;
  padding-right: 0;
  /*width: 75px;*/
}

//.permission-checkbox-container {
//  transition: filter .4s;
//  filter: grayscale(100%);
//}
//
//.permission-checkbox-container:hover {
//  filter: none;
//}

::v-deep {
  .permission-checkbox-container .v-input {
    transform: scale(.8);
  }

  .v-overlay__content {
    height: 100%;
    display: flex;
    align-items: center;
  }

  table {
    border-collapse: collapse;
  }
}

.role-op-header {
  position: relative;

  .custom-acl {
    opacity: 0;
    transition: opacity .4s;
    position: absolute;
    right: 1px;
    bottom: 1px;
  }

  .custom-acl-found {
    position: absolute;
    right: 1px;
    top: 1px;
  }

  &:hover .custom-acl {
    opacity: 1;
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
