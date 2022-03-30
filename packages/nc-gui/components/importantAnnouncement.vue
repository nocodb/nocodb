<template>
  <v-menu bottom offset-y>
    <template #activator="{on}">
      <transition name="announcement">
        <v-btn
          v-if="!loading"
          text
          small
          class="mb-0 mr-2 py-0 "
          v-on="on"
        >
          🚨 Important Announcement
          <v-icon small>
            mdi-menu-down
          </v-icon>
        </v-btn>
      </transition>
    </template>
    <v-list dense>
      <v-list-item dense>
        <span class="message">
          Starting from v0.90.0, our API design will be changed <br/> and we are discontinuing GraphQL.
        </span>
      </v-list-item>
      <!-- TODO: update link -->
      <v-list-item dense href="#" target="_blank">
        <v-icon small class="mr-2">
          mdi-script-text-outline
        </v-icon>
        <span class="caption">
          API Changes in v0.90.0
        </span>
      </v-list-item>
      <!-- TODO: update link -->
      <v-list-item dense href="#" target="_blank">
        <v-icon small class="mr-2">
          mdi-rocket-launch-outline
        </v-icon>
        <span class="caption">
          Migration Guide
        </span>
      </v-list-item>
      <v-list-item @click="announcementAlert = false">
        <v-icon small class="mr-2">
          mdi-close
        </v-icon>

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
  name: 'ImportantAnnouncement',
  data: () => ({
    loading: true
  }),
  computed: {
  },
  mounted() {
    setTimeout(() => {
      this.loading = false
    }, 1000)
  }
}
</script>

<style scoped>
.announcement-enter-active, .announcement-leave-active {
  transition: opacity .5s;
}

.announcement-enter, .announcement-leave-to {
  opacity: 0;
}

.message {
  font-size: 0.80rem !important;
  font-weight: bold;
  margin: 10px;
}
</style>
