<script lang="ts" setup>
import { navigateTo } from '#app'
const route = useRoute()
const openDiscord = () => {
  //   shell.openExternal('https://discord.gg/5RgZmkW')
}
const isDashboard = computed(() => {
  return route.path && (route.path === '/nc' || route.path === '/nc/' || route.path.startsWith('/nc/'))
})
</script>

<template>
  <v-app>
    <slot name="header">
      <v-app-bar class="elevation-1" color="primary" app clipped-left dense dark height="48">
        <div class="d-flex align-center pt-1" style="flex: 1">
          <v-toolbar-title>
            <v-tooltip bottom>
              {{ $t('general.home') }}
              <span class="caption font-weight-light pointer">(version)</span>
            </v-tooltip>

            <span class="body-1" @click="navigateTo('/projects')">NocoDB</span>
          </v-toolbar-title>

          <!-- todo: loading is not yet supported by nuxt 3 - see https://v3.nuxtjs.org/migration/component-options#loading
          <span v-show="$nuxt.$loading.show" class="caption grey--text ml-3">
            {{ $t('general.loading') }} <v-icon small color="grey">mdi-spin mdi-loading</v-icon>
          </span>


          todo: replace shortkey?
          <span v-shortkey="['ctrl', 'shift', 'd']" @shortkey="openDiscord" />
           -->
        </div>

        <!-- todo: implement isDashboard
        <div v-if="isDashboard" class="text-capitalize text-center title" style="flex: 1">
          {{ $store.getters['project/GtrProjectName'] }}
        </div>
        -->

        <div style="flex: 1" class="d-flex justify-end">
          <v-toolbar-items class="hidden-sm-and-down nc-topright-menu">
            <!-- todo: implement components
            <release-info />
            -->

            <general-language class="mr-3" />

            <!-- todo: implement isDashboard
            <template v-if="isDashboard">
              <div>
                <x-btn
                  v-if="_isUIAllowed('add-user')"
                  small
                  btn-class="primary--text nc-menu-share white"
                  @click="shareModal = true"
                >
                  <v-icon small class="mr-1"> mdi-account-supervisor-outline </v-icon>
                  {{ $t('activity.share') }}
                </x-btn>

                <share-or-invite-modal v-model="shareModal" />
              </div>
              <span v-shortkey="['ctrl', 'shift', 'd']" @shortkey="navigateTo('/')" />
              <x-btn
                v-if="!$store.state.settings.nc"
                text
                btn.class="caption font-weight-bold px-2 text-capitalize"
                tooltip="Enable/Disable Models"
                @click="cronTabAdd()"
              >
                <v-icon size="20"> mdi-timetable </v-icon> &nbsp; Crons
              </x-btn>
            </template>

            <template v-else>
              <span v-shortkey="['ctrl', 'shift', 'c']" @shortkey="settingsTabAdd" />

              <span v-shortkey="['ctrl', 'shift', 'b']" @shortkey="changeTheme" />
            </template>



            <preview-as class="mx-1" />

            <v-menu v-if="isAuthenticated" offset-y>
              <template #activator="{ on }">
                <v-icon v-ge="['Profile', '']" text class="font-weight-bold nc-menu-account icon" v-on="on">
                  mdi-dots-vertical
                </v-icon>
              </template>
              <v-list dense class="nc-user-menu">
                <template>
                  <v-list-item v-t="['c:navbar:user:email']" v-ge="['Settings', '']" dense to="/user/settings">
                    <v-list-item-title>
                      <v-icon small> mdi-at </v-icon>&nbsp;
                      <span class="font-weight-bold caption">{{ userEmail }}</span>
                    </v-list-item-title>
                  </v-list-item>

                  <v-divider />

                  <v-list-item
                    v-if="isDashboard"
                    v-t="['a:navbar:user:copy-auth-token']"
                    v-clipboard="$store.state.users.token"
                    dense
                    @click.stop="$toast.success($t('msg.toast.authToken')).goAway(3000)"
                  >
                    <v-list-item-title>
                      <v-icon key="terminal-dash" small> mdi-content-copy </v-icon>&nbsp;
                      <span class="font-weight-regular caption">{{ $t('activity.account.authToken') }}</span>
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item v-if="isDashboard" v-t="['a:navbar:user:swagger']" dense @click.stop="openUrl(swaggerLink)">
                    <v-list-item-title>
                      <v-icon key="terminal-dash" small> mdi-code-json </v-icon>&nbsp;
                      <span class="font-weight-regular caption"> {{ 'Swagger API Doc' }}</span>
                    </v-list-item-title>
                  </v-list-item>
                  <v-divider />
                  <v-list-item
                    v-if="isDashboard"
                    v-t="['c:navbar:user:copy-proj-info']"
                    v-ge="['Sign Out', '']"
                    dense
                    @click="copyProjectInfo"
                  >
                    <v-list-item-title>
                      <v-icon small> mdi-content-copy </v-icon>&nbsp;
                      <span class="font-weight-regular caption">{{ $t('activity.account.projInfo') }}</span>
                    </v-list-item-title>
                  </v-list-item>
                  <v-divider v-if="isDashboard" />
                  <v-list-item v-if="isDashboard" v-t="['c:navbar:user:themes']" dense @click.stop="settingsTabAdd">
                    <v-list-item-title>
                      <v-icon key="terminal-dash" small> mdi-palette </v-icon>&nbsp;
                      <span class="font-weight-regular caption">{{ $t('activity.account.themes') }}</span>
                    </v-list-item-title>
                  </v-list-item>

                  <v-divider v-if="isDashboard" />

                  <v-list-item v-t="['a:navbar:user:sign-out']" v-ge="['Sign Out', '']" dense @click="MtdSignOut">
                    <v-list-item-title>
                      <v-icon small> mdi-logout </v-icon>&nbsp;
                      <span class="font-weight-regular caption">{{ $t('general.signOut') }}</span>
                    </v-list-item-title>
                  </v-list-item>
                </template>
              </v-list>
            </v-menu>
            <v-menu v-else offset-y open-on-hover>
              <template #activator="{ on }">
                <v-btn v-ge="['Profile', '']" text class="font-weight-bold nc-menu-account" v-on="on">
                  <v-icon>mdi-account</v-icon>
                  <v-icon>arrow_drop_down</v-icon>
                </v-btn>
              </template>
              <v-list dense>
                <v-list-item v-if="!user && !isThisMobile" dense to="/user/authentication/signup">
                  <v-list-item-title>
                    <v-icon small> mdi-account-plus-outline </v-icon> &nbsp;
                    <span class="font-weight-regular caption">{{ $t('general.signUp') }}</span>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="!user && !isThisMobile" dense to="/user/authentication/signin">
                  <v-list-item-title>
                    <v-icon small> mdi-login </v-icon> &nbsp;
                    <span class="font-weight-regular caption">{{ $t('general.signIn') }}</span>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            -->
          </v-toolbar-items>
        </div>
      </v-app-bar>
    </slot>

    <slot name="sidebar" />
    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>
