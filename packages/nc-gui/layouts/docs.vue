<script lang="ts" setup>
import { computed, navigateTo, ref, useGlobal, useNuxtApp, useRoute, useSidebar } from '#imports'

const { signOut, signedIn, isLoading, user, currentVersion } = useGlobal()

useSidebar('nc-left-sidebar', { hasSidebar: false })

const route = useRoute()

const email = computed(() => user.value?.email ?? '---')

const hasSider = ref(false)

const sidebar = ref<HTMLDivElement>()

const logout = () => {
  signOut()
  navigateTo('/signin')
}

const { hooks } = useNuxtApp()

const isDashboard = computed(() => !!route.params.projectType)

/** when page suspensions have finished, check if a sidebar element was teleported into the layout */
hooks.hook('page:finish', () => {
  if (sidebar.value) {
    hasSider.value = sidebar.value?.children.length > 0
  }
})
</script>

<script lang="ts">
export default {
  name: 'DocsLayout',
}
</script>

<template>
  <a-layout>
    <a-layout-header class="flex !bg-white items-center text-white !pl-2 !pr-5 !py-7 border-b-1 border-gray-200">
      <Transition name="slide">
        <div v-show="hasSider" id="nc-sidebar-left" ref="sidebar" />
      </Transition>
      <div
        v-e="['c:navbar:home']"
        data-testid="nc-noco-brand-icon"
        class="transition-all duration-200 py-2 pr-2 pl-4 cursor-pointer transform scale-135 hover:scale-145 nc-noco-brand-icon"
        @click="navigateTo('/')"
      >
        <a-tooltip placement="bottom">
          <template #title>
            {{ currentVersion }}
          </template>
          <div class="flex items-center gap-2">
            <img width="25" alt="NocoDB" src="~/assets/img/icons/512x512.png" />
            <img v-show="!isDashboard" width="90" alt="NocoDB" src="~/assets/img/brand/text.png" />
          </div>
        </a-tooltip>
      </div>

      <div class="ml-2 font-semibold">Project Name</div>

      <div class="flex-1" />

      <LazyGeneralReleaseInfo />

      <a-tooltip placement="bottom" :mouse-enter-delay="1">
        <template #title> Switch language</template>

        <div class="flex pr-4 items-center text-white">
          <LazyGeneralLanguage class="cursor-pointer text-2xl hover:text-accent" />
        </div>
      </a-tooltip>

      <template v-if="signedIn">
        <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-user-accounts-menu">
          <MdiDotsVertical
            data-testid="nc-menu-accounts"
            class="md:text-xl cursor-pointer hover:text-accent nc-menu-accounts text-white"
            @click.prevent
          />

          <template #overlay>
            <a-menu class="!py-0 leading-8 !rounded">
              <a-menu-item key="0" data-testid="nc-menu-accounts__user-settings" class="!rounded-t">
                <nuxt-link v-e="['c:navbar:user:email']" class="nc-project-menu-item group !no-underline" to="/account/users">
                  <MdiAccountCircleOutline class="mt-1 group-hover:text-accent" />&nbsp;
                  <div class="prose group-hover:text-primary">
                    <div>Account</div>
                    <div class="text-xs text-gray-500">{{ email }}</div>
                  </div>
                </nuxt-link>
              </a-menu-item>

              <a-menu-divider class="!m-0" />
              <!--                <a-menu-item v-if="isUIAllowed('appStore')" key="0" class="!rounded-t">
                  <nuxt-link
                    v-e="['c:settings:appstore', { page: true }]"
                    class="nc-project-menu-item group !no-underline"
                    to="/admin/users"
                  >
                    <MdiShieldAccountOutline class="mt-1 group-hover:text-accent" />&nbsp;

                    &lt;!&ndash; todo: i18n &ndash;&gt;
                    <span class="prose group-hover:text-primary">Account management</span>
                  </nuxt-link>
                </a-menu-item>

                <a-menu-divider class="!m-0" /> -->

              <a-menu-item key="1" class="!rounded-b group">
                <div v-e="['a:navbar:user:sign-out']" class="nc-project-menu-item group" @click="logout">
                  <MdiLogout class="group-hover:text-accent" />&nbsp;

                  <span class="prose group-hover:text-primary">
                    {{ $t('general.signOut') }}
                  </span>
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </template>
    </a-layout-header>
    <a-layout>
      <a-layout-sider>
        <slot name="sidebar" />
      </a-layout-sider>
      <a-layout-content> <slot /></a-layout-content>
    </a-layout>
  </a-layout>
  <!-- <a-layout id="nc-app"> -->

  <!-- </a-layout> -->
</template>

<style lang="scss">
.nc-lang-btn {
  @apply color-transition flex items-center justify-center fixed bottom-10 right-10 z-99 w-12 h-12 rounded-full shadow-md shadow-gray-500 p-2 !bg-primary text-white ring-opacity-100 active:(ring ring-accent) hover:(ring ring-accent);

  &::after {
    @apply rounded-full absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary;
    content: '';
    z-index: -1;
  }

  &:hover::after {
    @apply transform scale-110 ring ring-accent ring-opacity-100;
  }

  &:active::after {
    @apply ring ring-accent ring-opacity-100;
  }
}
</style>
