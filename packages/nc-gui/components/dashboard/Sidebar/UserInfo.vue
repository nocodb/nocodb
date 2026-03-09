<script lang="ts" setup>
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const { user, signOut } = useGlobal()
// So watcher in users store is triggered
useUsers()

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

const { leftSidebarState } = storeToRefs(useSidebarStore())

const auditsStore = useAuditsStore()

const name = computed(() => user.value?.display_name?.trim())

const isMenuOpen = ref(false)

const isAuthTokenCopied = ref(false)

const isLoggingOut = ref(false)

const copyBtnRef = ref()

const { isMobileMode } = useGlobal()

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

watch(isMenuOpen, () => {
  if (isAuthTokenCopied.value) {
    isAuthTokenCopied.value = false
  }
})

watch(leftSidebarState, () => {
  if (leftSidebarState.value === 'peekCloseEnd') {
    isMenuOpen.value = false
  }
})

// This is a hack to prevent github button error (prevents navigateTo if user is not signed in)
const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
})

const openExperimentationMenu = () => {
  isMenuOpen.value = false
  isExperimentalFeatureModalOpen.value = true
}

const accountUrl = computed(() => '/account/profile')



const copyEmail = () => {
  if (!user?.value?.email) return

  copyBtnRef.value?.copyContent?.(user.value?.email)
}

const openKeyboardShortcutDialog = () => {
  isMenuOpen.value = false
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
  <div
    class="flex w-full flex-col border-nc-border-gray-medium gap-y-1"
    :class="{
      'sticky bottom-0 bg-nc-bg-gray-minisidebar': isMiniSidebar,
    }"
  >
    <div class="flex items-center justify-center h-13">
      <NcDropdown
        v-model:visible="isMenuOpen"
        placement="rightBottom"
        :overlay-class-name="`!min-w-44 md:!min-w-64 nc-user-menu-dropdown`"
        :align="{ offset: [12, 3] }"
      >
        <NcTooltip :disabled="isMobileMode" placement="right" hide-on-click :arrow="false">
          <template #title>
            <div>
              <div v-if="name">{{ name }}</div>
              <div>
                {{ user?.email }}
              </div>
            </div>
          </template>
          <div
            class="flex"
            :class="{
              'nc-mini-sidebar-ws-item flex-none': isMiniSidebar,
            }"
            data-testid="nc-sidebar-userinfo"
            :data-email="user?.email"
          >
            <div
              v-if="isMiniSidebar"
              class="nc-user-icon-wrapper border-1 w-7.5 h-7.5 flex-none rounded-full overflow-hidden transition-all duration-300"
              :class="{
                'border-nc-border-gray-medium ring-2 ring-nc-border-gray-medium/40': !isMenuOpen,
                'active border-primary shadow-selected ring-2 ring-primary/30': isMenuOpen,
              }"
            >
              <GeneralUserIcon :user="user" size="medium" class="!w-full !h-full !min-w-full cursor-pointer" />
            </div>

            <template v-else>
              <GeneralUserIcon :user="user" size="medium" />

              <NcTooltip class="max-w-32 truncate" show-on-truncate-only>
                <template #title>
                  {{ name ? name : user?.email }}
                </template>

                {{ name ? name : user?.email }}
              </NcTooltip>

              <GeneralIcon icon="chevronDown" class="flex-none !min-w-5 transform rotate-180 !text-nc-content-gray-muted" />
            </template>
          </div>
        </NcTooltip>
        <template #overlay>
          <NcMenu variant="medium">
            <template v-if="!isMobileMode">
              <!-- Log Out (furthest from cursor) -->
              <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
                <div v-e="['c:user:logout']" class="flex gap-2 items-center min-w-40 md:min-w-70">
                  <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
                  <GeneralIcon v-else icon="signout" class="menu-icon" />
                  <span class="menu-btn"> {{ $t('general.logout') }}</span>
                </div>
              </NcMenuItem>

              <NcDivider />

              <!-- Discovery / Meta -->
              <NcMenuItem @click="toggleMode">
                <GeneralIcon icon="ncPlaceholderIcon" class="menu-icon mt-0.5" />
                <span class="menu-btn">Dock Mode</span>
                <NcBadgeBeta />
              </NcMenuItem>
              <NcMenuItem @click="openExperimentationMenu">
                <GeneralIcon icon="bulb" class="menu-icon mt-0.5" />
                <span class="menu-btn"> {{ $t('general.featurePreview') }} </span>
              </NcMenuItem>
              <!-- Power user tools -->
              <NcMenuItem
                v-e="['c:user:keyboard-shortcuts']"
                data-testid="nc-sidebar-keyboard-shortcuts"
                @click="openKeyboardShortcutDialog"
              >
                <GeneralIcon icon="ncKeyboard" class="menu-icon" />
                <div class="flex items-center justify-between flex-1">
                  <span class="menu-btn"> {{ $t('title.keyboardShortcut') }} </span>
                  <span class="flex items-center gap-0.5 text-nc-content-gray-muted ml-1">
                    <kbd class="nc-user-menu-kbd">{{ renderCmdOrCtrlKey() }}</kbd>
                    <kbd class="nc-user-menu-kbd">/</kbd>
                  </span>
                </div>
              </NcMenuItem>
              <DashboardSidebarEEMenuOption v-if="isEeUI" />
              <nuxt-link v-e="['c:user:api-tokens']" class="!no-underline" to="/account/tokens">
                <NcMenuItem>
                  <GeneralIcon icon="ncKey2" class="menu-icon mt-0.5" />
                  <span class="menu-btn"> {{ $t('title.apiTokens') }} </span>
                </NcMenuItem>
              </nuxt-link>

              <NcDivider />

              <!-- Preferences (most used, closest to avatar) -->
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
              <NcMenuItem v-if="isThemeEnabled" v-e="['c:nocodb:theme']" data-testid="nc-sidebar-user-theme" @click="toggleTheme">
                <GeneralIcon :icon="themeIcon" class="menu-icon" />
                <span class="menu-btn">{{ themeLabel }}</span>
                <span class="text-nc-content-gray-muted text-xs ml-auto">Appearance</span>
              </NcMenuItem>

              <!-- Account Settings (closest to avatar) -->
              <nuxt-link v-e="['c:user:settings']" class="!no-underline" :to="accountUrl" @click="auditsStore.handleReset">
                <NcMenuItem>
                  <GeneralIcon icon="ncSettings" class="menu-icon" />
                  <div class="flex-1 flex flex-col">
                    <div>
                      {{ $t('title.accountSettings') }}
                    </div>
                    <NcTooltip
                      v-if="isMiniSidebar"
                      show-on-truncate-only
                      class="truncate text-bodySm text-nc-content-gray-muted max-w-68"
                    >
                      <template #title>
                        {{ user?.email }}
                      </template>
                      {{ user?.email }}
                    </NcTooltip>
                  </div>
                </NcMenuItem>
              </nuxt-link>
            </template>
            <template v-else-if="isMiniSidebar">
              <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
                <div v-e="['c:user:logout']" class="flex gap-2 items-center min-w-40">
                  <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
                  <GeneralIcon v-else icon="signout" class="menu-icon" />
                  <span class="menu-btn"> {{ $t('general.logout') }}</span>
                </div>
              </NcMenuItem>

              <NcDivider />

              <NcMenuItemLabel>
                <span class="normal-case"> {{ $t('labels.accountEmailID') }} </span>
              </NcMenuItemLabel>
              <NcMenuItem inner-class="w-full" @click="copyEmail">
                <GeneralIcon icon="ncMail" class="h-4 w-4" />
                <NcTooltip show-on-truncate-only class="flex-1 truncate max-w-68">
                  <template #title>
                    {{ user?.email }}
                  </template>
                  {{ user?.email }}
                </NcTooltip>

                <GeneralCopyButton
                  v-if="user?.email"
                  ref="copyBtnRef"
                  type="secondary"
                  :content="user?.email"
                  :show-toast="false"
                />
              </NcMenuItem>
            </template>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.menu-btn {
  line-height: 1.5;
}
.menu-icon {
  @apply w-4 h-4;
  font-size: 1rem;
}

.nc-user-icon-wrapper {
  &:not(.active):hover {
    box-shadow: 0px 12px 16px -4px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.06);
  }
  :deep(img) {
    @apply !cursor-pointer;
  }
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

.social-icon {
  @apply my-0.5 w-4 h-4 stroke-transparent;
  // Make icon black and white
  filter: grayscale(100%);

  // Make icon red on hover
  &:hover {
    filter: grayscale(100%) invert(100%);
  }
}

.social-icon-wrapper {
  .nc-icon {
    @apply mr-0.15;
  }

  &:hover {
    .social-icon {
      filter: none !important;
    }
  }
}
</style>

<style lang="scss">
.nc-user-menu-dropdown.nc-user-menu-dropdown {
  overflow: visible !important;

  &::before {
    content: '';
    position: absolute;
    left: -6px;
    bottom: 12px;
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 7px solid var(--nc-border-gray-medium);
  }

  &::after {
    content: '';
    position: absolute;
    left: -5px;
    bottom: 13px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid var(--nc-bg-default);
  }
}

.nc-lang-menu-overlay {
  .ant-popover-arrow-content {
    @apply dark:(border-1 border-nc-border-gray-medium);
  }

  .ant-popover-inner {
    @apply dark:(border-1 border-nc-border-gray-medium) !rounded-lg;
  }

  .ant-popover-inner-content {
    @apply !bg-transparent;
  }
}
</style>
