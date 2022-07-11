<script lang="ts" setup>
import { navigateTo } from '#app'
import MaterialSymbolsFormatListBulletedRounded from '~icons/material-symbols/format-list-bulleted-rounded'
import MaterialSymbolsGridView from '~icons/material-symbols/grid-view'
import MdiPlus from '~icons/mdi/plus'
import MdiDatabaseOutline from '~icons/mdi/database-outline'

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
      <v-navigation-drawer width="300">
        <div class="flex flex-col h-full">
          <div class="flex-1 flex flex-col gap-2 p-4">
            <v-menu class="select-none">
              <template #activator="{ props }">
                <div
                  class="mr-auto select-none flex items-center gap-2 leading-8 cursor-pointer rounded-full border-1 border-gray-300 px-5 py-2 shadow-md prose-lg font-semibold hover:bg-gray-200/20"
                  @click="props.onClick"
                >
                  <MdiPlus class="text-primary text-2xl" />
                  {{ $t('title.newProj') }}
                </div>
              </template>
              <v-list class="!py-0 flex flex-col bg-white rounded-lg shadow-md border-1 border-gray-300 mt-2 ml-2">
                <div
                  class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
                  @click="navigateTo('/projects/create')"
                >
                  <MdiPlus class="col-span-2 mr-1 mt-[1px] text-primary text-lg" />
                  <div class="col-span-10 text-sm xl:text-md">{{ $t('activity.createProject') }}</div>
                </div>
                <div
                  class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
                  @click="navigateTo('/projects/create-external')"
                >
                  <MdiDatabaseOutline class="col-span-2 mr-1 mt-[1px] text-green-500 text-lg" />
                  <div class="col-span-10 text-sm xl:text-md" v-html="$t('activity.createProjectExtended.extDB')" />
                </div>
              </v-list>
            </v-menu>

            <!-- todo: implement extras component
              <Extras class="pl-6" />
            -->
          </div>

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

        <div class="self-end flex text-4xl mb-1">
          <MaterialSymbolsFormatListBulletedRounded
            :class="route.name === 'projects-index-list' ? 'text-primary' : ''"
            class="transition-color ease-in duration-100 cursor-pointer p-2 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/projects/list')"
          />
          <MaterialSymbolsGridView
            :class="route.name === 'projects-index' ? 'text-primary' : ''"
            class="transition-color ease-in duration-100 cursor-pointer p-2 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/projects')"
          />
        </div>
      </div>

      <v-divider class="!mb-4 lg:(!mb-8)" />

      <NuxtPage :projects="projects" />
    </v-container>
  </NuxtLayout>
</template>
