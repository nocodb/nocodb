<!-- eslint-disable -->
<template>
  <v-container fluid class="api-client grid-list-xs pa-0" style="height: 100%">
    <splitpanes style="height: 100%" class="xc-theme">
      <pane min-size="20" max-size="50" size="30" style="overflow: auto">
        <v-tabs height="32">
          <v-tab>History</v-tab>
          <v-tab>Collection</v-tab>

          <v-tab-item style="border-top: 1px solid grey">
            <div class="apis-list">
              <div v-for="(api, i) in $store.state.apiClient.list" :key="i" class="pa-0 ma-0">
                <v-list-item dense two-line @click="apiClickedOnList(api)">
                  <v-hover v-slot="{ hover }">
                    <v-list-item-content>
                      <v-list-item-title class="grey--text">
                        <v-btn class="pl-0 ml-0" small text :tooltip="api.url" :color="apiMeta[api.type].color">
                          <b>
                            <v-icon
                              class="mx-0 ml-n2"
                              :class="{
                                'white--text': !api.response || !api.response.status,
                                'red--text': api.response && api.response.status >= 400,
                                'green--text': api.response && api.response.status < 400,
                              }"
                            >
                              mdi-circle-small
                            </v-icon>
                            {{ api.type }}
                          </b>
                        </v-btn>

                        {{ api.url }}
                      </v-list-item-title>
                      <v-list-item-subtitle v-show="!i || hover" class="text-right">
                        <span v-show="!i && !hover" class="grey--text text--darken-1 caption">(Last invoked API)</span>
                        <v-btn v-show="hover" small text class=" " @click="apiDeleteFromList(i)">
                          <v-icon small> mdi-delete </v-icon>
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
            <v-row class="pa-0 ma-0 pa-2 pl-2">
              <div class="primary--text cursor-pointer" @click="openApiFileCollection">
                <x-icon
                  class="mr-1 cursor-pointer"
                  color="primary"
                  tooltip="Create New API Collection"
                  @click="openNewCollection('/')"
                >
                  mdi-folder-plus-outline
                </x-icon>

                <x-icon class="mr-1" color="primary" tooltip="Open API Collection"> mdi-folder-open-outline </x-icon>
              </div>
            </v-row>
            <v-divider />
            <v-expansion-panels v-model="curApiCollectionPanel" accordion focusable>
              <v-expansion-panel v-for="(apiTv, i) in apiTvs" :key="i">
                <v-expansion-panel-header hide-actions>
                  <template #default="{ open }">
                    <div class="d-flex">
                      <v-icon color="">
                        {{ open ? 'mdi-menu-down' : 'mdi-menu-right' }}
                      </v-icon>
                      <v-icon small color="grey" class="ml-1 mr-2"> mdi-folder </v-icon>
                      <span class="body-2 flex-grow-1">{{
                        $store.getters['apiClient/GtrCurrentApiFilePaths'][i].fileName
                      }}</span>

                      <x-icon
                        color="white grey"
                        class="float-right mr-3"
                        small
                        @click="(showCtxMenu[i] = true), (x = $event.clientX), (y = $event.clientY)"
                        @click.stop=""
                      >
                        mdi-dots-horizontal
                      </x-icon>

                      <recursive-menu
                        v-model="showCtxMenu[i]"
                        :position-x="x"
                        :position-y="y"
                        :items="{
                          'Add Folder': 'add-folder',
                          'Reveal in Folder': 'reveal-in-folder',
                          'Delete Collection': 'delete-collection',
                          'Refresh Collection': 'refresh-collection',
                        }"
                        @click="ctxMenuClickHandler($event, i)"
                      />
                    </div>
                  </template>
                </v-expansion-panel-header>
                <v-expansion-panel-content class="expansion-wrap-0">
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
                    <v-icon slot="treeNodeIcon" small color="grey" class="mr-1"> mdi-folder-star </v-icon>

                    <v-icon slot="addTreeNode" small> mdi-folder-plus </v-icon>
                    <v-icon slot="addLeafNode" small> mdi-file-plus </v-icon>
                    <v-icon slot="editNode" small class="mt-n1"> mdi-file-edit </v-icon>
                    <v-icon slot="delNode" small> mdi-delete </v-icon>
                    <template #label="{ item: api }">
                      <div v-if="api.isLeaf" class="d-flex" style="width: 100%">
                        <!--                    <v-icon class="mx-0"-->
                        <!--                            :class="`${apiMeta[api.type].color}&#45;&#45;text`"-->
                        <!--                            small>-->
                        <!--                              mdi-bookmark-outline-->
                        <!--                            </v-icon>-->
                        <b style="display: inline-block; min-width: 45px" :class="`${apiMeta[api.type].color}--text`">
                          {{ api.type === 'DELETE' ? 'DEL' : api.type }}
                        </b>

                        <span
                          class="grey--text d-block"
                          style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap"
                          >{{ api.name }}</span
                        >
                      </div>
                      <div v-else style="width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap">
                        {{ api.name }}
                      </div>
                    </template>
                  </vue-tree-list>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-tab-item>
        </v-tabs>
      </pane>
      <pane min-size="10" size="75" style="overflow: auto">
        <v-toolbar
          class="toolbar-border-bottom elevation-0 d-flex req-inputs"
          height="55"
          style="position: relative; z-index: 2; width: 100%"
        >
          <v-select
            v-model="api.type"
            :items="Object.keys(apiMeta)"
            dense
            solo
            hide-details
            outlined
            class="body-2"
            style="
              max-width: 130px;
              border-bottom-right-radius: 0;
              border-top-right-radius: 0;
              border-right: 1px solid grey;
            "
          />

          <xAutoComplete
            v-model="api.url"
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

          <x-btn btn.class="primary" dense tooltip="Send Request" @click.prevent="apiSend()">
            <v-icon v-if="isPerfFilled" small class="ml-n3"> mdi-truck-fast </v-icon>
            <v-icon v-else small class="ml-n3"> mdi-send </v-icon>
            &nbsp;SEND
          </x-btn>
          <x-btn btn.class="outlined" dense icon="save" tooltip="Save API" @click.prevent="bookmarkApi()" />
          <x-btn
            v-if="$store.getters['project/GtrProjectJson']"
            icon="mdi-eye-outline"
            tooltip="Environments"
            @click="environmentDialog = true"
          />
        </v-toolbar>

        <splitpanes horizontal style="height: calc(100% - 64px)" class="xc-theme">
          <pane min-size="25" size="50" style="overflow: auto" class="pa-1">
            <v-tabs class="req-tabs" height="24">
              <v-tab class="caption">
                Params&nbsp;<b v-if="paramsCount" class="green--text">({{ paramsCount }})</b>
              </v-tab>
              <v-tab class="caption">
                Headers&nbsp;<b v-if="headersCount" class="green--text">({{ headersCount }})</b>
              </v-tab>
              <v-tab class="caption"> Body </v-tab>
              <v-tab class="caption"> Auth </v-tab>
              <v-tab class="caption"> Perf Test </v-tab>
              <div class="flex-grow-1 d-flex text-right pr-4 justify-end">
                <div class="flex-shrink-1">
                  <v-select
                    v-model="selectedEnv"
                    height="19"
                    class="caption envs"
                    dense
                    :items="environmentList"
                    placeholder="Environment"
                    single-line
                  >
                    <template #selection="{ item }">
                      <span style="text-transform: uppercase">{{ item }}</span
                      >&nbsp; <span class="grey--text">(env)</span>
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
                <params v-model="api.params" :env.sync="selectedEnv" />
              </v-tab-item>
              <v-tab-item>
                <headers v-model="api.headers" :env.sync="selectedEnv" />
              </v-tab-item>
              <v-tab-item>
                <monaco-json-editor
                  v-model="api.body"
                  style="height: 250px"
                  class="editor card"
                  theme="vs-dark"
                  lang="json"
                  :options="{ validate: true, documentFormattingEdits: true, foldingRanges: true }"
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

            <v-tabs v-if="api.response" height="24">
              <v-tab class="caption"> Body </v-tab>
              <v-tab class="caption">
                Headers<span v-if="api.response.headers" class="green--text"
                  >( {{ Object.keys(api.response.headers).length }} )</span
                >
              </v-tab>
              <div v-if="api.response" class="flex-grow-1 text-right pr-4 caption">
                <template v-if="api.response.status">
                  <span class="grey--text">Status:</span
                  ><span
                    :class="{
                      'green--text': api.response.status === 200,
                      'red--text': api.response.status !== 200,
                    }"
                    ><b>{{ api.response.status }}</b></span
                  >
                </template>
                &nbsp; &nbsp;
                <template v-if="api.timeTaken">
                  <span class="grey--text">Time:</span
                  ><span class="green--text"
                    ><b>{{ api.timeTaken }}ms</b></span
                  >
                </template>
              </div>
              <v-tab-item>
                <code
                  v-if="api.response"
                  class="black pa-1 grey--text"
                  style="overflow-x: auto; min-height: 50px; overflow-y: auto; min-width: 100%"
                  >{{ api.response.data }}</code
                >

                <!--                <pre v-if="api.response" class="black pa-1" style="overflow-x: auto;min-height:50px;overflow-y:auto">{{api.response.data}}</pre>-->
              </v-tab-item>
              <v-tab-item>
                <code
                  v-if="api.response"
                  class="black pa-1 grey--text"
                  style="overflow-x: auto; min-height: 50px; overflow-y: auto; min-width: 100%"
                  >{{ api.response.headers }}</code
                >
              </v-tab-item>
            </v-tabs>
          </pane>
        </splitpanes>
      </pane>
    </splitpanes>
    <environment v-if="$store.getters['project/GtrProjectJson']" v-model="environmentDialog" env="_noco" />
  </v-container>
</template>
<script>
/* eslint-disable */
import { mapGetters, mapActions } from 'vuex';

import Vue from 'vue';

import { VueTreeList, Tree, TreeNode } from 'vue-tree-list';
import { Splitpanes, Pane } from 'splitpanes';
import params from '../apiClient/Params';
import headers from '../apiClient/Headers';

import { MonacoJsonEditor } from '../monaco/index';

import environment from '../Environment';
import PerfTest from '../apiClient/PerfTest';

// const {app, dialog, path, fs, shell, FileCollection} = require("electron").remote.require(
//   "./libs"
// );

export default {
  components: {
    PerfTest,
    MonacoJsonEditor,
    VueTreeList,
    Splitpanes,
    Pane,
    params,
    headers,
    environment,
  },
  data() {
    return {
      environmentDialog: false,
      showCtxMenu: {},
      apiTvs: [],
      apiFilePaths: [],
      apiFileCollections: [],
      curApiCollectionPanel: null,

      x: 0,
      y: 0,

      apiMeta: {
        GET: {
          color: 'success',
        },
        POST: {
          color: 'warning',
        },
        DELETE: {
          color: 'error',
        },
        PUT: {
          color: 'info',
        },
        HEAD: {
          color: 'info',
        },
        PATCH: {
          color: 'info',
        },
      },

      // current api
      api: {
        type: 'GET',
        url: '',
        body: '',
        params: [],
        auth: '',
        headers: [],
        response: {},
        perf: {},
      },
    };
  },
  computed: {
    isPerfFilled() {
      return this.api.perf && Object.values(this.api.perf).some(v => v);
    },
    ...mapGetters({
      sqlMgr: 'sqlMgr/sqlMgr',
      currentProjectFolder: 'project/currentProjectFolder',
      projectApisFolder: 'project/projectApisFolder',
    }),
    paramsCount() {
      return this.api.params && this.api.params.filter(p => p.name && p.enabled).length;
    },
    headersCount() {
      return this.api.headers && this.api.headers.filter(h => h.name && h.enabled).length;
    },
    environmentList() {
      return Object.keys(this.$store.getters['project/GtrApiEnvironment']);
    },
    selectedEnv: {
      get() {
        return this.$store.state.apiClient.activeEnvironment[this.$route.params.project] || this.environmentList[0];
      },
      set(env) {
        this.$store.commit('apiClient/MutActiveEnvironment', { env, projectId: this.$route.params.project });
      },
    },
  },
  watch: {},
  async created() {
    console.log('ApisList', this.$store.state.apiClient.list);

    this.$store.dispatch('apiClient/loadApiCollectionForProject', {
      projectId: this.$route.params.project,
      projectName: this.$store.getters['project/GtrProjectName'],
    });

    try {
      /* load all files that are were previously opened */
      if (!this.$store.getters['apiClient/GtrCurrentApiFilePaths'].length) {
        const defaultPath = path.join(
          this.currentProjectFolder,
          'server',
          'tool',
          this.projectApisFolder,
          'apis.xc.json'
        );
        this.$store.commit('apiClient/MutApiFilePathsAdd', {
          path: defaultPath,
          fileName: path.basename(defaultPath),
        });
      }

      for (let i = 0; i < this.$store.getters['apiClient/GtrCurrentApiFilePaths'].length; ++i) {
        await this.loadFileCollection(this.$store.getters['apiClient/GtrCurrentApiFilePaths'][i]);
      }
    } catch (e) {
      console.log('Failed to load previously opened query collections', e);
    }

    if (this.nodes.url) {
      Vue.set(this.api, 'type', 'GET');
      this.api.url = this.nodes.url;
    }
    console.log(this.nodes);
  },
  mounted() {},
  beforeDestroy() {},
  methods: {
    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      console.log(metaKey, key, altKey, shiftKey, ctrlKey);
      // cmd + s -> save
      // cmd + l -> reload
      // cmd + n -> new
      // cmd + d -> delete
      // cmd + enter -> send api

      switch ([metaKey, key].join('_')) {
        case 'true_s':
          await this.bookmarkApi();
          break;
        case 'true_e':
          this.environmentDialog = true;
          break;
        // case 'true_n' :
        //   this.addColumn();
        //   break;
        case 'true_d':
          await this.deleteProcedure('showDialog');
          break;
        case 'true_Enter':
          await this.apiSend();
          break;
      }
    },

    async openCollectionFolder(pathString) {
      shell.showItemInFolder(pathString);
    },
    async openNewCollection() {
      try {
        const toLocalPath = path.join(this.currentProjectFolder, 'server', 'tool', this.projectApisFolder);

        const userChosenPath = dialog.showSaveDialog({
          defaultPath: toLocalPath,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });

        if (userChosenPath) {
          console.log(userChosenPath);
          fs.writeFileSync(userChosenPath, '[]', 'utf-8');
          const pathObj = {
            path: userChosenPath,
            fileName: path.basename(userChosenPath),
          };
          this.$store.commit('apiClient/MutApiFilePathsAdd', pathObj);
          await this.loadFileCollection(pathObj);
        }
        this.$toast.success('New API collection loaded successfully').goAway(5000);
      } catch (e) {
        console.log(e);
        throw e;
      }
    },
    async ctxMenuClickHandler(actionEvent, index) {
      console.log(actionEvent, index);
      switch (actionEvent.value) {
        case 'add-folder':
          this.tvNodeFolderAdd(index);
          break;
        case 'reveal-in-folder':
          await this.openCollectionFolder(this.$store.getters['apiClient/GtrCurrentApiFilePaths'][index].path);
          break;
        case 'delete-collection':
          this.$store.commit('apiClient/MutApiFilePathsRemove', index);
          this.apiFileCollections.splice(index, 1);
          this.apiTvs.splice(index, 1);
          break;
        case 'refresh-collection':
          await this.refreshFileCollection(index);
          break;
        default:
          break;
      }
      // this.deleteQueryByPath(this.apiTvs, this.menuItem.path);
    },
    openUrl(url) {
      shell.openExternal(url);
    },

    apiClickedOnList(api) {
      this.api = {
        ...api,
        params: api.params && api.params.map(param => ({ ...param })),
        headers: api.headers && api.headers.map(header => ({ ...header })),
      };
    },

    apiDeleteFromList(index) {
      this.$store.commit('apiClient/MutListRemove', index);
    },

    async apiSend() {
      console.log('apiSend');

      if (!this.api.url.trim()) {
        this.$toast.info('Please enter http url').goAway(3000);
        return;
      }

      const envs = this.$store.getters['project/GtrApiEnvironment'][this.selectedEnv];

      const apiDecoded = JSON.parse(
        JSON.stringify(this.api).replace(/{{\s*(\w+)\s*}}/g, (m, m1) => {
          if (m1 in envs) {
            return envs[m1];
          } else {
            this.$toast.info('Environment variable is not found : ' + m1).goAway(3000);
            return m;
          }
        })
      );

      const result = await this.$store.dispatch('apiClient/send', { api: this.api, apiDecoded });
      this.api.response = result;
      if (result) {
        if (result.status === 200) {
          // this.$toast.success('API invoked successfully',{duration:1000});
        } else {
          this.$toast.error(`Error:${result.status}`, { duration: 1000 });
        }
      } else {
        this.$toast.error('Some internal error occurred', { duration: 1000 });
      }
    },

    async fileCollectionReload() {
      const data = new Tree(await this.apiFileCollection.read());
      console.log(data);

      this.apiTv = data;
      // this.$set(this, 'apiCollections', data);
    },

    async tvNodeDelete(node) {
      console.log(node, this.curApiCollectionPanel);
      node.remove();
      await this.savefileCollections(this.curApiCollectionPanel);
    },

    async tvNodeRename(params) {
      console.log(params);
      await this.savefileCollections(this.curApiCollectionPanel);
    },

    async onAddNode(params) {
      console.log(params);
      await this.savefileCollections(this.curApiCollectionPanel);
    },

    async tvNodeOnClick({ parent, children, ...params }) {
      console.log(params);
      this.apiClickedOnList(params);
      // if (params.query) ;
      // this.selectQuery(params)
    },

    async savefileCollections(index = 0) {
      await this.apiFileCollections[index].write({ data: this.tvToObject(index) });
      // this.apiTvs = await this.fileCollections.read();
      // this.$set(this.apiTvs, index, this.apiTvs);
    },

    tvToObject(index) {
      const vm = this;

      function _dfs(oldNode) {
        const newNode = {};

        for (const k in oldNode) {
          if (k !== 'children' && k !== 'parent') {
            newNode[k] = oldNode[k];
          }
        }

        if (oldNode.children && oldNode.children.length > 0) {
          newNode.children = [];
          for (let i = 0, len = oldNode.children.length; i < len; i++) {
            newNode.children.push(_dfs(oldNode.children[i]));
          }
        }
        return newNode;
      }

      return _dfs(vm.apiTvs[index]).children;
    },

    async tvNodeFolderAdd(index) {
      const node = new TreeNode({ name: 'New Folder', isLeaf: false, children: [] });
      if (!this.apiTvs[index].children) {
        this.apiTvs[index].children = [];
      }
      this.apiTvs[index].addChildren(node);

      await this.saveFileCollection(index);
    },

    openApiFileCollection() {
      const vm = this;
      // console.log(obj, key);
      const file = dialog.showOpenDialog({
        properties: ['openFile'],
      });

      if (file && file[0]) {
        const fileName = path.basename(file[0]);
        const pathObj = {
          path: file[0] + '',
          fileName,
        };

        if (this.$store.getters['apiClient/GtrCurrentApiFilePaths'].every(({ path: p }) => p !== pathObj.path)) {
          this.$store.commit('apiClient/MutApiFilePathsAdd', pathObj);
          this.loadFileCollection(pathObj);
        } else {
          this.$toast.info('File already exist in collection').goAway(4000);
        }
      }
    },

    async saveFileCollection(index = 0) {
      await this.apiFileCollections[index].write({ data: this.tvToObject(index) });
    },

    async loadFileCollection(path, index = 0) {
      try {
        const fileCollection = new FileCollection(path);
        await fileCollection.init();

        this.apiFileCollections.push(fileCollection);

        const data = new Tree(await fileCollection.read());
        this.apiTvs.push(data);
      } catch (e) {
        console.log('Error in loadFileCollection:', e);
        throw e;
      }
    },
    async refreshFileCollection(index = 0) {
      try {
        const path = this.$store.getters['apiClient/GtrCurrentApiFilePaths'][index];
        const fileCollection = new FileCollection(path);
        await fileCollection.init();
        this.apiFileCollections[index] = fileCollection;
        const data = new Tree(await fileCollection.read());
        this.$set(this.apiTvs, index, data);
      } catch (e) {
        console.log('Error in loadFileCollection:', e);
        throw e;
      }
    },

    async bookmarkApi() {
      const q = this.api;
      const node = new TreeNode({
        id: Date.now(),
        label: 'Latest Api',
        name: 'Last Saved Api',
        pid: 0,
        isLeaf: true,
        ...q,
      });

      let expandedPanelIndex = this.curApiCollectionPanel;
      if (typeof expandedPanelIndex !== 'number' || expandedPanelIndex === -1) {
        expandedPanelIndex = this.$store.getters['apiClient/GtrCurrentApiFilePaths'].findIndex(
          file =>
            file.path === path.join(this.currentProjectFolder, 'server', 'tool', this.projectApisFolder, 'apis.xc.json')
        );
      }

      if (!this.apiTvs[expandedPanelIndex].children) {
        this.apiTvs[expandedPanelIndex].children = [];
      }
      this.apiTvs[expandedPanelIndex].addChildren(node);
      await this.savefileCollections(expandedPanelIndex);
    },
  },

  beforeCreated() {},
  destroy() {},
  directives: {},
  validate({ params }) {
    return true;
  },
  head() {
    return {};
  },
  props: ['nodes'],
};
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
  border-top: 1px solid #7f828b33;
}

.envs /deep/ .v-select__selections {
  color: var(--v-accent-base);
}

/*.envs /deep/ .v-select__selections input { display: none}*/
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
