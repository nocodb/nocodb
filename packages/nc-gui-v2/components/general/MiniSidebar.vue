<script lang="ts" setup>
import { navigateTo } from '#app'
import { computed, useGlobal, useProject, useRoute, useSidebar } from '#imports'

const { signOut, signedIn, user } = useGlobal()

const { isOpen } = useSidebar({ isOpen: true })

const { project } = useProject()

const route = useRoute()

const email = computed(() => user.value?.email ?? '---')

const logout = () => {
  signOut()
  navigateTo('/signin')
}
</script>

<template>
  <a-layout-sider
    :collapsed="isOpen"
    width="50"
    collapsed-width="0"
    class="nc-mini-sidebar !bg-primary h-full"
    :trigger="null"
    collapsible
    theme="light"
  >
    <a-dropdown placement="bottom" :trigger="['click']">
      <div class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105 nc-noco-brand-icon">
        <img width="35" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
      </div>

      <template v-if="signedIn" #overlay>
        <a-menu class="ml-2 !py-0 min-w-32 leading-8 !rounded nc-menu-account">
          <a-menu-item-group title="User Settings">
            <a-menu-item key="email" class="!rounded-t">
              <nuxt-link v-t="['c:navbar:user:email']" class="group flex items-center no-underline py-2" to="/user">
                <MdiAt class="mt-1 group-hover:text-success" />
                &nbsp;
                <span class="prose group-hover:text-black nc-user-menu-email">{{ email }}</span>
              </nuxt-link>
            </a-menu-item>

            <a-menu-divider class="!m-0" />

            <a-menu-item key="signout" class="!rounded-b">
              <div v-t="['a:navbar:user:sign-out']" class="group flex items-center py-2" @click="logout">
                <MdiLogout class="dark:text-white group-hover:(!text-red-500)" />&nbsp;
                <span class="prose font-semibold text-gray-500 group-hover:text-black nc-user-menu-signout">
                  {{ $t('general.signOut') }}
                </span>
              </div>
            </a-menu-item>
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>

    <div id="sidebar" ref="sidebar" class="text-white flex-auto flex flex-col items-center w-full">
      <a-dropdown :trigger="['contextmenu']" placement="right">
        <div :class="[route.name === 'index' ? 'active' : '']" class="nc-mini-sidebar-item" @click="navigateTo('/')">
          <MdiFolder class="cursor-pointer transform hover:scale-105 text-2xl" />
        </div>

        <template #overlay>
          <a-menu class="mt-6 select-none !py-0 min-w-32 leading-8 !rounded">
            <a-menu-item-group>
              <template #title>
                <span class="cursor-pointer prose-sm text-gray-500 hover:text-primary" @click="navigateTo('/')">
                  {{ $t('objects.projects') }}
                </span>
              </template>

              <a-menu-item class="active:(ring ring-pink-500)">
                <div
                  v-t="['c:project:create:xcdb']"
                  class="group flex items-center gap-2 py-2 hover:text-primary"
                  @click="navigateTo('/project/create')"
                >
                  <MdiPlus class="text-lg group-hover:text-pink-500" />
                  {{ $t('activity.createProject') }}
                </div>
              </a-menu-item>

              <a-menu-item class="rounded-b active:(ring ring-pink-500)">
                <div
                  v-t="['c:project:create:extdb']"
                  class="group flex items-center gap-2 py-2 hover:text-primary"
                  @click="navigateTo('/project/create-external')"
                >
                  <MdiDatabaseOutline class="text-lg group-hover:text-pink-500" />
                  <div v-html="$t('activity.createProjectExtended.extDB')" />
                </div>
              </a-menu-item>
            </a-menu-item-group>
          </a-menu>
        </template>
      </a-dropdown>

      <a-tooltip placement="right">
        <template v-if="project" #title>{{ project.title }}</template>

        <div
          :class="[route.name.includes('nc-projectId') ? 'active' : 'pointer-events-none !text-gray-400']"
          class="nc-mini-sidebar-item"
          @click="navigateTo(`/${route.params.projectType}/${route.params.projectId}`)"
        >
          <MdiDatabase class="cursor-pointer transform hover:scale-105 text-2xl" />
        </div>
      </a-tooltip>
    </div>
  </a-layout-sider>
</template>

<style lang="scss" scoped>
.nc-mini-sidebar {
  :deep(.ant-layout-sider-children) {
    @apply flex flex-col items-center;
  }

  .nc-mini-sidebar-item {
    @apply flex w-full justify-center items-center h-12 group p-2;

    &.active {
      @apply bg-pink-500 border-t-1 border-b-1;
    }
  }
}
</style>
