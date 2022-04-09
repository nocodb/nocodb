<template>
  <v-navigation-drawer
    left
    permanent
    width="250"
    class="h-100 d-100"
  >
    <div class="d-flex flex-column h-100">
      <div class="ml-5 pt-3 body-2 font-weight-medium grey--text  text-uppercase caption">
        Projects
      </div>
      <div class="advance-menu flex-grow-1 ">
        <v-list
          shaped
          dense
        >
          <v-list-item-group v-model="page" color="x-active" mandatory>
            <v-list-item
              v-for="item in navDrawerOptions"
              :key="item.title"
              :value="item.title"
              dense
              class="body-2"
            >
              <v-list-item-title>
                <v-icon small class="ml-5">
                  {{ item.icon }}
                </v-icon>
                <span
                  class="font-weight-medium ml-3"
                  :class="{'textColor--text text--lighten-2':item.title!==page}"
                >
                  {{ item.title }}
                </span>
              </v-list-item-title>
            </v-list-item>
          </v-list-item-group>
        </v-list>
      </div>
      <div class="ml-5 pt-3 body-2 font-weight-medium grey--text  text-uppercase caption">
        Community
      </div>
      <community-cards class="mb-4" />
    </div>
  </v-navigation-drawer>
</template>

<script>
import CommunityCards from '~/components/projectList/communityCards'
export default {
  name: 'ProjectListNavDrawer',
  components: { CommunityCards },
  props: {
    activePage: String
  },
  data: () => ({
    navDrawerOptions: [{
      title: 'My NocoDB',
      icon: 'mdi-folder-outline'
    }, {
      title: 'Shared With Me',
      icon: 'mdi-account-group'
    }, {
      title: 'Recent',
      icon: 'mdi-clock-outline'
    }, {
      title: 'Starred',
      icon: 'mdi-star'
    }]
  }),
  computed: {
    page: {
      get() {
        return this.activePage
      },
      set(page) {
        this.$emit('update:activePage', page)
      }
    }
  }
}
</script>

<style scoped>

/deep/ .v-navigation-drawer__border {
  background-color: transparent !important;
}
</style>
