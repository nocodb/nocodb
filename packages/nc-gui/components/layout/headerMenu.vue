<template>
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
          @click="signOut"
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
      <v-list-item v-if="!user && !isMobile" dense to="/user/authentication/signup">
        <v-list-item-title>
          <v-icon small>
            mdi-account-plus-outline
          </v-icon> &nbsp; <span
            class="font-weight-regular caption"
          >{{ $t('general.signUp') }}</span>
        </v-list-item-title>
      </v-list-item>
      <v-list-item v-if="!user && !isMobile" dense to="/user/authentication/signin">
        <v-list-item-title>
          <v-icon small>
            mdi-login
          </v-icon> &nbsp; <span class="font-weight-regular caption">{{ $t('general.signIn') }}</span>
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'HeaderMenu',
  data: () => ({
    swaggerOrGraphiqlUrl: null,
    roleIcon: {
      owner: 'mdi-account-star',
      creator: 'mdi-account-hard-hat',
      editor: 'mdi-account-edit',
      viewer: 'mdi-eye-outline'
    }
  }),
  computed: {
    ...mapGetters({
      userEmail: 'users/GtrUserEmail',
      isAuthenticated: 'users/GtrIsAuthenticated',
      isGql: 'project/GtrProjectIsGraphql',
      isRest: 'project/GtrProjectIsRest',
      tabs: 'tabs/list'
    }),
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    }
  },
  methods: {
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
    async signOut() {
      await this.$store.dispatch('users/ActSignOut')
      this.$router.push('/user/authentication/signin')
    }
  }
}
</script>

<style scoped>

/deep/ .nc-user-menu .v-list-item--dense, /deep/ .nc-user-menu .v-list--dense .v-list-item {
  min-height: 35px
}

</style>
