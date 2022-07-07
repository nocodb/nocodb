<script lang="ts" setup>
import MdiAt from '~icons/mdi/at'
import MdiLogout from '~icons/mdi/logout'
import MdiDotsVertical from '~icons/mdi/dots-vertical'
import { navigateTo } from '#app'

const { $state } = useNuxtApp()
const email = computed(() => $state.user?.value?.email ?? '---')
</script>

<template>
  <v-app>
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
        <v-toolbar-items class="flex gap-4 nc-topright-menu">
          <!-- todo: implement components
          <release-info />
          -->

          <general-language class="mr-3" />

          <template v-if="$state.signedIn.value">
            <v-menu class="leading-8">
              <template #activator="{ props }">
                <MdiDotsVertical class="md:text-xl cursor-pointer" @click="props.onClick" />
              </template>
              <v-list class="!py-0 nc-user-menu min-w-32">
                <nuxt-link
                  v-t="['c:navbar:user:email']"
                  class="group hover:bg-gray-200 flex items-center p-2"
                  to="/user/settings"
                >
                  <MdiAt class="mt-1 transition-colors duration-150 ease-in group-hover:text-success" />&nbsp;
                  <span class="prose">{{ email }}</span>
                </nuxt-link>

                <v-divider />

                <div
                  v-t="['a:navbar:user:sign-out']"
                  class="group flex flex-row cursor-pointer hover:bg-gray-200 flex items-center p-2"
                  @click="$state.signOut"
                >
                  <MdiLogout class="transition-colors duration-150 ease-in group-hover:text-red-500" />&nbsp;
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
