<script setup lang="ts">
import { useNuxtApp, useRoute } from '#app'
import MdiAccountCog from '~icons/mdi/account-cog'

const { $api, $state } = useNuxtApp()

const route = useRoute()
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <v-navigation-drawer v-model="$state.sidebarOpen.value" :border="0">
        <div class="flex flex-col h-full">
          <div class="advance-menu flex-1">
            <v-list class="flex flex-col gap-1" :color="$state.darkMode.value ? 'secondary' : 'primary'">
              <v-list-item
                :active="route.name === 'index-user-index'"
                class="flex items-center gap-4 !rounded-r-lg"
                :value="$t('activity.settings')"
              >
                <MdiAccountCog />

                <span class="font-semibold">
                  {{ $t('activity.settings') }}
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

    <NuxtPage />
  </NuxtLayout>
</template>
