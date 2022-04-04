<template>
  <v-app v-if="isProjectInfoLoaded">
    <snackbar />
    <v-app-bar
      class="elevation-0"
      color="primary"
      app
      clipped-left
      dense
      dark
      height="48"
    >
      <div class="d-flex align-center pt-1" style="flex: 1">
        <v-toolbar-title>
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                v-t="['toolbar:home']"
                to="/projects"
                icon
                class="pa-1 pr-0 brand-icon nc-noco-brand-icon"
                v-on="on"
              >
                <v-img :src="logo" max-height="32px" max-width="32px" />
              </v-btn>
            </template>
            <!-- Home -->
            {{ $t('general.home') }}
            <span
              class="caption  font-weight-light pointer"
            >(v{{
              $store.state.project.projectInfo && $store.state.project.projectInfo.version
            }})</span>
          </v-tooltip>

          <span class="body-1 ml-n2" @click="$router.push('/projects')"> {{ brandName }}</span>
        </v-toolbar-title>

        <!--        <v-toolbar-items  />-->
        <!-- loading -->
        <span v-show="$nuxt.$loading.show" class="caption grey--text ml-3">{{ $t('general.loading') }} <v-icon small color="grey">mdi-spin mdi-loading</v-icon></span>

        <span
          v-shortkey="[ 'ctrl','shift', 'd']"
          @shortkey="openDiscord"
        />
      </div>

      <div v-if="isDashboard" class="text-capitalize text-center title" style="flex: 1">
        {{ $store.getters['project/GtrProjectName'] }}
      </div>

      <div style="flex: 1" class="d-flex justify-end">
        <v-toolbar-items class="hidden-sm-and-down nc-topright-menu">
          <release-info />

          <language class="mr-3" />
          <template v-if="isDashboard">
            <div>
              <x-btn
                v-if="_isUIAllowed('add-user')"
                small
                btn-class="primary--text nc-menu-share white"
                @click="shareModal = true"
              >
                <v-icon small class="mr-1">
                  mdi-account-supervisor-outline
                </v-icon>
                <!-- Share -->
                {{ $t('activity.share') }}
              </x-btn>

              <share-or-invite-modal v-model="shareModal" />
            </div>
            <span
              v-shortkey="[ 'ctrl','shift', 'd']"
              @shortkey="$router.push('/')"
            />
            <x-btn
              v-if="!$store.state.windows.nc"
              text
              btn.class="caption font-weight-bold px-2 text-capitalize"
              tooltip="Enable/Disable Models"
              @click="cronTabAdd()"
            >
              <v-icon size="20">
                mdi-timetable
              </v-icon> &nbsp;
              Crons
            </x-btn>
          </template>
          <template v-else>
            <span
              v-shortkey="[ 'ctrl','shift', 'c']"
              @shortkey="settingsTabAdd"
            />

            <span
              v-shortkey="[ 'ctrl','shift', 'b']"
              @shortkey="changeTheme"
            />
          </template>

          <preview-as class="mx-1" />

          <v-menu
            v-if="isAuthenticated"
            offset-y
          >
            <template #activator="{ on }">
              <v-icon v-ge="['Profile','']" text class="font-weight-bold nc-menu-account icon" v-on="on">
                <!--              <v-icon></v-icon>-->
                mdi-dots-vertical
              </v-icon>
            </template>
            <v-list dense class="nc-user-menu">
              <template>
                <v-list-item v-t="['toolbar:user:email']" v-ge="['Settings','']" dense to="/user/settings">
                  <v-list-item-title>
                    <v-icon small>
                      mdi-at
                    </v-icon>&nbsp; <span class="font-weight-bold caption">{{ userEmail }}</span>
                  </v-list-item-title>
                </v-list-item>

                <v-divider />

                <!-- Copy Auth Token -->
                <!-- "Auth token copied to clipboard" -->
                <v-list-item
                  v-if="isDashboard"
                  v-t="['toolbar:user:copy-auth-token']"
                  v-clipboard="$store.state.users.token"
                  dense
                  @click.stop="$toast.success($t('msg.toast.authToken')).goAway(3000)"
                >
                  <v-list-item-title>
                    <v-icon key="terminal-dash" small>
                      mdi-content-copy
                    </v-icon>&nbsp;
                    <span class="font-weight-regular caption">{{ $t('activity.account.authToken') }}</span>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  v-if="swaggerOrGraphiqlUrl"
                  v-t="['toolbar:user:swagger']"
                  dense
                  @click.stop="openUrl(`${$axios.defaults.baseURL}${swaggerOrGraphiqlUrl}`)"
                >
                  <v-list-item-title>
                    <v-icon key="terminal-dash" small>
                      {{ isGql ? 'mdi-graphql' : 'mdi-code-json' }}
                    </v-icon>&nbsp;
                    <span class="font-weight-regular caption">
                      {{ isGql ? 'GraphQL APIs' : 'Swagger APIs Doc' }}</span>
                  </v-list-item-title>
                </v-list-item>
                <v-divider />
                <v-list-item
                  v-if="isDashboard"
                  v-t="['toolbar:user:copy-proj-info']"
                  v-ge="['Sign Out','']"
                  dense
                  @click="copyProjectInfo"
                >
                  <v-list-item-title>
                    <v-icon small>
                      mdi-content-copy
                    </v-icon>&nbsp; <span class="font-weight-regular caption">{{ $t('activity.account.projInfo') }}</span>
                  </v-list-item-title>
                </v-list-item>
                <v-divider v-if="isDashboard" />
                <v-list-item
                  v-if="isDashboard"
                  v-t="['toolbar:user:themes']"
                  dense
                  @click.stop="settingsTabAdd"
                >
                  <v-list-item-title>
                    <v-icon key="terminal-dash" small>
                      mdi-palette
                    </v-icon>&nbsp;
                    <span class="font-weight-regular caption">{{ $t('activity.account.themes') }}</span>
                  </v-list-item-title>
                </v-list-item>

                <v-divider v-if="isDashboard" />

                <v-list-item
                  v-t="['toolbar:user:sign-out']"
                  v-ge="['Sign Out','']"
                  dense
                  @click="MtdSignOut"
                >
                  <v-list-item-title>
                    <v-icon small>
                      mdi-logout
                    </v-icon>&nbsp; <span class="font-weight-regular caption">{{ $t('general.signOut') }}</span>
                  </v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>
          <v-menu v-else offset-y open-on-hover>
            <template #activator="{ on }">
              <v-btn v-ge="['Profile','']" text class=" font-weight-bold nc-menu-account" v-on="on">
                <!--              Menu-->
                <v-icon>mdi-account</v-icon>
                <v-icon>arrow_drop_down</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item v-if="!user && !isThisMobile" dense to="/user/authentication/signup">
                <v-list-item-title>
                  <v-icon small>
                    mdi-account-plus-outline
                  </v-icon> &nbsp; <span
                    class="font-weight-regular caption"
                  >{{ $t('general.signUp') }}</span>
                </v-list-item-title>
              </v-list-item>
              <v-list-item v-if="!user && !isThisMobile" dense to="/user/authentication/signin">
                <v-list-item-title>
                  <v-icon small>
                    mdi-login
                  </v-icon> &nbsp; <span class="font-weight-regular caption">{{ $t('general.signIn') }}</span>
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-toolbar-items>
      </div>
    </v-app-bar>

    <v-main class="pb-0 mb-0">
      <v-container class="ma-0 pa-0" fluid style="">
        <v-progress-linear
          v-show="GetPendingStatus"
          top
          absolute
          color="success"
          indeterminate
          height="2"
        />

        <nuxt />
      </v-container>
    </v-main>
    <dlgUnexpectedError
      v-if="dialogErrorShow"
      heading="Unexpected Error"
      :error="error"
      :dialog-error-show="dialogErrorShow"
      :error-dialog-cancel="errorDialogCancel"
      :error-dialog-report="errorDialogReport"
    />
    <dlgDebug
      v-if="dialogDebug"
      :dialog-show="dialogDebug"
      :mtd-dialog-cancel="dialogDebugCancel"
    />
    <settings v-model="settingsDialog" />
    <loader />
  </v-app>
  <v-app v-else>
    <v-overlay>
      <v-progress-circular indeterminate size="64" />
    </v-overlay>
  </v-app>
</template>

<script>
import ReleaseInfo from '@/components/releaseInfo'
import { mapGetters, mapActions, mapMutations } from 'vuex'
import 'splitpanes/dist/splitpanes.css'
import XBtn from '../components/global/xBtn'
import dlgUnexpectedError from '../components/utils/dlgUnexpectedError'
import settings from '../components/settings'
import { copyTextToClipboard } from '@/helpers/xutils'
import Snackbar from '~/components/snackbar'
import Language from '~/components/utils/language'
import Loader from '~/components/loader'
import PreviewAs from '~/components/previewAs'
import ShareOrInviteModal from '~/components/auth/shareOrInviteModal'

export default {
  components: {
    ShareOrInviteModal,
    PreviewAs,
    Loader,
    ReleaseInfo,
    Language,
    XBtn,
    Snackbar,
    dlgUnexpectedError,
    settings
  },
  data: () => ({
    clickCount: true,
    templateModal: false,
    swaggerOrGraphiqlUrl: null,
    showScreensaver: false,
    roleIcon: {
      owner: 'mdi-account-star',
      creator: 'mdi-account-hard-hat',
      editor: 'mdi-account-edit',
      viewer: 'mdi-eye-outline'
    },
    showAppStore: false,
    showChangeEnv: false,
    feedDialog: false,
    releaseDownloadedSnackbar: false,
    downloadAvailSnackbar: false,
    settingsDialog: false,
    environmentDialog: false,
    darkTheme: true,
    error: null,
    dialogErrorShow: false,
    dialogDebug: false,
    clipped: false,
    drawer: null,
    fixed: false,
    right: true,
    title: 'Xgene',
    isHydrated: false,
    snackbar: false,
    timeout: 10000,
    rolesList: null,
    shareModal: false
  }),
  computed: {
    ...mapGetters({
      logo: 'plugins/brandLogo',
      brandName: 'plugins/brandName',
      projects: 'project/list',
      tabs: 'tabs/list',
      sqldMgr: 'sqlMgr/sqlMgr',
      GetPendingStatus: 'notification/GetPendingStatus',
      isAuthenticated: 'users/GtrIsAuthenticated',
      isAdmin: 'users/GtrIsAdmin',
      isDocker: 'project/GtrIsDocker',
      isFirstLoad: 'project/GtrIsFirstLoad',
      isGql: 'project/GtrProjectIsGraphql',
      isRest: 'project/GtrProjectIsRest',
      isGrpc: 'project/GtrProjectIsGrpc',
      role: 'users/GtrRole',
      userEmail: 'users/GtrUserEmail'
    }),
    user() {
      return this.$store.getters['users/GtrUser']
    },
    isThisMobile() { // just an example, could be one specific value if that's all you need
      return this.isHydrated ? this.$vuetify.breakpoint.smAndDown : false
    }
  },
  watch: {
    '$route.path'(path, oldPath) {
      try {
        if (oldPath === path) {
          return
        }
        const recaptcha = this.$recaptchaInstance
        if (path.startsWith('/user/')) {
          recaptcha.showBadge()
        } else {
          recaptcha.hideBadge()
        }
      } catch (e) {
      }
    },
    '$route.params.project_id'(newId, oldId) {
      if (newId && newId !== oldId) {
        this.loadProjectInfo()
      }
      if (!newId) {
        this.swaggerOrGraphiqlUrl = null
      }
    }
  },
  mounted() {
    this.selectedEnv = this.$store.getters['project/GtrActiveEnv']
    this.loadProjectInfo()
  },
  methods: {
    ...mapActions({ changeActiveTab: 'tabs/changeActiveTab' }),
    ...mapMutations({
      toggleLogWindow: 'windows/MutToggleLogWindow',
      toggleOutputWindow: 'windows/MutToggleOutputWindow',
      toggleTreeviewWindow: 'windows/MutToggleTreeviewWindow'
    }),
    async loadProjectInfo() {
      // if (this.$route.params.project_id) {
      //   try {
      //     const { info } = (await this.$axios.get(`/nc/${this.$route.params.project_id}/projectApiInfo`, {
      //       headers: {
      //         'xc-auth': this.$store.state.users.token
      //       }
      //     })).data
      //     const obj = Object.values(info).find(v => v.apiType === 'rest' ? v.swaggerUrl : v.gqlApiUrl)
      //     this.swaggerOrGraphiqlUrl = obj.apiType === 'rest' ? obj.swaggerUrl : obj.gqlApiUrl
      //   } catch (e) {
      //   }
      // }
    },
    setPreviewUSer(previewAs) {
      this.previewAs = previewAs
      window.location.reload()
    },
    showAppStoreIcon() {
      this.showAppStore = true
      this.$toast.info('Apps unlocked').goAway(5000)
    },

    isProjectInfoLoaded() {
      return this.$store.state.project.projectInfo !== null
    },
    githubClickHandler(e) {
      //   e.preventDefault();
      //   shell.openExternal(e.path.find(e => e.href).href);
    },
    openUrl(url) {
      window.open(url, '_blank')
    },
    openPricingPage() {
      //   shell.openExternal(process.env.serverUrl + '/pricing')
    },
    openHowItWorks() {
      //   shell.openExternal(process.env.serverUrl + '/how-it-works')
    },
    openDiscord() {
      //   shell.openExternal('https://discord.gg/5RgZmkW')
    },
    openGithub() {
      //   shell.openExternal('https://github.com/NocoDB/NocoDB')
    },
    dialogDebugCancel() {
      this.dialogDebug = false
    },
    dialogDebugShow() {
      this.dialogDebug = true
    },

    errorDialogCancel() {
      this.dialogErrorShow = false
    },
    errorDialogReport() {
      this.dialogErrorShow = false
    },
    loadChat() {
      if (!window.Tawk_API) {
        const s1 = document.createElement('script')
        const s0 = document.getElementsByTagName('script')[0]
        s1.async = true
        s1.src = 'https://embed.tawk.to/5d81b8de9f6b7a4457e23ba7/default'
        s1.charset = 'UTF-8'
        s1.setAttribute('crossorigin', '*')
        s0.parentNode.insertBefore(s1, s0)
        setTimeout(() => window.Tawk_API && window.Tawk_API.maximize(), 2000)
      } else {
        window.Tawk_API.maximize()
      }
    },
    handleMigrationsMenuClick(item, closeMenu = true, sqlEditor = false) {
    },
    apiClientTabAdd() {
      // if (this.$route.path.indexOf('dashboard') > -1) {
      const tabIndex = this.tabs.findIndex(el => el.key === 'apiClientDir')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'API Client', key: 'apiClientDir' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'apiClientDir'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    apiClientSwaggerTabAdd() {
      // if (this.$route.path.indexOf('dashboard') > -1) {
      const tabIndex = this.tabs.findIndex(el => el.key === 'apiClientSwaggerDir')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'API Client', key: 'apiClientSwaggerDir' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'apiClientSwaggerDir'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    projectInfoTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'projectInfo')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'Info', key: 'projectInfo' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'projectInfo'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    xcMetaTabAdd() {
      // if (this.$route.path.indexOf('dashboard') > -1) {
      const tabIndex = this.tabs.findIndex(el => el.key === 'meta')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'Meta', key: 'meta' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'meta'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    apiClientSwaggerOpen() {
      this.$router.push('/apiClient')
    },
    graphqlClientTabAdd() {
      window.open(this.swaggerOrGraphiqlUrl, '_blank')
    },
    swaggerClientTabAdd() {
      window.open(this.swaggerOrGraphiqlUrl, '_blank')
    },
    grpcTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'grpcClient')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'gRPC Client', key: 'grpcClient' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'grpcClient'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    rolesTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'roles')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'Team & Auth ', key: 'roles' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'roles'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
      setTimeout(() => {
        this.$eventBus.$emit('show-add-user')
      }, 200)
    },
    settingsTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'projectSettings')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'Themes', key: 'projectSettings' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'projectSettings'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    aclTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'acl')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'ACL', key: 'acl' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'acl'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    disableOrEnableModelTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'disableOrEnableModel')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'Meta Management', key: 'disableOrEnableModel' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'disableOrEnableModel'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    cronTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'cronJobs')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'Cron Jobs', key: 'cronJobs' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'cronJobs'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    appsTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === 'appStore')
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex)
      } else {
        const item = { name: 'App Store', key: 'appStore' }
        item._nodes = { env: '_noco' }
        item._nodes.type = 'appStore'
        this.$store.dispatch('tabs/ActAddTab', item)
      }
    },
    async codeGenerateMvc() {
      try {
        await this.sqlMgr.projectGenerateBackend({
          env: '_noco'
        })
        this.$toast.success('Yay, REST APIs with MVC generated').goAway(4000)
      } catch (e) {
        this.$toast.error('Error generating REST APIs code :' + e).goAway(4000)
        throw e
      }
    },
    cookieStatus(status) {
      this.status = status
    },
    cookieClickedAccept() {
      this.status = 'accept'
    },
    cookieClickedDecline() {
      this.status = 'decline'
      // localStorage.removeItem('vue-cookie-accept-decline')
    },
    removeCookie() {
      // console.log('Cookie removed')
      localStorage.removeItem('vue-cookie-accept-decline')
      this.status = 'Cookie removed, refresh the page.'
    },

    MtdContactUs() {
      this.snackbar = true
    },

    MtdHiring() {
      this.$router.push('/info/hiring')
    },

    MtdFaq() {
      this.$router.push('/info/faq')
    },
    MtdTos() {
      this.$router.push('/info/tos')
    },
    async MtdSignOut() {
      await this.$store.dispatch('users/ActSignOut')
      this.$router.push('/user/authentication/signin')
    },
    MtdToggleDrawer() {
      if (!this.$store.getters['users/GtrUser']) {
        this.drawer = false
      } else {
        this.drawer = !this.drawer
      }
      // console.log('Toggling drawer', this.drawer);
    },
    changeTheme() {
      this.$store.dispatch('windows/ActToggleDarkMode', !this.$store.state.windows.darkTheme)
      this.$tele.emit('toolbar:theme')
    },
    async copyProjectInfo() {
      try {
        const data = (await this.$api.project.metaGet(this.$store.state.project.projectId))// await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'ncProjectInfo'])
        copyTextToClipboard(Object.entries(data).map(([k, v]) => `${k}: **${v}**`).join('\n'))
        this.$toast.info('Copied project info to clipboard').goAway(3000)
      } catch (e) {
        console.log(e)
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }

}
</script>
<style scoped>
a {
  text-decoration: none;
}

.brand-icon::before {
  background: none !important;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  60% {
    transform: scale(1);
  }
  70% {
    /*opacity: 0;*/
    transform: scale(1.35);
  }
  80% {
    transform: scale(1);
  }
  90% {
    /*opacity: 0;*/
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}

.heart-anim {
  animation-name: pulse;
  animation-duration: 4.5s;
  animation-iteration-count: infinite;
}

/deep/ .v-toolbar__items {
  align-items: center;
}

/deep/ .nc-ripple {
  border-radius: 50%;
}

/deep/ .nc-user-menu .v-list-item--dense, /deep/ .nc-user-menu .v-list--dense .v-list-item {
  min-height: 35px
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
