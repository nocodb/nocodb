<script lang="ts" setup>
/**
 * Reusable user menu content — logout, dock mode, feature preview,
 * keyboard shortcuts, API tokens, language, theme, account settings.
 *
 * Used by both the mini-sidebar UserInfo and the HomeSidebar.
 * Expects to be placed inside an NcDropdown overlay slot.
 */

const emits = defineEmits<{
  (e: 'closeMenu'): void
}>()

const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const { user, signOut, isMobileMode } = useGlobal()

const { toggleMode } = useMiniSidebarMode()

const { toggleTheme, isThemeEnabled, selectedTheme } = useTheme()

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

const auditsStore = useAuditsStore()

const isLoggingOut = ref(false)

const copyBtnRef = ref()

const { $e } = useNuxtApp()

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

const openExperimentationMenu = () => {
  emits('closeMenu')
  isExperimentalFeatureModalOpen.value = true
}

const route = useRoute()

const accountUrl = computed(() => '/account/profile')

const saveBackRoute = () => {
  ncBackRoute().set(route.fullPath)
}

const copyEmail = () => {
  if (!user?.value?.email) return
  copyBtnRef.value?.copyContent?.(user.value?.email)
}

const openKeyboardShortcutDialog = () => {
  emits('closeMenu')
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
  <NcMenu variant="medium">
    <!-- Desktop menu -->
    <template v-if="!isMobileMode">
      <!-- Log Out -->
      <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
        <div v-e="['c:user:logout']" class="flex gap-2 items-center min-w-40 md:min-w-70">
          <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
          <GeneralIcon v-else icon="signout" class="menu-icon" />
          <span class="menu-btn">{{ $t('general.logout') }}</span>
        </div>
      </NcMenuItem>

      <NcDivider />

      <!-- Dock Mode -->
      <NcMenuItem v-if="isMiniSidebar" @click="toggleMode">
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
            <kbd class="nc-user-menu-kbd">{{ renderCmdOrCtrlKey() }}</kbd>
            <kbd class="nc-user-menu-kbd">/</kbd>
          </span>
        </div>
      </NcMenuItem>

      <!-- Admin Panel (EE) -->
      <DashboardSidebarEEMenuOption v-if="isEeUI" />

      <!-- API Tokens -->
      <nuxt-link v-e="['c:user:api-tokens']" class="!no-underline" to="/account/tokens" @click="saveBackRoute">
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
      <nuxt-link
        v-e="['c:user:settings']"
        class="!no-underline"
        :to="accountUrl"
        @click="
          () => {
            saveBackRoute()
            auditsStore.handleReset()
          }
        "
      >
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
    </template>

    <!-- Mobile menu (mini-sidebar) -->
    <template v-else>
      <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
        <div v-e="['c:user:logout']" class="flex gap-2 items-center min-w-40">
          <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
          <GeneralIcon v-else icon="signout" class="menu-icon" />
          <span class="menu-btn">{{ $t('general.logout') }}</span>
        </div>
      </NcMenuItem>

      <NcDivider />

      <NcMenuItem @click="openExperimentationMenu">
        <GeneralIcon icon="bulb" class="menu-icon mt-0.5" />
        <span class="menu-btn">{{ $t('general.featurePreview') }}</span>
      </NcMenuItem>

      <template v-if="isThemeEnabled">
        <NcDivider />
        <NcMenuItem v-e="['c:nocodb:theme']" data-testid="nc-sidebar-user-theme" @click="toggleTheme">
          <GeneralIcon :icon="themeIcon" class="menu-icon" />
          <span class="menu-btn">{{ themeLabel }}</span>
          <span class="text-nc-content-gray-muted text-xs ml-auto">Appearance</span>
        </NcMenuItem>
      </template>

      <NcDivider />

      <NcMenuItemLabel>
        <span class="normal-case">{{ $t('labels.accountEmailID') }}</span>
      </NcMenuItemLabel>
      <NcMenuItem inner-class="w-full" @click="copyEmail">
        <GeneralIcon icon="ncMail" class="h-4 w-4" />
        <NcTooltip show-on-truncate-only class="flex-1 truncate max-w-68">
          <template #title>{{ user?.email }}</template>
          {{ user?.email }}
        </NcTooltip>
        <GeneralCopyButton v-if="user?.email" ref="copyBtnRef" type="secondary" :content="user?.email" :show-toast="false" />
      </NcMenuItem>
    </template>
  </NcMenu>
</template>

<style lang="scss" scoped>
.menu-btn {
  line-height: 1.5;
}

.menu-icon {
  @apply w-4 h-4;
  font-size: 1rem;
}

.nc-user-menu-kbd {
  @apply inline-flex items-center justify-center
    min-w-4.5 h-4.5 px-1
    text-[10px] font-medium leading-none
    text-nc-content-gray-muted
    bg-nc-bg-gray-light
    border-1 border-nc-border-gray-medium
    rounded;
}
</style>
