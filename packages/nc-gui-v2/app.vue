<script lang="ts" setup>
import { breakpointsTailwind } from '@vueuse/core'
import { navigateTo } from '#app'
import { computed, provideSidebar, ref, useBreakpoints, useGlobal, useRoute, useRouter } from '#imports'

/** get current breakpoints (for enabling sidebar) */
const breakpoints = useBreakpoints(breakpointsTailwind)

const { signOut, signedIn, isLoading, user } = $(useGlobal())

const { isOpen } = provideSidebar({ isOpen: (signedIn && breakpoints.greater('md').value) || true })

const router = useRouter()

const route = useRoute()

console.log(route.name)

const sidebar = ref<HTMLDivElement>()

const email = computed(() => user?.email ?? '---')

const logout = () => {
  signOut()
  navigateTo('/signin')
}
</script>

<template>
  <a-layout>
    <a-layout-sider
      :collapsed="!isOpen"
      width="50"
      collapsed-width="0"
      class="!bg-primary h-full shadow-lg"
      :trigger="null"
      collapsible
      theme="light"
    >
      <a-dropdown :trigger="['click']">
        <div class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105 border-b-1 border-r-1">
          <img width="35" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
        </div>

        <template v-if="signedIn" #overlay>
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

      <div id="sidebar" ref="sidebar" class="text-white flex flex-col items-center w-full">
        <div
          :class="[route.name.includes('nc-projectId') ? 'bg-pink-500' : '']"
          class="flex w-full justify-center items-center h-12 group p-2"
        >
          <MdiDatabase class="cursor-pointer transform hover:scale-105 text-2xl" />
        </div>

        <a-tooltip placement="right">
          <template #title> Switch language </template>

          <div class="flex w-full justify-center items-center h-12 group p-2">
            <general-language class="cursor-pointer text-2xl" />
          </div>
        </a-tooltip>
        <div class="flex w-full justify-center items-center h-12 group p-2">
          <MdiLightningBoltOutline class="cursor-not-allowed text-2xl text-gray-400" />
        </div>
      </div>
    </a-layout-sider>

    <a-layout class="!flex-col">
      <a-layout-header class="flex !bg-primary items-center text-white !px-[1px] shadow-lg">
        <div id="header-start" class="w-[250px] flex items-center px-4 h-full" />

        <div class="hidden flex justify-center">
          <div v-show="isLoading" class="flex items-center gap-2 ml-3">
            {{ $t('general.loading') }}
            <MdiReload :class="{ 'animate-infinite animate-spin': isLoading }" />
          </div>
        </div>

        <div class="flex-1 text-white">
          <div class="flex items-center px-4 gap-4">
            <a-tooltip placement="bottom">
              <template #title> Go back </template>

              <MaterialSymbolsArrowBackRounded
                class="cursor-pointer transform hover:(scale-115 text-pink-500) text-xl"
                @click="router.go(-1)"
              />
            </a-tooltip>

            <a-tooltip placement="bottom">
              <template #title>Go forward</template>

              <MaterialSymbolsArrowForwardRounded
                class="cursor-pointer transform hover:(scale-115 text-pink-500) text-xl"
                @click="router.go(+1)"
              />
            </a-tooltip>
          </div>
        </div>
      </a-layout-header>

      <div class="w-full h-full">
        <NuxtPage />
      </div>
    </a-layout>
  </a-layout>
</template>
