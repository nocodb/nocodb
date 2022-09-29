<template>
  <v-menu v-if="connectToExternalDB" offset-y bottom open-on-hover>
    <template #activator="{ on }">
      <slot :on="on">
        <div>
          <v-btn
            v-if="_isUIAllowed('projectCreate', true)"
            v-ge="['home', 'project-new']"
            :x-large="$vuetify.breakpoint.lgAndUp"
            :large="$vuetify.breakpoint.mdAndDown"
            data-v-step="1"
            outlined
            rounded
            color="primary"
            class="nc-new-project-menu elevation-3"
            v-on="on"
          >
            <v-icon class="mr-2"> mdi-plus </v-icon>

            <!-- New Project -->
            {{ $t('title.newProj') }}
            <v-icon class="mr-1" small> mdi-menu-down </v-icon>
          </v-btn>
        </div>
      </slot>
    </template>
    <v-list dense>
      <v-list-item class="create-xc-db-project nc-create-xc-db-project" @click="onCreateProject('xcdb')">
        <v-list-item-icon class="mr-2">
          <v-icon small color="blue"> mdi-plus </v-icon>
        </v-list-item-icon>
        <v-list-item-title>
          <!-- Create -->
          <span>{{ $t('general.create') }}</span>
        </v-list-item-title>
        <v-spacer />
        <v-tooltip right>
          <template #activator="{ on }">
            <v-icon x-small color="grey" class="ml-4" v-on="on"> mdi-information-outline </v-icon>
          </template>
          <!-- Create a new project -->
          <span class="caption">{{ $t('tooltip.xcDB') }}</span>
        </v-tooltip>
      </v-list-item>
      <v-list-item
        title
        class="pt-2 create-external-db-project nc-create-external-db-project"
        @click="onCreateProject()"
      >
        <v-list-item-icon class="mr-2">
          <v-icon small color="green"> mdi-database-outline </v-icon>
        </v-list-item-icon>
        <v-list-item-title>
          <!-- Create By Connecting <br>To An External Database -->
          <span style="line-height: 1.5em" v-html="$t('activity.createProjectExtended.extDB')" />
        </v-list-item-title>
        <v-spacer />
        <v-tooltip right>
          <template #activator="{ on }">
            <v-icon x-small color="grey" class="ml-4" v-on="on"> mdi-information-outline </v-icon>
          </template>
          <!-- Supports MySQL, PostgreSQL, SQL Server & SQLite -->
          <span class="caption">{{ $t('tooltip.extDB') }}</span>
        </v-tooltip>
      </v-list-item>
    </v-list>
  </v-menu>
  <x-btn
    v-else-if="_isUIAllowed('projectCreate', true)"
    v-ge="['home', 'project-new']"
    outlined
    data-v-step="1"
    color="primary"
    @click="onCreateProject('xcdb')"
  >
    <!-- New Project -->
    {{ $t('title.newProj') }}
  </x-btn>
  <span v-else />
</template>

<script>
export default {
  name: 'CreateNewProjectBtn',
  computed: {
    connectToExternalDB() {
      return (
        this.$store.state.project &&
        this.$store.state.project.appInfo &&
        this.$store.state.project.appInfo.connectToExternalDB
      );
    },
  },
  methods: {
    onCreateProject(xcdb) {
      if (xcdb === 'xcdb') {
        this.$router.push('/project/xcdb');
        this.$e('c:project:create:xcdb');
      } else {
        this.$router.push('/project/0');
        this.$e('c:project:create:extdb');
      }
    },
  },
};
</script>

<style scoped></style>
