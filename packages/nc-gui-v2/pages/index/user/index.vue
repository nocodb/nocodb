<script setup lang="ts">
import { useNuxtApp, useRoute } from '#app'
import MdiAccountCog from '~icons/mdi/account-cog'

const { $api } = useNuxtApp()

const route = useRoute()

const navDrawerOptions = [
  {
    title: 'Settings',
    icon: MdiAccountCog,
  },
]
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <div class="flex flex-col h-full">
        <a-menu :selected-keys="[0]" class="pr-4 dark:bg-gray-800 dark:text-white flex-1 border-0">
          <a-menu-item v-for="(option, index) in navDrawerOptions" :key="index" class="!rounded-r-lg">
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
