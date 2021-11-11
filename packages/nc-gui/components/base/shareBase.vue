<template>
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
        <v-list-item dense @click="disableSharedBase">
          <v-list-item-title>Disable shared base</v-list-item-title>
        </v-list-item>
        <v-list-item dense @click="createSharedBase">
          <v-list-item-title>Readonly link</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-chip v-if="base.enabled" :color="colors[2]">
      <div class="nc-url-wrapper d-flex mx-1 align-center d-100">
        <span class="nc-url">{{ base.url }}</span>
        <v-icon>mdi-reload</v-icon>
        <v-icon>mdi-content-copy</v-icon>
        <v-icon>mdi-xml</v-icon>
      </div>
    </v-chip>
  </div>
</template>

<script>
import colors from '~/mixins/colors'

export default {
  name: 'ShareBase',
  mixins: [colors],
  data: () => ({
    base: {
      enable: false
    }
  }),
  mounted() {
    this.loadSharedBase()
  },
  methods: {
    async loadSharedBase() {
      try {
        const sharedBase = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'getSharedBaseLink'])
        this.base = sharedBase || {}
      } catch (e) {
        console.log(e)
      }
    },
    async createSharedBase() {
      try {
        const sharedBase = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'createSharedBaseLink'])
        this.base = sharedBase || {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async disableSharedBase() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'disableSharedBaseLink'])
        this.base = {}
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }

}
</script>

<style scoped>
.nc-url-wrapper {
  column-gap: 5px;
}

.nc-url {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-container {
  border-radius: 4px;
  border: 2px solid var(--v-backgroundColor-base);
  padding: 20px 20px;
}
</style>
