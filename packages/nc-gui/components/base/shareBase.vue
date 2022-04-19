<template>
  <div>
    <v-icon color="grey" small>
      mdi-open-in-new
    </v-icon>
    <span class="grey--text caption">
      <!-- Shared base link -->
      {{ $t('activity.shareBase.link') }}
    </span>
    <div class="nc-container">
      <v-chip v-if="base.uuid" :color="colors[4]" style="" class="rounded pl-1 pr-0 d-100 nc-url-chip pr-3">
        <div class="nc-url-wrapper d-flex mx-1 align-center d-100">
          <span class="nc-url flex-grow-1 caption ">{{ url }}</span>
          <v-spacer />
          <v-divider vertical />

          <!-- tooltip="reload" -->
          <x-icon
            :tooltip="$t('general.reload')"
            @click="recreate"
          >
            mdi-reload
          </x-icon>

          <!-- tooltip="copy URL"  -->
          <x-icon
            :tooltip="$t('activity.copyUrl')"
            @click="copyUrl"
          >
            mdi-content-copy
          </x-icon>

          <!-- tooltip="open new tab" -->
          <x-icon
            :tooltip="$t('activity.openTab')"
            @click="navigateToSharedBase"
          >
            mdi-open-in-new
          </x-icon>

          <!-- tooltip="copy embeddable HTML code" -->
          <x-icon
            :tooltip="$t('activity.iFrame')"
            @click="generateEmbeddableIframe"
          >
            mdi-xml
          </x-icon>
        </div>
      </v-chip>

      <div class="d-flex align-center px-2">
        <div>
          <v-menu offset-x>
            <template #activator="{on}">
              <div class="my-2" v-on="on">
                <div class="font-weight-bold nc-disable-shared-base">
                  <span v-if="base.uuid">
                    <!-- Anyone with the link -->
                    {{ $t('activity.shareBase.enable') }}
                  </span>
                  <span v-else>
                    <!-- Disable shared base -->
                    {{ $t('activity.shareBase.disable') }}
                  </span>
                  <v-icon small>
                    mdi-menu-down-outline
                  </v-icon>
                </div>
              </div>
            </template>
            <v-list dense>
              <v-list-item v-if="!base.uuid" dense @click="createSharedBase('viewer')">
                <v-list-item-title>
                  <v-icon small class="mr-1">
                    mdi-link-variant
                  </v-icon>
                  <span class="caption">
                    <!-- Anyone with the link -->
                    {{ $t('activity.shareBase.enable') }}
                  </span>
                </v-list-item-title>
              </v-list-item>
              <v-list-item v-if="base.uuid" dense @click="disableSharedBase">
                <v-list-item-title>
                  <v-icon small class="mr-1">
                    mdi-link-variant-off
                  </v-icon>
                  <span class="caption">
                    <!-- Disable shared base -->
                    {{ $t('activity.shareBase.disable') }}
                  </span>
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <div class=" caption">
            <template v-if="base.enabled">
              <span v-if="base.roles === 'editor'">
                Anyone on the internet with this link can edit
                <!-- {{ $t('msg.info.shareBasePrivate') }} -->
              </span>
              <span v-else-if="base.roles === 'viewer'">
                <!-- Anyone on the internet with this link can view -->
                {{ $t('msg.info.shareBasePublic') }}
              </span>
            </template>
            <template v-else>
              <!-- Generate publicly shareable readonly base -->
              {{ $t('msg.info.shareBasePrivate') }}
            </template>
          </div>
        </div>
        <v-spacer />
        <div class="d-flex justify-center" style="width:120px">
          <v-menu v-if="base.uuid" offset-y>
            <template #activator="{on}">
              <div
                class="text-capitalize my-2   font-weight-bold backgroundColorDefault py-2 px-4 rounded nc-shared-base-role"
                v-on="on"
              >
                {{ base.roles || 'Viewer' }}

                <v-icon small>
                  mdi-menu-down-outline
                </v-icon>
              </div>
            </template>

            <v-list dense>
              <v-list-item @click="createSharedBase('editor')">
                <v-list-item-title>
                  <!-- Editor -->
                  {{ $t('objects.roleType.editor') }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="createSharedBase('viewer')">
                <v-list-item-title>
                  <!-- Viewer -->
                  {{ $t('objects.roleType.viewer') }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import colors from '~/mixins/colors'
import { copyTextToClipboard } from '~/helpers/xutils'

export default {
  name: 'ShareBase',
  mixins: [colors],
  data: () => ({
    base: {
      enable: false
    }
  }),
  computed: {
    url() {
      return this.base && this.base.uuid ? `${this.dashboardUrl}#/nc/base/${this.base.uuid}` : null
    }
  },
  mounted() {
    this.loadSharedBase()
  },
  methods: {
    async loadSharedBase() {
      try {
        // const sharedBase = await this.$store.dispatch('sqlMgr/ActSqlOp', [
        //   { dbAlias: 'db' }, 'getSharedBaseLink'])
        const sharedBase = (await this.$api.project.sharedBaseGet(this.$store.state.project.projectId))

        this.base = sharedBase || {}
      } catch (e) {
        console.log(e)
      }
    },
    async createSharedBase(roles = 'viewer') {
      try {
        // const sharedBase = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: 'db' }, 'createSharedBaseLink', { roles }])
        const sharedBase = (await this.$api.project.sharedBaseUpdate(this.$store.state.project.projectId, { roles }))

        this.base = sharedBase || {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit(`shared-base:enable:${roles}`)
    },
    async disableSharedBase() {
      try {
        await this.$api.project.sharedBaseDisable(this.$store.state.project.projectId)
        this.base = {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit('shared-base:disable')
    },
    async recreate() {
      try {
        const sharedBase = (await this.$api.project.sharedBaseCreate(this.$store.state.project.projectId, { roles: this.base.roles || 'viewer' }))
        this.base = sharedBase || {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }

      this.$tele.emit('shared-base:recreate')
    },
    copyUrl() {
      copyTextToClipboard(this.url)
      this.$toast.success('Copied shareable base url to clipboard!').goAway(3000)

      this.$tele.emit('shared-base:copy-url')
    },
    navigateToSharedBase() {
      window.open(this.url, '_blank')

      this.$tele.emit('shared-base:open-url')
    },
    generateEmbeddableIframe() {
      copyTextToClipboard(`<iframe
class="nc-embed"
src="${this.url}?embed"
frameborder="0"
width="100%"
height="700"
style="background: transparent; border: 1px solid #ddd"></iframe>`)
      this.$toast.success('Copied embeddable html code!').goAway(3000)

      this.$tele.emit('shared-base:copy-embed-frame')
    }
  }

}
</script>

<style scoped>
.nc-url-wrapper {
  column-gap: 15px;
  width: 100%
}

.nc-url {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-container {
  border-radius: 4px;
  border: 2px solid var(--v-backgroundColor-base);
  background: var(--v-backgroundColor-base);
  padding: 20px 20px;
}

/deep/ .nc-url-chip .v-chip__content {
  width: 100%
}
</style>
