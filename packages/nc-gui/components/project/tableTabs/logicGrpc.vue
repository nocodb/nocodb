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
                     text: nodes.table_name || nodes.view_name + ' (APIs)',
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
          {{ showSwagger ?'mdi-eye-off-outline' : 'mdi-eye-outline' }}
        </v-icon> &nbsp;

        {{ showSwagger ? 'Hide Protobuf' : 'Show Protobuf' }}
      </v-btn>
      <x-btn
        v-ge="['rows','reload']"
        outlined
        tooltip="Reload Rows"
        color="primary"
        small
        @click="loadSchema(); loadRpcs();"
      >
        <v-icon small left>
          refresh
        </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </x-btn>
    </v-toolbar>

    <v-container fluid>
      <v-row>
        <v-col v-if="showSwagger">
          <v-card class="flex-shrink-1">
            <div class="text-center" style="padding: 3px">
              <span class="title schema-card-title">Protobuf</span>
            </div>
            <div class="d-flex pa-3">
              <v-spacer />
              <x-btn
                outlined
                :tooltip="`Compare GQL schema history of ${nodes.table_name}`"
                color="primary"
                x-small
                :disabled="loading || !schemaHistory.length"
                @click.prevent="schemaDiffDialog = true"
              >
                <v-icon small left>
                  mdi-source-branch
                </v-icon>
                History <span v-if="schemaHistory.length" class="history-count">({{ schemaHistory.length }})</span>
              </x-btn>
              <x-btn
                v-ge="['rows','save']"
                outlined
                :tooltip="$t('tooltip.saveChanges')"
                color="primary"
                x-small
                :disabled="loading"
                @click.prevent="saveMessageAndRpc"
              >
                <v-icon small left>
                  save
                </v-icon>
                <!-- Save -->
                {{ $t('general.save') }}
              </x-btn>
            </div>
            <p class="caption pa-1">
              Messages
            </p>
            <monaco-editor
              v-model="messages"
              theme=""
              style="min-height:250px;"
            />
            <p class="caption pa-1 mt-2">
              rpcs
            </p>
            <monaco-editor
              v-model="services"
              theme=""
              style="min-height:250px;"
            />
          </v-card>
        </v-col>
        <v-col>
          <!--    <div class="d-flex justify-center">-->
          <v-card v-if="rpcServices && filteredData.length" class="flex-shrink-1" style="">
            <v-text-field
              v-model="search"
              dense
              hide-details
              class="ma-2 mt-2"
              :placeholder="`Search ${nodes.table_name || nodes.view_name} rpc services`"
              prepend-inner-icon="search"
              outlined
            />

            <v-simple-table v-if="rpcServices" dense style="width: auto; min-width: 500px">
              <thead>
                <tr>
                  <th colspan="2" class="text-center">
                    <div class="text-center">
                      <span class="title">RPC Services</span>
                    </div>
                  </th>

                  <th
                    width="60"
                    class="text-center"
                  >
                    <span class="title" />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{service,...rest} in filteredData"
                >
                  <td width="20" class="px-0" />
                  <td class="pl-0">
                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <span v-on="on">{{ service }}</span>
                      </template>
                      <span>{{ service }}</span>
                    </v-tooltip>
                  </td>
                  <td
                    width="60"
                    class="pa-1 text-center method-cell"
                  >
                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <v-hover v-slot="{ hover }">
                          <v-icon
                            small
                            :color="hover ? 'primary':''"
                            @click="showSourceCode(service,rest)"
                            v-on="on"
                          >
                            mdi-pencil
                          </v-icon>
                        </v-hover>
                      </template>
                      Edit business logic
                    </v-tooltip>
                  </td>
                </tr>
              </tbody>
            </v-simple-table>

            <v-alert v-else outlined type="info">
              Permission file not found
            </v-alert>
          </v-card>
        </v-col>
        <!--    </div>-->
      </v-row>
    </v-container>
    <grpc-handler-code-editor
      v-model="showCodeEditor"
      :nodes="nodes"
      :service="editService"
      :service-data="editServiceData"
    />

    <v-dialog v-model="schemaDiffDialog" scrollable min-width="600px">
      <v-card>
        <xc-diff
          v-model="messages"
          :history="schemaHistory"
        />
      </v-card>
    </v-dialog>
  </div>
</template>

<script>

import GrpcHandlerCodeEditor from '@/components/project/grpcHandlerCodeEditor'
import MonacoEditor from '~/components/monaco/MonacoEditor'

export default {
  name: 'LogicGrpc',
  components: { GrpcHandlerCodeEditor, MonacoEditor },
  props: ['nodes'],
  data: () => ({
    showSwagger: false,
    editServiceData: null,
    loading: false,
    search: '',
    rpcServices: null,
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
    editService: '',
    showCodeEditor: false,
    messages: '',
    services: '',
    schemaHistory: [],
    schemaDiffDialog: false
  }),
  computed: {
    filteredData() {
      return this.rpcServices.filter(({ service }) => service && (!this.search || service.toLowerCase().includes(this.search.toLowerCase())))
    }
  },
  async created() {
    await this.loadRpcs()
    await this.loadSchema()
  },
  methods: {

    showSourceCode(service, serviceData) {
      this.editService = service
      this.showCodeEditor = true
      this.editServiceData = serviceData
    },
    async loadSchema() {
      const tableMeta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableXcModelGet', {
        table_name: this.nodes.table_name || this.nodes.view_name
      }])
      this.messages = tableMeta.messages
      this.services = tableMeta.services
      // if (tableMeta.schema_previous) {
      //   this.schemaHistory = JSON.parse(tableMeta.schema_previous).reverse()
      // } else {
      //   this.schemaHistory = []
      // }
    },
    async loadRpcs() {
      this.rpcServices = (await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'xcRpcPolicyGet', {
        table_name: this.nodes.table_name || this.nodes.view_name
      }])).data.list
    },
    async saveMessageAndRpc() {
      this.edited = false
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelMessagesAndServicesSet', {
          table_name: this.nodes.table_name || this.nodes.view_name,
          messages: this.messages,
          services: this.services
        }])
        this.$toast.success('Successfully updated protobuf messages and rpcs').goAway(3000)
      } catch (e) {
        this.$toast.error('Failed to update validations').goAway(3000)
      }
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
