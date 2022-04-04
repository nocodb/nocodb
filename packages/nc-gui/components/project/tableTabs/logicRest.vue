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
                   },{
                     text: nodes.dbAlias,
                     disabled: true,
                     href: '#'
                   },
                   {
                     text: name + ' (APIs)',
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

      <v-btn small outlined class="caption text-capitalize" color="primary" @click="showSwagger = !showSwagger">
        <v-icon small color="primary">
          {{ showSwagger ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}
        </v-icon> &nbsp;

        {{ showSwagger ? 'Hide Swagger' : 'Show Swagger' }}
      </v-btn>

      <x-btn
        v-ge="['rows','reload']"
        outlined
        tooltip="Reload Rows"
        color="primary"
        small
        btn.class="caption text-capitalize"
        @click="loadSwaggerDoc(); loadRoutes();"
      >
        <v-icon small left>
          refresh
        </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
    </v-toolbar>

    <v-text-field
      v-model="search"
      dense
      hide-details
      class="ma-2"
      :placeholder="`Search ${name} routes`"
      prepend-inner-icon="search"
      outlined
    />

    <!--    <div class="d-flex justify-center">-->
    <v-container fluid>
      <v-row>
        <v-col v-if="showSwagger">
          <v-card>
            <div class="text-center" style="padding: 3px">
              <span class="title schema-card-title">Swagger JSON</span>
            </div>
            <div class="d-flex pa-3">
              <v-spacer />
              <x-btn
                outlined
                :tooltip="`Compare GQL schema history of ${nodes.table_name}`"
                color="primary"
                x-small
                :disabled="loading || !swaggerDocHistory.length"
                @click.prevent="schemaDiffDialog = true"
              >
                <v-icon small left>
                  mdi-source-branch
                </v-icon>
                History <span v-if="swaggerDocHistory.length" class="history-count">({{
                  swaggerDocHistory.length
                }})</span>
              </x-btn>
              <x-btn
                v-ge="['rows','save']"
                outlined
                :tooltip="$t('tooltip.saveChanges')"
                color="primary"
                x-small
                :disabled="loading"
                @click.prevent="saveSwaggerDoc"
              >
                <v-icon small left>
                  save
                </v-icon>
                <!-- Save -->
                {{ $t('general.save') }}
              </x-btn>
            </div>
            <monaco-json-editor
              v-model="swaggerDoc"
              theme=""
              style="min-height:500px;"
            />
          </v-card>
        </v-col>
        <v-col>
          <v-card v-if="filteredGroupedData.length" class="flex-shrink-1" style="">
            <v-skeleton-loader v-if="loading" type="table" />

            <v-simple-table v-else-if="routers" dense style="width: auto; min-width: 500px">
              <thead>
                <tr>
                  <th colspan="2" class="text-center">
                    <div class="d-flex justify-center">
                      <span class="title">Routes</span>
                    </div>
                  </th>

                  <template v-for="(method,i) in methods">
                    <th
                      :key="`${method}`"
                      width="60"
                      class=" method-cell caption px-1 text-center text-uppercase font-weight-bold"
                      :class="`${methodColor[method]}--text`"
                    >
                      {{ method }}
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="[path,route] in filteredGroupedData"
                >
                  <td width="20" class="px-0" />
                  <td class="pl-0">
                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <span v-on="on">{{ path }}</span>
                      </template>
                      <span>{{ path }}</span>
                    </v-tooltip>
                  </td>
                  <template v-for="(method,i) in methods">
                    <td

                      :key="`${path}_${method}}`"
                      width="60"
                      class="pa-1 text-center method-cell"
                    >
                      <v-tooltip bottom>
                        <template #activator="{ on }">
                          <v-hover v-if="route[method]" v-slot="{ hover }">
                            <v-icon
                              small
                              :color="hover ? methodColor[method]:''"
                              @click="showSourceCode(route,method)"
                              v-on="on"
                            >
                              mdi-pencil
                            </v-icon>
                          </v-hover>
                        </template>
                        Edit business logic
                      </v-tooltip>
                    </td>
                  </template>
                </tr>

                <tr
                  v-for="mw in middlewares"
                >
                  <td width="20" class="px-0" />
                  <td class="pl-0">
                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <span v-on="on">{{ mw.title }} - Middleware</span>
                      </template>
                      <span>{{ mw.title }} - Middleware</span>
                    </v-tooltip>
                  </td>
                  <td
                    :colspan="methods.length"
                    width="60"
                    class="pa-1 text-center method-cell"
                  >
                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <v-hover v-slot="{ hover }">
                          <v-icon
                            small
                            :color="hover ? methodColor[method]:''"
                            @click="showMiddlewareSourceCode(mw)"
                            v-on="on"
                          >
                            mdi-pencil
                          </v-icon>
                        </v-hover>
                      </template>
                      Edit middleware business logic
                    </v-tooltip>
                  </td>
                </tr>
              </tbody>
            </v-simple-table>

            <v-alert v-else outlined type="info">
              Permission file not found
            </v-alert>
          </v-card>
          <!--    </div>-->
        </v-col>
        <!--    </div>-->
      </v-row>
    </v-container>
    <handler-code-editor
      v-model="showCodeEditor"
      :is-middleware="isMiddleware"
      :nodes="nodes"
      :route="editRoute"
      :method="editMethod"
    />

    <v-dialog v-model="schemaDiffDialog" scrollable min-width="600px">
      <v-card>
        <xc-diff
          v-model="swaggerDoc"
          :history="swaggerDocHistory"
        />
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import HandlerCodeEditor from '@/components/project/restHandlerCodeEditor'
import MonacoJsonEditor from '@/components/monaco/MonacoJsonEditor'

export default {
  name: 'LogicRest',
  components: { MonacoJsonEditor, HandlerCodeEditor },
  props: ['nodes'],
  data: () => ({
    showSwagger: false,
    loading: false,
    search: '',
    groupedData: {},
    middlewares: [],
    routers: null,
    methods: [
      'get', 'post', 'put', 'delete'
    ],
    methodColor: {
      get: 'success',
      post: 'warning',
      put: 'info',
      patch: 'secondary',
      delete: 'error'
    },
    editRoute: '',
    editMethod: '',
    isMiddleware: false,
    showCodeEditor: false,
    swaggerDocHistory: [],
    swaggerDoc: '',
    schemaDiffDialog: false
  }),
  computed: {
    filteredGroupedData() {
      return Object.entries(this.groupedData)
        .filter(([path]) => !this.search || path.toLowerCase().includes(this.search.toLowerCase()))
    },
    name() {
      return this.nodes.table_name || this.nodes.view_name
    }
  },
  async created() {
    await this.loadRoutes()
    this.groupRoutes()
    await this.loadSwaggerDoc()
  },
  methods: {
    groupRoutes() {
      const groupedData = {}
      this.middlewares = []
      for (const route of this.routers) {
        if (route.path) {
          groupedData[route.path] = groupedData[route.path] || {}
          groupedData[route.path][route.type] = route
        } else if (route.handler_type === 2) {
          this.middlewares.push(route)
        }
      }
      this.groupedData = groupedData
    },
    showSourceCode(route, method) {
      this.editRoute = route
      this.editMethod = method
      this.isMiddleware = false
      this.showCodeEditor = true
    },
    showMiddlewareSourceCode(mw) {
      this.editRoute = mw
      this.editMethod = null
      this.isMiddleware = true
      this.showCodeEditor = true
    },
    async loadSwaggerDoc() {
      const tableMeta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableXcModelGet', {
        table_name: this.nodes.table_name || this.nodes.view_name
      }])
      this.swaggerDoc = JSON.stringify(JSON.parse(tableMeta.schema), 0, 2)
      // if (tableMeta.schema_previous) {
      //   this.swaggerDocHistory = JSON.parse(tableMeta.schema_previous).reverse().map(o => JSON.stringify(o, null, 2))
      // } else {
      //   this.swaggerDocHistory = []
      // }
    },
    async saveSwaggerDoc() {
      this.edited = false
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSwaggerDocSet', {
          tn: this.nodes.table_name || this.nodes.view_name,
          swaggerDoc: JSON.parse(this.swaggerDoc)
        }])
        this.$toast.success('Successfully updated swagger doc').goAway(3000)
      } catch (e) {
        this.$toast.error('Failed to update swagger doc').goAway(3000)
      }
    },
    async loadRoutes() {
      this.loading = true
      this.routers = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'xcRoutesPolicyGet', {
        tn: this.name
      }])).data.list
      this.loading = false
    }
  }
}
</script>

<style scoped>
.method-cell {
  border-left: 1px solid #aaa;
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
