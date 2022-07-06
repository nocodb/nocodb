<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { navigateTo } from '#app'
import useColors from '~/composables/useColors'

const { $api, $e } = useNuxtApp()
const { getColorByIndex } = useColors()

const response = await $api.project.list({})
const projects = $ref(response.list)
const activePage = $ref()

const openProject = async (project: ProjectType) => {
  await navigateTo(`/nc/${project.id}`)
  $e('a:project:open', { count: projects.length })
}

const navDrawerOptions = [
  {
    title: 'My NocoDB',
    icon: 'mdi-folder-outline',
  },
  {
    title: 'Shared With Me',
    icon: 'mdi-account-group',
  },
  {
    title: 'Recent',
    icon: 'mdi-clock-outline',
  },
  {
    title: 'Starred',
    icon: 'mdi-star',
  },
]

const formatTitle = (title: string) =>
  title
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <v-navigation-drawer :permanent="true" width="300">
        <div class="d-flex flex-column h-100">
          <div class="advance-menu flex-grow-1 pt-8">
            <!--
              <v-list v-if="_isUIAllowed('treeViewProjectSettings')" shaped dense :class="{ 'advanced-border': overShieldIcon }">
              <v-list-item-group v-model="activePage" color="x-active" mandatory>
                <v-list-item v-for="item in navDrawerOptions" :key="item.title" :value="item.title" dense class="body-2">
                  <v-list-item-title>
                    <v-icon small class="ml-5">
                      {{ item.icon }}
                    </v-icon>
                    <span
                      class="font-weight-medium ml-3"
                      :class="{
                        'textColor--text text--lighten-2': item.title !== activePage,
                      }"
                    >
                      {{ item.title }}
                    </span>
                  </v-list-item-title>
                </v-list-item>
              </v-list-item-group>
            </v-list>
            -->
          </div>
          <v-divider />
          <!-- todo: implement extras component
            <Extras class="pl-6" />
          -->
          <div class="sponsor">
            <general-sponsors :nav="true" />
          </div>
        </div>
      </v-navigation-drawer>
    </template>

    <v-container class="flex-grow-1 py-9 px-15 h-100" style="overflow-y: auto">
      <div class="d-flex">
        <h2 class="display-1 ml-5 mb-7 font-weight-medium textColor--text text--lighten-2 flex-grow-1">
          {{ activePage }}
        </h2>

        <div class="">
          <button>Button</button>
        </div>
      </div>
      <v-divider class="mb-3" />
      <div v-if="projects && projects.length" class="nc-project-item-container d-flex d-100">
        <div
          v-for="(project, i) of projects"
          :key="project.id"
          class="nc-project-item elevation-0 d-flex align-center justify-center flex-column py-5"
        >
          <div
            class="nc-project-thumbnail pointer text-uppercase d-flex align-center justify-center"
            :style="{ backgroundColor: getColorByIndex(i) }"
            @click="openProject(project)"
          >
            {{ formatTitle(project.title) }}

            <v-icon class="nc-project-star-icon" small color="white" @click.stop> mdi-star-outline </v-icon>

            <v-menu bottom offset-y>
              <template #activator="{ props }">
                <v-icon class="nc-project-option-menu-icon" color="white" @click.stop="props.onClick"> mdi-menu-down </v-icon>
              </template>
              <v-list dense>
                <v-list-item>
                  <v-list-item-title>
                    <v-icon small color="red"> mdi-delete-outline </v-icon>
                    {{ $t('general.delete') }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>

          <div class="text-center pa-2 nc-project-title body-2 font-weight-medium">
            {{ project.title }}
          </div>
        </div>

        <div class="pointer nc-project-item nc-project-item elevation-0 d-flex align-center justify-center flex-column">
          <button>Button</button>
          <div class="text-center pa-2 nc-project-title body-2 font-weight-medium">{{ $t('activity.createProject') }}</div>
        </div>
      </div>
      <div v-else class="px-4 py-10 text-center textColor--text text--lighten-3 caption backgroundColor">
        Please create a project
      </div>
    </v-container>
  </NuxtLayout>
</template>

<style scoped>
.nc-project-item-container {
  flex-wrap: wrap;
  position: relative;
}
.nc-project-item {
  width: 150px;
  align-items: center;
}
.nc-project-thumbnail {
  height: 100px;
  width: 100px;
  font-size: 50px;
  color: white;
  font-weight: bold;
  border-radius: 4px;
  margin-inside: auto;
  position: relative;
}
.nc-project-option-menu-icon,
.nc-project-star-icon {
  position: absolute;
  opacity: 0;
  transition: 0.3s opacity;
}
.nc-project-star-icon {
  top: 8px;
  right: 10px;
}
.nc-project-option-menu-icon {
  bottom: 5px;
  right: 5px;
}
.nc-project-thumbnail:hover .nc-project-option-menu-icon,
.nc-project-thumbnail:hover .nc-project-star-icon {
  opacity: 1;
}
.nc-project-title {
  text-transform: capitalize;
  text-align: center;
}
.nc-project-title.nc-add-project {
  font-size: 60px;
}
/deep/ .v-navigation-drawer__border {
  background-color: transparent !important;
}
.nc-project-thumbnail:hover {
  background-image: linear-gradient(#0002, #0002);
}
</style>
