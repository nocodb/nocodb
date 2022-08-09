<script lang="ts" setup>
import { breakpointsTailwind } from '@vueuse/core'
import { navigateTo } from '#app'
import { computed, useBreakpoints, useGlobal, useProject, useRoute } from '#imports'

/** get current breakpoints (for enabling sidebar) */
const breakpoints = useBreakpoints(breakpointsTailwind)

const { signOut, signedIn, isLoading, user } = useGlobal()

const { project } = useProject()

const route = useRoute()

const email = computed(() => user.value?.email ?? '---')

const logout = () => {
  signOut()
  navigateTo('/signin')
}
</script>

<template>
  <a-layout id="nc-app" has-sider>
    <div id="nc-sidebar-left" />

    <a-layout class="!flex-col">
      <a-layout-header class="flex !bg-primary items-center text-white pl-1 pr-4 shadow-lg">
        <div class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105" @click="navigateTo('/')">
          <img width="35" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
        </div>

        <div class="flex justify-center">
          <div v-show="isLoading" class="flex items-center gap-2 ml-3">
            {{ $t('general.loading') }}

            <MdiReload :class="{ 'animate-infinite animate-spin': isLoading }" />
          </div>
        </div>

        <div class="flex-1" />

        <a-tooltip placement="left">
          <template #title> Switch language </template>

          <div class="flex pr-4 items-center">
            <GeneralLanguage class="cursor-pointer text-2xl" />
          </div>
        </a-tooltip>

        <template v-if="signedIn">
          <a-dropdown :trigger="['click']">
            <MdiDotsVertical class="md:text-xl cursor-pointer nc-user-menu" @click.prevent />

            <template #overlay>
              <a-menu class="!py-0 nc-user-menu dark:(!bg-gray-800) leading-8 !rounded">
                <a-menu-item key="0" class="!rounded-t">
                  <nuxt-link v-t="['c:navbar:user:email']" class="group flex items-center no-underline py-2" to="/user">
                    <MdiAt class="mt-1 group-hover:text-success" />&nbsp;

                    <span class="prose group-hover:text-black nc-user-menu-email">{{ email }}</span>
                  </nuxt-link>
                </a-menu-item>

                <a-menu-divider class="!m-0" />

                <a-menu-item key="1" class="!rounded-b">
                  <div v-t="['a:navbar:user:sign-out']" class="group flex items-center py-2" @click="logout">
                    <MdiLogout class="dark:text-white group-hover:(!text-red-500)" />&nbsp;

                    <span class="prose font-semibold text-gray-500 group-hover:text-black nc-user-menu-signout">
                      {{ $t('general.signOut') }}
                    </span>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </a-layout-header>

      <div class="w-full" style="height: calc(100% - var(--header-height))">
        <slot />
      </div>
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped>
:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply m-0;
}
</style>
