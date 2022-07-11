<script lang="ts" setup>
import { navigateTo } from '#app'
import MaterialSymbolsFormatListBulletedRounded from '~icons/material-symbols/format-list-bulleted-rounded'
import MaterialSymbolsGridView from '~icons/material-symbols/grid-view'

const route = useRoute()

const { $api } = useNuxtApp()

const response = await $api.project.list({})
const projects = $ref(response.list)
const activePage = $ref()

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
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <v-navigation-drawer :permanent="true" width="300">
        <div class="flex flex-col h-full">
          <div class="flex-1 pt-8" />
          <v-divider />
          <!-- todo: implement extras component
            <Extras class="pl-6" />
          -->

          <general-sponsors :nav="true" />
        </div>
      </v-navigation-drawer>
    </template>

    <v-container class="flex-1 h-full">
      <div class="flex">
        <div class="prose-xl p-2">
          {{ $t('title.myProject') }}
        </div>

        <h2 class="display-1 ml-5 mb-7 font-weight-medium textColor--text text--lighten-2 flex-grow-1">
          {{ activePage }}
        </h2>

        <div class="self-end flex text-2xl">
          <MaterialSymbolsFormatListBulletedRounded
            :class="route.name === 'projects-index-list' ? 'text-primary' : ''"
            class="cursor-pointer p-1 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/projects/list')"
          />
          <MaterialSymbolsGridView
            :class="route.name === 'projects-index' ? 'text-primary' : ''"
            class="cursor-pointer p-1 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/projects')"
          />
        </div>
      </div>

      <v-divider class="!mb-4 lg:(!mb-8)" />

      <NuxtPage :projects="projects" />
    </v-container>
  </NuxtLayout>
</template>
