<template>
  <v-container class="ma-0 pa-0 sql-editor" fluid style="height: 100%">
    <!--    <v-toolbar class="elevation-0 search-toolbar pa-0" :height="48">-->
    <!--      <v-autocomplete-->
    <!--        ref="search"-->
    <!--        v-model="selectedQueryItem"-->
    <!--        @change="changedSelectedQuery(selectedQueryItem)"-->
    <!--        clearable-->
    <!--        item-text="query"-->
    <!--        outlined-->
    <!--        solo-inverted-->
    <!--        dense-->
    <!--        single-line-->
    <!--        hide-details-->
    <!--        open-on-clear-->
    <!--        label="Search queries by words ( ⌘ P )"-->
    <!--        :items="$store.state.sqlClient.list"-->
    <!--        :filter="queryFilter"-->
    <!--        prepend-inner-icon="search"-->
    <!--        no-data-text="No queries in the search history"-->
    <!--      >-->
    <!--        <template v-slot:item="{item:query,index:i}">-->

    <!--          <v-hover v-slot:default="{ hover }">-->
    <!--            <div style="width: 100%">-->
    <!--              <v-btn class="pl-0 ml-0 " small text :tooltip="query.type"-->
    <!--              >-->
    <!--                <b :class="query.typeColor + '&#45;&#45;text'">-->
    <!--                  <v-icon class="mx-0 ml-n2" :color="query.response.status === 0 ? 'success' : 'error'">-->
    <!--                    mdi-circle-small-->
    <!--                  </v-icon>-->
    <!--                  <span>{{query.type}}</span>-->
    <!--                </b>-->

    <!--              </v-btn>-->

    <!--              <span class="caption grey&#45;&#45;text ml-2" v-if="query.timeTaken">Query took {{query.timeTaken}} Seconds</span>-->
    <!--              <div class="float-right">-->

    <!--                <span v-if="query.createdAt" class="caption grey&#45;&#45;text">{{dateToHowManyAgo(query.createdAt)}}</span>-->
    <!--                <v-btn text primary small class="caption grey&#45;&#45;text"-->
    <!--                       v-if="query.query.length > 422"-->
    <!--                       @click.stop="expanded = expanded === i ? -1 : i">...More-->
    <!--                </v-btn>-->
    <!--                <v-btn small text class=" " @click.prevent.stop="queryDeleteFromHistory(query)">-->
    <!--                  <v-icon small color="warning">mdi-delete-outline</v-icon>-->
    <!--                </v-btn>-->

    <!--                <v-btn text primary small @click="copyAndExecute(query)">-->
    <!--                  <v-icon color="success">mdi-play</v-icon>-->
    <!--                </v-btn>-->

    <!--              </div>-->
    <!--              <div>-->
    <!--                <v-hover v-slot:default="{ hover }">-->
    <!--                  <p class="pa-1"-->
    <!--                     :class="{'white&#45;&#45;text' : hover, 'grey&#45;&#45;text' : !hover}"-->
    <!--                     style="white-space: normal;cursor: pointer">-->
    <!--                    {{expanded === i ? query.query : query.query.substr(0,442)}}</p>-->
    <!--                </v-hover>-->
    <!--              </div>-->
    <!--            </div>-->
    <!--          </v-hover>-->
    <!--        </template>-->
    <!--      </v-autocomplete>-->

    <!--    </v-toolbar>-->

    <splitpanes style="height:calc(100%); " class="xc-theme">
      <pane v-if="showsqlTvs" :size="showsqlTvs ? 25 : 0" :max-size="showsqlTvs ? 50 : 0" style="overflow: auto">
        <div v-if="showsqlTvs" style="width:100%;height:100%">
          <v-row class="pa-0 ma-0 pa-2 pl-2 d-block">
            <x-icon
              class="mr-2 cursor-pointer"
              color="primary"
              tooltip="Create New SQL Collection"
              @click="openNewCollection('/')"
            >
              mdi-folder-plus-outline
            </x-icon>

            <x-icon
              class="mr-2 cursor-pointer"
              color="primary"
              tooltip="Open SQL Collection"
              @click="openSqlFileCollection"
            >
              mdi-folder-open-outline
            </x-icon>

            <span class="caption float-right warning--text mt-1" style="font-style: italic">
              SQL Editor is in<v-icon small color="warning">mdi-alpha</v-icon>
            </span>
          </v-row>
          <v-divider />

          <v-expansion-panels v-model="expandedPanel" accordion focusable>
            <v-expansion-panel
              v-for="(tv,i) in sqlTvs"
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
                    >{{ $store.getters['sqlClient/GtrCurrentSqlFilePaths'][i].fileName }}</span>

                    <x-icon
                      color="white grey"
                      class="float-right mr-3"
                      small
                      @click="toggle[i]=true,x = $event.clientX,y = $event.clientY"
                      @click.stop=""
                    >
                      mdi-dots-horizontal
                    </x-icon>

                    <recursive-menu
                      v-model="toggle[i]"
                      :position-x="x"
                      :position-y="y"
                      :items="{
                        'Add Folder':'add-folder',
                        'Reveal in Folder':'reveal-in-folder',
                        'Delete Collection':'delete-collection',
                        'Refresh Collection':'refresh-collection'
                      }"
                      @click="ctxMenuClickHandler($event,i)"
                    />
                  </div>
                </template>
              </v-expansion-panel-header>
              <v-expansion-panel-content>
                <vue-tree-list
                  v-if="sqlTvs[i]"
                  class="body-2 sql-query-treeview px-1 pt-2"
                  :model="tv"
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
                  <template #extraLeafNode>
                    <v-icon small>
                      mdi-delete
                    </v-icon>
                  </template>
                  <template #label="{item}">
                    <v-icon
                      v-if="item.isLeaf"
                      small
                      class="mr-1"
                      :color="item.response && item.response.status === 0 ? 'success' : 'error'"
                    >
                      mdi-bookmark-outline
                    </v-icon>
                    {{ item.name }}
                  </template>
                </vue-tree-list>
              </v-expansion-panel-content>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>
      </pane>
      <pane style="overflow: auto" :size="showsqlTvs ? 75 :100">
        <div style="position: relative;height: 100%;min-height: 200px">
          <v-tabs
            v-model="tab"
            style="height: 100%"
            dense
            height="38"
            class="sql-editor-tab"
          >
            <v-tab v-for="(c,i) in editors" :key="i">
              <template v-if="c.type==='file'">
                {{ c.fileName }}
                <v-icon small class="ml-2" @click.prevent.stop="fileClose('showDialog',i)">
                  close
                </v-icon>
              </template>
              <template v-else>
                Query - {{ i + 1 }}
              </template>
            </v-tab>
            <v-tabs-items v-model="tab" style="height: calc(100% - 38px)">
              <v-tab-item v-for="(c,i) in editors" :key="i" style="height: 100%">
                <div class="d-flex" style="height: 100%; position: relative">
                  <div style="" class="text-center flex-shrink-1 d-flex flex-column">
                    <x-icon
                      tooltip="Execute Query (⌘ ↵)"
                      icon-class="mx-2 mt-3 elevation-1"
                      color="success success"
                      @click="runSelectedSqlCode"
                    >
                      mdi-play
                    </x-icon>

                    <x-icon
                      tooltip="Execute Query (⌘ ⌥ ↵)"
                      icon-class="mx-2 mt-3 elevation-1"
                      color="info info"
                      @click="runAllSqlCode"
                    >
                      mdi-play
                    </x-icon>
                    <x-icon
                      tooltip="Bookmark Query (⌘ B)"
                      icon-class="mx-2 mt-3 elevation-1 py-1"
                      color="amber amber"
                      small
                      @click="bookmarkQuery"
                    >
                      mdi-star
                    </x-icon>
                    <x-icon
                      :tooltip="showsqlTvs?'Close Sql Collection( ⌘ K )':'Open Sql Collection( ⌘ K )'"
                      icon-class="mx-2 mt-3 elevation-1 py-1"
                      :color="showsqlTvs?'amber amber':'amber amber'"
                      small
                      @click="showSqlCollectionToggle"
                    >
                      mdi-folder-star
                    </x-icon>

                    <x-icon
                      tooltip="Open New File (⌘ O)"
                      icon-class="mx-2 mt-3 elevation-1 py-1"
                      color="primary blue-grey "
                      small
                      @click="openFile"
                    >
                      mdi-file
                    </x-icon>
                    <x-icon
                      tooltip="Save Editor Contents (⌘ S)"
                      icon-class="mx-2 mt-3 elevation-1 py-1"
                      color="primary blue-grey "
                      small
                      @click="fileSave(editors[tab])"
                    >
                      save
                    </x-icon>

                    <x-icon
                      tooltip="Clear Editor (⌘ N)"
                      icon-class="mx-2 mt-3 elevation-1 py-1"
                      color="error blue-grey "
                      small
                      @click="editorClear"
                    >
                      mdi-close-box
                    </x-icon>
                  </div>
                  <div class="flex-grow-1" style="overflow:auto;height:100%">
                    <MonacoSqlEditor
                      :ref="`editor-${i}`"
                      :tables="tableList"
                      :column-names="tableColumnList"
                      :code.sync="editors[i].code"
                      :column-name-cbk="columnNameCbk"
                      css-style="height:100%"
                      @execute="runSelectedSqlCode"
                      @bookmark="bookmarkQuery"
                      @searchHistory=" $refs.search.$el.querySelector('input').click()"
                      @toggleBookmark="showSqlCollectionToggle"
                      @saveFile="fileSave(editors[tab])"
                      @openFile="openFile"
                      @runAll="runAllSqlCode"
                      @clearEditor="editorClear"
                    />
                  </div>
                </div>
              </v-tab-item>
            </v-tabs-items>
          </v-tabs>
        </div>
      </pane>
    </splitpanes>

    <dlgLabelSubmitCancel
      v-if="closeFileDlg"
      type="primary"
      :dialog-show="closeFileDlg"
      :actions-mtd="fileClose"
      :heading="`$t('tooltip.saveChanges') ?`"
    />
  </v-container>
</template>

<script>
/* eslint-disable */

// Todo: handling resize bar when hidden

import { mapGetters } from 'vuex'
import { VueTreeList, Tree, TreeNode } from 'vue-tree-list'
import { Splitpanes, Pane } from 'splitpanes'
import sqlRightClickOptions from '../../helpers/sqlRightClickOptions'
import dlgLabelSubmitCancel from '../utils/dlgLabelSubmitCancel.vue'
import { SqlUI } from '../../helpers/sqlUi/SqlUiFactory'

import Utils from '../../helpers/Utils'

import MonacoSqlEditor from '../monaco/MonacoSqlEditor'

export default {
  components: {
    MonacoSqlEditor,
    dlgLabelSubmitCancel,
    VueTreeList,
    Splitpanes,
    Pane
  },
  data () {
    return {
      expandedPanel: null,
      toggle: {},
      tableList: null,
      tableColumnList: {},
      data: new Tree([
        {
          name: 'Node 1',
          id: 1,
          pid: 0,
          dragDisabled: true,
          addTreeNodeDisabled: true,
          addLeafNodeDisabled: true,
          editNodeDisabled: true,
          delNodeDisabled: true,
          children: [
            {
              name: 'Node 1-2',
              id: 2,
              isLeaf: true,
              pid: 1
            }
          ]
        },
        {
          name: 'Node 2',
          id: 3,
          pid: 0,
          disabled: true
        },
        {
          name: 'Node 3',
          id: 4,
          pid: 0
        }
      ]),
      opened: [],

      sqlTvs: [],
      fileCollections: [],
      filePaths: [],

      showsqlTvs: true,
      menuVisible: false,
      x: 0,
      y: 0,
      menuItem: null,
      closeIndex: null,
      closeFileDlg: false,
      selectedQueryItem: null,
      tab: 0,
      expanded: null,
      searchQuery: '',
      searchOverlay: false,
      folderOverlay: false,
      loading: false,
      editors: [],
      headers1: [
        {
          text: 'API Call History',
          align: 'left',
          sortable: false,
          value: 'query',
          class: 'text-center black'
        }
      ]
    }
  },
  computed: {
    ...mapGetters({
      sqlMgr: 'sqlMgr/sqlMgr',
      currentProjectFolder: 'project/currentProjectFolder',
      projectQueriesFolder: 'project/projectQueriesFolder'
    })
  },
  watch:
      {
        editors: {
          handler (editors) {
            this.$store.commit('sqlClient/MutSetEditors', editors)
          },
          deep: true
        }
      },
  async created () {
    this.$store.dispatch('sqlClient/loadSqlCollectionForProject', {
      projectId: 1,
      projectName: this.$store.getters['project/GtrProjectName']
    })

    try {
      /* load all files that are were previously opened */
      if (!this.$store.getters['sqlClient/GtrCurrentSqlFilePaths'].length) {
        const defaultPath = '' // path.join(this.currentProjectFolder, 'server', 'tool', this.nodes.dbAlias, this.projectQueriesFolder, 'queries.xc.json');
        this.$store.commit('sqlClient/MutSqlFilePathsAdd', {
          path: defaultPath,
          fileName: ''// path.basename(defaultPath)
        })
      }

      for (let i = 0; i < this.$store.getters['sqlClient/GtrCurrentSqlFilePaths'].length; ++i) {
        await this.loadFileCollection(this.$store.getters['sqlClient/GtrCurrentSqlFilePaths'][i])
      }
    } catch (e) {
      console.log('Failed to load previously opened query collections', e)
    }

    this.sqlUi = SqlUI.create(this.nodes.dbConnection)
    console.log('------------', this.nodes)
    this.editors = this.$store.state.sqlClient.editors.map(editor => ({ ...editor }))
    this.checkClipboardForQuery(this.$store.state.sqlClient.clipboardQuery)
    const vm = this
    this.$store.watch(
      state => state.sqlClient.clipboardQuery,
      clipboardQuery => vm.checkClipboardForQuery(clipboardQuery)
    )

    // const client = await this.sqlMgr.projectGetSqlClient({
    //   env: this.nodes.env,
    //   dbAlias: this.nodes.dbAlias
    // });
    // const result = await client.tableList();
    // console.log(result)
    this.tableList = [] // result.data.list.map(table => table.table_name)

    this.expandedPanel = 0
  },
  mounted () {
  },
  beforeDestroy () {
  },
  methods: {
    dateToHowManyAgo: Utils.dateToHowManyAgo,
    findById: Utils.findById,

    async openNewCollection () {
      // try {
      //   const toLocalPath = path.join(this.currentProjectFolder, 'server', 'tool', this.nodes.dbAlias, this.projectQueriesFolder)
      //
      //   const userChosenPath = dialog.showSaveDialog({
      //     defaultPath: toLocalPath,
      //     filters: [{ name: 'JSON', extensions: ['json'] }]
      //   })
      //
      //   if (userChosenPath) {
      //     console.log(userChosenPath)
      //     fs.writeFileSync(userChosenPath, '[]', 'utf-8')
      //     const pathObj = {
      //       path: userChosenPath,
      //       fileName: path.basename(userChosenPath)
      //     }
      //     this.$store.commit('sqlClient/MutSqlFilePathsAdd', pathObj)
      //     await this.loadFileCollection(pathObj)
      //   }
      //   this.$toast.success('New collection loaded successfully').goAway(5000)
      // } catch (e) {
      //   console.log(e)
      //   throw e
      // }
    },

    async columnNameCbk (tn) {
      // tableColumnList
      //
      // const client = await this.sqlMgr.projectGetSqlClient({
      //   env: this.nodes.env,
      //   dbAlias: this.nodes.dbAlias
      // });
      // const result = await client.columnList({tn});
      // const columns = result.data.list.map(table => table.column_name)
      // this.$set(this.tableColumnList, tn, columns);
      // return columns;
      return []
    },

    async tvNodeDelete (node) {
      console.log(node)
      node.remove()
      await this.savefileCollections(this.expandedPanel)
    },

    async tvNodeRename (params) {
      console.log(params)
      await this.savefileCollections(this.expandedPanel)
    },

    async onAddNode (params) {
      console.log(params)
      await this.savefileCollections(this.expandedPanel)
    },

    tvNodeOnClick (params) {
      console.log(params)
      if (params.query) { this.selectQuery(params) }
    },
    async openCollectionFolder (pathString) {
      shell.showItemInFolder(pathString)
    },
    tvToObject (index) {
      const vm = this

      function _dfs (oldNode) {
        const newNode = {}

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

      return _dfs(vm.sqlTvs[index]).children
    },

    async tvNodeFolderAdd (index) {
      const node = new TreeNode({ name: 'New Folder', isLeaf: false })
      if (!this.sqlTvs[index].children) { this.sqlTvs[index].children = [] }
      this.sqlTvs[index].addChildren(node)
      await this.savefileCollections(index)
    },

    async ctxMenuClickHandler (actionEvent, index) {
      console.log(actionEvent, index)
      switch (actionEvent.value) {
        case 'add-folder':
          this.tvNodeFolderAdd(index)
          break
        case 'reveal-in-folder':
          await this.openCollectionFolder(this.$store.getters['sqlClient/GtrCurrentSqlFilePaths'][index].path)
          break
        case 'delete-collection':
          this.$store.commit('sqlClient/MutSqlFilePathsRemove', index)
          this.fileCollections.splice(index, 1)
          this.sqlTvs.splice(index, 1)
          break
        case 'refresh-collection':
          await this.refreshFileCollection(index)
          break
        default:
          break
      }
      // this.deleteQueryByPath(this.sqlTvs, this.menuItem.path);
    },
    async runSelectedSqlCode () {
      this.executeQuery(this.$refs[`editor-${this.tab}`][0].getCurrentQuery())
    },
    async runAllSqlCode () {
      const queryString = this.$refs[`editor-${this.tab}`][0].getAllContent()

      const queries = this.sqlUi.splitQueries(queryString)
      if (queries) {
        for (const query of queries) {
          await this.executeQuery(query)
        }
      } else { await this.executeQuery('') }

      console.log(queries)
    },
    async runSqlCode () {
      this.executeQuery(this.editors[this.tab].code)
    },
    async executeQuery (query) {
      if (query.trim() === '') {
        this.$toast.info('Query is empty').goAway(5000)
        return
      }
      this.loading = true

      try {
        const result = await this.$store.dispatch('sqlClient/executeQuery', {
          envs: {
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          },
          query
        })
        this.$store.commit('outputs/MutListSet', { sqlUi: this.sqlUi, headers: [], result })
        // this.result = this.sqlUi.handleRawOutput(result, this.headers);
      } catch (e) {
        this.$toast.error('Query failed : ' + e.message).goAway(3000)
        this.$store.commit('outputs/MutListSet', {
          headers: [{ text: 'Mesage', value: 'message', sortable: false }],
          result: [{ message: e.message }]
        })
      } finally {
        this.loading = false
      }
    },
    editorClear () {
      this.editors[this.tab].code = ''
      this.$store.commit('outputs/MutClear')
    },
    queryDeleteFromHistory (item) {
      this.$store.commit('sqlClient/MutListRemoveItem', item)
    },
    selectQuery ({ query }) {
      if (this.editors[this.tab].code.trim()) { this.editors[this.tab].code += '\n\n' + query } else { this.editors[this.tab].code = query }
      this.$refs[`editor-${this.tab}`][0].focus()
    },
    async copyAndExecute (query) {
      this.selectQuery(query)
      await this.runSqlCode()
    },
    queryFilter (item, queryText, itemText) {
      return item.query.toLowerCase().includes(queryText.toLowerCase())
    },
    changedSelectedQuery (query) {
      this.selectQuery({ query })
    },
    checkClipboardForQuery (clipboardQuery) {
      if (clipboardQuery) {
        this.$set(this.editors[this.tab], 'code', clipboardQuery)
        this.$store.commit('sqlClient/MutSetClipboardQuery', null)
      }
    },
    openFile () {
      // if (this.editors.filter(({ type }) => type === 'file').length >= 4) {
      //   this.$toast.info('Only 4 files can be opened').goAway(4000)
      //   return
      // }
      // const vm = this
      // const file = dialog.showOpenDialog({
      //   properties: ['openFile']
      // })
      // if (file && file[0]) {
      //   const fileName = path.basename(file[0])
      //   fs.readFile(file[0], 'utf8', function (err, data) {
      //     if (err) { return console.log(err) }
      //     vm.editors.push({ code: data, type: 'file', fileName, filePaths: file[0], edited: false })
      //     vm.tab = vm.editors.length - 1
      //     // data is the contents of the text file we just read
      //   })
      // }
    },
    openSqlFileCollection () {
      // const vm = this
      // const file = dialog.showOpenDialog({
      //   properties: ['openFile']
      // })
      // if (file && file[0]) {
      //   const fileName = path.basename(file[0])
      //   const pathObj = {
      //     path: file[0] + '',
      //     fileName
      //   }
      //
      //   if (this.$store.getters['sqlClient/GtrCurrentSqlFilePaths'].every(({ path: p }) => p !== pathObj.path)) {
      //     this.$store.commit('sqlClient/MutSqlFilePathsAdd', pathObj)
      //     this.loadFileCollection(pathObj)
      //   } else {
      //     this.$toast.info('File already exist in collection').goAway(4000)
      //   }
      // }
    },
    showSqlCollectionToggle (status = true) {
      this.showsqlTvs = !this.showsqlTvs
    },
    fileSave (editor, cbk = null) {
      // console.log(editor)
      // if (editor.type != 'file') {
      //   return
      // }
      // const vm = this
      // fs.writeFile(editor.filePaths, editor.code, 'utf-8', function (err, result) {
      //   if (err) {
      //     vm.$toast.error('Error saving the file').goAway(5000)
      //   } else {
      //     vm.$toast.success('File saved successfully').goAway(5000)
      //   }
      //   if (cbk) { cbk(err, result) }
      // })
    },
    async fileClose (action = '', index) {
      if (action === 'showDialog') {
        this.closeFileDlg = true
        this.closeIndex = index
      } else if (action === 'hideDialog') {
        this.editors.splice(this.closeIndex, 1)
        this.closeFileDlg = false
        this.closeIndex = null
      } else {
        const vm = this
        this.fileSave(this.editors[this.closeIndex], function (err, result) {
          vm.editors.splice(vm.closeIndex, 1)
          vm.closeIndex = null
          vm.closeFileDlg = false
        })
      }
    },
    queryClickHandler (item) {
      console.log('bookmark', item)
      if (item.type !== 'folder') { this.selectQuery({ query: item.query }) }
    },
    ctxMenuShow (e, item) {
      if (!item) { return }
      this.menuItem = item
      e.preventDefault()
      this.x = e.clientX
      this.y = e.clientY
      this.$nextTick(() => {
        this.menuVisible = true
      })
    },
    ctxMenuOptions () {
      if (!this.menuItem || !this.menuItem) { return }
      const options = sqlRightClickOptions[this.menuItem.type === 'folder' ? 'folder' : 'file']
      return options
    },

    async fileCollectionsReload () {
      const data = new Tree(await this.fileCollections.read())
      console.log(data)

      this.sqlTvs = data
      // this.$set(this, 'sqlTvs', data);
    },

    async savefileCollections (index = 0) {
      await this.fileCollections[index].write({ data: this.tvToObject(index) })
    },

    async bookmarkQuery () {
      const q = this.$refs[`editor-${this.tab}`][0].getCurrentQuery()

      if (q.trim()) {
        this.showsqlTvs = true

        const node = new TreeNode({
          id: Date.now(),
          type: 'select',
          typeColor: 'success',
          query: q,
          response: { status: 0 },
          label: 'Example',
          name: 'Last saved query',
          pid: 0,
          isLeaf: true
        })

        let expandedPanelIndex = this.expandedPanel
        if (typeof expandedPanelIndex !== 'number') {
          expandedPanelIndex = this.$store.getters['sqlClient/GtrCurrentSqlFilePaths'].findIndex(
            file => file.path === path.join(this.currentProjectFolder, 'server', 'tool', this.nodes.dbAlias, this.projectQueriesFolder, 'queries.xc.json')
          )
        }

        if (!this.sqlTvs[expandedPanelIndex].children) { this.sqlTvs[expandedPanelIndex].children = [] }
        this.sqlTvs[expandedPanelIndex].addChildren(node)
        await this.savefileCollections(expandedPanelIndex)

        this.$toast.success('Query bookmarked').goAway(1000)
      }
    },

    async loadFileCollection (pathObj, index = 0) {

      // try {
      //   const fileCollection = new FileCollection(pathObj);
      //   await fileCollection.init();
      //
      //   this.fileCollections.push(fileCollection);
      //
      //   let data = new Tree(await fileCollection.read());
      //   this.sqlTvs.push(data);
      // } catch (e) {
      //   console.log('Error in loadFileCollection:', e);
      //   throw e;
      // }

    },
    async refreshFileCollection (index = 0) {
      try {
        const pathObj = this.$store.getters['sqlClient/GtrCurrentSqlFilePaths'][index]
        const fileCollection = new FileCollection(pathObj)
        await fileCollection.init()

        this.fileCollections[index] = fileCollection

        const data = new Tree(await fileCollection.read())
        this.$set(this.sqlTvs, index, data)
      } catch (e) {
        console.log('Error in loadFileCollection:', e)
        throw e
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
  .vertical-resizer {
    height: 5px;
    background: grey;
    cursor: ns-resize;
    position: relative;
  }

  .vertical-resizer + * {
    overflow-y: auto;
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
