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
</script>

<template>
  <v-app>
    <v-app-bar class="shadow-md bg-primary" height="48">
      <div class="flex items-center flex-1 md:ml-4">
        <v-toolbar-title>
          <v-tooltip bottom>
            {{ $t('general.home') }}
            <span class="caption font-weight-light pointer">(version)</span>
          </v-tooltip>

          <div class="flex items-center gap-2">
            <img width="35" src="~/assets/img/icons/512x512-trans.png" />
            <span class="prose-xl" @click="navigateTo('/')">NocoDB</span>
          </div>
        </v-toolbar-title>

        <!-- todo: loading is not yet supported by nuxt 3 - see https://v3.nuxtjs.org/migration/component-options#loading
        <span v-show="$nuxt.$loading.show" class="caption grey--text ml-3">
          {{ $t('general.loading') }} <v-icon small color="grey">mdi-spin mdi-loading</v-icon>
        </span>


        todo: replace shortkey?
        <span v-shortkey="['ctrl', 'shift', 'd']" @shortkey="openDiscord" />
         -->
      </div>

      <div class="flex justify-end">
        <v-toolbar-items class="flex gap-4 nc-topright-menu">
          <!-- todo: implement components
          <release-info />
          -->

          <general-color-mode-switcher v-model="$state.darkMode.value" />

          <general-language class="mr-3" />

          <MaterialSymbolsMenu
            v-if="$state.signedIn.value"
            class="block text-xl cursor-pointer xl:(hidden)"
            @click="$state.sidebarOpen.value = !$state.sidebarOpen.value"
          />

          <template v-if="$state.signedIn.value">
            <v-menu class="leading-8">
              <template #activator="{ props }">
                <MdiDotsVertical class="md:text-xl cursor-pointer" @click="props.onClick" />
              </template>

              <v-list class="!py-0 nc-user-menu min-w-32 dark:(!bg-gray-800)">
                <nuxt-link
                  v-t="['c:navbar:user:email']"
                  class="group hover:(bg-gray-200) dark:(hover:bg-gray-600) flex items-center p-2 no-underline"
                  to="/user"
                >
                  <MdiAt class="mt-1 group-hover:text-success" />&nbsp;
                  <span class="prose">{{ email }}</span>
                </nuxt-link>

                <v-divider />

                <div
                  v-t="['a:navbar:user:sign-out']"
                  class="group flex flex-row cursor-pointer hover:bg-gray-200 dark:(hover:bg-gray-600) flex items-center p-2"
                  @click="signOut"
                >
                  <MdiLogout class="dark:text-white group-hover:(!text-red-500)" />&nbsp;
                  <span class="prose font-semibold text-gray-500">{{ $t('general.signOut') }}</span>
                </div>
              </v-list>
            </v-menu>
          </template>
        </v-toolbar-items>
      </div>
    </v-app-bar>

    <NuxtPage />
  </v-app>
</template>
