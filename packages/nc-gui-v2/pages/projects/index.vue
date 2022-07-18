<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import { navigateTo } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import MaterialSymbolsFormatListBulletedRounded from '~icons/material-symbols/format-list-bulleted-rounded'
import MaterialSymbolsGridView from '~icons/material-symbols/grid-view'
import MdiPlus from '~icons/mdi/plus'
import MdiDatabaseOutline from '~icons/mdi/database-outline'
import MdiFolderOutline from '~icons/mdi/folder-outline'
import MdiAccountGroup from '~icons/mdi/account-group'
import MdiClockOutline from '~icons/mdi/clock-outline'
import MdiStar from '~icons/mdi/star'

const navDrawerOptions = [
  {
    title: 'My NocoDB',
    icon: MdiFolderOutline,
  },
  /* todo: implement the api and bring back the options below
   {
    title: "Shared With Me",
    icon: MdiAccountGroup
  },
  {
    title: "Recent",
    icon: MdiClockOutline
  },
  {
    title: "Starred",
    icon: MdiStar
  } */
]

const route = useRoute()

const { $api, $state } = useNuxtApp()
const toast = useToast()

const response = await $api.project.list({})
const projects = $ref(response.list)
const activePage = $ref(navDrawerOptions[0].title)
const deleteProject = async (project: ProjectType) => {
  try {
    await $api.project.delete(project.id as string)
    projects.splice(projects.indexOf(project), 1)
  } catch (e) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <v-navigation-drawer v-model="$state.sidebarOpen.value" :border="0">
        <div class="flex flex-col h-full">
          <div class="flex p-4">
            <a-dropdown class="select-none" trigger="click">
              <a
                class="ant-dropdown-link bg-white mr-auto select-none flex items-center gap-2 leading-8 cursor-pointer rounded-full border-1 border-gray-300 px-5 py-2 shadow prose-lg font-semibold hover:(!bg-gray-100)"
                @click.prevent
              >
                <MdiPlus class="text-primary text-2xl" />
                {{ $t('title.newProj') }}
              </a>
              <template #overlay>
                <div class="!py-0 flex flex-col bg-white rounded-lg shadow-md border-1 border-gray-300 mt-2 ml-2">
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
                </div>
              </template>
            </a-dropdown>
          </div>

          <div class="advance-menu flex-1">
            <div :color="$state.darkMode.value ? 'default' : 'primary'">
              <a-menu class="flex flex-col gap-1" mode="inline" :open-keys="[activePage]">
                <a-menu-item v-for="item in navDrawerOptions" :key="item.title" class="flex items-center gap-4 !rounded-r-lg">
                  <template #icon>
                    <component :is="item.icon" />
                  </template>
                  <span class="font-semibold">
                    {{ item.title }}
                  </span>
                </a-menu-item>
              </a-menu>
            </div>
          </div>

          <v-divider />

          <general-social />

          <general-sponsors :nav="true" />
        </div>
      </v-navigation-drawer>
    </template>

    <v-container class="flex-1 mb-12">
      <div class="flex">
        <div class="flex-1 text-2xl md:text-4xl font-bold text-gray-500 dark:text-white p-4">
          {{ activePage }}
        </div>

        <div class="self-end flex text-4xl mb-1">
          <MaterialSymbolsGridView
            :class="route.name === 'projects-index' ? 'text-primary dark:(!text-secondary/75)' : ''"
            class="color-transition cursor-pointer p-2 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/projects')"
          />
          <MaterialSymbolsFormatListBulletedRounded
            :class="route.name === 'projects-index-list' ? 'text-primary dark:(!text-secondary/75)' : ''"
            class="color-transition cursor-pointer p-2 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/projects/list')"
          />
        </div>
      </div>

      <a-divider class="!mb-4 lg:(!mb-8)" />

      <NuxtPage :projects="projects" @delete-project="deleteProject" />
    </v-container>
  </NuxtLayout>
</template>
