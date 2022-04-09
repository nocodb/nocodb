<template>
  <div class="d-flex  align-center d-100">
    <div class="d-flex align-center pt-1" style="flex: 1" :style="isProjectList ? {width: '316px',maxWidth: '316px'} :{}">
      <v-toolbar-title class="ml-n3">
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

        <span class="body-1 ml-n1" @click="$router.push('/projects')"> {{ brandName }}</span>
      </v-toolbar-title>
      <span v-show="$nuxt.$loading.show" class="caption grey--text ml-3">{{ $t('general.loading') }} <v-icon small color="grey">mdi-spin mdi-loading</v-icon></span>
    </div>

    <div v-if="isDashboard" class="text-capitalize text-center title" style="flex: 1">
      {{ projectName }}
    </div>
    <header-project-filter v-else-if="isProjectList" class="flex-grow-1" />
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
          </div>
        </template>
        <template v-else />

        <preview-as class="mx-1" />
        <header-menu />
      </v-toolbar-items>
    </div>

    <share-or-invite-modal v-model="shareModal" />
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import ReleaseInfo from '~/components/releaseInfo'
import Language from '~/components/utils/language'
import { copyTextToClipboard } from '~/helpers/xutils'
import PreviewAs from '~/components/previewAs'
import HeaderMenu from '~/components/layout/headerMenu'
import ShareOrInviteModal from '~/components/auth/shareOrInviteModal'
import HeaderProjectFilter from '~/components/layout/headerProjectFilter'
export default {
  name: 'MainHeader',
  components: { HeaderProjectFilter, ShareOrInviteModal, HeaderMenu, PreviewAs, Language, ReleaseInfo },
  data: () => ({
    shareModal: false
  }),
  computed: {
    ...mapGetters({
      brandName: 'plugins/brandName',
      tabs: 'tabs/list',
      logo: 'plugins/brandLogo',
      projectName: 'project/GtrProjectName'
    }),
    isProjectList() {
      return this.$route.path.startsWith('/projects')
    }
  },
  methods: {
    ...mapActions({ changeActiveTab: 'tabs/changeActiveTab' }),

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

.brand-icon::before {
  background: none !important;
}

/deep/ .v-toolbar__items {
  align-items: center;
}

a {
  text-decoration: none;
}

/deep/ .nc-ripple {
  border-radius: 50%;
}

</style>
