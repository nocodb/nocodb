<template>
  <v-menu bottom offset-y>
    <template #activator="{ on }">
      <transition name="release">
        <v-btn v-show="releaseAlert" text small class="mb-0 mr-2 py-0" v-on="on">
          <!--Upgrade available-->
          {{ $t('activity.upgrade.available') }}
          <v-icon small> mdi-menu-down </v-icon>
        </v-btn>
      </transition>
    </template>
    <v-list dense>
      <v-list-item dense href="https://github.com/nocodb/nocodb/releases" target="_blank">
        <v-icon small class="mr-2"> mdi-script-text-outline </v-icon>
        <span class="caption">{{ releaseVersion }} {{ $t('activity.upgrade.releaseNote') }}</span>
      </v-list-item>
      <v-list-item dense href="https://docs.nocodb.com/getting-started/upgrading" target="_blank">
        <v-icon small class="mr-2"> mdi-rocket-launch-outline </v-icon>
        <!--How to upgrade?-->
        <span class="caption">{{ $t('activity.upgrade.howTo') }}</span>
      </v-list-item>
      <v-list-item @click="releaseAlert = false">
        <v-icon small class="mr-2"> mdi-close </v-icon>

        <span class="caption">
          <!--Hide menu-->
          {{ $t('general.hideMenu') }}
        </span>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
export default {
  name: 'ReleaseInfo',
  data: () => ({
    loading: true,
  }),
  computed: {
    releaseAlert: {
      get() {
        return (
          !this.loading &&
          this.$store.state.app.currentVersion &&
          this.$store.state.app.latestRelease &&
          this.$store.state.app.currentVersion !== this.$store.state.app.latestRelease &&
          this.$store.state.app.latestRelease !== this.$store.state.app.hiddenRelease
        );
      },
      set(val) {
        return this.$store.commit('app/MutHiddenRelease', val ? null : this.$store.state.app.latestRelease);
      },
    },
    releaseVersion() {
      return this.$store.state.app.latestRelease;
    },
  },
  mounted() {
    setTimeout(() => {
      this.loading = false;
    }, 1000);
  },
};
</script>

<style scoped>
.release-enter-active,
.release-leave-active {
  transition: opacity 0.5s;
}

.release-enter,
.release-leave-to {
  opacity: 0;
}
</style>
