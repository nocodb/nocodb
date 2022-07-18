<script lang="ts" setup>
import { navigateTo } from '#app'
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
  {
    title: 'Shared With Me',
    icon: MdiAccountGroup,
  },
  {
    title: 'Recent',
    icon: MdiClockOutline,
  },
  {
    title: 'Starred',
    icon: MdiStar,
  },
]

const route = useRoute()

const { $api, $state } = useNuxtApp()

const response = await $api.project.list({})
const projects = $ref(response.list)
const activePage = $ref(navDrawerOptions[0].title)
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <div class="flex flex-col h-full">
        <div class="flex p-4">
          <v-menu class="select-none">
            <template #activator="{ props }">
              <div
                class="color-transition hover:(bg-gray-100 dark:bg-secondary/25) dark:(bg-secondary/50 !text-white shadow-gray-600) mr-auto select-none flex items-center gap-2 leading-8 cursor-pointer rounded-full border-1 border-gray-300 px-5 py-2 shadow prose-lg font-semibold"
                @click="props.onClick"
              >
                <MdiPlus class="text-primary dark:(!text-white) text-2xl" />
                {{ $t('title.newProj') }}
              </div>
            </template>

            <v-list class="!py-0 flex flex-col bg-white rounded-lg shadow-md border-1 border-gray-300 mt-2 ml-2">
              <div
                class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
                @click="navigateTo('/create')"
              >
                <MdiPlus class="col-span-2 mr-1 mt-[1px] text-primary text-lg" />
                <div class="col-span-10 text-sm xl:text-md">{{ $t('activity.createProject') }}</div>
              </div>
              <div
                class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
                @click="navigateTo('/create-external')"
              >
                <MdiDatabaseOutline class="col-span-2 mr-1 mt-[1px] text-green-500 text-lg" />
                <div class="col-span-10 text-sm xl:text-md" v-html="$t('activity.createProjectExtended.extDB')" />
              </div>
            </v-list>
          </v-menu>
        </div>

        <a-menu class="mx-4 dark:bg-gray-800 dark:text-white flex-1 border-0">
          <a-menu-item
            v-for="(option, index) in navDrawerOptions"
            :key="index"
            class="f!rounded-r-lg"
            @click="activePage = option.title"
          >
            <div class="flex items-center gap-4">
              <component :is="option.icon" />

              <span class="font-semibold">
                {{ option.title }}
              </span>
            </div>
          </a-menu-item>
        </a-menu>

        <general-social />

        <general-sponsors :nav="true" />
      </div>
    </template>

    <v-container class="flex-1 mb-12">
      <div class="flex">
        <div class="flex-1 text-2xl md:text-4xl font-bold text-gray-500 dark:text-white p-4">
          {{ activePage }}
        </div>

        <div class="self-end flex text-4xl mb-1">
          <MaterialSymbolsGridView
            :class="route.name === 'index-index' ? 'text-primary dark:(!text-secondary/75)' : ''"
            class="color-transition cursor-pointer p-2 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/')"
          />
          <MaterialSymbolsFormatListBulletedRounded
            :class="route.name === 'index-index-list' ? 'text-primary dark:(!text-secondary/75)' : ''"
            class="color-transition cursor-pointer p-2 hover:bg-gray-300/50 rounded-full"
            @click="navigateTo('/list')"
          />
        </div>
      </div>

      <v-divider class="!mb-4 lg:(!mb-8)" />

      <NuxtPage :projects="projects" />
    </v-container>
  </NuxtLayout>
</template>
