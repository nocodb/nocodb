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
      <v-navigation-drawer v-model="$state.sidebarOpen.value" :border="0">
        <div class="flex flex-col h-full">
          <div class="flex p-4">
            <v-menu class="select-none">
              <template #activator="{ props }">
                <div
                  class="bg-white mr-auto select-none flex items-center gap-2 leading-8 cursor-pointer rounded-full border-1 border-gray-300 px-5 py-2 shadow prose-lg font-semibold hover:(!bg-gray-100)"
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
          </div>

          <div class="advance-menu flex-1">
            <v-list class="flex flex-col gap-1" :color="$state.darkMode.value ? 'default' : 'primary'">
              <!-- todo: v-list-item-group doesn't seem to work with vuetify 3 yet ... -->
              <v-list-item
                v-for="item in navDrawerOptions"
                :key="item.title"
                class="flex items-center gap-4 !rounded-r-lg"
                :value="item.title"
              >
                <component :is="item.icon" />

                <span
                  class="font-semibold"
                  :class="{
                    'textColor--text text--lighten-2': item.title !== activePage,
                  }"
                >
                  {{ item.title }}
                </span>
              </v-list-item>
            </v-list>
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

<style scoped>
.v-main {
  @apply w-full;
  overflow: hidden;
  flex: unset !important;
}

:deep(.v-main__wrap) {
  @apply flex-0 w-full relative scrollbar-thin-primary;
  overflow-x: hidden;
}
</style>
