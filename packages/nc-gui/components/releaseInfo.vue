<template>
  <transition name="release">
    <v-alert
      v-if="releaseAlert"
      class="mb-0"
      border="left"
      colored-border
      outlined
      type="info"
      :icon="false"
      dense
    >
      <a href="https://github.com/nocodb/nocodb/releases" target="_blank" class="white--text text-decoration-none"><span class="caption">New version is available (<strong>{{
        releaseVersion
      }}</strong>)</span></a>
      <x-icon x-small :color="['grey lighten-2']" btnclass="mr-n2" @click="releaseAlert =false">
        mdi-close
      </x-icon>
    </v-alert>
  </transition>
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
