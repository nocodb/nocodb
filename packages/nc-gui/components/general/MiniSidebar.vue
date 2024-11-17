<script lang="ts" setup>
const { signOut, signedIn, user, currentVersion } = useGlobal()

const { isOpen } = useSidebar('nc-mini-sidebar', { isOpen: true })

const { base } = storeToRefs(useBase())

const route = useRoute()

const email = computed(() => user.value?.email ?? '---')

const logout = async () => {
  await signOut({
    redirectToSignin: true,
  })
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
    <a-dropdown placement="bottom" :trigger="['click']" overlay-class-name="nc-dropdown">
      <div class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105 nc-noco-brand-icon">
        <a-tooltip placement="bottom">
          <template #title>
            {{ currentVersion }}
          </template>
          <img width="35" alt="NocoDB" src="~/assets/img/icons/256x256-trans.png" />
        </a-tooltip>
      </div>

      <template v-if="signedIn" #overlay>
        <a-menu class="ml-2 !py-0 min-w-32 leading-8 !rounded nc-menu-account">
          <a-menu-item-group title="User Settings">
            <a-menu-item key="email" class="!rounded-t">
              <nuxt-link v-e="['c:navbar:user:email']" class="group flex items-center no-underline py-2" to="/user">
                <component :is="iconMap.at" class="mt-1 group-hover:text-success" />
                &nbsp;
                <span class="prose group-hover:text-black nc-user-menu-email">{{ email }}</span>
              </nuxt-link>
            </a-menu-item>

            <a-menu-divider class="!m-0" />

            <a-menu-item key="signout" class="!rounded-b">
              <div v-e="['a:navbar:user:sign-out']" class="group flex items-center py-2" @click="logout">
                <component :is="iconMap.signout" class="group-hover:(!text-red-500)" />&nbsp;
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
      <a-dropdown :trigger="['contextmenu']" placement="right" overlay-class-name="nc-dropdown">
        <div :class="[route.name === 'index' ? 'active' : '']" class="nc-mini-sidebar-item" @click="navigateTo('/')">
          <component :is="iconMap.folder" class="cursor-pointer transform hover:scale-105 text-2xl" />
        </div>

        <template #overlay>
          <a-menu class="mt-6 select-none !py-0 min-w-32 leading-8 !rounded">
            <a-menu-item-group>
              <template #title>
                <span class="cursor-pointer prose-sm text-gray-500 hover:text-primary" @click="navigateTo('/')">
                  {{ $t('objects.projects') }}
                </span>
              </template>

              <a-menu-item class="active:(ring ring-accent ring-opacity-100)">
                <div
                  v-e="['c:base:create:xcdb']"
                  class="group flex items-center gap-2 py-2 hover:text-primary"
                  @click="navigateTo('/base/create')"
                >
                  <component :is="iconMap.plus" class="text-lg group-hover:text-accent" />
                  {{ $t('activity.createProject') }}
                </div>
              </a-menu-item>

              <a-menu-item class="rounded-b active:(ring ring-accent)">
                <div
                  v-e="['c:base:create:extdb']"
                  class="group flex items-center gap-2 py-2 hover:text-primary"
                  @click="navigateTo('/base/create-external')"
                >
                  <component :is="iconMap.database" class="text-lg group-hover:text-accent" />
                  <div v-html="$t('activity.createProjectExtended.extDB')" />
                </div>
              </a-menu-item>
            </a-menu-item-group>
          </a-menu>
        </template>
      </a-dropdown>

      <a-tooltip placement="right">
        <template v-if="base" #title>{{ base.title }}</template>

        <div
          :class="[route.name.includes('nc-baseId') ? 'active' : 'pointer-events-none !text-gray-400']"
          class="nc-mini-sidebar-item"
          @click="navigateTo(`/${route.params.baseType}/${route.params.baseId}`)"
        >
          <component :is="iconMap.database" class="cursor-pointer transform hover:scale-105 text-2xl" />
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
      @apply bg-accent border-t-1 border-b-1;
    }
  }
}
</style>
