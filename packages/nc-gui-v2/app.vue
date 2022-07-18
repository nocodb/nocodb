<script lang="ts" setup>
import MdiAt from '~icons/mdi/at'
import MdiLogout from '~icons/mdi/logout'
import MdiDotsVertical from '~icons/mdi/dots-vertical'
import MaterialSymbolsMenu from '~icons/material-symbols/menu'
import { navigateTo } from '#app'

const { $state } = useNuxtApp()
const email = computed(() => $state.user?.value?.email ?? '---')

const signOut = () => {
  $state.signOut()
  navigateTo('/signin')
}

const toggleSidebar = useToggle($state.sidebarOpen)
</script>

<template>
  <a-layout>
    <a-layout-header class="flex !bg-primary items-center text-white">
      <div class="flex items-center flex-1">
        <div class="flex items-center gap-2">
          <img width="35" src="~/assets/img/icons/512x512-trans.png" />
          <span class="prose-xl" @click="navigateTo('/')">NocoDB</span>
        </div>

        <!-- todo: loading is not yet supported by nuxt 3 - see https://v3.nuxtjs.org/migration/component-options#loading
        <span v-show="$nuxt.$loading.show" class="caption grey--text ml-3">
          {{ $t('general.loading') }} <v-icon small color="grey">mdi-spin mdi-loading</v-icon>
        </span>


        todo: replace shortkey?
        <span v-shortkey="['ctrl', 'shift', 'd']" @shortkey="openDiscord" />
         -->
      </div>

      <div class="flex justify-end gap-4">
        <general-color-mode-switcher v-model="$state.darkMode.value" />

        <general-language class="mr-3" />

        <MaterialSymbolsMenu
          v-if="$state.signedIn.value"
          class="block text-xl cursor-pointer xl:(hidden)"
          @click="toggleSidebar"
        />

        <template v-if="$state.signedIn.value">
          <a-dropdown :trigger="['click']">
            <MdiDotsVertical class="md:text-xl cursor-pointer" @click.prevent />

            <template #overlay>
              <a-menu class="!py-0 nc-user-menu min-w-32 dark:(!bg-gray-800) leading-8 !rounded">
                <a-menu-item key="0" class="!rounded">
                  <nuxt-link v-t="['c:navbar:user:email']" class="group flex items-center no-underline py-2" to="/user">
                    <MdiAt class="mt-1 group-hover:text-success" />&nbsp;
                    <span class="prose">{{ email }}</span>
                  </nuxt-link>
                </a-menu-item>

                <a-menu-divider class="!m-0" />

                <a-menu-item class="!rounded" key="1">
                  <div v-t="['a:navbar:user:sign-out']" class="group flex items-center py-2" @click="signOut">
                    <MdiLogout class="dark:text-white group-hover:(!text-red-500)" />&nbsp;
                    <span class="prose font-semibold text-gray-500">{{ $t('general.signOut') }}</span>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </div>
    </a-layout-header>

    <NuxtPage />
  </a-layout>
</template>
