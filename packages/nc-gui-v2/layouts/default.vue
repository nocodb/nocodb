<script lang="ts" setup>
import { navigateTo } from '#app'
import MdiAt from '~icons/mdi/at'
import MdiLogout from '~icons/mdi/logout'
import MdiDotsVertical from '~icons/mdi/dots-vertical'

const route = useRoute()
const { $state } = useNuxtApp()

const openDiscord = () => {
  //   shell.openExternal('https://discord.gg/5RgZmkW')
}

const isDashboard = computed(() => {
  return route.path && (route.path === '/nc' || route.path === '/nc/' || route.path.startsWith('/nc/'))
})
</script>

<script lang="ts">
export default {
  name: 'Default',
}
</script>

<template>
  <v-app>
    <slot name="header">
      <v-app-bar class="elevation-1" color="primary" app clipped-left dense dark height="48">
        <div class="d-flex align-center" style="flex: 1">
          <v-toolbar-title>
            <v-tooltip bottom>
              {{ $t('general.home') }}
              <span class="caption font-weight-light pointer">(version)</span>
            </v-tooltip>

            <span class="body-1" @click="navigateTo('/projects')">NocoDB</span>
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
          <v-toolbar-items class="flex gap-4 hidden-sm-and-down nc-topright-menu">
            <!-- todo: implement components
            <release-info />
            -->

            <general-language class="mr-3" />

            <v-menu>
              <template #activator="{ props }">
                <MdiDotsVertical class="md:text-xl cursor-pointer" @click="props.onClick" />
              </template>
              <v-list class="!py-0 nc-user-menu min-w-32">
                <nuxt-link
                  v-t="['c:navbar:user:email']"
                  class="flex flex-row cursor-pointer hover:bg-gray-200 flex items-center p-2"
                  to="/user/settings"
                >
                  <MdiAt />&nbsp;
                  <span class="font-bold">{{ $state.user }}</span>
                </nuxt-link>

                <v-divider />

                <div
                  v-t="['a:navbar:user:sign-out']"
                  class="group flex flex-row cursor-pointer hover:bg-gray-200 flex items-center p-2"
                  @click.stop
                >
                  <MdiLogout class="transition-colors duration-150 ease-in group-hover:text-red-500" />&nbsp;
                  <span class="text-sm font-semibold text-gray-500">{{ $t('general.signOut') }}</span>
                </div>
              </v-list>
            </v-menu>
          </v-toolbar-items>
        </div>
      </v-app-bar>
    </slot>

    <slot name="sidebar" />
    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>
