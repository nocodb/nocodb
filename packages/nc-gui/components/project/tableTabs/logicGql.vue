<template>
  <div class="graphql-logic">

    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <v-toolbar-title>
        <v-breadcrumbs :items="[{
          text: nodes.env,
          disabled: true,
          href: '#'
        },{
          text: nodes.dbAlias,
          disabled: true,
          href: '#'
        },
        {
          text: (nodes.tn || nodes.view_name) + ' (APIs)',
          disabled: true,
          href: '#'
        }]" divider=">" small>
          <template v-slot:divider>
            <v-icon small color="grey lighten-2">forward</v-icon>
          </template>
        </v-breadcrumbs>

      </v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn small outlined @click="showSwagger = !showSwagger" class="caption text-capitalize" color="primary">
        <v-icon small  color="primary"> {{showSwagger ?'mdi-eye-off-outline' : 'mdi-eye-outline'}}</v-icon> &nbsp;

        {{ showSwagger ? 'Hide Schema' : 'Show Schema' }}</v-btn>
      <x-btn outlined tooltip="Reload Rows"
             color="primary"
             small
             v-ge="['rows','reload']"
             @click="loadSchema(); loadResolvers();">
        <v-icon small left>refresh</v-icon>
        Reload
      </x-btn>

    </v-toolbar>

    <v-row class="mx-0" align="stretch">
      <v-col v-if="showSwagger">
        <v-card class="flex-shrink-1">
          <div class="text-center" style="padding: 3px">

            <span class="title schema-card-title">Schema</span>
          </div>
          <div class="d-flex pa-3">
            <v-spacer></v-spacer>

            <x-btn outlined :tooltip="`Compare GQL schema history of ${nodes.tn}`"
                   color="primary"
                   x-small
                   :disabled="loading || !schemaHistory.length"
                   @click.prevent="schemaDiffDialog = true">
              <v-icon small left>mdi-source-branch</v-icon>
              History <span class="history-count" v-if="schemaHistory.length">({{ schemaHistory.length }})</span>
            </x-btn>
            <x-btn outlined tooltip="Save Changes"
                   color="primary"
                   x-small
                   :disabled="loading"
                   v-ge="['rows','save']"
                   @click.prevent="saveSchema">
              <v-icon small left>save</v-icon>
              Save
            </x-btn>

          </div>
          <monaco-editor
            v-model="schema"
            theme=""
            style="min-height:500px;"

          >

          </monaco-editor>
        </v-card>
      </v-col>
      <v-col>
        <v-card class="flex-shrink-1" style="" v-if="filteredData.length">
          <div class="text-center" style="padding: 3px">

            <span class="title schema-card-title">Resolvers & Middlewares</span>
          </div>
          <v-simple-table v-if="resolvers" dense>
            <!--          style="width: auto; min-width: 500px">-->
            <thead>
            <!--            <tr>-->

            <!--              <th colspan="3" class="text-center">-->

            <!--                <div class="text-center">-->

            <!--                  <span class="title card-title">Resolvers</span>-->
            <!--                </div>-->

            <!--              </th>-->

            <!--            </tr>-->
            <tr>

              <th colspan="3" class="text-center">


                <v-text-field dense hide-details class="ma-2" :placeholder="`Search '${nodes.tn}' resolvers`"
                              prepend-inner-icon="search" v-model="search"
                              outlined></v-text-field>


              </th>

            </tr>

            </thead>
            <tbody>
            <template v-for="({resolver,title,functions},i) in filteredData">
              <tr v-if="resolver" :key="i"
              >

                <td width="20" class="px-0">

                </td>
                <td class="pl-0">

                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <span v-on="on">{{ resolver }}</span>
                    </template>
                    <span>{{ resolver }}</span>
                  </v-tooltip>
                </td>
                <td
                  width="60" class="pa-1 text-center method-cell">

                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">

                      <v-hover v-slot:default="{ hover }">
                        <v-icon @click="showSourceCode(resolver,functions)" small
                                :color="hover ? 'primary':''" v-on="on">mdi-pencil
                        </v-icon>
                      </v-hover>
                    </template>
                    Edit business logic
                  </v-tooltip>
                </td>

              </tr>
              <tr v-else :key="i"
              >

                <td width="20" class="px-0">

                </td>
                <td class="pl-0">

                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <span v-on="on" class="">{{ title }} - Middleware</span>
                    </template>
                    <span>{{ title }} - Middleware</span>
                  </v-tooltip>
                </td>
                <td
                  width="60" class="pa-1 text-center method-cell">

                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">

                      <v-hover v-slot:default="{ hover }">
                        <v-icon @click="showMiddlewareSourceCode(title,functions)" small
                                :color="hover ? 'primary':''" v-on="on">mdi-pencil
                        </v-icon>
                      </v-hover>
                    </template>
                    Edit business logic
                  </v-tooltip>
                </td>

              </tr>
            </template>
            </tbody>
          </v-simple-table>


          <v-alert v-else outlined type="info">Permission file not found</v-alert>
        </v-card>
      </v-col>

    </v-row>


    <gql-handler-code-editor :nodes="nodes"
                             :functions="selectedFunctions"
                             :resolver="editResolver"
                             :is-middleware="isMiddleware"
                             v-model="showCodeEditor"></gql-handler-code-editor>


    <v-dialog v-model="schemaDiffDialog" scrollable min-width="600px">
      <v-card>
        <xc-diff
          v-model="schema"
          :history="schemaHistory"
        ></xc-diff>
      </v-card>
    </v-dialog>

  </div>
</template>

<script>
import GqlHandlerCodeEditor from "@/components/project/gqlHandlerCodeEditor";
import MonacoTsEditor from "@/components/monaco/MonacoTsEditor";
import MonacoEditor from "@/components/monaco/MonacoEditor";
import XcDiff from "@/components/xcDiff";

export default {
  name: "logic-gql",
  components: {XcDiff, MonacoEditor, MonacoTsEditor, GqlHandlerCodeEditor},
  props: ['nodes'],
  data: () => ({
    showSwagger:false,
    selectedFunctions: null,
    schema: '',
    schemaHistory: [''],
    loading: false,
    search: '',
    groupedData: {},
    resolvers: [],

    editResolver: '',
    showCodeEditor: false,
    schemaDiffDialog: false,
    isMiddleware: false
  }),
  methods: {
    showSourceCode(resolver, functions) {
      this.selectedFunctions = functions;
      this.editResolver = resolver;
      this.isMiddleware = false;
      this.showCodeEditor = true;
    },
    showMiddlewareSourceCode(table, functions) {
      this.selectedFunctions = functions;
      this.editResolver = table;
      this.isMiddleware = true;
      this.showCodeEditor = true;
    },

    async saveSchema() {
      this.edited = false;
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSchemaSet', {
          tn: this.nodes.tn || this.nodes.view_name,
          schema: this.schema
        }]);
        this.$toast.success('Successfully updated validations').goAway(3000);
      } catch (e) {
        this.$toast.error('Failed to update validations').goAway(3000);
      }
    },
    async loadSchema() {
      const tableMeta = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableXcModelGet', {
        tn: this.nodes.tn || this.nodes.view_name
      }]);
      this.schema = tableMeta.schema;
      if (tableMeta.schema_previous) {
        this.schemaHistory = JSON.parse(tableMeta.schema_previous).reverse();
      } else {
        this.schemaHistory = [];
      }
    },
    async loadResolvers() {
      this.resolvers = (await this.$store.dispatch('sqlMgr/ActSqlOp', [
        {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcResolverPolicyGet', {
          tn: this.nodes.tn || this.nodes.view_name
        }])).data.list;
    }
  },
  async created() {
    await this.loadResolvers();
    await this.loadSchema();
  },
  computed: {
    filteredData() {
      return this.resolvers.filter(({resolver}) => !resolver || (!this.search || resolver.toLowerCase().indexOf(this.search.toLowerCase()) > -1));
    }
  }
}
</script>

<style scoped lang="scss">


@import "~vuetify/src/styles/styles";

$text-field-outlined-fieldset-padding: 0px;

//@import '~vuetify/src/styles/styles';
// Imports
//@import './_variables.scss'

.method-cell {
  border-left: 1px solid #aaa;
}

.history-count {
  font-size: 10px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  color: var(--v-primary-base);
  display: inline-block;
  text-align: center;
  margin-left: 2px;
  border: 1px solid var(--v-primary-base);
}

@function map-deep-get($map, $keys...) {
  @each $key in $keys {
    $map: map-get($map, $key);
  }
  @return $map;
}

::v-deep {
  table th {
    height: auto !important;

    .v-input__control {
      height: auto !important;
    }
  }

  .card-title {
    color: var(--secondary-color);
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
