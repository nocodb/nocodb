<template>
  <v-container fluid class="project-container ma-0 pa-0" style="position: relative">
    <v-tabs
      ref="projectTabs"
      v-model="activeTab"
      dark
      background-color="primary"
      height="40"
      class="project-tabs nc-project-tabs"
      color=""
      next-icon="mdi-arrow-right-bold-box-outline"
      prev-icon="mdi-arrow-left-bold-box-outline"
      show-arrows
      :class="{'dark-them' : $store.state.windows.darkTheme}"
    >
      <v-tabs-slider color="" />

      <v-tab
        v-for="(tab,index) in tabs"
        :key="`${pid}||${(tab._nodes && tab._nodes).type || ''}||${(tab._nodes && tab._nodes.dbAlias) || ''}||${tab.name}`"
        class="divider project-tab xc-border-right"
        :title="tab.name"
        :href="`#${(tab._nodes && tab._nodes).type || ''}||${(tab._nodes && tab._nodes.dbAlias) || ''}||${tab.name}`"
        @change="tabActivated(tab)"
      >
        <v-icon v-if="treeViewIcons[tab._nodes.type]" icon :small="true">
          {{ treeViewIcons[tab._nodes.type].openIcon }}
        </v-icon>

        <!--        <v-progress-circular-->
        <!--          v-if="operationTab === index"-->
        <!--          :value="100"-->
        <!--          :size="20" class="mr-2"-->
        <!--          indeterminate-->
        <!--        ></v-progress-circular>-->
        <span
          class="flex-grow-1 caption font-weight-bold text-capitalize mx-2"
          style="
  white-space: nowrap;
  overflow: hidden;max-width:140px;text-overflow:ellipsis"
        >{{ tab.name }}</span>
        <v-icon icon :small="true" @click="removeTab(index)">
          mdi-close
        </v-icon>
      </v-tab>

      <!--      <v-tabs-items v-model="activeTab">-->
      <v-tabs-items :value="activeTab">
        <v-tab-item
          v-for="(tab, index) in tabs"
          :key="`${pid}||${(tab._nodes && tab._nodes).type || ''}||${(tab._nodes && tab._nodes.dbAlias) || ''}||${tab.name}`"
          :value="`${(tab._nodes && tab._nodes.type) || ''}||${(tab._nodes && tab._nodes.dbAlias) || ''}||${tab.name}`"
          eager
          :transition="false"
          style="height:100%"
          :reverse-transition="false"
        >
          <div
            v-if="tab._nodes.type === 'table'"
            style="height:100%"
          >
            <!--          <sqlLogAndOutput :hide="hideLogWindows">-->
            <TableView :ref="'tabs'+index" :hide-log-windows.sync="hideLogWindows" :nodes="tab._nodes" />
            <!--          </sqlLogAndOutput>-->
          </div>
          <div v-else-if="tab._nodes.type === 'view'" style="height:100%">
            <!--            <sqlLogAndOutput>-->
            <ViewTab :ref="'tabs'+index" :nodes="tab._nodes" />
            <!--            </sqlLogAndOutput>-->
          </div>
          <div v-else-if="tab._nodes.type === 'function'" style="height:100%">
            <sqlLogAndOutput>
              <FunctionTab :ref="'tabs'+index" :nodes="tab._nodes" />
            </sqlLogAndOutput>
          </div>
          <div v-else-if="tab._nodes.type === 'procedure'" style="height:100%">
            <sqlLogAndOutput>
              <ProcedureTab :ref="'tabs'+index" :nodes="tab._nodes" />
            </sqlLogAndOutput>
          </div>
          <div v-else-if="tab._nodes.type === 'sequence'" style="height:100%">
            <sqlLogAndOutput>
              <SequenceTab :ref="'tabs'+index" :nodes="tab._nodes" />
            </sqlLogAndOutput>
          </div>
          <div v-else-if="tab._nodes.type === 'db'" style="height:100%">
            <audit-tab :ref="'tabs'+index" :nodes="tab._nodes" />
            <!--            <sqlLogAndOutput>-->
            <!--              <DbTab :nodes="tab._nodes" :ref="'tabs'+index"/>-->
            <!--            </sqlLogAndOutput>-->
          </div>
          <!--        <div v-else-if="tab._nodes.type === 'sqlEditor'">-->
          <!--          <SqlEditorTab :nodes="tab._nodes" ref=tabs/>-->
          <!--        </div>-->
          <div v-else-if="tab._nodes.type === 'seedParserDir'" style="height:100%">
            <sqlLogAndOutput>
              <SeedTab :ref="'tabs'+index" :nodes="tab._nodes" />
            </sqlLogAndOutput>
          </div>
          <div v-else-if="tab._nodes.type === 'migrationsDir'" style="height:100%">
            <audit-tab :ref="'tabs'+index" :nodes="tab._nodes" />

            <!--            <sqlLogAndOutput>-->
            <!--              <DbTab :nodes="tab._nodes" :ref="'tabs'+index"/>-->
            <!--            </sqlLogAndOutput>-->
          </div>
          <div v-else-if="tab._nodes.type === 'apisDir'" style="height:100%">
            <ApisTab :ref="'tabs'+index" :nodes="tab._nodes" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'apiClientDir'"
            style="height:100%"
          >
            <ApiClientTab :ref="'tabs'+index" :nodes="tab._nodes" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'apiClientSwaggerDir'"
            style="height:100%"
          >
            <ApiClientSwaggerTab :ref="'tabs'+index" :nodes="tab._nodes" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'sqlClientDir'"
            style="height:100%"
          >
            <sqlLogAndOutput>
              <SqlClientTab :ref="'tabs'+index" :nodes="tab._nodes" />
            </sqlLogAndOutput>
          </div>
          <div
            v-else-if="tab._nodes.type === 'terminal'"
            style="height:100%"
          >
            <x-term :ref="'tabs'+index" style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'graphqlClientDir'"
            style="height:100%"
          >
            <graphql-client style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'swaggerClientDir'"
            style="height:100%"
          >
            <swagger-client style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'grpcClient'"
            style="height:100%"
          >
            <grpc-client style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'meta'"
            style="height:100%"
          >
            <xc-meta style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'roles'"
            style="height:100%"
          >
            <auth-tab v-if="_isUIAllowed('team-auth')" :nodes="tab._nodes" style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'acl'"
            style="height:100%"
          >
            <global-acl :nodes="tab._nodes" style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'projectSettings'"
            style="height:100%"
          >
            <project-settings
              v-if="_isUIAllowed('settings')"
              :nodes="tab._nodes"
              style="height: 100%"
            />
          </div>
          <div
            v-else-if="tab._nodes.type === 'disableOrEnableModel'"
            style="height:100%"
          >
            <disable-or-enable-models
              v-if="_isUIAllowed('project-metadata')"
              :nodes="tab._nodes"
              style="height: 100%"
            />
          </div>
          <div
            v-else-if="tab._nodes.type === 'cronJobs'"
            style="height:100%"
          >
            <cron-jobs :nodes="tab._nodes" style="height: 100%" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'projectInfo'"
            style="height:100%"
          >
            <xc-info :nodes="tab._nodes" class="h-100" />
          </div>
          <div
            v-else-if="tab._nodes.type === 'appStore'"
            style="height:100%"
          >
            <app-store :nodes="tab._nodes" class="h-100" />
          </div>
          <div v-else style="height:100%">
            <h1>{{ tab.name }}</h1>
            <h1>{{ tab._nodes }}</h1>
          </div>
        </v-tab-item>
        <!--      </v-tabs-items>-->
      </v-tabs-items>

      <x-icon
        v-if="_isUIAllowed('addTable')"
        tooltip="Create new table"
        icon-class="add-btn"
        :color="[ 'white','grey lighten-2']"
        @click="dialogCreateTableShow = true"
      >
        mdi-plus-box
      </x-icon>
      <v-spacer />
      <div
        class="powered-by align-self-center  grey--text text--lighten-3 d-flex align-center"
        style="margin-right: 34px;font-size: .65rem ;"
      >
        <span>Powered by <a
          href="https://nocodb.com"
          target="_blank"
          class=" white--text"
          style="text-decoration: none"
        >NocoDB</a></span>
        <v-icon x-small class="ml-1 powered-by-close" color="grey lighten-1" @click="upgradeToEE">
          mdi-close-circle
        </v-icon>
      </div>
    </v-tabs>

    <dlg-table-create
      v-if="dialogCreateTableShow"
      v-model="dialogCreateTableShow"
      @create="$emit('tableCreate',$event); dialogCreateTableShow =false;"
    />

    <screensaver v-if="showScreensaver" class="screensaver" />
  </v-container>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'
// import Roles from '@/components/auth/roles'
// import CreateOrEditProject from '@/components/createOrEditProject'
import treeViewIcons from '../helpers/treeViewIcons'
import TableView from './project/table'
import ViewTab from './project/view'
import FunctionTab from './project/function'
import ProcedureTab from './project/procedure'
import SequenceTab from './project/sequence'
import SeedTab from './project/seed'
// import DbTab from "./project/auditTab/db";
// import SqlEditorTab from "./project/sqlClient";
import SqlClientTab from './project/sqlClient'
import ApisTab from './project/apis'
import ApiClientTab from './project/apiClientOld'
import sqlLogAndOutput from './project/sqlLogAndOutput'
import graphqlClient from './project/graphqlClient'
import xTerm from './xTerm'

import ApiClientSwaggerTab from './project/apiClientSwagger'
import XcMeta from './project/settings/xcMeta'
import XcInfo from './project/xcInfo'
import SwaggerClient from '@/components/project/swaggerClient'
import Screensaver from '@/components/screensaver'
import DlgTableCreate from '@/components/utils/dlgTableCreate'
import AppStore from '@/components/project/appStore'
import AuthTab from '@/components/authTab'
import CronJobs from '@/components/project/cronJobs'
import DisableOrEnableModels from '@/components/project/projectMetadata/disableOrEnableModels'
import ProjectSettings from '@/components/project/projectSettings'
import GrpcClient from '@/components/project/grpcClient'
import GlobalAcl from '@/components/globalAcl'
import AuditTab from '~/components/project/auditTab'

export default {
  components: {
    SwaggerClient,
    Screensaver,
    DlgTableCreate,
    AuditTab,
    AppStore,
    XcInfo,
    AuthTab,
    CronJobs,
    DisableOrEnableModels,
    // CreateOrEditProject,
    ProjectSettings,
    GrpcClient,
    GlobalAcl,
    // Roles,
    XcMeta,
    ApiClientSwaggerTab,
    TableView,
    ViewTab,
    FunctionTab,
    ProcedureTab,
    // DbTab,
    // SqlEditorTab,
    ApisTab,
    SqlClientTab,
    ApiClientTab,
    SeedTab,
    SequenceTab,
    sqlLogAndOutput,
    xTerm,
    graphqlClient
  },
  data() {
    return {
      dialogCreateTableShow: false,
      test: '',
      treeViewIcons,
      hideLogWindows: false,
      showScreensaver: false
    }
  },
  methods: {
    checkInactiveState() {
      let position = 0
      let idleTime = 0
      // Increment the idle time counter every minute.
      let idleInterval = setInterval(timerIncrement, 1000)

      const self = this
      // Zero the idle timer on mouse movement.
      document.addEventListener('mousemove', (e) => {
        self.showScreensaver = false
        idleTime = 0
        clearInterval(idleInterval)
        idleInterval = setInterval(timerIncrement, 1000)
      })
      document.addEventListener('keypress', (e) => {
        self.showScreensaver = false
        idleTime = 0
        clearInterval(idleInterval)
        idleInterval = setInterval(timerIncrement, 1000)
      })

      function timerIncrement() {
        idleTime = idleTime + 1
        if (idleTime > 120) {
          const title = document.title

          function scrolltitle() {
            document.title = title + Array(position).fill(' .').join('')
            position = ++position % 3
            if (self.showScreensaver) {
              window.setTimeout(scrolltitle, 400)
            } else {
              document.title = title
            }
          }

          self.showScreensaver = self.$store.state.windows.screensaver
          scrolltitle()
          clearInterval(idleInterval)
        }
      }
    },
    async handleKeyDown(event) {
      console.log('======== project tabs key handler')
      const activeTabEleKey = `tabs${this.activeTab}`
      let isHandled = false

      if (this.$refs[activeTabEleKey] &&
        this.$refs[activeTabEleKey][0] &&
        this.$refs[activeTabEleKey][0].handleKeyDown) {
        isHandled = await this.$refs[activeTabEleKey][0].handleKeyDown(event)
      }
      if (!isHandled) {
        switch ([this._isMac ? event.metaKey : event.ctrlKey, event.key].join('_')) {
          case 'true_w' :
            this.removeTab(this.activeTab)
            event.preventDefault()
            event.stopPropagation()
            break
        }
      }
    },
    ...mapMutations({
      setActiveTab: 'tabs/active',
      removeTab: 'tabs/remove',
      updateActiveTabx: 'tabs/activeTabCtx'
    }),
    tabActivated(tab) {

      // if (tab._nodes.type === 'apiClientDir' || tab._nodes.type === 'sqlClientDir' || tab._nodes.type === 'sqlEditor') {
      //   this.$store.commit('windows/MutToggleLogWindowFromTab', {client: true, status: true});
      // } else {
      //   this.$store.commit('windows/MutToggleLogWindowFromTab', {client: false, status: false});
      // }
    }
  },
  computed: {
    ...mapGetters({ tabs: 'tabs/list', activeTabCtx: 'tabs/activeTabCtx' }),
    pid() {
      return this.$route.params.project_id
    },
    activeTab: {
      // get() {
      //   console.log('activateTab========== get', this.$store.state.tabs.activeTab)
      //   return this.$store.state.tabs.activeTab;
      // },
      // set(val) {
      //   console.log('activateTab========== set', val)
      //   this.setActiveTab(val);
      // }
      set(tab) {
        if (!tab) {
          return this.$router.push({
            query: {}
          })
        }
        const [type, dbalias, name] = tab.split('||')
        this.$router.push({
          query: {
            ...this.$route.query,
            type,
            dbalias,
            name
          }
        })
      },
      get() {
        return [this.$route.query.type, this.$route.query.dbalias, this.$route.query.name].join('||')
      }
    }
  },

  beforeCreated() {
  },
  watch: {
    // tabs() {
    // if (this.tabs.length > 0) {
    //   const index = this.tabs.length - 1;
    //   if (this.activeTab !==0 && this.activeTab === index)
    //     this.setActiveTab(index - 1)
    //   setTimeout(() => this.setActiveTab(index));
    //   // this.$refs.projectTabs.onResize();
    // }
    // }
  },
  created() {
    document.addEventListener('keydown', this.handleKeyDown)
    /**
     * Listening for tab change so that we can hide/show projectlogs based on tab
     */
    // this.$store.watch(
    //   function (state) {
    //     return state.tabs.activeTabCtx;
    //   },
    //   () => {
    //     const tab = this.tabs[this.$store.state.tabs.activeTab];
    //     if (tab)
    //       this.tabActivated(tab)
    //   },
    //   // {
    //   //   deep: true //add this if u need to watch object properties change etc.
    //   // }
    // );

    this.checkInactiveState()
  },
  mounted() {
  },
  beforeDestroy() {
  },
  destroyed() {
    document.removeEventListener('keydown', this.handleKeyDown)
  },
  directives: {},
  validate({ params }) {
    return true
  },
  head() {
    return {}
  },
  props: {}
}
</script>

<style scoped>
/*/deep/ .project-tabs > .v-tabs-items {*/
/*  border-top: 1px solid #7F828B33;*/
/*}*/

/deep/ .project-tabs .v-tabs-bar {
  max-height: 30px;
}

/deep/ .project-tabs > .v-tabs-bar {
  max-height: 35px;
}

/*/deep/ .project-tabs .v-tabs-slider-wrapper {*/
/*  display: none;*/
/*}*/

/deep/ .project-tabs .v-tab.project-tab {
  text-transform: capitalize;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  background: #ffffff22;
  margin: 0px 1px 0 1px;
  color: white !important;
}

/deep/ .project-tabs .v-tab.v-tab--active.project-tab {
  background-color: white !important;
  color: rgba(51, 51, 51, 1) !important;
}

/deep/ .project-tabs.dark-them .v-tab.v-tab--active.project-tab {
  background-color: #272727 !important;
  color: white !important;
}

/*
/deep/ .project-tabs.dark-them > div > div > div > div > .v-tabs-slider {
  color: #272727 !important;
}
*/

/deep/ .project-tabs > div > div > div > div > .v-tabs-slider {
  color: transparent !important;
}

/deep/ .project-tabs .v-btn {
  text-transform: capitalize;
}

.powered-by .powered-by-close {
  opacity: 0;
  transition: .4s opacity;
}

.powered-by a {
  transition: .1s font-weight;
}

.powered-by:hover .powered-by-close {
  opacity: 1;
}

.powered-by:hover a {
  font-weight: bold;
}

/deep/ .add-btn {
  margin-left: 5px;
}

/deep/ .screensaver.body {
  position: absolute;
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
