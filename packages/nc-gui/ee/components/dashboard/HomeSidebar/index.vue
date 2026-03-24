<script setup lang="ts">
const { user, signOut } = useGlobal()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

const isCreateWsDlgOpen = ref(false)

const navigateToWorkspace = (wsId: string) => {
  navigateTo(`/${wsId}`)
}

const name = computed(() => user.value?.display_name?.trim())

// Track which workspace context menu is open
const openMenuWsId = ref<string | null>(null)

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

const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)

const isNotificationOpen = ref(false)

const { toggleMode } = useMiniSidebarMode()

const { toggleTheme, isThemeEnabled, selectedTheme, isDark } = useTheme()

const themeLabel = computed(
  () =>
    ({
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    }[selectedTheme.value]),
)

const themeIcon = computed(
  () =>
    ({
      light: 'ncSun',
      dark: 'ncMoon',
      system: 'ncSunMoon',
    }[selectedTheme.value] as IconMapKey),
)

const { isExperimentalFeatureModalOpen } = useBetaFeatureToggle()

const { isMobileMode } = useGlobal()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { $e } = useNuxtApp()

const openExperimentationMenu = () => {
  isUserMenuOpen.value = false
  isExperimentalFeatureModalOpen.value = true
}

const openKeyboardShortcutDialog = () => {
  isUserMenuOpen.value = false
  $e('a:actions:keyboard-shortcut')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgKeyboardShortcuts'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false
    close(300)
  }
}
</script>

<template>
  <div class="nc-home-sidebar flex flex-col h-full bg-nc-bg-gray-sidebar border-r-1 border-nc-border-gray-light select-none">
    <!-- Brand header — same pattern as SidebarHeaderWrapper -->
    <div class="w-full px-2 py-1.5 flex items-center justify-between gap-2 h-[var(--topbar-height)] flex-none">
      <div class="pl-1">
        <img v-if="isDark" alt="NocoDB" src="~/assets/img/brand/text.png" class="h-4" />
        <img v-else alt="NocoDB" src="~/assets/img/brand/nocodb.png" class="h-4" />
      </div>
      <div class="flex items-center gap-0.5">
        <NcTooltip class="flex" placement="bottom" hide-on-click :disabled="!!isMobileMode">
          <template #title>
            {{ isLeftSidebarOpen ? $t('title.hideSidebar') : $t('title.showSidebar') }}
          </template>
          <NcButton
            v-e="['c:leftSidebar:hideToggle']"
            :type="isMobileMode ? 'secondary' : 'text'"
            :size="isMobileMode ? 'medium' : 'small'"
            class="nc-sidebar-left-toggle-icon !text-nc-content-gray-subtle !hover:text-nc-content-gray !md:(hover:bg-nc-bg-gray-medium) !rounded-md"
            @click="isLeftSidebarOpen = !isLeftSidebarOpen"
          >
            <div class="flex items-center text-inherit">
              <GeneralIcon v-if="isMobileMode" icon="close" />
              <GeneralIcon
                v-else
                icon="doubleLeftArrow"
                class="duration-150 transition-all !text-lg -mt-0.5 !text-nc-content-gray-muted bg-opacity-50"
                :class="{ 'transform rotate-180': !isLeftSidebarOpen }"
              />
            </div>
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- Workspaces section — uses same layout as nc-project-home-section -->
    <div class="flex-1 flex flex-col overflow-hidden nc-project-home-section !pb-0">
      <!-- Header — same style as nc-settings-section-header in WsSettingsMenu -->
      <div class="nc-ws-section-header flex items-center justify-between">
        <span>{{ $t('labels.workspaces') }}</span>
        <NcButton type="text" size="xxsmall" data-testid="nc-home-sidebar-create-ws" @click="isCreateWsDlgOpen = true">
          <GeneralIcon icon="plus" class="h-3.5 w-3.5" />
        </NcButton>
      </div>

      <!-- Workspace list -->
      <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
        <NcSidebarMenuItem
          v-for="ws in workspacesList"
          :key="ws.id"
          class="group"
          :active="activeWorkspaceId === ws.id"
          :data-testid="`nc-home-sidebar-ws-${ws.id}`"
          @click="navigateToWorkspace(ws.id!)"
        >
          <template #icon>
            <GeneralWorkspaceIcon :workspace="ws" size="small" class="flex-none" />
          </template>
          <span class="capitalize">{{ ws.title }}</span>
        </NcSidebarMenuItem>
      </div>
    </div>

    <!-- Templates & Import -->
    <div class="flex-none px-1 pb-1">
      <NcSidebarMenuItem icon="ncLayout">
        {{ $t('general.templates') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem icon="ncDownload">
        {{ $t('general.import') }}
      </NcSidebarMenuItem>
    </div>

    <!-- Bottom section: User info with dropdown + notification bell -->
    <div class="flex-none border-t-1 border-nc-border-gray-light p-1.5">
      <div class="flex items-center gap-0.5">
        <NcDropdown v-model:visible="isUserMenuOpen" placement="topLeft" overlay-class-name="!min-w-56">
          <div
            class="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-md cursor-pointer flex-1 min-w-0 transition-colors"
            :class="{
              'bg-nc-bg-gray-medium': isUserMenuOpen,
              'hover:bg-nc-bg-gray-medium': !isUserMenuOpen,
            }"
            data-testid="nc-home-sidebar-userinfo"
          >
            <GeneralUserIcon :user="user" size="medium" class="flex-none" />
            <div class="flex-1 min-w-0">
              <NcTooltip show-on-truncate-only class="truncate text-bodyDefaultSm text-nc-content-gray block">
                <template #title>{{ name || user?.email }}</template>
                {{ name || user?.email }}
              </NcTooltip>
              <NcTooltip v-if="name" show-on-truncate-only class="truncate text-bodySm text-nc-content-gray-muted block">
                <template #title>{{ user?.email }}</template>
                {{ user?.email }}
              </NcTooltip>
            </div>
          </div>
          <template #overlay>
            <NcMenu variant="medium" class="nc-home-user-menu">
              <!-- Log Out -->
              <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
                <div v-e="['c:user:logout']" class="flex gap-2 items-center min-w-40 md:min-w-64">
                  <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
                  <GeneralIcon v-else icon="signout" class="menu-icon" />
                  <span class="menu-btn">{{ $t('general.logout') }}</span>
                </div>
              </NcMenuItem>

              <NcDivider />

              <!-- Dock Mode -->
              <NcMenuItem @click="toggleMode">
                <GeneralIcon icon="ncPlaceholderIcon" class="menu-icon mt-0.5" />
                <span class="menu-btn">Dock Mode</span>
                <NcBadgeBeta />
              </NcMenuItem>

              <!-- Experimental Features -->
              <NcMenuItem @click="openExperimentationMenu">
                <GeneralIcon icon="bulb" class="menu-icon mt-0.5" />
                <span class="menu-btn">{{ $t('general.featurePreview') }}</span>
              </NcMenuItem>

              <!-- Keyboard Shortcuts -->
              <NcMenuItem
                v-e="['c:user:keyboard-shortcuts']"
                data-testid="nc-sidebar-keyboard-shortcuts"
                @click="openKeyboardShortcutDialog"
              >
                <GeneralIcon icon="ncKeyboard" class="menu-icon" />
                <div class="flex items-center justify-between flex-1">
                  <span class="menu-btn">{{ $t('title.keyboardShortcut') }}</span>
                  <span class="flex items-center gap-0.5 text-nc-content-gray-muted ml-1">
                    <kbd class="nc-home-user-kbd">{{ renderCmdOrCtrlKey() }}</kbd>
                    <kbd class="nc-home-user-kbd">/</kbd>
                  </span>
                </div>
              </NcMenuItem>

              <!-- Admin Panel (EE) -->
              <DashboardSidebarEEMenuOption v-if="isEeUI" />

              <!-- API Tokens -->
              <nuxt-link v-e="['c:user:api-tokens']" class="!no-underline" to="/account/tokens">
                <NcMenuItem>
                  <GeneralIcon icon="ncKey2" class="menu-icon mt-0.5" />
                  <span class="menu-btn">{{ $t('title.apiTokens') }}</span>
                </NcMenuItem>
              </nuxt-link>

              <NcDivider />

              <!-- Language -->
              <a-popover
                key="language"
                class="lang-menu !py-1.5"
                placement="rightBottom"
                overlay-class-name="nc-lang-menu-overlay !z-1050"
              >
                <NcMenuItem inner-class="w-full">
                  <div v-e="['c:translate:open']" class="flex gap-2 items-center w-full">
                    <GeneralIcon icon="translate" class="nc-language ml-0.25 menu-icon" />
                    {{ $t('labels.language') }}
                    <div class="flex items-center text-nc-content-gray-disabled text-xs">
                      {{ $t('labels.community.communityTranslated') }}
                    </div>
                    <div class="flex-1" />
                    <GeneralIcon icon="ncChevronRight" class="flex-none !text-nc-content-gray-muted" />
                  </div>
                </NcMenuItem>
                <template #content>
                  <div class="bg-nc-bg-default max-h-50vh min-w-64 mb-1 nc-scrollbar-thin -mr-1.5 pr-1.5">
                    <LazyGeneralLanguageMenu />
                  </div>
                </template>
              </a-popover>

              <!-- Theme -->
              <NcMenuItem v-if="isThemeEnabled" v-e="['c:nocodb:theme']" data-testid="nc-sidebar-user-theme" @click="toggleTheme">
                <GeneralIcon :icon="themeIcon" class="menu-icon" />
                <span class="menu-btn">{{ themeLabel }}</span>
                <span class="text-nc-content-gray-muted text-xs ml-auto">Appearance</span>
              </NcMenuItem>

              <!-- Account Settings -->
              <nuxt-link v-e="['c:user:settings']" class="!no-underline" :to="accountUrl">
                <NcMenuItem>
                  <GeneralIcon icon="ncSettings" class="menu-icon" />
                  <div class="flex-1 flex flex-col">
                    <div>{{ $t('title.accountSettings') }}</div>
                    <NcTooltip show-on-truncate-only class="truncate text-bodySm text-nc-content-gray-muted max-w-68">
                      <template #title>{{ user?.email }}</template>
                      {{ user?.email }}
                    </NcTooltip>
                  </div>
                </NcMenuItem>
              </nuxt-link>
            </NcMenu>
          </template>
        </NcDropdown>

        <!-- Notification bell -->
        <NcDropdown v-model:visible="isNotificationOpen" :trigger="['click']" placement="topRight" overlay-class-name="!min-w-80">
          <NcTooltip placement="top" :arrow="false" :disabled="isNotificationOpen">
            <template #title>{{ $t('general.notification') }}</template>
            <NcButton
              type="text"
              size="small"
              class="!rounded-md relative self-center flex-none"
              data-testid="nc-home-sidebar-notification"
            >
              <span
                v-if="unreadCount"
                class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full border border-white dark:border-[#1a1a1a]"
                style="background: #e75a8d"
              />
              <GeneralIcon icon="ncBell" class="h-4 w-4" />
            </NcButton>
          </NcTooltip>
          <template #overlay>
            <NotificationCard @close="isNotificationOpen = false" />
          </template>
        </NcDropdown>
      </div>
    </div>

    <!-- Create workspace dialog -->
    <LazyWorkspaceCreateDlg v-model:model-value="isCreateWsDlgOpen" />
  </div>
</template>

<style lang="scss" scoped>
.nc-home-sidebar {
  @apply !pb-0;
  width: 100%;
}

.menu-icon {
  @apply w-4 h-4;
}

.menu-btn {
  line-height: 1.5;
}

.nc-ws-section-header {
  @apply px-3 pt-1.5 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}

.nc-home-user-kbd {
  @apply inline-flex items-center justify-center
    min-w-4.5 h-4.5 px-1
    text-[10px] font-medium leading-none
    text-nc-content-gray-muted
    bg-nc-bg-gray-light
    border-1 border-nc-border-gray-medium
    rounded;
}
</style>
