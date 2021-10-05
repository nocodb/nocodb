<template>
  <v-menu bottom offset-y>
    <template #activator="{on}">
      <transition name="release">
        <v-btn
          v-if="releaseAlert"
          text
          small
          class="mb-0 mr-2 py-0 "
          v-on="on"
        >
          Upgrade available
          <v-icon small>
            mdi-menu-down
          </v-icon>
        </v-btn>
      </transition>
    </template>
    <v-list dense>
      <v-list-item dense href="https://github.com/nocodb/nocodb/releases" target="_blank">
        <v-icon small class="mr-2">
          mdi-script-text-outline
        </v-icon>
        <span class="caption">{{ releaseVersion }} Release notes</span>
      </v-list-item>
      <v-list-item dense href="https://docs.nocodb.com/getting-started/upgrading" target="_blank">
        <v-icon small class="mr-2">
          mdi-rocket-launch-outline
        </v-icon>
        <span class="caption">How to upgrade ?</span>
      </v-list-item>
      <v-list-item @click="releaseAlert = false">
        <v-icon small class="mr-2">
          mdi-close
        </v-icon>

        <span class="caption">Hide menu</span>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
export default {
  name: 'ReleaseInfo',
  data: () => ({
    loading: true
  }),
  computed: {
    releaseAlert: {
      get() {
        return !this.loading && this.$store.state.app.releaseVersion && this.$store.state.app.releaseVersion !== this.$store.state.app.hiddenRelease
      },
      set(val) {
        return this.$store.commit('app/MutHiddenRelease', val ? null : this.$store.state.app.releaseVersion)
      }
    },
    releaseVersion() {
      return this.$store.state.app.releaseVersion
    }
  },
  mounted() {
    setTimeout(() => {
      this.loading = false
    }, 1000)
  }
}
</script>

<style scoped>
.release-enter-active, .release-leave-active {
  transition: opacity .5s;
}

.release-enter, .release-leave-to {
  opacity: 0;
}
</style>
