<script lang="ts" setup>
import { breakpointsTailwind } from '@vueuse/core'
import { navigateTo } from '#app'
import { computed, provideSidebar, ref, useBreakpoints, useGlobal } from '#imports'

/** get current breakpoints (for enabling sidebar) */
const breakpoints = useBreakpoints(breakpointsTailwind)

const { signOut, signedIn, isLoading, user } = $(useGlobal())

const { isOpen, toggle, hasSidebar } = provideSidebar({ isOpen: signedIn && breakpoints.greater('md').value })

const sidebar = ref<HTMLDivElement>()

const email = computed(() => user?.email ?? '---')

const logout = () => {
  signOut()
  navigateTo('/signin')
}
</script>

<template>
  <a-layout>
    <a-layout-header class="flex !bg-primary items-center text-white px-4 shadow-md">
      <material-symbols-menu v-if="signedIn && hasSidebar" class="text-xl cursor-pointer" @click="toggle" />

      <div class="flex-1" />

      <div class="ml-4 flex justify-center shrink">
        <div class="flex items-center gap-2 cursor-pointer nc-noco-brand-icon" @click="navigateTo('/')">
          <img width="35" src="~/assets/img/icons/512x512-trans.png" />
          <span class="prose-xl">NocoDB</span>
        </div>
      </div>

      <div class="flex-1 text-left">
        <div v-show="isLoading" class="flex items-center gap-2 ml-3">
          {{ $t('general.loading') }}
          <mdi-reload :class="{ 'animate-infinite animate-spin': isLoading }" />
        </div>
      </div>

      <div class="flex justify-end gap-4">
        <general-language class="mr-3" />

        <template v-if="signedIn">
          <a-dropdown :trigger="['click']">
            <mdi-dots-vertical class="md:text-xl cursor-pointer nc-user-menu" @click.prevent />

            <template #overlay>
              <a-menu class="!py-0 nc-user-menu min-w-32 dark:(!bg-gray-800) leading-8 !rounded">
                <a-menu-item key="0" class="!rounded-t">
                  <nuxt-link v-t="['c:navbar:user:email']" class="group flex items-center no-underline py-2" to="/user">
                    <MdiAt class="mt-1 group-hover:text-success" />&nbsp;
                    <span class="prose group-hover:text-black nc-user-menu-email">{{ email }}</span>
                  </nuxt-link>
                </a-menu-item>

                <a-menu-divider class="!m-0" />

                <a-menu-item key="1" class="!rounded-b">
                  <div v-t="['a:navbar:user:sign-out']" class="group flex items-center py-2" @click="logout">
                    <mdi-logout class="dark:text-white group-hover:(!text-red-500)" />&nbsp;

                    <span class="prose font-semibold text-gray-500 group-hover:text-black nc-user-menu-signout">
                      {{ $t('general.signOut') }}
                    </span>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </div>
    </a-layout-header>

    <a-layout>
      <a-layout-sider
        :collapsed="!isOpen"
        width="300"
        collapsed-width="0"
        class="bg-white dark:!bg-gray-800 border-r-1 border-gray-200 dark:!border-gray-600 h-full"
        :trigger="null"
        collapsible
      >
        <div id="sidebar" ref="sidebar" class="w-full h-full" />
      </a-layout-sider>

      <NuxtPage />
    </a-layout>
  </a-layout>
</template>
