<script setup lang="ts">
import { navigateTo, useNuxtApp, useRoute } from '#app'
import MdiAccountCog from '~icons/mdi/account-cog'
import MdiFolderOutline from '~icons/mdi/folder-outline'

const { $api } = useNuxtApp()

const route = useRoute()

const navDrawerOptions = [
  {
    title: 'My NocoDB',
    route: '/',
    icon: MdiFolderOutline,
  },
  {
    title: 'Settings',
    route: '/user',
    icon: MdiAccountCog,
  },
]

const selectedKey = computed(() => [navDrawerOptions.findIndex((opt) => opt.route === route.path)])
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <div class="flex flex-col h-full">
        <a-menu :selected-keys="selectedKey" class="pr-4 dark:bg-gray-800 dark:text-white flex-1 border-0">
          <a-menu-item
            v-for="(option, index) in navDrawerOptions"
            :key="index"
            class="!rounded-r-lg"
            @click="navigateTo(option.route)"
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

    <NuxtPage />
  </NuxtLayout>
</template>
