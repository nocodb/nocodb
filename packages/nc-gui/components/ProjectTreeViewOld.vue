<template>
  <div
    style="height:100%;"
    @mouseenter="onMiniHoverEnter"
    @mouseleave="onMiniHoverLeave">
    <!--    :expand-on-hover="mini"-->
    <v-navigation-drawer
      permanent
      mini-variant-width="50"
      :mini-variant.sync="mini"
      mini
      class="pl-2"
      ref="drawer"
      style="min-width:100%;overflow: auto; max-height:100%;"
      v-model="navigation.shown">
      <div class="h-100 d-flex flex-column">
        <div class="flex-grow-1" style="overflow-y: auto;min-height:200px">
          <v-skeleton-loader class="mt-2 ml-2" v-if="!projects || !projects.length" type="button">

          </v-skeleton-loader>
          <!--      <v-btn
                  v-else
                  icon
                  text
                  @click.stop="toggleMini"
                >
                  &lt;!&ndash;        <v-icon v-if="mini">mdi-chevron-right-circle</v-icon>&ndash;&gt;
                  &lt;!&ndash;        <v-icon v-else>mdi-pin-outline</v-icon>&ndash;&gt;
                  <v-icon class="grey&#45;&#45;text">mdi-arrow-expand-horizontal</v-icon>
                  &lt;!&ndash;        <v-icon v-else>mdi-arrow-expand-horizontal</v-icon>&ndash;&gt;

                </v-btn>-->
          <!--      <v-text-field-->
          <!--        v-model="search"-->
          <!--        label="Search Project"-->
          <!--        dense-->
          <!--        solo-->
          <!--        hide-details-->
          <!--        clearable-->
          <!--        clear-icon="mdi-close-circle-outline"-->
          <!--        class="pa-2"-->
          <!--      ></v-text-field>-->


          <v-skeleton-loader v-if="!projects || !projects.length "
                             type="list-item,list-item-three-line@3,list-item@2,list-item-three-line@3">

          </v-skeleton-loader>


          <v-treeview
            class="mt-5 project-tree"
            v-else
            dense
            v-model="tree"
            :open.sync="open"
            :active.sync="active"
            :items="projects"
            :search="search"
            :filter="filter"
            item-key="_nodes.key"
            open-on-click
          >
            <template v-slot:label="{ item, open, leaf }">
              <v-tooltip
                :bottom="!!item.tooltip"
                :right="!item.tooltip"
                :disabled="!item.tooltip && false">
                <template v-slot:activator="{ on }">

                  <div
                    v-if="!hideNode[item._nodes.type]"
                    v-on="item.tooltip || true ? on : ''"
                    @contextmenu.prevent="showCTXMenu($event, item, open, leaf)"
                    @click.stop="addTab({ ...item }, open, leaf)"
                  >


                    <template v-if="item._nodes.type ==='db'">
                      <v-icon size="16">mdi-database</v-icon>
                      <!--                  <img-->
                      <!--                    class="grey lighten-3"-->
                      <!--                    :width="16" :src="`/db-icons/${dbIcons[item._nodes.dbConnection.client]}`"/>-->

                    </template>
                    <template v-else>
                      <v-icon
                        small
                        style="cursor:auto;"
                        v-if="open && icons[item._nodes.type].openIcon"
                        :color="icons[item._nodes.type].openColor"
                      >{{ icons[item._nodes.type].openIcon }}
                      </v-icon>
                      <v-icon
                        small
                        style="cursor:auto;"
                        v-else :color="icons[item._nodes.type].color"
                      >{{ icons[item._nodes.type].icon }}
                      </v-icon>
                    </template>
                    <span class="v-treeview-node__label body-2"
                          :class="[icons[item._nodes.type].class, item.active ? 'font-weight-bold' : '']">{{
                        item.name
                      }}</span>
                  </div>
                </template>
                <span>{{ item.tooltip || item.name }}</span>
              </v-tooltip>
            </template>
          </v-treeview>

          <recursive-menu v-model="menuVisible"
                          @click="handleCTXMenuClick($event.value)"
                          offset-y :items="ctxMenuOptions()"
                          :position-x="x" :position-y="y"></recursive-menu>
        </div>
        <div
          v-if="_isUIAllowed('treeViewProjectSettings')"
          class="pr-3 pb-3"
          :class="{'pl-3':!mini}"
          style="min-height: 250px;"
        >
          <v-divider>
          </v-divider>


          <v-list dense>

            <v-list-item @click="rolesTabAdd" class="body-2">
              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <div class="d-100 d-flex" v-on="on">
                    <v-icon color="green" class="mr-1" small> mdi-account-group</v-icon>
                    <span>Team & Auth</span>
                  </div>
                </template>
                Roles & Users Management
              </v-tooltip>
            </v-list-item>
            <v-list-item @click="disableOrEnableModelTabAdd" class="body-2">
              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <div class="d-100 d-flex" v-on="on">
                    <v-icon color="purple" class="mr-1" small>mdi-table-multiple</v-icon>
                    <span>Project Metadata</span>

                  </div>
                </template>
                Meta Management
              </v-tooltip>
            </v-list-item>
            <v-list-item @click="settingsTabAdd" class="body-2">
              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <div class="d-100 d-flex" v-on="on">
                    <v-icon color="orange" class="mr-1" small>mdi-settings</v-icon>
                    <span>Settings</span>
                  </div>
                </template>
                Tool Settings (^⇧C)
              </v-tooltip>
            </v-list-item>
            <v-list-item @click="toggleMini" class="body-2">
              <div class="d-100 d-flex" v-on="on">
                <v-icon color="" class="mr-1" small>mdi-arrow-expand-horizontal</v-icon>
                <span>Toggle Sidebar</span>
              </div>
            </v-list-item>

          </v-list>

        </div>
      </div>
    </v-navigation-drawer>

    <dlg-table-create
      v-model="dialogGetTableName.dialogShow"
      @create="mtdTableCreate($event)"
    ></dlg-table-create>


    <!--    <textDlgSubmitCancel
          v-if="dialogGetTableName.dialogShow"
          :dialogShow="dialogGetTableName.dialogShow"
          :heading="dialogGetTableName.heading"
          :mtdDialogSubmit="mtdDialogGetTableNameSubmit"
          :mtdDialogCancel="mtdDialogGetTableNameCancel"
        />-->


    <textDlgSubmitCancel
      v-if="dialogRenameTable.dialogShow"
      :dialogShow="dialogRenameTable.dialogShow"
      :heading="dialogRenameTable.heading"
      :cookie="dialogRenameTable.cookie"
      :defaultValue="dialogRenameTable.defaultValue"
      :mtdDialogSubmit="mtdDialogRenameTableSubmit"
      :mtdDialogCancel="mtdDialogRenameTableCancel"
    />
    <textDlgSubmitCancel
      v-if="dialogGetViewName.dialogShow"
      :dialogShow="dialogGetViewName.dialogShow"
      :heading="dialogGetViewName.heading"
      :mtdDialogSubmit="mtdDialogGetViewNameSubmit"
      :mtdDialogCancel="mtdDialogGetViewNameCancel"
    />
    <textDlgSubmitCancel
      v-if="dialogGetFunctionName.dialogShow"
      :dialogShow="dialogGetFunctionName.dialogShow"
      :heading="dialogGetFunctionName.heading"
      :mtdDialogSubmit="mtdDialogGetFunctionNameSubmit"
      :mtdDialogCancel="mtdDialogGetFunctionNameCancel"
    />
    <textDlgSubmitCancel
      v-if="dialogGetProcedureName.dialogShow"
      :dialogShow="dialogGetProcedureName.dialogShow"
      :heading="dialogGetProcedureName.heading"
      :mtdDialogSubmit="mtdDialogGetProcedureNameSubmit"
      :mtdDialogCancel="mtdDialogGetProcedureNameCancel"
    />
    <textDlgSubmitCancel
      v-if="dialogGetSequenceName.dialogShow"
      :dialogShow="dialogGetSequenceName.dialogShow"
      :heading="dialogGetSequenceName.heading"
      :mtdDialogSubmit="mtdDialogGetSequenceNameSubmit"
      :mtdDialogCancel="mtdDialogGetSequenceNameCancel"
    />
    <dlgLabelSubmitCancel
      v-if="selectedNodeForDelete.dialog"
      :actionsMtd="deleteSelectedNode"
      :dialogShow="selectedNodeForDelete.dialog"
      :heading="selectedNodeForDelete.heading"
      type="error"
    />
  </div>
</template>

<script>
/* eslint-disable */

import {mapMutations, mapGetters, mapActions} from "vuex";

import rightClickOptions from "../helpers/rightClickOptions";
import icons from "../helpers/treeViewIcons";

import textDlgSubmitCancel from "./utils/dlgTextSubmitCancel";
import dlgLabelSubmitCancel from "./utils/dlgLabelSubmitCancel";
import {copyTextToClipboard} from "../helpers/xutils";
import DlgTableCreate from "@/components/utils/dlgTableCreate";

// const {clipboard} = require('electron');

export default {
  components: {DlgTableCreate, textDlgSubmitCancel, dlgLabelSubmitCancel},
  data: () => ({
    dbIcons: {
      oracledb: "oracle_icon@2x.png",
      pg: "postgresql_icon@2x.png",
      mysql: "mysql_icon@2x.png",
      mssql: "mssql_icon@2x.png",
      sqlite3: "sqlite.png"
    },
    mini: false,
    miniExpanded: false,
    navigation: {
      shown: true,
      width: 320,
      borderSize: 3
    },
    loadingProjects: true,
    caseInsensitive: true,
    open: [],
    search: null,
    menuVisible: false,
    x: 0,
    y: 0,
    menuItem: null,
    menu: [{title: "Execute"}],
    icons,
    tree: [],
    active: [],
    viewMenu: false,
    dialogGetTableName: {
      dialogShow: false,
      heading: "Enter New Table Name",
      field: "Table Name"
    },
    dialogGetViewName: {
      dialogShow: false,
      heading: "Enter New View Name",
      field: "View Name"
    },
    dialogGetFunctionName: {
      dialogShow: false,
      heading: "Enter New Function Name",
      field: "Function Name"
    },
    dialogGetProcedureName: {
      dialogShow: false,
      heading: "Enter New Procedure Name",
      field: "Procedure Name",
    },
    dialogGetSequenceName: {
      dialogShow: false,
      heading: "Enter New Sequence Name",
      field: "Sequence Name",
    },
    dialogRenameTable: {
      dialogShow: false,
      heading: "Rename Table",
      field: "Table Name",
      cookie: null,
      defaultValue: null
    },
    selectedNodeForDelete: {dialog: false, item: null, heading: null}
  }),
  computed: {
    direction() {
      return this.navigation.shown === false ? "Open" : "Closed";
    },
    ...mapGetters({
      projects: "project/list",
      tabs: "tabs/list",
      sqlMgr: "sqlMgr/sqlMgr",
      currentProjectFolder: "project/currentProjectFolder"
    }),
    filter() {
      return (item, search, textKey) => item[textKey].indexOf(search) > -1;
    },
    hideNode() {
      return {
        sqlClientDir: !this._isUIAllowed('sqlClientDir'),
        migrationsDir: !this._isUIAllowed('migrationsDir'),
        functionDir: !this._isUIAllowed('functionDir'),
        procedureDir: !this._isUIAllowed('procedureDir'),
      }
    }
  },
  methods: {

    settingsTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `projectSettings`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add roles tab');
        let item = {name: 'Settings', key: `projectSettings`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'projectSettings';
        this.$store.dispatch("tabs/ActAddTab", item);
      }

    },

    rolesTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `roles`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add roles tab');
        let item = {name: 'Team & Auth ', key: `roles`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'roles';
        this.$store.dispatch("tabs/ActAddTab", item);
      }

    },
    disableOrEnableModelTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `disableOrEnableModel`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add acl tab');
        let item = {name: 'Meta Management', key: `disableOrEnableModel`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'disableOrEnableModel';
        this.$store.dispatch("tabs/ActAddTab", item);
      }
    },
    toggleMini() {
      this.$store.commit('panelSize/MutSize', {
        type: 'treeView',
        size: this.$store.state.panelSize.treeView.size === 18 ? 5 : 18
      })
      // this.onMiniHoverEnter();
      // this.mini = !this.mini;
    },
    onMiniHoverEnter() {
      if (this.mini && this.$refs.drawer) {
        const el = this.$refs.drawer.$el
        this.$refs.drawer.width = el.style.width = '320px';
        this.miniExpanded = true;
      }
    },
    onMiniHoverLeave() {
      if (this.mini && this.$refs.drawer) {
        const el = this.$refs.drawer.$el
        this.navigation.width = this.$refs.drawer.width = el.style.width = '50px';
        this.miniExpanded = false;
      }
    },

    ...mapMutations({
      setProject: "project/list",
      updateProject: "project/update"
    }),
    ...mapActions({
      loadTables: "project/loadTables",
      loadProjects: "project/loadProjects",
      loadViews: "project/loadViews",
      loadProcedures: "project/loadProcedures",
      loadSequences: "project/loadSequences",
      loadFunctions: "project/loadFunctions",
      changeActiveTab: "tabs/changeActiveTab",
      // instantiateSqlMgr: "sqlMgr/instantiateSqlMgr",
      removeTabs: "tabs/loadDefaultTabs",
      loadTablesFromParentTreeNode: "project/loadTablesFromParentTreeNode",
      loadViewsFromParentTreeNode: "project/loadViewsFromParentTreeNode",
      loadFunctionsFromParentTreeNode:
        "project/loadFunctionsFromParentTreeNode",
      loadProceduresFromParentTreeNode:
        "project/loadProceduresFromParentTreeNode",
      removeTabsByName: "tabs/removeTabsByName",
      clearProjects: "project/clearProjects"
    }),
    async addTab(item, open, leaf) {

      console.log("addtab item", item, open, leaf);
      //this.$store.commit('notification/MutToggleProgressBar', true);
      try {
        if (item._nodes.type === "tableDir" && !open) {
          //load tables
          await this.loadTables(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.open = currentlyOpened;
        } else if (item._nodes.type === "viewDir" && !open) {
          await this.loadViews(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.open = currentlyOpened;
        } else if (item._nodes.type === "functionDir" && !open) {
          await this.loadFunctions(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.open = currentlyOpened;
        } else if (item._nodes.type === "procedureDir" && !open) {
          await this.loadProcedures(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.open = currentlyOpened;
        } else if (item._nodes.type === "sequenceDir" && !open) {
          await this.loadSequences(item);
          const currentlyOpened = JSON.parse(JSON.stringify(this.open));
          currentlyOpened.push(item._nodes.key);
          this.open = currentlyOpened;
        } else if (item._nodes.type === "env") {
          return;
        } else {
          const tabIndex = this.tabs.findIndex(el => el.key === item.key);
          if (tabIndex != -1) {
            this.changeActiveTab(tabIndex);
          } else {
            if (
              item._nodes.type === "tableDir" ||
              item._nodes.type === "project" ||
              item._nodes.type === "viewDir" ||
              item._nodes.type === "procedureDir" ||
              item._nodes.type === "sequenceDir" ||
              item._nodes.type === "db" ||
              item._nodes.type === "functionDir"
            ) {
              return;
            }
            if (item._nodes.type === 'table') {
              let tableIndex = +item._nodes.key.split('.').pop();
              if (!(await this.$store.dispatch('windows/ActCheckMaxTable', {tableIndex}))) return
            }
            this.$store.dispatch("tabs/ActAddTab", item);
          }
        }

      } catch (e) {
        console.log(e);
      } finally {
        //this.$store.commit('notification/MutToggleProgressBar', false);
      }

    },
    showCTXMenu(e, item, open, leaf) {
      if (!item) return;
      e.preventDefault();

      this.x = e.clientX;
      this.y = e.clientY;
      this.menuItem = item;

      this.$nextTick(() => {
        this.menuVisible = true;
      });
    },
    async loadProjectsData(id = null) {
      try {
        this.loadingProjects = true;
        await this.loadProjects(id);


        if ('toast' in this.$route.query) {
          this.$toast.success(`Successfully generated ${(this.$store.getters['project/GtrProjectType'] || '').toUpperCase()} APIs`, {
            position: 'top-center'
          }).goAway(5000);
        }

        try {
          this.open = [
            this.projects[0].key,
            this.projects[0].children[0].key,
            this.projects[0].children[0].children[0].key
          ];
        } catch (error) {
          console.log("this.open set array error", error);
        }
        this.loadingProjects = false;
      } catch (error) {
        console.error("loadProjectsData", error);
      }
    },
    ctxMenuOptions() {
      if (!this.menuItem || !this.menuItem._nodes.type) return;
      const options = rightClickOptions[this.menuItem._nodes.type];
      return options;
      // if (options) {
      //   return Object.keys(options).map(k => typeof options[k] === 'object' ? Object.keys(options[k]) : k);
      // }
      // return [];
    },
    async handleCTXMenuClick(actionStr) {
      ///this.$store.commit('notification/MutToggleProgressBar', true);

      try {
        const item = this.menuItem;
        // const options = rightClickOptions[this.menuItem._nodes.type];
        const action = actionStr;//options[actionStr];
        if (action) {
          console.log("action and context", item, action);
          if (action === "ENV_DB_TABLES_CREATE") {
            this.dialogGetTableName.dialogShow = true;
          } else if (action === "ENV_DB_VIEWS_CREATE") {
            this.dialogGetViewName.dialogShow = true;
          } else if (action === "ENV_DB_PROCEDURES_CREATE") {
            this.dialogGetProcedureName.dialogShow = true;
          } else if (action === "ENV_DB_SEQUENCES_CREATE") {
            this.dialogGetSequenceName.dialogShow = true;
          } else if (action === "ENV_DB_FUNCTIONS_CREATE") {
            this.dialogGetFunctionName.dialogShow = true;
          } else if (action === "ENV_DB_FUNCTIONS_CREATE") {
            this.dialogGetFunctionName.dialogShow = true;
          } else if (action === "ENV_DB_TABLES_REFRESH") {
            await this.loadTables(this.menuItem);
            this.$toast.success('Tables refreshed').goAway(1000);
          } else if (action === "ENV_DB_VIEWS_REFRESH") {
            await this.loadViews(this.menuItem);
            this.$toast.success('Views refreshed').goAway(1000);
          } else if (action === "ENV_DB_FUNCTIONS_REFRESH") {
            await this.loadFunctions(this.menuItem);
            this.$toast.success('Functions refreshed').goAway(1000);
          } else if (action === "ENV_DB_PROCEDURES_REFRESH") {
            await this.loadProcedures(this.menuItem);
            this.$toast.success('Procedures refreshed').goAway(1000);
          } else if (action === "ENV_DB_SEQUENCES_REFRESH") {
            await this.loadSequences(this.menuItem);
            this.$toast.success('Table refreshed').goAway(1000);
          } else if (action === "ENV_DB_TABLES_RENAME") {
            console.log(`${item._nodes.type} Rename`);
            this.dialogRenameTable.cookie = item;
            this.dialogRenameTable.dialogShow = true;
            this.dialogRenameTable.defaultValue = item.name;

          } else if (action === "ENV_DB_MIGRATION_DOWN") {
            await this.sqlMgr.migrator().migrationsDown({
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias,
              migrationSteps: 99999999999,
              folder: this.currentProjectFolder,
              sqlContentMigrate: 1
            });
            console.log("migrations down done");
          } else if (action === "SHOW_NODES") {
            console.log("\n_nodes.type = ", item._nodes.type, "\n");
            console.log("_nodes.key = ", item._nodes.key, "\n");
            console.log("_nodes = ", item._nodes, "\n");
          } else if (
            action === "ENV_DB_TABLES_DELETE" ||
            action === "ENV_DB_VIEWS_DELETE" ||
            action === "ENV_DB_FUNCTIONS_DELETE" ||
            action === "ENV_DB_PROCEDURES_DELETE" ||
            action === "ENV_DB_SEQUENCES_DELETE"
          ) {
            console.log(`${item._nodes.type} delete`);
            this.deleteSelectedNode("showDialog", item);
          } else if (action === "ENV_DB_TABLES_CREATE_STATEMENT") {
            await this.handleSqlStatementGeneration(item, 'tableCreateStatement', `${item.name} Create Statement copied`);
          } else if (action === "ENV_DB_TABLES_INSERT_STATEMENT") {
            await this.handleSqlStatementGeneration(item, 'tableInsertStatement', `${item.name} Insert Statement copied`);
          } else if (action === "ENV_DB_TABLES_UPDATE_STATEMENT") {
            await this.handleSqlStatementGeneration(item, 'tableUpdateStatement', `${item.name} Update Statement copied`);
          } else if (action === "ENV_DB_TABLES_DELETE_STATEMENT") {
            await this.handleSqlStatementGeneration(item, 'tableSelectStatement', `${item.name} Delete Statement copied`);
          } else if (action === "ENV_DB_TABLES_SELECT_STATEMENT") {
            await this.handleSqlStatementGeneration(item, 'tableDeleteStatement', `${item.name} Select Statement copied`);
          } else {
            console.log(`No Action Fn found for ${action}`);
          }
        }
      } catch (e) {
        console.log(e);
      } finally {
        //this.$store.commit('notification/MutToggleProgressBar', false);
      }
    },

    async handleSqlStatementGeneration(item, func, msg) {
      try {
        // let result = await this.sqlMgr.sqlOp(
        //   {
        //     env: item._nodes.env,
        //     dbAlias: item._nodes.dbAlias
        //   },
        //   func,
        //   {tn: item.name}
        // );

        let result = await this.$store.dispatch('sqlMgr/ActSqlOp', [
          {
            env: item._nodes.env,
            dbAlias: item._nodes.dbAlias
          },
          func,
          {tn: item.name}
        ]);
        if (result && result.data) {
          copyTextToClipboard(result.data, 'selection');
        } else {
          copyTextToClipboard('Example String', 'selection');
        }

        let sqlClientNode = {...item._nodes};
        let newItem = {
          _nodes: sqlClientNode
        };

        sqlClientNode.type = 'sqlClientDir';
        sqlClientNode.key = sqlClientNode.tableDirKey.split('.')
        sqlClientNode.key.pop();
        sqlClientNode.dbKey = sqlClientNode.key.join('.');
        sqlClientNode.key.push('sqlClient');
        sqlClientNode.key = sqlClientNode.key.join('.');


        newItem.key = sqlClientNode.dbKey + '.sqlClient';
        newItem.name = 'SQL Client';
        newItem.tooltip = "SQL Client";
        newItem.type = 'sqlClientDir';

        console.log('Generated sql client node', sqlClientNode);


        this.$toast.success(msg).goAway(2000);

        this.addTab(newItem, false, false)

        this.$store.commit('queries/MutSetClipboardQuery', result.data)

      } catch (e) {
        console.log(e);
        this.$toast.error('Something went wrong').goAway(2000);
      }
    },

    async mtdDialogRenameTableSubmit(tn, cookie) {
      console.log(tn);
      let item = cookie;
      // await this.sqlMgr.sqlOpPlus(
      //   {
      //     env: item._nodes.env,
      //     dbAlias: item._nodes.dbAlias
      //   },
      //   "tableRename",
      //   {tn: tn, tn_old: item.name}
      // );
      await await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
        {
          env: item._nodes.env,
          dbAlias: item._nodes.dbAlias
        },
        "tableRename",
        {tn: tn, tn_old: item.name}
      ]);
      await this.removeTabsByName(item);
      await this.loadTablesFromParentTreeNode({
        _nodes: {
          ...item._nodes
        }
      });
      this.$store.dispatch("tabs/ActAddTab", {
        _nodes: {
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          tn: tn,
          dbConnection: this.menuItem._nodes.dbConnection,

          type: "table",
          dbKey: this.menuItem._nodes.dbKey,
          key: this.menuItem._nodes.key,
        },
        name: tn
      });
      this.dialogRenameTable.dialogShow = false;
      this.dialogRenameTable.defaultValue = null;
      this.$toast.success('Table renamed succesfully').goAway(3000);
      console.log(tn, cookie);
    },
    mtdDialogRenameTableCancel() {
      console.log("mtdDialogGetTableNameCancel cancelled");
      this.dialogRenameTable.dialogShow = false;
      this.dialogRenameTable.defaultValue = null;
    },
    mtdTableCreate(table) {

      const tables = table.name.split(',');
      this.$store.commit('notification/MutToggleProgressBar', true);
      this.dialogGetTableName.dialogShow = false;
      setTimeout(() => {
        for (let i = 0; i < tables.length; ++i) {
          if (tables[i]) {
            this.$store.dispatch("tabs/ActAddTab", {
              _nodes: {
                env: this.menuItem._nodes.env,
                dbAlias: this.menuItem._nodes.dbAlias,
                tn: tables[i],

                type: "table",
                dbKey: this.menuItem._nodes.dbKey,
                key: this.menuItem._nodes.key,
                dbConnection: this.menuItem._nodes.dbConnection,

                newTable: table
              },
              name: tables[i]
            });
          }
        }
      });
      setTimeout(() => this.$store.commit('notification/MutToggleProgressBar', false), 200);


      this.$set(this.dialogGetTableName, 'dialogShow', false)
    },
    mtdDialogGetTableNameSubmit(tn, cookie) {

      console.log(tn);

      let tables = tn.split(',');
      this.$store.commit('notification/MutToggleProgressBar', true);
      this.dialogGetTableName.dialogShow = false;
      setTimeout(() => {
        for (let i = 0; i < tables.length; ++i) {
          if (tables[i]) {
            this.$store.dispatch("tabs/ActAddTab", {
              _nodes: {
                env: this.menuItem._nodes.env,
                dbAlias: this.menuItem._nodes.dbAlias,
                tn: tables[i],

                type: "table",
                dbKey: this.menuItem._nodes.dbKey,
                key: this.menuItem._nodes.key,
                dbConnection: this.menuItem._nodes.dbConnection,

                newTable: true
              },
              name: tables[i]
            });
          }
        }
      });
      setTimeout(() => this.$store.commit('notification/MutToggleProgressBar', false), 200);

    },
    mtdDialogGetTableNameCancel() {
      console.log("mtdDialogGetTableNameCancel cancelled");
      this.dialogGetTableName.dialogShow = false;
    },
    mtdDialogGetViewNameSubmit(view_name) {
      console.log(view_name);
      this.$store.dispatch("tabs/ActAddTab", {
        _nodes: {
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          view_name: view_name,

          type: "view",
          dbKey: this.menuItem._nodes.key,
          key: this.menuItem._nodes.key,
          dbConnection: this.menuItem._nodes.dbConnection,

          newView: true
        },
        name: view_name
      });
      this.dialogGetViewName.dialogShow = false;
    },
    mtdDialogGetViewNameCancel() {
      console.log("mtdDialogGetTableNameCancel cancelled");
      this.dialogGetViewName.dialogShow = false;
    },
    mtdDialogGetFunctionNameSubmit(function_name) {
      console.log(function_name);
      this.$store.dispatch("tabs/ActAddTab", {
        _nodes: {
          dbKey: this.menuItem._nodes.dbKey,
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          function_name: function_name,
          newFunction: true,
          type: "function",
          key: this.menuItem._nodes.key,
          dbConnection: this.menuItem._nodes.dbConnection
        },
        name: function_name
      });
      this.dialogGetFunctionName.dialogShow = false;
    },
    mtdDialogGetFunctionNameCancel() {
      console.log("mtdDialogGetFunctionNameCancel cancelled");
      this.dialogGetFunctionName.dialogShow = false;
    },
    mtdDialogGetProcedureNameSubmit(procedure_name) {
      console.log(procedure_name);
      this.$store.dispatch("tabs/ActAddTab", {
        _nodes: {
          dbKey: this.menuItem._nodes.dbKey,
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          procedure_name: procedure_name,
          newProcedure: true,
          type: "procedure",
          key: this.menuItem._nodes.key
        },
        name: procedure_name
      });
      this.dialogGetProcedureName.dialogShow = false;
    },
    mtdDialogGetSequenceNameSubmit(sequence_name) {
      console.log(sequence_name);
      this.$store.dispatch("tabs/ActAddTab", {
        _nodes: {
          dbKey: this.menuItem._nodes.dbKey,
          env: this.menuItem._nodes.env,
          dbAlias: this.menuItem._nodes.dbAlias,
          sequence_name: sequence_name,
          newSequence: true,
          type: "sequence",
          key: this.menuItem._nodes.key,
          dbConnection: this.menuItem._nodes.dbConnection
        },
        name: sequence_name
      });
      this.dialogGetSequenceName.dialogShow = false;
    },
    mtdDialogGetProcedureNameCancel() {
      console.log("mtdDialogGetProcedureNameCancel cancelled");
      this.dialogGetProcedureName.dialogShow = false;
    },
    mtdDialogGetSequenceNameCancel() {
      console.log("mtdDialogGetSequenceNameCancel cancelled");
      this.dialogGetSequenceName.dialogShow = false;
    },
    async renameSelectedNode(action = "", item) {
      if (action === "showDialog") {
        this.selectedNodeForRename = {
          dialog: true,
          item: item,
          heading: `Rename ${item._nodes.type}`
        };
      } else if (action === "hideDialog") {
        this.selectedNodeForDelete = {
          dialog: false,
          item: null,
          heading: null
        };
      } else {

      }
    },
    async deleteSelectedNode(action = "", item) {
      if (action === "showDialog") {
        this.selectedNodeForDelete = {
          dialog: true,
          item: item,
          heading: `Click Submit to Delete The ${item._nodes.type}`
        };
      } else if (action === "hideDialog") {
        this.selectedNodeForDelete = {
          dialog: false,
          item: null,
          heading: null
        };
      } else {
        item = this.selectedNodeForDelete.item;

        // const client = await this.sqlMgr.projectGetSqlClient({
        //   env: item._nodes.env,
        //   dbAlias: item._nodes.dbAlias
        // });

        if (item._nodes.type === "table") {
          // const columns = await client.columnList({
          //   tn: item._nodes.tn
          // });

          // const result = await this.sqlMgr.sqlOp({
          //   env: item._nodes.env,
          //   dbAlias: item._nodes.dbAlias,
          // }, 'columnList', {
          //   tn: item._nodes.tn
          // });

          const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: item._nodes.env,
            dbAlias: item._nodes.dbAlias,
          }, 'columnList', {
            tn: item._nodes.tn
          }]);

          await this.sqlMgr.sqlOpPlus(
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias
            },
            "tableDelete",
            {tn: item._nodes.tn, columns: columns.data.list}
          );
          await this.loadTablesFromParentTreeNode({
            _nodes: {
              ...item._nodes
            }
          });
          this.$toast.success('Table deleted successfully').goAway(3000);
        } else if (item._nodes.type === "view") {
          // const view = await client.viewRead({
          //   view_name: item._nodes.view_name
          // });


          // const view = await this.sqlMgr.sqlOp({
          //   env: item._nodes.env,
          //   dbAlias: item._nodes.dbAlias
          // }, 'viewRead', {view_name: item._nodes.view_name})

          const view = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: item._nodes.env,
            dbAlias: item._nodes.dbAlias
          }, 'viewRead', {view_name: item._nodes.view_name}])

          //
          // await this.sqlMgr.sqlOpPlus(
          //   {
          //     env: item._nodes.env,
          //     dbAlias: item._nodes.dbAlias
          //   },
          //   "viewDelete",
          //   {
          //     view_name: item._nodes.view_name,
          //     oldViewDefination: view.view_definition
          //   }
          // );

          await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias
            },
            "viewDelete",
            {
              view_name: item._nodes.view_name,
              oldViewDefination: view.view_definition
            }]
          );
          await this.loadViewsFromParentTreeNode({
            _nodes: {
              ...item._nodes
            }
          });
          this.$toast.success('View deleted successfully').goAway(3000);
        } else if (item._nodes.type === "function") {
          //
          // const _function = await this.sqlMgr.sqlOp({
          //   env: item._nodes.env,
          //   dbAlias: item._nodes.dbAlias
          // }, 'functionRead', {
          //   function_name: item._nodes.function_name
          // });

          const _function = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: item._nodes.env,
            dbAlias: item._nodes.dbAlias
          }, 'functionRead', {
            function_name: item._nodes.function_name
          }]);

          // const _function = await client.functionRead({
          //   function_name: item._nodes.function_name
          // });
          //
          // await this.sqlMgr.sqlOpPlus(
          //   {
          //     env: item._nodes.env,
          //     dbAlias: item._nodes.dbAlias
          //   },
          //   "functionDelete",
          //   {
          //     function_name: item._nodes.function_name,
          //     oldCreateFunction: _function.create_function
          //   }
          // );

          await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias
            },
            "functionDelete",
            {
              function_name: item._nodes.function_name,
              oldCreateFunction: _function.create_function
            }
          ]);

          await this.loadFunctionsFromParentTreeNode({
            _nodes: {
              ...item._nodes
            }
          });
          this.$toast.success('Function deleted successfully').goAway(3000);
        } else if (item._nodes.type === "procedure") {
          // const procedure = await client.procedureRead({
          //   procedure_name: item._nodes.procedure_name
          // });
          //
          // const procedure = await this.sqlMgr.sqlOp({
          //   env: item._nodes.env,
          //   dbAlias: item._nodes.dbAlias
          // }, 'procedureRead', {
          //   procedure_name: item._nodes.procedure_name
          // });


          const procedure = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: item._nodes.env,
            dbAlias: item._nodes.dbAlias
          }, 'procedureRead', {
            procedure_name: item._nodes.procedure_name
          }]);

          // await this.sqlMgr.sqlOpPlus(
          //   {
          //     env: item._nodes.env,
          //     dbAlias: item._nodes.dbAlias
          //   },
          //   "procedureDelete",
          //   {
          //     procedure_name: item._nodes.procedure_name,
          //     create_procedure: procedure.create_procedure
          //   }
          // );

          await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: item._nodes.env,
              dbAlias: item._nodes.dbAlias
            },
            "procedureDelete",
            {
              procedure_name: item._nodes.procedure_name,
              create_procedure: procedure.create_procedure
            }
          ]);

          await this.loadProceduresFromParentTreeNode({
            _nodes: {
              ...item._nodes
            }
          });
          this.$toast.success('Procedure deleted successfully').goAway(3000);
        }

        await this.removeTabsByName(item);

        this.selectedNodeForDelete = {
          dialog: false,
          item: null,
          heading: null
        };
      }
    }
  },
  async created() {
    this.loadDefaultTabs();
    // this.instantiateSqlMgr();
    const _id = this.$route.params.project;

    if (_id === 'external') {

    }
    await this.loadProjectsData(_id);
    this.loadDefaultTabs();
  },
  beforeCreate() {
  },
  mounted() {
    // this.setBorderWidth();
    // this.setEvents();
  },
  async destroyed() {
    await this.clearProjects();
  }
};
</script>
<style scoped>
/deep/ .project-tree .v-treeview-node__level {
  width: 12px;
}

/deep/ .project-tree .v-treeview-node__toggle {
  width: 12px;
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
