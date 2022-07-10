<script lang="ts" setup>
import MaterialSymbolsFormatListBulletedRounded from '~icons/material-symbols/format-list-bulleted-rounded'
import MaterialSymbolsGridView from '~icons/material-symbols/grid-view'

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

    <v-container class="flex-1 py-9 px-15 h-full">
      <div class="flex">
        <div class="prose-xl p-2">
          {{ $t('title.myProject') }}
        </div>

        <h2 class="display-1 ml-5 mb-7 font-weight-medium textColor--text text--lighten-2 flex-grow-1">
          {{ activePage }}
        </h2>

        <div class="self-end flex text-xl">
          <MaterialSymbolsFormatListBulletedRounded class="cursor-pointer p-1 hover:bg-gray-300/50 rounded-full" />
          <MaterialSymbolsGridView class="cursor-pointer p-1 hover:bg-gray-300/50 rounded-full" />
        </div>
      </div>
      <v-divider class="mb-3" />

      <NuxtPage :projects="projects" />
    </v-container>
  </NuxtLayout>
</template>

