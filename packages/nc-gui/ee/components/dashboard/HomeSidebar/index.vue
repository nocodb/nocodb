<script setup lang="ts">
const router = useRouter()
const route = router.currentRoute

const { user, signOut } = useGlobal()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

const isCreateWsDlgOpen = ref(false)

const isHomeActive = computed(() => {
  return (route.value.name as string) === 'index-home'
})

const navigateToHome = () => {
  navigateTo('/home')
}

const navigateToWorkspace = (wsId: string) => {
  navigateTo(`/${wsId}`)
}

const name = computed(() => user.value?.display_name?.trim())

// User menu
const isUserMenuOpen = ref(false)

const isLoggingOut = ref(false)

const logout = async () => {
  isLoggingOut.value = true
  try {
    const isSsoUser = !!(user?.value as any)?.sso_client_id
    await signOut({
      redirectToSignin: true,
      signinUrl: isSsoUser ? '/sso' : '/signin',
    })
  } catch (e) {
    console.error(e)
  } finally {
    isLoggingOut.value = false
  }
}

const accountUrl = computed(() => '/account/profile')
</script>

<template>
  <div
    class="nc-home-sidebar flex flex-col h-full bg-nc-bg-gray-sidebar border-r-1 border-nc-border-gray-light select-none"
  >
    <!-- Brand -->
    <div class="flex items-center gap-2 px-4 h-[var(--topbar-height)] flex-none">
      <GeneralIcon icon="nocodb1" class="h-6 w-6 flex-none" />
      <span class="text-[13px] font-bold text-nc-content-gray">NocoDB</span>
    </div>

    <!-- Home nav item -->
    <div class="px-2 mb-1">
      <div
        class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md cursor-pointer transition-colors"
        :class="{
          'bg-nc-bg-gray-medium text-nc-content-gray': isHomeActive,
          'text-nc-content-gray-subtle hover:bg-nc-bg-gray-light': !isHomeActive,
        }"
        data-testid="nc-home-sidebar-home"
        @click="navigateToHome"
      >
        <GeneralIcon icon="ncHome" class="h-4 w-4 flex-none" />
        <span class="text-[13px] font-medium">{{ $t('general.home') }}</span>
      </div>
    </div>

    <!-- Workspaces section -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-4 py-1.5">
        <span class="text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide">
          {{ $t('labels.workspaces') }}
        </span>
        <NcButton type="text" size="xxsmall" data-testid="nc-home-sidebar-create-ws" @click="isCreateWsDlgOpen = true">
          <GeneralIcon icon="plus" class="h-3.5 w-3.5" />
        </NcButton>
      </div>

      <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-2">
        <div
          v-for="ws in workspacesList"
          :key="ws.id"
          class="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors mb-0.5"
          :class="{
            'bg-nc-bg-gray-medium': activeWorkspaceId === ws.id && !isHomeActive,
            'hover:bg-nc-bg-gray-light': activeWorkspaceId !== ws.id || isHomeActive,
          }"
          :data-testid="`nc-home-sidebar-ws-${ws.id}`"
          @click="navigateToWorkspace(ws.id!)"
        >
          <GeneralWorkspaceIcon :workspace="ws" size="small" />
          <NcTooltip show-on-truncate-only class="flex-1 truncate text-[13px] text-nc-content-gray">
            <template #title>{{ ws.title }}</template>
            {{ ws.title }}
          </NcTooltip>
          <NcDropdown :trigger="['click']" @click.stop>
            <GeneralIcon
              icon="threeDotVertical"
              class="h-4 w-4 flex-none text-nc-content-gray-muted opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <template #overlay>
              <NcMenu class="nc-ws-ctx-menu">
                <NcMenuItem @click.stop="navigateTo(`/${ws.id}`)">
                  <GeneralIcon icon="ncDatabase" class="h-4 w-4" />
                  {{ $t('objects.projects') }}
                </NcMenuItem>
                <NcMenuItem @click.stop="navigateTo(`/${ws.id}/members`)">
                  <GeneralIcon icon="users" class="h-4 w-4" />
                  {{ $t('labels.members') }}
                </NcMenuItem>
                <NcMenuItem @click.stop="navigateTo(`/${ws.id}/teams`)">
                  <GeneralIcon icon="ncBuilding" class="h-4 w-4" />
                  {{ $t('general.teams') }}
                </NcMenuItem>
                <NcMenuItem @click.stop="navigateTo(`/${ws.id}/integrations`)">
                  <GeneralIcon icon="integration" class="h-4 w-4" />
                  {{ $t('general.integrations') }}
                </NcMenuItem>
                <NcMenuItem @click.stop="navigateTo(`/${ws.id}/audits`)">
                  <GeneralIcon icon="audit" class="h-4 w-4" />
                  {{ $t('title.audits') }}
                </NcMenuItem>
                <NcMenuItem @click.stop="navigateTo(`/${ws.id}/more`)">
                  <GeneralIcon icon="ncMoreHorizontal" class="h-4 w-4" />
                  {{ $t('general.more') }}
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>
      </div>
    </div>

    <!-- Templates & Import -->
    <div class="flex-none px-2 pb-1">
      <div
        class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md cursor-pointer text-nc-content-gray-subtle hover:bg-nc-bg-gray-light transition-colors"
      >
        <GeneralIcon icon="ncLayout" class="h-4 w-4 flex-none" />
        <span class="text-[13px]">{{ $t('general.templates') }}</span>
      </div>
      <div
        class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md cursor-pointer text-nc-content-gray-subtle hover:bg-nc-bg-gray-light transition-colors"
      >
        <GeneralIcon icon="ncDownload" class="h-4 w-4 flex-none" />
        <span class="text-[13px]">{{ $t('general.import') }}</span>
      </div>
    </div>

    <!-- Bottom section: User info with dropdown + notification bell -->
    <div class="flex-none border-t-1 border-nc-border-gray-light p-2">
      <div class="flex items-center gap-1">
        <NcDropdown v-model:visible="isUserMenuOpen" placement="topLeft" overlay-class-name="!min-w-56">
          <div
            class="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-md cursor-pointer flex-1 min-w-0 transition-colors"
            :class="{
              'bg-nc-bg-gray-medium': isUserMenuOpen,
              'hover:bg-nc-bg-gray-light': !isUserMenuOpen,
            }"
            data-testid="nc-home-sidebar-userinfo"
          >
            <GeneralUserIcon :user="user" size="medium" class="flex-none" />
            <div class="flex-1 min-w-0">
              <NcTooltip show-on-truncate-only class="truncate text-[13px] text-nc-content-gray block">
                <template #title>{{ name || user?.email }}</template>
                {{ name || user?.email }}
              </NcTooltip>
              <NcTooltip
                v-if="name"
                show-on-truncate-only
                class="truncate text-xs text-nc-content-gray-muted block"
              >
                <template #title>{{ user?.email }}</template>
                {{ user?.email }}
              </NcTooltip>
            </div>
          </div>
          <template #overlay>
            <NcMenu variant="medium">
              <!-- Account Settings -->
              <nuxt-link v-e="['c:user:settings']" class="!no-underline" :to="accountUrl">
                <NcMenuItem>
                  <GeneralIcon icon="ncSettings" class="menu-icon" />
                  <span>{{ $t('title.accountSettings') }}</span>
                </NcMenuItem>
              </nuxt-link>

              <NcDivider />

              <!-- Logout -->
              <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
                <div v-e="['c:user:logout']" class="flex gap-2 items-center">
                  <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
                  <GeneralIcon v-else icon="signout" class="menu-icon" />
                  <span>{{ $t('general.logout') }}</span>
                </div>
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>

        <!-- Notification bell -->
        <NcTooltip placement="top" :arrow="false">
          <template #title>{{ $t('general.notification') }}</template>
          <NcButton type="text" size="xxsmall" class="!rounded-md" @click="navigateTo(`/${activeWorkspaceId}/feed`)">
            <GeneralIcon icon="ncBell" class="h-4 w-4" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- Create workspace dialog -->
    <LazyWorkspaceCreateDlg v-model:model-value="isCreateWsDlgOpen" />
  </div>
</template>

<style lang="scss" scoped>
.nc-home-sidebar {
  width: 100%;
}
.menu-icon {
  @apply w-4 h-4;
}

.nc-ws-ctx-menu {
  font-size: 13px;
}
</style>
