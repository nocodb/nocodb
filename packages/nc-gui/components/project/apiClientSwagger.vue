<!-- eslint-disable -->
<template>
  <v-container fluid class="api-client grid-list-xs pa-0 " style="height: 100%;">
    <splitpanes style="height:100%;" class="xc-theme">
      <pane min-size="20" max-size="50" size="30" style="overflow: auto">
        <!--        <p class="body-2 my-1 text-center grey&#45;&#45;text text&#45;&#45;lighten-1" v-show="!isDashboard">-->
        <!--          {..} REST API CLIENT</p>-->
        <v-row class="pa-0 ma-0 pa-2 pl-2">
          <div class=" cursor-pointer d-flex" style="width: 100%">
            <x-icon
              v-ge="['api-client','open-new-collection']"
              icon-class="mr-1 cursor-pointer"
              small
              color="primary"
              tooltip="Create New API Collection"
              @click="openNewCollection('/')"
            >
              mdi-folder-plus-outline
            </x-icon>

            <!--            <x-icon class="mr-1" color="primary" tooltip="Open API Collection" @click="openApiFileCollection">-->
            <!--              mdi-folder-open-outline-->
            <!--            </x-icon>-->
            <v-dialog v-model="importCollection.modal" persistent max-width="550">
              <template #activator="{ on }">
                <v-icon color="" v-on="on">
                  mdi-import
                </v-icon>
              </template>
              <v-card class="pa-3" style="position: relative">
                <v-icon
                  v-ge="['api-client','open-new-collection-close']"
                  style="position: absolute;right:20px; top:20px;"
                  @click="importCollection.modal = false"
                >
                  mdi-close
                </v-icon>

                <v-card-title class="headline justify-center mb-2">
                  Import
                </v-card-title>
                <v-card-subtitle class="text-center">
                  (JSON Format Only)
                </v-card-subtitle>

                <div style="" class="py-3">
                  <v-card-text>
                    <v-select
                      v-model="importCollection.type"
                      dense
                      hide-details
                      outlined
                      :items="importCollection.types"
                      filled
                      label="API Specification"
                    />
                  </v-card-text>
                  <v-card-actions>
                    <v-tabs background-color="indigo accent-4" dark style="border: 1px solid indigo ; margin:0 10px">
                      <v-tab>FILE</v-tab>
                      <v-tab :disabled="!isSwaggerImport">
                        URL
                      </v-tab>
                      <v-tab :disabled="!isSwaggerImport">
                        JSON
                      </v-tab>
                      <v-tab-item>
                        <div class="px-2 py-10 text-center" style="min-height: 250px;">
                          <v-row>
                            <v-col>
                              <v-text-field
                                v-model="importCollection.file.srcFilePath"
                                hide-details
                                label="Select file"
                                dense
                                outlined
                              >
                                <template #append>
                                  <v-btn v-ge="['api-client','select-import-file']" small @click="selectImportFile()">
                                    Choose File ...
                                  </v-btn>
                                </template>
                              </v-text-field>
                            </v-col>
                          </v-row>

                          <v-row v-show="isSwaggerImport">
                            <v-col>
                              <v-text-field
                                v-model="importCollection.file.dstFilePath"
                                hide-details
                                label="Destination file path"
                                dense
                                outlined
                                hide-details
                              />
                            </v-col>
                          </v-row>

                          <v-btn
                            v-ge="['api-client','import-collection']"
                            class="mt-4"
                            color="primary"
                            @click="importFile(importCollection.type,importCollection.file.srcFilePath,importCollection.file.dstFilePath)"
                          >
                            Import
                          </v-btn>
                        </div>
                      </v-tab-item>
                      <v-tab-item>
                        <div style="min-height: 250px;" class="text-center">
                          <div class="px-2 pt-10 ">
                            <v-text-field v-model="importCollection.url" placeholder="Enter url" />
                          </div>

                          <v-btn
                            v-ge="['api-client','import-collection-from-url']"
                            color="primary"
                            @click="importFromUrl(importCollection.type,importCollection.url)"
                          >
                            Import
                          </v-btn>
                        </div>
                      </v-tab-item>
                      <v-tab-item>
                        <div style="min-height: 250px;" class="text-center">
                          <div class="px-2  pt-2 ">
                            <v-textarea
                              v-model="importCollection.text"
                              placeholder="Enter JSON String"
                            />
                          </div>
                          <v-btn
                            v-ge="['api-client','import-collection-from-text']"
                            color="primary"
                            @click="importFromText(importCollection.type,importCollection.text)"
                          >
                            Import
                          </v-btn>
                        </div>
                      </v-tab-item>
                    </v-tabs>
                  </v-card-actions>
                </div>
              </v-card>
            </v-dialog>
            <v-spacer />
            <span v-show="!isDashboard" class="flex-shrink-1 body-2 my-1 text-center grey--text">
              {..} REST API CLIENT ( is in <v-icon small color="warning">mdi-alpha</v-icon>)</span>

            <span v-show="isDashboard" class="caption float-right warning--text mt-1" style="font-style: italic">
              API Client is in<v-icon small color="warning">mdi-alpha</v-icon>
            </span>
          </div>
        </v-row>
        <v-divider />

        <v-tabs v-model="apiRootTab" height="32" style="border-top:1px solid darkgrey">
          <v-tab style="text-transform: none">
            History
          </v-tab>
          <v-tab style="text-transform: none">
            Collections
          </v-tab>

          <v-tab-item style="border-top: 1px solid grey">
            <div class="apis-list">
              <div v-for="(api,i) in historyList" :key="i" class="pa-0 ma-0 ">
                <v-list-item v-ge="['api-client','history']" dense two-line @click="apiClickedOnHistoryList(api)">
                  <v-hover v-slot="{ hover }">
                    <v-list-item-content>
                      <v-list-item-title class="grey--text">
                        <v-btn
                          class="pl-0 ml-0"
                          small
                          text
                          :tooltip="api.meta.path"
                          :color="apiMethodMeta[api.meta.method.toUpperCase()].color"
                        >
                          <b>
                            <v-icon
                              class="mx-0 ml-n2"
                              :class="{
                                'white--text': !api.meta.response || !api.meta.response.status,
                                'red--text': api.meta.response && api.meta.response.status >= 400,
                                'green--text':api.meta.response && api.meta.response.status < 400
                              }"
                            >
                              mdi-circle-small
                            </v-icon>
                            {{ api.meta.method }} </b>
                        </v-btn>

                        {{ api.meta.path }}
                      </v-list-item-title>
                      <v-list-item-subtitle v-show="!i || hover" class="text-right">
                        <span v-show="!i && !hover" class="grey--text text--darken-1 caption">(Last invoked API) </span>

                        <v-icon v-if="_isDev" v-ge="['api-client','node-info']" small @click.stop="showNodeInfo(api)">
                          mdi-information
                        </v-icon>
                        <v-btn
                          v-show="hover"
                          v-ge="['api-client','delete-list']"
                          small
                          text
                          class=" "
                          @click="apiDeleteFromList(i)"
                        >
                          <v-icon small>
                            mdi-delete
                          </v-icon>
                        </v-btn>
                      </v-list-item-subtitle>
                    </v-list-item-content>
                  </v-hover>
                </v-list-item>
                <v-divider />
              </div>
            </div>
          </v-tab-item>
          <v-tab-item style="border-top: 1px solid grey">
            <v-expansion-panels v-model="curApiCollectionPanel" accordion focusable>
              <v-expansion-panel
                v-for="(apiTv,i) in apiTvs"
                :key="i"
              >
                <v-expansion-panel-header hide-actions>
                  <template #default="{open}">
                    <div class="d-flex">
                      <v-icon color="">
                        {{ open ? 'mdi-menu-down' : 'mdi-menu-right' }}
                      </v-icon>
                      <v-icon small color="grey" class="ml-1 mr-2">
                        mdi-folder
                      </v-icon>

                      <span
                        class="body-2 flex-grow-1"
                      >{{ $store.getters['apiClientSwagger/GtrCurrentApiFilePaths'][i].fileName }}</span>

                      <x-icon
                        color="white grey"
                        class="float-right mr-3"
                        small
                        @click="showCtxMenu[i]=true,x = $event.clientX,y = $event.clientY"
                        @click.stop=""
                      >
                        mdi-dots-horizontal
                      </x-icon>

                      <recursive-menu
                        v-model="showCtxMenu[i]"
                        v-ge="['api-client','collection-context-menu']"
                        :position-x="x"
                        :position-y="y"
                        :items="{
                          'Add Folder':'add-folder',
                          'Add Request':'add-request',
                          'Reveal in Folder':'reveal-in-folder',
                          'Delete Collection':'delete-collection',
                          'Refresh Collection' : 'refresh-collection'
                        }"
                        @click="ctxMenuClickHandler($event,i)"
                      />
                    </div>
                  </template>
                </v-expansion-panel-header>
                <v-expansion-panel-content class="expansion-wrap-0 pl-4">
                  <vue-tree-list
                    v-if="apiTvs[i]"
                    style="cursor: pointer"
                    class="body-2 sql-query-treeview px-1 pt-2 api-treeview"
                    :model="apiTv"
                    default-tree-node-name="new node"
                    default-leaf-node-name="new leaf"
                    :default-expanded="false"
                    @click="tvNodeOnClick"
                    @change-name="tvNodeRename"
                    @delete-node="tvNodeDelete"
                    @add-node="onAddNode"
                  >
                    <span slot="leafNodeIcon" />
                    <v-icon slot="treeNodeIcon" small color="grey" class="mr-1">
                      mdi-folder-star
                    </v-icon>

                    <v-icon slot="addTreeNode" small>
                      mdi-folder-plus
                    </v-icon>
                    <v-icon slot="addLeafNode" small>
                      mdi-file-plus
                    </v-icon>
                    <v-icon slot="editNode" small class="mt-n1">
                      mdi-file-edit
                    </v-icon>
                    <v-icon slot="delNode" small>
                      mdi-delete
                    </v-icon>
                    <template #label="{item:api}">
                      <div
                        v-if="api.isLeaf"
                        class="d-flex pa-1 ma-n1"
                        style="width: 100%"
                        :style="
                          api.id === currentApi.id && !currentApi.meta.history ? 'background:rgb(240, 240, 240)' :''
                        "
                      >
                        <!--                    <v-icon class="mx-0"-->
                        <!--                            :class="`${apiMeta[api.method].color}&#45;&#45;text`"-->
                        <!--                            small>-->
                        <!--                              mdi-bookmark-outline-->
                        <!--                            </v-icon>-->
                        <span
                          style="display: inline-block;min-width: 45px;"
                          :class=" apiMethodMeta[api.meta.method.toUpperCase()] ? `${apiMethodMeta[api.meta.method.toUpperCase()].color}--text` : ''"
                        >
                          {{ api.meta.method.toUpperCase() === 'DELETE' ? 'DEL' : api.meta.method.toUpperCase() }} </span>

                        <span
                          class="grey--text d-block text--darken-1"
                          style="text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;"
                        >{{ api.name }}</span>
                        <v-spacer />
                        <v-icon v-if="_isDev" v-ge="['api-client','node-info']" small @click.stop="showNodeInfo(api)">
                          mdi-information
                        </v-icon>
                      </div>
                      <div
                        v-else
                        class="d-flex"
                        style="width: 100%;text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;"
                      >
                        <span>{{ api.name }}</span>

                        <v-spacer />
                        <v-icon v-if="_isDev" v-ge="['api-client','node-info']" small @click.stop="showNodeInfo(api)">
                          mdi-information
                        </v-icon>
                      </div>
                    </template>
                  </vue-tree-list>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-tab-item>
        </v-tabs>
      </pane>
      <pane min-size="10" size="70" style="overflow: auto">
        <v-toolbar
          class=" toolbar-border-bottom  elevation-0 d-flex req-inputs"
          height="55"
          style="position: relative;z-index:2;width: 100%"
        >
          <v-select
            v-model="api.method"
            v-ge="['api-client','method']"
            :items="Object.keys(apiMethodMeta)"
            dense
            solo
            hide-details
            outlined
            class="body-2"
            style="max-width:130px;border-bottom-right-radius: 0;border-top-right-radius: 0;border-right: 1px solid grey"
          />

          <xAutoComplete
            v-model="api.path"
            outlined
            class="flex-grow-1"
            :env="selectedEnv"
            placeholder="Enter HTTP URL"
            solo
            dense
            hide-details
            autofocus
            styles="border-bottom-left-radius: 0;border-top-left-radius:0 "
          />

          <x-btn
            v-ge="['api-client','api-send']"
            btn.class="primary"
            dense
            tooltip="Send Request"
            @click.prevent="apiSend()"
          >
            <v-icon v-if="isPerfFilled" small class="ml-n3">
              mdi-truck-fast
            </v-icon>
            <v-icon v-else small class="ml-n3">
              mdi-send
            </v-icon>
            &nbsp;SEND
          </x-btn>
          <x-btn
            v-ge="['api-client','save']"
            btn.class="outlined"
            dense
            :icon="api.history ? 'save' : 'mdi-content-save-edit'"
            tooltip="Save API"
            @click.prevent="saveOrUpdateApi(api)"
          />
          <x-btn
            v-ge="['api-client','environment']"
            icon="mdi-eye-outline"
            tooltip="Environments"
            @click="environmentDialog = true"
          />
        </v-toolbar>

        <splitpanes horizontal style="height:calc(100% - 64px)" class="xc-theme">
          <pane min-size="25" size="50" style="overflow: auto;" class="pa-1">
            <v-tabs
              class="req-tabs"
              height="24"
            >
              <v-tab v-ge="['api-client','params']" class="caption">
                Params&nbsp;<b
                  v-if="paramsCount"
                  class="green--text"
                >({{ paramsCount }})</b>
              </v-tab>
              <v-tab v-ge="['api-client','headers']" class="caption">
                Headers&nbsp;<b
                  v-if="headersCount"
                  class="green--text"
                >({{
                  headersCount
                }})</b>
              </v-tab>
              <v-tab v-ge="['api-client','body']" class="caption">
                Body
              </v-tab>
              <v-tab v-ge="['api-client','auth']" class="caption">
                Auth
              </v-tab>
              <v-tab v-ge="['api-client','perf-test']" class="caption">
                Perf Test
              </v-tab>
              <div class="flex-grow-1 d-flex text-right pr-4 justify-end ">
                <div class="flex-shrink-1 ">
                  <v-select
                    v-model="selectedEnv"
                    height="19"
                    class="caption envs"
                    dense
                    :items="environmentList"
                    placeholder="Environment"
                    single-line
                  >
                    <template #selection="{item}">
                      <span
                        style="text-transform: uppercase"
                      >{{ item }}</span>&nbsp; <span class="grey--text">(env)</span>
                    </template>
                  </v-select>
                </div>
              </div>
              <!--              <div class="flex-grow-1 text-right pr-4 caption" v-if="api.response">-->
              <!--                &lt;!&ndash;                <x-icon iconClass="mr-4"  v-if="$store.getters['project/GtrProjectJson']" @click="environmentDialog = true" tooltip="Environments">&ndash;&gt;-->
              <!--                &lt;!&ndash;                  mdi-eye-outline&ndash;&gt;-->
              <!--                &lt;!&ndash;                </x-icon>&ndash;&gt;-->
              <!--              </div>-->
              <v-tab-item>
                <params
                  v-model="api.parameters"
                  :env.sync="selectedEnv"
                />
              </v-tab-item>
              <v-tab-item>
                <headers
                  v-model="api.headers"
                  :env.sync="selectedEnv"
                />
              </v-tab-item>
              <v-tab-item>
                <monaco-json-editor
                  v-model="api.body"
                  style="height: 250px"
                  class="editor card"
                  theme="vs-dark"
                  lang="json"
                  :options="{validate:true,documentFormattingEdits:true,foldingRanges:true}"
                />
              </v-tab-item>
              <v-tab-item>
                <!--                <monaco-editor-->
                <!--                  :code.sync="api.auth"-->
                <!--                  cssStyle="height:250px"></monaco-editor>-->
              </v-tab-item>

              <v-tab-item>
                <perf-test v-model="api.perf" />
              </v-tab-item>
            </v-tabs>
          </pane>
          <pane min-size="25" size="50" style="overflow: auto" class="pa-1">
            <!--            <h3 class="mb-2 grey&#45;&#45;text lighten-1">-->
            <!--              Response Body :-->
            <!--              <div v-if="api.response">-->
            <!--                <span v-if="api.response.status === 200" class="green&#45;&#45;text">{{api.response.status}}</span>-->
            <!--                <span v-if="api.response.status !== 200" class="red&#45;&#45;text">{{api.response.status}}</span>-->
            <!--              </div>-->
            <!--            </h3>-->

            <v-tabs
              v-if="api.response"
              height="24"
            >
              <v-tab v-ge="['api-client','response-body']" class="caption">
                Body
              </v-tab>
              <v-tab v-ge="['api-client','respomse-headers']" class="caption">
                Headers<span
                  v-if="api.response.headers"
                  class="green--text"
                >( {{ Object.keys(api.response.headers).length }} )</span>
              </v-tab>
              <div v-if="api.response" class="flex-grow-1 text-right pr-4 caption">
                <template v-if="api.response.status">
                  <span class="grey--text">Status:</span><span
                    :class="{
                      'green--text' : api.response.status === 200 ,
                      'red--text' : api.response.status !== 200
                    }"
                  ><b>{{ api.response.status }}</b></span>
                </template>
                &nbsp;
                &nbsp;
                <template v-if="api.timeTaken">
                  <span class="grey--text">Time:</span><span
                    class="green--text"
                  ><b>{{ api.timeTaken }}ms</b></span>
                </template>
              </div>
              <v-tab-item>
                <pre
                  v-if="api.response"
                  class="black pa-1 grey--text w-100 caption"
                  style="overflow-x: auto;min-height:100px;overflow-y:auto;min-width: 100%"
                >{{ api.response.data }}</pre>

                <!--                <pre v-if="api.response" class="black pa-1" style="overflow-x: auto;min-height:50px;overflow-y:auto">{{api.response.data}}</pre>-->
              </v-tab-item>
              <v-tab-item>
                <pre
                  v-if="api.response"
                  class="black pa-1 grey--text w-100 caption"
                  style="overflow-x: auto;min-height:100px;overflow-y:auto;min-width: 100%"
                >{{ api.response.headers }}</pre>
              </v-tab-item>
            </v-tabs>
          </pane>
        </splitpanes>
      </pane>
    </splitpanes>
    <environment v-model="environmentDialog" env="_noco" />

    <v-dialog v-model="bookmarkApiDialog" max-width="500">
      <v-card>
        <v-card-title class="justify-center">
          Bookmark API
        </v-card-title>

        <v-card-text>
          <div class="text-right">
            <v-btn
              v-ge="['api-client','open-new-collection']"
              small
              color="primary"
              outlined
              @click="openNewCollection('/')"
            >
              <v-icon small>
                mdi-plus
              </v-icon> &nbsp;New Collection
            </v-btn>
          </div>
          <v-list dense>
            <v-list-item-group v-model="choosenApiCollection">
              <v-list-item
                v-for="(item,i) in $store.getters['apiClientSwagger/GtrCurrentApiFilePaths']"
                :key="i"
                :value="i"
                style="border: 1px solid grey"
              >
                <v-list-item-title>{{ item.fileName }}</v-list-item-title>
              </v-list-item>
            </v-list-item-group>
          </v-list>
        </v-card-text>
        <v-card-actions class="justify-center pb-5">
          <v-btn v-ge="['api-client','bookmark']" small @click="bookmarkApiDialog = false">
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn
            small
            color="primary"
            :disabled="choosenApiCollection === null || choosenApiCollection === undefined"
            @click="bookmarkApi(choosenApiCollection)"
          >
            Save API
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
<script>
/* eslint-disable */

import { mapGetters } from 'vuex'

import Vue from 'vue'

import { VueTreeList, Tree, TreeNode } from 'vue-tree-list'
import { Splitpanes, Pane } from 'splitpanes'
import params from '../apiClient/params'
import headers from '../apiClient/headers'

import { MonacoJsonEditor } from '../monaco/index'

import environment from '../environment'
import PerfTest from '../apiClient/perfTest'

// const {app, dialog, path, fs, shell, XcApis} = require("electron").remote.require(
//   "./libs"
// );

import * as XcApiHelp from '../../helpers/XcApiHelp'

// const {config} = require('electron').remote.require('./libs');

export default {
  components: {
    PerfTest,
    MonacoJsonEditor,
    VueTreeList,
    Splitpanes,
    Pane,
    params,
    headers,
    environment
  },
  data () {
    return {
      choosenApiCollection: null,
      bookmarkApiDialog: false,
      apiRootTab: 0,
      importCollection: {
        modal: false,
        type: 'Swagger 3.0',
        types: [{
          text: 'Swagger 3.0',
          value: 'Swagger 3.0'
        }, {
          text: 'XC',
          value: 'XC'
        }],
        file: {
          srcFilePath: '',
          dstFilePath: ''
        }
      },
      fileHistory: null,
      historyList: [],
      environmentDialog: false,
      showCtxMenu: {},
      apiTvs: [],
      apiFilePaths: [],
      apiFileCollections: [],
      curApiCollectionPanel: null,

      x: 0,
      y: 0,

      apiMethodMeta: {
        GET: {
          color: 'success'
        },
        POST: {
          color: 'warning'
        },
        DELETE: {
          color: 'error'
        },
        PUT: {
          color: 'info'
        },
        HEAD: {
          color: 'info'
        },
        PATCH: {
          color: 'info'
        }
      },

      // current api
      api: {
        method: 'GET',
        path: '',
        body: '',
        params: [],
        auth: '',
        headers: [],
        response: {},
        perf: {},
        meta: {}
      },
      currentApi: {},
      currentNode: null

    }
  },
  computed: {
    isPerfFilled () {
      return this.api.perf && Object.values(this.api.perf).some(v => v)
    },
    ...mapGetters({
      sqlMgr: 'sqlMgr/sqlMgr',
      currentProjectFolder: 'project/currentProjectFolder',
      projectApisFolderPath: 'project/projectApisFolderPath',
      projectApisFolder: 'project/projectApisFolder'
    }),
    isSwaggerImport () {
      return this.importCollection.type === 'Swagger 3.0'
    },
    paramsCount () {
      return this.api.parameters && this.api.parameters.filter(p => p.name && p.enabled).length
    },
    headersCount () {
      return this.api.headers && this.api.headers.filter(h => h.name && h.enabled).length
    },
    environmentList () {
      if (this.isDashboard) {
        return Object.keys(this.$store.getters['project/GtrApiEnvironment'])
      } else {
        return Object.keys(this.$store.getters['project/GtrDefaultApiEnvironment'])
      }
    },
    selectedEnv: {
      get () {
        return this.$store.state.apiClientSwagger.activeEnvironment[this.$store.state.apiClientSwagger.currentProjectKey] || this.environmentList[0]
      },
      set (env) {
        this.$store.commit('apiClientSwagger/MutActiveEnvironment', { env })
      }
    }
  },
  watch: {
    async historyList (newData) {
      await this.fileHistory.write({
        path: config.electron.apiHistoryPath,
        data: newData
      })
    }
  },

  async created () {
    try {
      /* load history collection - default path is within app directory */
      await this.loadHistoryFile()

      if (this.$route.params && this.$route.params.project) {
        /* get collection paths previously opened for this project */
        this.$store.dispatch('apiClientSwagger/loadApiCollectionForProject', {
          projectId: this.$route.params.project,
          projectName: this.$store.getters['project/GtrProjectName']
        })
      } else {
        /* get collection paths previously opened */
        this.$store.dispatch('apiClientSwagger/loadApiCollectionForProject', {})
      }

      /* load the filecollection json as treeviews */
      for (let i = 0; i < this.$store.getters['apiClientSwagger/GtrCurrentApiFilePaths'].length; ++i) {
        await this.loadFileCollection(this.$store.getters['apiClientSwagger/GtrCurrentApiFilePaths'][i])
      }

    } catch (e) {
      console.log('Failed to load previously opened query collections', e)
    }

    if (this.nodes && this.nodes.url) {
      Vue.set(this.api, 'method', 'GET')
      this.api.path = this.nodes.url
    }

    this.api.meta = {}

    try {
      const info = (await this.$axios.get('/nc/projectApiInfo', {
        headers: {
          'xc-auth': this.$store.state.users.token
        }
      })).data
      const rest = Object.values(info).find(v => v.apiUrl)
      if (rest) {
        Vue.set(this.api, 'method', 'GET')
        Vue.set(this.api, 'path', rest.apiUrl)
      }
    } catch (e) { }
  },
  mounted () {
  },
  beforeDestroy () {
  },
  methods: {

    showNodeInfo (api) {
      console.log('Node info : ', api)
    },
    async handleKeyDown ({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([metaKey, key].join('_')) {
        case 'true_s' :
          await this.bookmarkApi()
          break
        case 'true_e' :
          this.environmentDialog = true
          break
        // case 'true_n' :
        //   this.addColumn();
        //   break;
        case 'true_d' :
          await this.deleteProcedure('showDialog')
          break
        case 'true_Enter' :
          await this.apiSend()
          break
      }
    },

    async openCollectionFolder (pathString) {
      shell.showItemInFolder(pathString)
    },
    async openNewCollection () {
      try {
        const toLocalPath = this.isDashboard ? path.join(this.currentProjectFolder, 'server', 'tool', this.projectApisFolder) : ''

        const userChosenPath = dialog.showSaveDialog({
          defaultPath: toLocalPath,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })

        if (userChosenPath) {
          fs.writeFileSync(userChosenPath, '[]', 'utf-8')
          const pathObj = {
            path: userChosenPath,
            fileName: path.basename(userChosenPath)
          }
          this.$store.commit('apiClientSwagger/MutApiFilePathsAdd', pathObj)
          await this.loadFileCollection(pathObj)
        }
        this.$toast.success('New API collection loaded successfully').goAway(5000)
      } catch (e) {
        console.log(e)
        throw e
      }
    },
    async openSwaggerJSONFile (srcPath, dstPath) {
      const dstFileName = path.basename(dstPath)
      await XC.importSwaggerJson({
        srcPath,
        dstPath
      })
      const pathObj = {
        path: dstPath,
        fileName: dstFileName
      }
      this.$store.commit('apiClientSwagger/MutApiFilePathsAdd', pathObj)
      await this.loadFileCollection(pathObj)
    },
    selectImportFile () {
      const file = dialog.showOpenDialog({
        properties: ['openFile']
      })

      const dstFileName = `${path.basename(file[0], '.json')}.xc.json`

      let dstPath = ''
      if (this.isDashboard) {
        dstPath = this.projectApisFolderPath
      } else {
        dstPath = path.dirname(config.electron.apiHistoryPath)
      }

      if (file && file[0]) {
        this.$set(this.importCollection.file, 'srcFilePath', file[0] + '')
        this.$set(this.importCollection.file, 'dstFilePath', path.join(dstPath, dstFileName))
      }
    },
    async importFile (type, srcPath, dstPath) {
      this.apiRootTab = 1
      this.$set(this.importCollection, 'modal', false)
      try {
        if (type === 'Swagger 3.0') {
          await this.openSwaggerJSONFile(srcPath, dstPath)
        } else {
          await this.openApiFileCollection(srcPath, dstPath)
        }
        this.$toast.success('File imported successfully').goAway(3000)
      } catch (e) {
        console.log('File import error : ', e)
        this.$toast.error('File importing failed').goAway(3000)
      }
    },
    async importFromUrl (type, url) {
      this.apiRootTab = 1
      this.$set(this.importCollection, 'modal', false)
      try {
        if (type === 'Swagger 3.0') {
          await this.importSwaggerFromUrl(url)
        } else {
          await this.importXcFromUrl(url)
        }
        this.$toast.success('Import from URL completed successfully').goAway(3000)
      } catch (e) {
        console.log('URL import error : ', e)
        this.$toast.error('Import from URL failed').goAway(3000)
      }
    },
    async importFromText (type, text) {
      this.apiRootTab = 1
      this.$set(this.importCollection, 'modal', false)
      try {
        if (type === 'Swagger 3.0') {
          await this.importSwaggerFromText(text)
        } else {
          await this.importXcFromText(text)
        }
        this.$toast.success('Import from Text completed successfully').goAway(3000)
      } catch (e) {
        console.log('Text import error : ', e)
        this.$toast.error('Import from Text failed').goAway(3000)
      }
    },

    async importSwaggerFromUrl (url) {
      const data = await this.$axios.$get(url)

      const dstFileName = `${Date.now()}.xc.json`

      let dstPath = ''
      if (this.isDashboard) {
        dstPath = this.projectApisFolderPath
      } else {
        dstPath = path.dirname(config.electron.apiHistoryPath)
      }

      await XC.importSwaggerObject({
        swagger: data,
        dstPath: path.join(dstPath, dstFileName)
      })

      const pathObj = {
        path: path.join(dstPath, dstFileName),
        fileName: dstFileName
      }

      this.$store.commit('apiClientSwagger/MutApiFilePathsAdd', pathObj)
      await this.loadFileCollection(pathObj)
    },
    async importSwaggerFromText (text) {
      const data = JSON.parse(text)

      const dstFileName = `${Date.now()}.xc.json`

      let dstPath = ''
      if (this.isDashboard) {
        dstPath = this.projectApisFolderPath
      } else {
        dstPath = path.dirname(config.electron.apiHistoryPath)
      }

      await XC.importSwaggerObject({
        swagger: data,
        dstPath: path.join(dstPath, dstFileName)
      })

      const pathObj = {
        path: path.join(dstPath, dstFileName),
        fileName: dstFileName
      }

      this.$store.commit('apiClientSwagger/MutApiFilePathsAdd', pathObj)
      await this.loadFileCollection(pathObj)

      this.$toast.success('Import from Text completed successfully').goAway(3000)
    },
    async importXcFromUrl (url) {
      const data = await this.$axios.$get(url)

      const dstFileName = `${Date.now()}.xc.json`

      let dstPath = ''
      if (this.isDashboard) {
        dstPath = this.projectApisFolderPath
      } else {
        dstPath = path.dirname(config.electron.apiHistoryPath)
      }

      // await XcApis.importSwaggerObject({
      //   swagger: data,
      //   dstPath: path.join(dstPath, dstFileName)
      // })

      const pathObj = {
        path: path.join(dstPath, dstFileName),
        fileName: dstFileName
      }

      this.$store.commit('apiClientSwagger/MutApiFilePathsAdd', pathObj)
      await this.loadFileCollection(pathObj)
    },
    async importXcFromText (text) {
      const data = JSON.parse(text)

      const dstFileName = `${Date.now()}.xc.json`

      let dstPath = ''
      if (this.isDashboard) {
        dstPath = this.projectApisFolderPath
      } else {
        dstPath = path.dirname(config.electron.apiHistoryPath)
      }
      //
      // await XcApis.importSwaggerObject({
      //   swagger: data,
      //   dstPath: path.join(dstPath, dstFileName)
      // })

      const pathObj = {
        path: path.join(dstPath, dstFileName),
        fileName: dstFileName
      }

      this.$store.commit('apiClientSwagger/MutApiFilePathsAdd', pathObj)
      await this.loadFileCollection(pathObj)

      this.$toast.success('Import from Text completed successfully').goAway(3000)
    },

    async ctxMenuClickHandler (actionEvent, index) {
      switch (actionEvent.value) {
        case 'add-folder':
          this.tvNodeFolderAdd(index)
          break
        case 'add-request':
          this.curApiCollectionPanel = index
          this.tvNodeRequestAdd(index)
          break
        case 'reveal-in-folder':
          await this.openCollectionFolder(this.$store.getters['apiClientSwagger/GtrCurrentApiFilePaths'][index].path)
          break
        case 'delete-collection':
          this.$store.commit('apiClientSwagger/MutApiFilePathsRemove', index)
          this.apiFileCollections.splice(index, 1)
          this.apiTvs.splice(index, 1)
          break
        case 'refresh-collection':
          await this.refreshFileCollection(index)
          break
        default:
          break
      }
      // this.deleteQueryByPath(this.apiTvs, this.menuItem.path);
    },
    openUrl (url) {
      shell.openExternal(url)
    },

    apiClickedOnList (api) {
      if (api.isLeaf) {
        api = XcApiHelp.apiPrepareForInvocation(api)

        this.currentApi = JSON.parse(JSON.stringify(api))
        this.api = {
          perf: {},
          ...this.currentApi.meta
        }
      }
    },

    apiClickedOnHistoryList (api) {
      this.currentApi = JSON.parse(JSON.stringify(api))
      this.api = {
        perf: {},
        ...api.meta,
        history: true,
        isLeaf: true
      }
    },

    apiDeleteFromList (index) {
      this.$store.commit('apiClientSwagger/MutListRemove', index)
    },

    async apiSend () {
      if (!this.api.path.trim()) {
        this.$toast.info('Please enter http url').goAway(3000)
        return
      }

      const envs = this.isDashboard
        ? this.$store.getters['project/GtrApiEnvironment'][this.selectedEnv]
        : this.$store.getters['project/GtrDefaultApiEnvironment'][this.selectedEnv]

      const apiDecoded = JSON.parse(
        JSON.stringify(this.api).replace(/{{\s*(\w+)\s*}}/g, (m, m1) => {
          if (m1 in envs) {
            return envs[m1]
          } else {
            this.$toast.info('Environment variable is not found : ' + m1).goAway(3000)
            return m
          }
        })
      )

      const swaggerResult = await this.$store.dispatch('apiClientSwagger/send', { api: this.api, apiDecoded })

      this.historyList = [{ ...this.currentApi, meta: swaggerResult, pid: 0 }, ...this.historyList]

      const result = swaggerResult.response
      this.api = swaggerResult

      if (result) {
        if (result.status === 200) {
          // this.$toast.success('API invoked successfully',{duration:1000});
        } else {
          this.$toast.error(`Error:${result.status}`, { duration: 1000 })
        }
      } else {
        this.$toast.error('Some internal error occurred', { duration: 1000 })
      }
    },

    async fileCollectionReload () {
      const data = new Tree(await this.apiFileCollection.read())

      this.apiTv = data
      // this.$set(this, 'apiCollections', data);
    },

    async tvNodeDelete (node) {
      console.log(node, this.curApiCollectionPanel)
      node.remove()
      await this.savefileCollections(this.curApiCollectionPanel)
    },

    async tvNodeRename (params) {
      await this.savefileCollections(this.curApiCollectionPanel)
    },

    async onAddNode (params) {
      await this.savefileCollections(this.curApiCollectionPanel)
    },

    async tvNodeOnClick (node) {
      const { parent, children, ...params } = node
      this.currentNode = node

      this.apiClickedOnList(params)
      // if (params.query) ;
      // this.selectQuery(params)
    },

    async savefileCollections (index = 0) {
      await this.apiFileCollections[index].write({ data: this.tvToObject(index) })
      // this.apiTvs = await this.fileCollections.read();
      // this.$set(this.apiTvs, index, this.apiTvs);
    },

    tvToObject (index) {
      try {
        const vm = this

        function _dfs (oldNode) {
          const newNode = {}

          XcApiHelp.nodeHandleIfNew(oldNode)

          for (const k in oldNode) {
            if (k !== 'children' && k !== 'parent') {
              newNode[k] = oldNode[k]
            }
          }

          if (oldNode.children && oldNode.children.length > 0) {
            newNode.children = []
            for (let i = 0, len = oldNode.children.length; i < len; i++) {
              newNode.children.push(_dfs(oldNode.children[i]))
            }
          }

          return newNode
        }

        return _dfs(vm.apiTvs[index]).children
      } catch (e) {
        this.$toast.error('Error while parsing api collection').goAway(3000)
      }
    },

    async tvNodeFolderAdd (index) {
      const node = new TreeNode({ name: 'New Folder', isLeaf: false, children: [] })
      if (!this.apiTvs[index].children) { this.apiTvs[index].children = [] }
      this.apiTvs[index].addChildren(node)

      await this.saveFileCollection(index)
    },
    async tvNodeRequestAdd (index) {
      const node = new TreeNode({ name: 'New Request', isLeaf: true })
      if (!this.apiTvs[index].children) { this.apiTvs[index].children = [] }
      this.apiTvs[index].addChildren(node)

      await this.saveFileCollection(index)
    },

    openApiFileCollection (filePath = null) {
      const vm = this
      // console.log(obj, key);

      const file = filePath
        ? [filePath]
        : dialog.showOpenDialog({
          properties: ['openFile']
        })

      if (file && file[0]) {
        const fileName = path.basename(file[0])
        const pathObj = {
          path: file[0] + '',
          fileName
        }

        if (this.$store.getters['apiClientSwagger/GtrCurrentApiFilePaths'].every(({ path: p }) => p !== pathObj.path)) {
          this.$store.commit('apiClientSwagger/MutApiFilePathsAdd', pathObj)
          this.loadFileCollection(pathObj)
        } else {
          this.$toast.info('File already exist in collection').goAway(4000)
        }
      }
    },

    async saveFileCollection (index = 0) {
      await this.apiFileCollections[index].write({ data: this.tvToObject(index) })
    },

    async loadFileCollection (path, index = 0) {
      try {
        /* create file collection and get its data */
        const fileCollection = new XC(path)
        await fileCollection.init()
        this.apiFileCollections.push(fileCollection)
        const treeData = await fileCollection.read()

        /* create a tree view and push it */
        const data = new Tree(treeData.length && treeData[0].name === 'swagger.json' ? treeData[0].children : treeData)
        this.apiTvs.push(data)

        this.curApiCollectionPanel = this.apiFileCollections.length - 1
      } catch (e) {
        console.log('Error in loadFileCollection:', e)
        throw e
      }
    },
    async loadHistoryFile () {
      // try {
      //   this.fileHistory = new XcApis({path: config.electron.apiHistoryPath});
      //   this.historyList = await this.fileHistory.read();
      // } catch (e) {
      //   console.log('Error in loadFileHistory:', e);
      //   throw e;
      // }
    },
    async refreshFileCollection (index = 0) {
      try {
        const path = this.$store.getters['apiClientSwagger/GtrCurrentApiFilePaths'][index]
        const fileCollection = new XC(path)
        await fileCollection.init()
        this.apiFileCollections[index] = fileCollection
        const data = new Tree(await fileCollection.read())
        this.$set(this.apiTvs, index, data)
      } catch (e) {
        console.log('Error in loadFileCollection:', e)
        throw e
      }
    },

    async bookmarkApi (panelIndex) {
      this.bookmarkApiDialog = false
      if (this.apiFileCollections.length) {
        delete this.currentApi.meta.history
        const q = this.currentApi
        const node = new TreeNode({
          name: q.meta.path,
          swagger: {},
          isLeaf: true,
          id: Date.now(),
          pid: 0,
          ...q
        })

        if (!this.apiTvs[panelIndex].children) { this.apiTvs[panelIndex].children = [] }
        this.apiTvs[panelIndex].addChildren(node)
        await this.savefileCollections(panelIndex)
        await this.refreshFileCollection(panelIndex)

        this.$toast.success(`API added to ${this.$store.getters['apiClientSwagger/GtrCurrentApiFilePaths'][panelIndex].fileName} collection successfully`).goAway(3000)
      } else {
        this.$toast.info('Create a new collection to bookmark the api.').goAway(3000)
        this.openNewCollection('/')
      }
    },
    async saveOrUpdateApi () {
      if (this.api.history) {
        this.bookmarkApiDialog = true
      } else {
        const q = this.currentApi
        const api = {
          ...q,
          meta: { ...this.api },
          pid: 0
        }
        const activePanelIndex = this.curApiCollectionPanel
        await this.apiFileCollections[activePanelIndex].updateApi({ api })
        await this.refreshFileCollection(activePanelIndex)
        this.$toast.success(`API updated in ${this.$store.getters['apiClientSwagger/GtrCurrentApiFilePaths'][activePanelIndex].fileName} collection successfully`).goAway(3000)
      }
    }

  },

  beforeCreated () {
  },
  destroy () {
  },
  directives: {},
  validate ({ params }) {
    return true
  },
  head () {
    return {}
  },
  props: ['nodes']
}
</script>

<style scoped>

.apis-list {
  height: calc(100%);
  overflow-y: auto;
}

.apis-request {
  overflow-y: auto;
}

/deep/ > .req-inputs .v-toolbar__content {
  width: 100%;
  display: flex;
  padding: 2px;
}

/deep/ .req-tabs > .v-tabs-items {
  border-top: 1px solid #7F828B33;
}

.envs /deep/ .v-select__selections {
  color: var(--v-accent-base)
}

/*.envs /deep/ .v-select__selections input { display: none}*/
code{
  min-height:200px;
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
