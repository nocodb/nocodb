<template>


  <v-app v-if="isProjectInfoLoaded">
    <snackbar/>
    <v-app-bar
      class="elevation-0"
      color="primary"
      app
      clipped-left
      dense
      dark
      @contextmenu="showAirtabLikeLink++"
      height="40"
    >
      {{ $store.state.plugins.brand }}
      <!-- <v-toolbar-side-icon></v-toolbar-side-icon> -->
      <v-toolbar-title>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn to="/projects" icon class="pa-1 brand-icon" v-on="on">
              <v-img :src="logo" max-height="30px" max-width="30px"></v-img>
              <!-- <v-icon color="primary">alpha-x-circle</v-icon
              ><v-icon color="primary">alpha-c-circle </v-icon> -->
            </v-btn>
          </template>
          Home
          <span
            class="caption ml-1 font-weight-light">(v{{
              $store.state.project.projectInfo && $store.state.project.projectInfo.version
            }})</span>
        </v-tooltip>
        <template><span class="title"> {{ brandName }}</span>
        </template>
      </v-toolbar-title>

      <v-toolbar-items class="ml-3">

        <gh-btns-star
          icon="mark-github" slug="nocodb/nocodb" show-count class="mr-3 align-self-center"></gh-btns-star>
      </v-toolbar-items>
        <!-- <template v-if="!isThisMobile ">


                  <a class="align-self-center" style="" target="_blank" href="https://calendly.com/nocodb">

                    <x-icon size="20" tooltip="Book a free demo" color="white" icon.class="mr-3">mdi-calendar-month</x-icon>

                  </a>

                  <a href="https://twitter.com/NocoDB" target="_blank" class="align-self-center" style="">
                    <v-icon size="20" color="white" class="mr-3">mdi-twitter</v-icon>
                  </a>
                  &lt;!&ndash;            <v-menu offset-y>&ndash;&gt;
                  &lt;!&ndash;              <template v-slot:activator="{on}">&ndash;&gt;
                  &lt;!&ndash;                href="https://discord.gg/5RgZmkW"&ndash;&gt;
                  <a target="_blank" class="align-self-center" style="" href="https://discord.gg/5RgZmkW">
                    <v-icon size="20" color="white" class="mr-3">mdi-discord</v-icon>
                  </a>
                  &lt;!&ndash;              </template>&ndash;&gt;
                  &lt;!&ndash;              <discord></discord>&ndash;&gt;
                  &lt;!&ndash;            </v-menu>&ndash;&gt;
                </template>

              </v-toolbar-items>-->
        <span class="caption grey--text ml-3" v-show="$nuxt.$loading.show">Loading <v-icon small color="grey">mdi-spin mdi-loading</v-icon></span>

        <!--      <gh-btns-star-->
        <!--        @click.native="githubClickHandler"-->
        <!--        class="black&#45;&#45;text"-->
        <!--        icon="mark-github" slug="nocodb/nocodb" show-count></gh-btns-star>-->
        <!--

              <x-icon key="discord-dash" iconClass="ml-4" @click="openDiscord" tooltip="Discord Chat (^⇧D)">mdi-discord
              </x-icon>

              <a href="https://twitter.com/xgenecloud" target="_blank">
                <x-icon key="twitter-dash" iconClass="ml-4" tooltip="Twitter">
                  mdi-twitter
                </x-icon>
              </a>

              <a href="https://calendly.com/nocodb" target="_blank">
                <x-icon iconClass="ml-4" tooltip="Book a demo">
                  mdi-video-outline
                </x-icon>
              </a>-->

        <!--      <x-btn btn.class=" mr-4" small text-->
        <!--             tooltip="We'll help you get started over a video call"-->
        <!--             @click="openUrl('https://calendly.com/nocodb')">-->
        <!--        <v-icon-->

        <!--          color="">-->
        <!--          mdi-video-outline-->
        <!--        </v-icon> &nbsp; Free Demo-->
        <!--      </x-btn>-->
        <span v-shortkey="[ 'ctrl','shift', 'd']"
              @shortkey="openDiscord"></span>


        <v-spacer></v-spacer>
        <div style="position: absolute; top:0;left:0;width:100%; pointer-events: none" class="d-flex align-center">
          <h5 class="text-center mx-auto mb-0 mt-1 title font-weight-bold text-capitalize"
              v-if="isDashboard && $store.getters['project/GtrProjectName'] !== '__project__'">
            <v-icon small class="mr-2\1" color="grey lighten-2">
              mdi-folder-outline
            </v-icon>
            {{ $store.getters['project/GtrProjectName'] }}
            <v-tooltip bottom>
              <template v-slot:activator="{on}">
                <v-icon style="pointer-events:all" x-small v-on="on" color="grey lighten-2">
                  mdi-information-outline
                </v-icon>
              </template>
              Project name
            </v-tooltip>
          </h5>
        </div>


        <v-spacer></v-spacer>


        <v-toolbar-items class="hidden-sm-and-down">



          <!--        <x-icon iconClass="mr-4" v-if="isDashboard"-->
          <!--                @click="codeGenerateMvc()"-->
          <!--                tooltip="Generate REST Code (^⇧G)"-->
          <!--                color="success success">-->
          <!--          mdi-language-javascript-->
          <!--        </x-icon>-->
          <!--        <span v-shortkey="['ctrl','shift','m']" v-if="isDashboard"  @shortkey="codeGenerateMvc()"></span>-->

          <!--        <x-icon iconClass="mr-4"-->
          <!--                v-if="isDashboard"-->
          <!--                @click="codeGenerateMvcGql()"-->
          <!--                color="accent accent"-->
          <!--                tooltip="Generate GraphQL Code (^⇧G)">-->
          <!--          mdi-language-javascript-->
          <!--        </x-icon>-->
          <!--        <span v-shortkey="['ctrl','shift','q']" v-if="isDashboard"  @shortkey="codeGenerateMvcGql()"></span>-->

          <!--        <x-icon iconClass="mr-4"-->
          <!--                v-if="isDashboard"-->
          <!--                @click="codeClear()"-->
          <!--                color="error error"-->
          <!--                tooltip="Delete all code (^⇧G)">-->
          <!--          mdi-delete-variant-->
          <!--        </x-icon>-->
          <!--        <span v-shortkey="['ctrl','shift','c']" v-if="isDashboard"  @shortkey="codeClear()"></span>-->

          <template v-if="isDashboard">

            <div>
              <x-btn v-if="_isUIAllowed('add-user')" @click="rolesTabAdd" small color="white" btn-class="primary--text">
                <v-icon small class="mr-1">mdi-account-supervisor-outline</v-icon>
                Share
              </x-btn>
            </div>
            <!--      <github-button v-show="$store.state.isLoaded" class="mt-2 mr-md-2" href="https://github.com/nocodb/nocodb"-->
            <!--                     data-color-scheme="no-preference: light; light: light; dark: light;" data-size="large"-->
            <!--                     data-show-count="true" aria-label="Star nocodb/nocodb on GitHub">Star-->
            <!--      </github-button>-->


            <!-- <v-menu offset-y>
               <template v-slot:activator="{on}">
                 <div class="align-self-center" v-on="on">
                   <v-icon small color="" class="mr-1 heart-anim">mdi-heart</v-icon>
                   <span class="body-2">Community</span>
                   <v-icon small>mdi-menu-down</v-icon>
                 </div>
               </template>


               <v-list dense>
                 <v-list-item>
                   <v-icon small class="mr-1">mdi-github</v-icon>
                   <span class="caption text-capitalize">Github</span>
                 </v-list-item>
                 <v-list-item>
                   <v-icon small class="mr-1">mdi-discord</v-icon>
                   <span class="caption text-capitalize">Discord</span>
                 </v-list-item>

                 <v-list-item>
                   <v-icon small class="mr-1">mdi-discord</v-icon>
                   <span class="caption text-capitalize">Discord</span>
                 </v-list-item>
               </v-list>
             </v-menu>
   -->
            <!--
             <v-menu offset-y v-if="rolesList">
                        <template v-slot:activator="{on}">
                          <div class="d-flex align-center">
                            <v-btn small outlined v-on="on">
                              <v-icon small class="mr-1">mdi-drama-masks</v-icon>
                              <span>Preview as</span>
                              <v-icon small>mdi-menu-down</v-icon>
                            </v-btn>
                          </div>
                        </template>


                        <v-list dense>
                          <v-list-item v-for="role in rolesList" @click="setPreviewUSer(role.title)" :key="role.title">
                            <v-icon small class="mr-1">{{ roleIcon[role.title] }}</v-icon>
                            <span class="caption text-capitalize">{{ role.title }}</span>
                          </v-list-item>
                          <template v-if="previewAs">
                            <v-divider></v-divider>
                            <v-list-item @click="setPreviewUSer(null)">
                              <v-icon small class="mr-1">mdi-close</v-icon>
                              <span class="caption">Reset Preview</span>
                            </v-list-item>
                          </template>
                        </v-list>
                      </v-menu>

            -->

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-icon v-on="on" class="mt-1 ml-3" size="22" @click="$store.commit('windows/MutToggleTheme')">
                  mdi-format-color-fill
                </v-icon>
              </template>
              Change theme (^⇧M)
            </v-tooltip>

            <span v-shortkey="[ 'ctrl','shift', 'b']"
                  @shortkey="changeTheme"></span>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-icon @dblclick="showAppStore=true" @click="changeTheme" v-on="on" size="20"
                        class="ml-3"> {{ $vuetify.theme.dark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}
                </v-icon>
              </template>
              <span class="caption">
              {{ $vuetify.theme.dark ? 'Click for light theme' : 'Click for dark theme' }}
              <i></i>
            </span>
            </v-tooltip>


            <!--          <template v-if="isDocker">-->
            <!--            <x-btn text btn.class="caption font-weight-bold px-2" tooltip="Metadata Operations"-->
            <!--                   @click="xcMetaTabAdd">-->

            <!--              <v-icon class="mt-n1">-->
            <!--                mdi-file-table-box-multiple-outline-->
            <!--              </v-icon> &nbsp;-->
            <!--              Meta-->
            <!--            </x-btn>-->


            <!--            <x-btn text btn.class="caption font-weight-bold px-2" tooltip="Change Environment"-->
            <!--                   @click="showChangeEnv = true">-->

            <!--              <v-icon>-->
            <!--                mdi-test-tube-->
            <!--              </v-icon> &nbsp;-->
            <!--              Change Env-->
            <!--            </x-btn>-->
            <!--          </template>-->


            <span v-shortkey="[ 'ctrl','shift', 'd']"
                  @shortkey="$router.push('/')"></span>

            <x-btn text btn.class="caption font-weight-bold px-2 text-capitalize" v-if="showAirtabLikeLink > 2"
                   tooltip="Data (^⇧D)"
                   to="/datatable">

              <v-icon size="20">
                mdi-table
              </v-icon> &nbsp;
              Data
            </x-btn>

            <!--          v-if="showAppStore"-->

            <!--       <x-btn text btn.class="caption font-weight-bold px-2 text-capitalize"
                          tooltip="App store"
                          @click="appsTabAdd()">

                     <v-icon size="16" class="mt-n1">
                       mdi-storefront-outline
                     </v-icon> &nbsp;
                     App Store
                   </x-btn>-->

            <!--          <x-btn text btn.class="caption font-weight-bold px-2 text-capitalize" tooltip="Meta Management"-->
            <!--                 @dblclick="showAppStoreIcon"-->
            <!--                 @click="disableOrEnableModelTabAdd()">-->

            <!--            <v-icon size="20">mdi-table-multiple-->
            <!--            </v-icon> &nbsp;-->
            <!--            Meta-->
            <!--          </x-btn>-->

            <!--          <x-btn text btn.class="caption font-weight-bold px-2 text-capitalize" tooltip="Roles & Users Management"-->
            <!--                 @click="rolesTabAdd()">-->

            <!--            <v-icon size="20">-->
            <!--              mdi-account-group-->
            <!--            </v-icon> &nbsp;-->
            <!--            Team-->
            <!--          </x-btn>-->

            <x-btn
              v-if="!$store.state.windows.nc"
              text btn.class="caption font-weight-bold px-2 text-capitalize" tooltip="Enable/Disable Models"
              @click="cronTabAdd()">

              <v-icon size="20">mdi-timetable
              </v-icon> &nbsp;
              Crons
            </x-btn>
            <!--          <x-btn text btn.class="caption font-weight-bold px-2" tooltip="ACL Management"-->
            <!--                 @click="aclTabAdd()">-->

            <!--            <v-icon>-->
            <!--              mdi-shield-edit-outline-->
            <!--            </v-icon> &nbsp;-->
            <!--            ACL-->
            <!--          </x-btn>-->

            <!--          <span v-shortkey="['ctrl','shift','g']" @shortkey="graphqlClientTabAdd()"></span>-->


            <!--          <x-btn v-if="isGql" text btn.class="caption font-weight-bold px-2" tooltip="GraphQL Client (^⇧G)"-->
            <!--                 @click="graphqlClientTabAdd()">-->

            <!--          <v-icon tooltip="GraphQL Client (^⇧G)"-->
            <!--                  v-if="!$store.state.windows.nc && isGql"-->
            <!--                  @click="graphqlClientTabAdd()" class="ml-3 " size="20">-->
            <!--            mdi-graphql-->
            <!--          </v-icon>-->
            <!--          <v-icon tooltip="GraphQL Client (^⇧G)"-->
            <!--                  v-if="isRest"-->
            <!--                  @click="swaggerClientTabAdd()" class="ml-3 " size="20">-->
            <!--            mdi-code-json-->
            <!--          </v-icon>-->
            <!--            &nbsp;-->
            <!--            GraphiQL-->
            <!--          </x-btn>-->
            <span v-shortkey="['ctrl','shift','g']" @shortkey="graphqlClientTabAdd()"></span>


            <!--          <x-btn v-if="isGrpc" text btn.class="caption font-weight-bold px-2" tooltip="GraphQL Client (^⇧G)"-->
            <!--                 @click="grpcTabAdd()">-->

            <v-icon
              v-if="!$store.state.windows.nc && isGrpc"
              size="20" class="ml-3 " tooltip="GraphQL Client (^⇧G)"
              @click="grpcTabAdd()">
              mdi-alpha-g-circle-outline
            </v-icon>
            <!--            &nbsp;-->
            <!--            gRPC-->
            <!--          </x-btn>-->


            <!--          <x-icon iconClass="mr-4" @click="apiClientTabAdd()" tooltip="API Client (^⇧A)">mdi-send-->
            <!--          </x-icon>-->

            <!--          <x-btn text @click="apiClientSwaggerTabAdd()" tooltip="API Client (^⇧A)"-->
            <!--                 btn.class="caption font-weight-bold px-2">-->


            <v-icon class="ml-3 "
                    v-if="!$store.state.windows.nc" size="20" @click="apiClientSwaggerTabAdd()"
                    tooltip="API Client (^⇧A)">mdi-code-json
            </v-icon>
            <!--            &nbsp; REST Client-->
            <!--          </x-btn>-->

            <!--          <x-icon iconClass="mr-4" tooltip="Feed (^⇧F)" @click="feedDialog = true">mdi-glasses</x-icon>-->
            <!--          <span v-shortkey="['ctrl','shift','f']" @shortkey="feedDialog = true"></span>-->


            <span v-shortkey="['ctrl','shift','a']" @shortkey="apiClientTabAdd()"></span>

            <!--          <x-btn text btn.class="caption font-weight-bold px-2" @click="terminalTabAdd()"-->
            <!--                 tooltip="API Generator Console (^⇧T)">-->

            <!--            <v-icon key="terminal-dash">-->
            <!--              mdi-console-->
            <!--            </v-icon>&nbsp;-->
            <!--            {{ isDocker ? 'Docker Console' : 'API Generator' }}-->
            <!--          </x-btn>-->

            <span v-shortkey="[ 'ctrl','shift', 'c']"
                  @shortkey="settingsDialog = true"></span>


            <!--          <span v-shortkey="[ 'ctrl','shift', 'd']"-->
            <!--                @shortkey="openDiscord"></span>-->


            <!--          <x-icon key="discord-dash" iconClass="mr-4" @click="openDiscord" tooltip="Discord Chat (^⇧D)">mdi-discord-->
            <!--          </x-icon>-->


            <!--          <x-icon key="github-dash" iconClass="mr-4" @click="openGithub" tooltip="Github">mdi-github-circle-->
            <!--          </x-icon>-->
            <!--          <span v-shortkey="[ 'ctrl','shift', 'm']"
                            @shortkey="$store.commit('windows/MutToggleTheme')"></span>

                      <v-tooltip bottom>
                        <template v-slot:activator="{ on }">
                          <v-icon v-on="on" class="mt-1 ml-3" size="22" @click="$store.commit('windows/MutToggleTheme')">
                            mdi-format-color-fill
                          </v-icon>
                        </template>
                        Change theme (^⇧M)
                      </v-tooltip>

                      <span v-shortkey="[ 'ctrl','shift', 'b']"
                            @shortkey="changeTheme"></span>
                      <v-tooltip bottom>
                        <template v-slot:activator="{ on }">
                          <v-icon @dblclick="showAppStore=true" @click="changeTheme" v-on="on" size="23"
                                  :style="$vuetify.theme.dark ? {}:{color:'lightgrey'}"
                                  class="ml-3">mdi-bat
                          </v-icon>
                        </template>
                        <h3 class="pa-3">
                          {{ $vuetify.theme.dark ? 'It does come in Black (^⇧B)' : 'Does it come in Black ? (^⇧B)' }}
                          <i></i>
                        </h3>
                      </v-tooltip>-->

            <!--          <v-tooltip bottom>-->
            <!--            <template v-slot:activator="{ on }">-->
            <!--              <v-icon @click="toggleOutputWindow" class=" ml-3"-->
            <!--                      v-on="on"-->
            <!--                      :style="$store.state.windows.outputWindow ? {}:{color:'lightgrey'}">-->
            <!--                mdi-page-layout-body-->
            <!--              </v-icon>-->
            <!--            </template>-->
            <!--            <span>Toggle output window  (^⇧O)</span>-->
            <!--          </v-tooltip>-->

            <span v-shortkey="[ 'ctrl','shift', 'o']"
                  @shortkey="toggleOutputWindow"></span>


            <!--          <v-tooltip bottom>-->
            <!--            <template v-slot:activator="{ on }">-->
            <!--              <v-icon @click="toggleLogWindow" class="ml-4 "-->
            <!--                      v-on="on"-->
            <!--                      :style="$store.state.windows.logWindow ? {}:{color:'lightgrey'}">-->
            <!--                mdi-page-layout-footer-->
            <!--              </v-icon>-->
            <!--            </template>-->
            <!--            <span>Toggle log window  (^⇧L)</span>-->
            <!--          </v-tooltip>-->
            <span v-shortkey="[ 'ctrl','shift', 'l']"
                  @shortkey="toggleLogWindow"></span>


            <!--          <v-icon v-if="_isDev" @click="dialogDebugShow">mdi-view-headline</v-icon>-->
          </template>
          <template v-else>

            <!--          <x-icon iconClass="mr-4" @click="apiClientSwaggerOpen()" v-if="!$store.state.windows.isComp"-->
            <!--                  tooltip="API Client (^⇧A)">mdi-code-json-->
            <!--          </x-icon>-->


            <!--          <x-icon iconClass="mr-4" tooltip="Feed (^⇧F)" @click="feedDialog = true">mdi-glasses</x-icon>-->
            <!--          <span v-shortkey="['ctrl','shift','f']" @shortkey="feedDialog = true"></span>-->

            <!--          <x-icon iconClass="mr-4" @click="settingsTabAdd" size="20" tooltip="Tool Settings (^⇧C)">mdi-cog-->
            <!--          </x-icon>-->
            <!--          <x-icon iconClass="mr-4" @click="settingsDialog = true" tooltip="Tool Settings (^⇧C)">mdi-cog-->
            <!--          </x-icon>-->
            <!--          <span v-shortkey="[ 'ctrl','shift', 'c']"-->
            <!--                @shortkey="settingsDialog = true"></span>   -->
            <span v-shortkey="[ 'ctrl','shift', 'c']"
                  @shortkey="settingsTabAdd"></span>

            <span v-shortkey="[ 'ctrl','shift', 'b']"
                  @shortkey="changeTheme"></span>

            <!--          <span v-shortkey="[ 'ctrl','shift', 'd']"-->
            <!--                @shortkey="openDiscord"></span>-->


            <!--          <x-icon key="discord" iconClass="mr-4" @click="openDiscord" tooltip="Discord Chat (^⇧D)">mdi-discord-->
            <!--          </x-icon>-->
            <!--          <x-icon key="github" iconClass="mr-4" @click="openGithub" tooltip="Github">mdi-github-circle-->
            <!--          </x-icon>-->

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-icon @click="changeTheme" v-on="on" size="23" :style="$vuetify.theme.dark ? {}:{color:'lightgrey'}">
                  mdi-bat
                </v-icon>
              </template>
              <h3 class="pa-3">
                {{ $vuetify.theme.dark ? 'It does come in Black (^⇧B)' : 'Does it come in Black ? (^⇧B)' }}
                <i></i>
              </h3>
            </v-tooltip>
            <!--          <notification></notification>-->

            <!--          <v-icon v-if="_isDev" @click="dialogDebugShow">mdi-view-headline</v-icon>-->
          </template>

          <!--        <v-btn text active-class to="/how-it-works" v-if="!user && !isThisMobile">-->
          <!--          <b>How it works</b>-->
          <!--        </v-btn>-->

          <!--        <v-btn text class="ml-1" to="/pricing" v-if="!isThisMobile">-->
          <!--          <b>Pricing</b>-->
          <!--        </v-btn>-->


          <!--        <v-btn text class="ml-1" to="/user/authentication/signin" v-if="!user && !isThisMobile">-->
          <!--          <b>Log in</b>-->
          <!--        </v-btn>-->
          <!--        <v-btn text class="ml-3  elevation-0 "-->
          <!--               to="/user/authentication/signup" v-if="!user && !isThisMobile">-->
          <!--          <b>SIGN UP</b>-->
          <!--        </v-btn>-->

          <!--        <v-btn text class=""-->
          <!--               to="/referral" v-if="user && !isThisMobile">-->
          <!--          <b>Refer</b>-->
          <!--        </v-btn>-->

          <!--        <v-btn text class=""-->
          <!--               to="/visits" v-if="user && !isThisMobile">-->
          <!--          <b>Your Rewards</b>-->
          <!--        </v-btn>-->
          <span v-shortkey="['ctrl', 'shift', 't']"
                @shortkey="terminalTabAdd()" tooltip="Terminal"></span>

          <!--        <x-icon key="settings-dash" iconClass="mr-1 ml-4" @click="settingsDialog = true" tooltip="Tool Settings (^⇧C)">-->
          <!--          mdi-cog-->
          <!--        </x-icon>-->
          <!--        <x-icon key="settings-dash" iconClass="mr-1 ml-4"  size="20" @click="settingsTabAdd" tooltip="Tool Settings (^⇧C)">-->
          <!--          mdi-cog-->
          <!--        </x-icon>-->

          <notification class="mx-2"></notification>


          <v-menu offset-y open-on-hover
                  v-if="isAuthenticated">

            <template v-slot:activator="{ on }">
              <v-btn text v-on="on" class="font-weight-bold" v-ge="['Profile','']">

                <v-icon v-if="role && roleIcon[role]" size="20">{{ roleIcon[role] }}</v-icon>
                <v-icon v-else size="20">mdi-account-circle</v-icon>
                <v-icon small>arrow_drop_down</v-icon>
              </v-btn>

            </template>
            <v-list dense>
              <v-list-item dense to="/user/settings" v-if="userAuthIsEmail">
                <v-list-item-title v-ge="['Settings','']">
                  <v-icon small>mdi-cog</v-icon> &nbsp; <span class="font-weight-regular">Settings</span>
                </v-list-item-title>
              </v-list-item>
              <v-divider v-if="userAuthIsEmail"></v-divider>

              <template v-if="isDocker">

                <!--              <v-list-item @click="xcMetaTabAdd" v-ge="['Meta add','']">-->
                <!--                <v-list-item-title>-->

                <!--                  <v-icon small>mdi-file-table-box-multiple-outline</v-icon>&nbsp; Export/Import Metadata-->
                <!--                </v-list-item-title>-->
                <!--              </v-list-item>-->
                <!--              <v-list-item @click="showChangeEnv = true" v-ge="['Change env','']">-->
                <!--                <v-list-item-title>-->

                <!--                  <v-icon small>mdi-test-tube</v-icon>&nbsp; Change Environment-->
                <!--                </v-list-item-title>-->
                <!--              </v-list-item>-->
                <!--              <v-list-item @click="terminalTabAdd()" v-ge="[isDocker ? 'Docker Console' : 'API Generator','']">
                                <v-list-item-title>


                                  <v-icon small key="terminal-dash">
                                    mdi-console
                                  </v-icon>&nbsp;
                                  {{ isDocker ? 'Docker Console' : 'API Generator' }}

                                </v-list-item-title>
                              </v-list-item>-->


                <v-list-item dense @click.stop="$toast.success('Auth token copied to clipboard').goAway(3000)"
                             v-clipboard="this.$store.state.users.token">
                  <v-list-item-title>


                    <v-icon small key="terminal-dash">
                      mdi-console
                    </v-icon>&nbsp;
                    <span class="font-weight-regular">Copy auth token</span>

                  </v-list-item-title>
                </v-list-item>
                <!--
                              <v-list-item dense @click.stop="projectInfoTabAdd">
                                <v-list-item-title>

                                  <v-icon small key="terminal-dash">
                                    mdi-information-outline
                                  </v-icon>&nbsp;
                                  <span class="font-weight-regular">Project Info</span>

                                </v-list-item-title>
                              </v-list-item>-->
                <v-list-item v-if="swaggerOrGraphiqlUrl" dense
                             @click.stop="openUrl(`${$axios.defaults.baseURL}${swaggerOrGraphiqlUrl}`)">
                  <v-list-item-title>

                    <v-icon small key="terminal-dash">
                      {{ isGql ? 'mdi-graphql' : 'mdi-code-json' }}
                    </v-icon>&nbsp;
                    <span class="font-weight-regular">
                    {{ isGql ? 'GraphQL APIs' : 'Swagger APIs Doc' }}</span>

                  </v-list-item-title>
                </v-list-item>

                <v-list-item dense @click.stop="settingsTabAdd">
                  <v-list-item-title>

                    <v-icon small key="terminal-dash">
                      mdi-cog
                    </v-icon>&nbsp;
                    <span class="font-weight-regular">Themes</span>

                  </v-list-item-title>
                </v-list-item>


                <v-list-item v-if="isDashboard" dense @click="copyProjectInfo" v-ge="['Sign Out','']">
                  <v-list-item-title>

                    <v-icon small>info</v-icon>&nbsp; <span class="font-weight-regular">Copy Project info</span>
                  </v-list-item-title>
                </v-list-item>

                <v-list-item dense @click="MtdSignOut" v-ge="['Sign Out','']">
                  <v-list-item-title>

                    <v-icon small>mdi-logout</v-icon>&nbsp; <span class="font-weight-regular">Sign Out</span>
                  </v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>
          <v-menu offset-y v-else open-on-hover>

            <template v-slot:activator="{ on }">
              <v-btn text v-on="on" class=" font-weight-bold" v-ge="['Profile','']">
                <!--              Menu-->
                <v-icon>mdi-account</v-icon>
                <v-icon>arrow_drop_down</v-icon>
              </v-btn>

            </template>
            <v-list dense>
              <v-list-item dense v-if="!user && !isThisMobile" to="/user/authentication/signup">
                <v-list-item-title>
                  <v-icon small>mdi-account-plus-outline</v-icon> &nbsp; <span
                  class="font-weight-regular">Sign Up</span>
                </v-list-item-title>
              </v-list-item>
              <v-list-item dense v-if="!user && !isThisMobile" to="/user/authentication/signin">
                <v-list-item-title>
                  <v-icon small>mdi-login</v-icon> &nbsp; <span class="font-weight-regular">Login</span>
                </v-list-item-title>
              </v-list-item>
              <!--            <v-list-item @click="openPricingPage">-->
              <!--              <v-list-item-title>-->

              <!--                <v-icon small>mdi-currency-usd</v-icon>&nbsp; Pricing-->
              <!--              </v-list-item-title>-->
              <!--            </v-list-item>-->
              <!--            <v-list-item @click="openHowItWorks">-->
              <!--              <v-list-item-title>-->
              <!--                <v-icon small>mdi-help-circle</v-icon> &nbsp; How it works-->
              <!--              </v-list-item-title>-->
              <!--            </v-list-item>-->
            </v-list>
          </v-menu>


        </v-toolbar-items>
    </v-app-bar>

    <v-main class="pb-0 mb-0">


      <!--      <v-navigation-drawer-->
      <!--        mini-variant-->
      <!--        app-->
      <!--        clipped-->

      <!--        expand-on-hover-->
      <!--      >-->
      <!--&lt;!&ndash;        <v-list-item class="px-2">&ndash;&gt;-->
      <!--&lt;!&ndash;          <v-list-item-avatar>&ndash;&gt;-->
      <!--&lt;!&ndash;            <v-img src="https://randomuser.me/api/portraits/men/85.jpg"></v-img>&ndash;&gt;-->
      <!--&lt;!&ndash;          </v-list-item-avatar>&ndash;&gt;-->

      <!--&lt;!&ndash;          <v-list-item-title>John Leider</v-list-item-title>&ndash;&gt;-->

      <!--&lt;!&ndash;          <v-btn&ndash;&gt;-->
      <!--&lt;!&ndash;            icon&ndash;&gt;-->
      <!--&lt;!&ndash;          >&ndash;&gt;-->
      <!--&lt;!&ndash;            <v-icon>mdi-chevron-left</v-icon>&ndash;&gt;-->
      <!--&lt;!&ndash;          </v-btn>&ndash;&gt;-->
      <!--&lt;!&ndash;        </v-list-item>&ndash;&gt;-->

      <!--&lt;!&ndash;        <v-divider></v-divider>&ndash;&gt;-->

      <!--        <v-list dense>-->
      <!--          <v-list-item-->
      <!--            link-->
      <!--            to="/"-->
      <!--          >-->
      <!--            <v-list-item-icon>-->
      <!--            </v-list-item-icon>-->

      <!--            <v-list-item-content>-->
      <!--              <v-list-item-title>Dashboard</v-list-item-title>-->
      <!--            </v-list-item-content>-->
      <!--          </v-list-item>-->
      <!--          <v-list-item-->
      <!--            link-->
      <!--            to="/client"-->
      <!--          >-->
      <!--            <v-list-item-icon>-->
      <!--              <v-icon>mdi-code-json</v-icon>-->
      <!--            </v-list-item-icon>-->

      <!--            <v-list-item-content>-->
      <!--              <v-list-item-title>API Client</v-list-item-title>-->
      <!--            </v-list-item-content>-->
      <!--          </v-list-item>-->
      <!--        </v-list>-->
      <!--      </v-navigation-drawer>-->

      <v-container class="ma-0 pa-0" fluid style="">
        <v-progress-linear
          v-show="GetPendingStatus"
          top
          absolute
          color="success"
          indeterminate
          height="2"
        ></v-progress-linear>


        <nuxt/>
      </v-container>
    </v-main>
    <dlgUnexpectedError
      v-if="dialogErrorShow"
      heading="Unexpected Error"
      :error="error"
      :dialogErrorShow="dialogErrorShow"
      :errorDialogCancel="errorDialogCancel"
      :errorDialogReport="errorDialogReport"
    />
    <dlgDebug
      v-if="dialogDebug"
      :dialogShow="dialogDebug"
      :mtdDialogCancel="dialogDebugCancel"
    />
    <settings v-model="settingsDialog"></settings>

    <v-dialog
      width="70%"
      v-model="terminalDialog"
    >
      <x-term is-modal v-if="terminalDialog" style="min-height:400px"></x-term>
    </v-dialog>
    <!--    <v-dialog-->
    <!--      width="70%"-->
    <!--      v-model="feedDialog"-->
    <!--    >-->
    <!--      <feed v-if="feedDialog" style="min-height1:400px"></feed>-->
    <!--    </v-dialog>-->


    <v-snackbar :top="true" v-model="releaseDownloadedSnackbar" color="info">
      New update successfully downloaded. Restart to update.
      <v-btn @click.native="updateAndRestart()">Update & Restart</v-btn>
      <v-btn @click.native="releaseDownloadedSnackbar = false">Close</v-btn>
    </v-snackbar>


    <v-snackbar :top="true" v-model="downloadAvailSnackbar" color="info">
      New update available. Upgrade?
      <v-btn @click.native="upgrade()">Upgrade</v-btn>
      <v-btn @click.native="downloadAvailSnackbar = false">Close</v-btn>
    </v-snackbar>
    <change-env v-model="showChangeEnv"></change-env>


  </v-app>
  <v-app v-else>
    <v-overlay>
      <v-progress-circular indeterminate size="64"></v-progress-circular>
    </v-overlay>
  </v-app>
</template>

<script>
import {mapGetters, mapActions, mapMutations} from "vuex";
import Snackbar from "~/components/snackbar";
import dlgUnexpectedError from "../components/utils/dlgUnexpectedError";
import notification from '../components/notification.vue'
import settings from "../components/settings";
import xTerm from "../components/xTerm";

import 'splitpanes/dist/splitpanes.css'
import XBtn from "../components/global/xBtn";
import ChangeEnv from "../components/changeEnv";
import Discord from "@/components/discord";
import {copyTextToClipboard} from "@/helpers/xutils";

export default {
  components: {
    Discord,
    ChangeEnv,
    XBtn,
    Snackbar,
    dlgUnexpectedError,
    notification,
    settings,
    xTerm
  },
  data: () => ({
    swaggerOrGraphiqlUrl: null,
    showScreensaver: false,
    roleIcon: {
      owner: 'mdi-account-star',
      creator: 'mdi-account-hard-hat',
      editor: 'mdi-account-edit',
      viewer: 'mdi-eye-outline',
    },
    showAppStore: false,
    showAirtabLikeLink: 0,
    showChangeEnv: false,
    feedDialog: false,
    releaseDownloadedSnackbar: false,
    downloadAvailSnackbar: false,
    terminalDialog: false,
    settingsDialog: false,
    environmentDialog: false,
    darkTheme: true,
    error: null,
    dialogErrorShow: false,
    dialogDebug: false,
    migrationsMenu: [
      {name: "dev", children: [{name: "db-1"}, {name: "db-2"}]},
      {name: "test", children: [{name: "db-1"}, {name: "db-2"}]}
    ],
    clipped: false,
    drawer: null,
    fixed: false,
    right: true,
    title: 'Xgene',
    isHydrated: false,

    snackbar: false,
    timeout: 10000,
    text: 'contact@senseprofit.com',
    rolesList: null,

  }),
  computed: {
    ...mapGetters({
      logo: 'plugins/brandLogo',
      brandName: 'plugins/brandName',
      projects: "project/list",
      tabs: "tabs/list",
      sqlMgr: "sqlMgr/sqlMgr",
      GetPendingStatus: 'notification/GetPendingStatus',
      isAuthenticated: 'users/GtrIsAuthenticated',
      isAdmin: 'users/GtrIsAdmin',
      isDocker: 'project/GtrIsDocker',
      isFirstLoad: 'project/GtrIsFirstLoad',
      isGql: 'project/GtrProjectIsGraphql',
      isRest: 'project/GtrProjectIsRest',
      isGrpc: 'project/GtrProjectIsGrpc',
      role: 'users/GtrRole'
    }),
    // previewAs: {
    //   get() {
    //     return this.$store.state.users.previewAs
    //   }, set(previewAs) {
    //     this.$store.commit('users/MutPreviewAs', previewAs);
    //   }
    // },
    user() {
      // console.log(this.$store);
      return this.$store.getters['users/GtrUser'];
    },

    paidUser() {
    },


    project() {
    },

    userAuthIsEmail() {

    },


    isThisMobile() { // just an example, could be one specific value if that's all you need
      return this.isHydrated ? this.$vuetify.breakpoint.smAndDown : false;
    },

    drawer_status() {
      // return this.$store.getters['users/GtrUser'] && this.drawer;
    },
  },
  mounted() {
    this.selectedEnv = this.$store.getters['project/GtrActiveEnv'];
    this.loadProjectInfo();
    // this.checkInactiveState();
  },
  watch: {
    '$route.path': function (path, oldPath) {
      try {
        if (oldPath === path) return;
        const recaptcha = this.$recaptchaInstance
        if (path.startsWith('/user/')) {
          recaptcha.showBadge()
        } else {
          recaptcha.hideBadge()
        }
      } catch (e) {
      }
    },
    '$route.params.project_id': function (newId, oldId) {
      if (newId && newId !== oldId) {
        this.loadProjectInfo();
      }
      if (!newId) {
        this.swaggerOrGraphiqlUrl = null;
      }
    }
  },
  // errorCaptured(err, vm, info) {
  //   console.log("errorCaptured", err, vm, info);
  //   this.error = err;
  //   this.dialogErrorShow = true;
  //   return false;
  // },
  methods: {
    ...mapActions({changeActiveTab: "tabs/changeActiveTab"}),
    ...mapMutations({
      toggleLogWindow: "windows/MutToggleLogWindow",
      toggleOutputWindow: "windows/MutToggleOutputWindow",
      toggleTreeviewWindow: "windows/MutToggleTreeviewWindow",
    }),
    async loadProjectInfo() {
      if (this.$route.params.project_id)
        try {
          const {info} = (await this.$axios.get(`${this.$axios.defaults.baseURL}/nc/${this.$route.params.project_id}/projectApiInfo`, {
            headers: {
              'xc-auth': this.$store.state.users.token
            }
          })).data;
          const obj = Object.values(info).find(v => v.apiType === 'rest' ? v.swaggerUrl : v.gqlApiUrl);
          this.swaggerOrGraphiqlUrl = obj.apiType === 'rest' ? obj.swaggerUrl : obj.gqlApiUrl
        } catch (e) {
        }
    },
    setPreviewUSer(previewAs) {
      this.previewAs = previewAs;
      window.location.reload();
    },
    showAppStoreIcon() {
      this.showAppStore = true;
      this.$toast.info('Apps unlocked').goAway(5000);
    },


    isProjectInfoLoaded() {
      return this.$store.state.project.projectInfo !== null;
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
      this.dialogDebug = false;
    },
    dialogDebugShow() {
      this.dialogDebug = true;
    },

    errorDialogCancel() {
      this.dialogErrorShow = false;
    },
    errorDialogReport() {
      this.dialogErrorShow = false;
    },
    loadChat() {
      if (!window.Tawk_API) {
        const s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
        s1.async = true;
        s1.src = 'https://embed.tawk.to/5d81b8de9f6b7a4457e23ba7/default';
        s1.charset = 'UTF-8';
        s1.setAttribute('crossorigin', '*');
        s0.parentNode.insertBefore(s1, s0);
        setTimeout(() => window.Tawk_API && window.Tawk_API.maximize(), 2000)
      } else {
        window.Tawk_API.maximize()
      }
    },
    handleMigrationsMenuClick(item, closeMenu = true, sqlEditor = false) {
      // if (item._nodes.type != "db") return;
      //
      // if (closeMenu) this.$refs.migrationsMenu.isActive = false;
      // const tabIndex = this.tabs.findIndex(el => el.name === item.name);
      // if (tabIndex != -1) {
      //   this.changeActiveTab(tabIndex);
      // } else {
      //   if (sqlEditor) {
      //     const tabData = JSON.parse(JSON.stringify(item));
      //     tabData._nodes.type = "sqlEditor";
      //     this.$store.dispatch("tabs/ActAddTab", tabData);
      //   } else {
      //     this.$store.dispatch("tabs/ActAddTab", item);
      //   }
      // }
    },

    terminalTabAdd() {
      if (this.isDashboard) {
        const tabIndex = this.tabs.findIndex(el => el.key === `terminal`);
        if (tabIndex !== -1) {
          this.changeActiveTab(tabIndex);
        } else {
          console.log('add terminal tab');
          let item = {name: 'Terminal', key: `terminal`}
          item._nodes = {};
          item._nodes.type = 'terminal';
          this.$store.dispatch("tabs/ActAddTab", item);
        }
      } else {
        this.terminalDialog = true;
      }
    },
    apiClientTabAdd() {
      // if (this.$route.path.indexOf('dashboard') > -1) {
      const tabIndex = this.tabs.findIndex(el => el.key === `apiClientDir`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add terminal tab');
        let item = {name: 'API Client', key: `apiClientDir`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'apiClientDir';
        this.$store.dispatch("tabs/ActAddTab", item);
      }
      // } else {
      //   this.terminalDialog = true;
      // }
    },
    apiClientSwaggerTabAdd() {
      // if (this.$route.path.indexOf('dashboard') > -1) {
      const tabIndex = this.tabs.findIndex(el => el.key === `apiClientSwaggerDir`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add terminal tab');
        let item = {name: 'API Client', key: `apiClientSwaggerDir`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'apiClientSwaggerDir';
        this.$store.dispatch("tabs/ActAddTab", item);
      }
      // } else {
      //   this.terminalDialog = true;
      // }
    },
    projectInfoTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `projectInfo`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add project info tab');
        let item = {name: 'Info', key: `projectInfo`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'projectInfo';
        this.$store.dispatch("tabs/ActAddTab", item);
      }
    },
    xcMetaTabAdd() {
      // if (this.$route.path.indexOf('dashboard') > -1) {
      const tabIndex = this.tabs.findIndex(el => el.key === `meta`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        let item = {name: 'Meta', key: `meta`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'meta';
        this.$store.dispatch("tabs/ActAddTab", item);
      }
      // } else {
      //   this.terminalDialog = true;
      // }
    },
    apiClientSwaggerOpen() {
      this.$router.push('/apiClient')
    },
    graphqlClientTabAdd() {
      // const tabIndex = this.tabs.findIndex(el => el.key === `graphqlClientDir`);
      // if (tabIndex !== -1) {
      //   this.changeActiveTab(tabIndex);
      // } else {
      //   console.log('add graphql tab');
      //   let item = {name: 'Graphql Client', key: `graphqlClientDir`}
      //   item._nodes = {env: 'dev'};
      //   item._nodes.type = 'graphqlClientDir';
      //   this.$store.dispatch("tabs/ActAddTab", item);
      // }
      window.open(this.swaggerOrGraphiqlUrl, '_blank')
    },
    swaggerClientTabAdd() {
      // const tabIndex = this.tabs.findIndex(el => el.key === `swaggerClientDir`);
      // if (tabIndex !== -1) {
      //   this.changeActiveTab(tabIndex);
      // } else {
      //   console.log('add swagger tab');
      //   let item = {name: 'Swagger Client', key: `swaggerClientDir`}
      //   item._nodes = {env: 'dev'};
      //   item._nodes.type = 'swaggerClientDir';
      //   this.$store.dispatch("tabs/ActAddTab", item);
      // }
      window.open(this.swaggerOrGraphiqlUrl, '_blank')
    },
    grpcTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `grpcClient`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add grpc tab');
        let item = {name: 'gRPC Client', key: `grpcClient`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'grpcClient';
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
      setTimeout(() => {
        this.$eventBus.$emit('show-add-user');
      }, 200)
    },
    settingsTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `projectSettings`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add roles tab');
        let item = {name: 'Themes', key: `projectSettings`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'projectSettings';
        this.$store.dispatch("tabs/ActAddTab", item);
      }

    },
    aclTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `acl`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add acl tab');
        let item = {name: 'ACL', key: `acl`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'acl';
        this.$store.dispatch("tabs/ActAddTab", item);
      }

    }, disableOrEnableModelTabAdd() {
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
    }, cronTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `cronJobs`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add cron job tab');
        let item = {name: 'Cron Jobs', key: `cronJobs`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'cronJobs';
        this.$store.dispatch("tabs/ActAddTab", item);
      }
    }, appsTabAdd() {
      const tabIndex = this.tabs.findIndex(el => el.key === `appStore`);
      if (tabIndex !== -1) {
        this.changeActiveTab(tabIndex);
      } else {
        console.log('add app store tab');
        let item = {name: 'App Store', key: `appStore`}
        item._nodes = {env: 'dev'};
        item._nodes.type = 'appStore';
        this.$store.dispatch("tabs/ActAddTab", item);
      }
    },
    async codeGenerateMvc() {
      try {
        await this.sqlMgr.projectGenerateBackend({
          env: 'dev',
        });
        this.$toast.success('Yay, REST APIs with MVC generated').goAway(4000);
      } catch (e) {
        this.$toast.error('Error generating REST APIs code :' + e).goAway(4000);
        throw e;
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
      //localStorage.removeItem('vue-cookie-accept-decline')
    },
    removeCookie() {
      //console.log('Cookie removed')
      localStorage.removeItem('vue-cookie-accept-decline')
      this.status = 'Cookie removed, refresh the page.'
    },

    MtdContactUs() {
      this.snackbar = true;
    },

    MtdHiring() {
      this.$router.push('/info/hiring');
    },

    MtdFaq() {
      this.$router.push('/info/faq');
    },
    MtdTos() {
      this.$router.push('/info/tos');
    },
    async MtdSignOut() {
      let err = await this.$store.dispatch('users/ActSignOut');
      this.$router.push('/user/authentication/signin');
    },
    MtdToggleDrawer() {
      if (!this.$store.getters['users/GtrUser']) {
        this.drawer = false;
      } else {
        this.drawer = !this.drawer;
      }
      //console.log('Toggling drawer', this.drawer);
    },
    changeTheme() {
      this.$store.dispatch('windows/ActToggleDarkMode', !this.$store.state.windows.darkTheme);
    },
    async copyProjectInfo() {
      try {
        const data = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'ncProjectInfo'])
        copyTextToClipboard(Object.entries(data).map(([k, v]) => `${k}: **${v}**`).join('\n'));
        this.$toast.info('Copied project info to clipboard').goAway(3000);
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
      }
    }
  },

};
</script>
<style scoped>
/deep/ .gh-button-container.black--text a {
  color: black !important;
}

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
