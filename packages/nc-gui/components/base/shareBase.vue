<template>
  <div>
    <v-icon color="grey" small>
      mdi-open-in-new
    </v-icon>
    <span class="grey--text caption">Shared base link</span>
    <div class="nc-container">
      <v-menu>
        <template #activator="{on}">
          <div class="my-2" v-on="on">
            <template v-if="base.enabled">
              Anyone with following link can view base in a readonly mode
            </template>
            <template v-else>
              Generate publicly shareable readonly base
            </template>

            <v-icon small>
              mdi-menu-down-outline
            </v-icon>
          </div>
        </template>
        <v-list dense>
          <v-list-item dense @click="createSharedBase">
            <v-list-item-title>
              <v-icon small class="mr-1">
                mdi-link-variant
              </v-icon>
              <span class="caption">Readonly link</span>
            </v-list-item-title>
          </v-list-item>
          <v-list-item dense @click="disableSharedBase">
            <v-list-item-title>
              <v-icon small class="mr-1">
                mdi-link-variant-off
              </v-icon>
              <span class="caption">Disable shared base</span>
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-chip v-if="base.enabled" :color="colors[4]">
        <div class="nc-url-wrapper d-flex mx-1 align-center d-100">
          <span class="nc-url flex-grow-1">{{ url }}</span>
          <v-divider vertical />
          <v-icon @click="recreate">
            mdi-reload
          </v-icon>
          <v-icon @click="copyUrl">
            mdi-content-copy
          </v-icon>
          <v-icon @click="navigateToSharedBase">
            mdi-open-in-new
          </v-icon>
        </div>
      </v-chip>
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
      return this.base && this.base.shared_base_id ? `${this.dashboardUrl}#/nc/base/${this.base.shared_base_id}` : null
    }
  },
  mounted() {
    this.loadSharedBase()
  },
  methods: {
    async loadSharedBase() {
      try {
        const sharedBase = await this.$store.dispatch('sqlMgr/ActSqlOp', [
          { dbAlias: 'db' }, 'getSharedBaseLink'])
        this.base = sharedBase || {}
      } catch (e) {
        console.log(e)
      }
    },
    async createSharedBase() {
      try {
        const sharedBase = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: 'db' }, 'createSharedBaseLink'])
        this.base = sharedBase || {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async disableSharedBase() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: 'db' }, 'disableSharedBaseLink'])
        this.base = {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async recreate() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: 'db' }, 'disableSharedBaseLink'])
        const sharedBase = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: 'db' }, 'createSharedBaseLink'])
        this.base = sharedBase || {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    copyUrl() {
      copyTextToClipboard(this.url)
      this.$toast.success('Copied shareable base url to clipboard!').goAway(3000)
    },
    navigateToSharedBase() {
      window.open(this.url, '_blank')
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
</style>
