<script lang="ts" setup>
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const { user, signOut, appInfo } = useGlobal()
// So watcher in users store is triggered
useUsers()

const { toggleMode } = useMiniSidebarMode()

const { isExperimentalFeatureModalOpen } = useBetaFeatureToggle()

const { leftSidebarState } = storeToRefs(useSidebarStore())

const auditsStore = useAuditsStore()

const name = computed(() => user.value?.display_name?.trim())

const isMenuOpen = ref(false)

const isAuthTokenCopied = ref(false)

const isLoggingOut = ref(false)

const copyBtnRef = ref()

const { isMobileMode } = useGlobal()

const { isChatWootEnabled } = useProvideChatwoot()

const { isModalVisible: isChatVisible } = useChatWoot()

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

const toggleChatSupport = () => {
  if (!isChatVisible.value && !ncIsFunction(window.$chatwoot?.toggle)) {
    return
  }
  const toggleText = (isChatVisible.value ? 'hide' : 'show') as any
  window.$chatwoot.toggle(toggleText)
  isMenuOpen.value = false
}

const supportCopyBtnRef = ref()

const copySupportEmail = () => {
  supportCopyBtnRef.value?.copyContent?.('support@nocodb.com')
}

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
    <div class="flex items-center justify-center h-14">
      <NcDropdown
        v-model:visible="isMenuOpen"
        placement="topLeft"
        :overlay-class-name="`!min-w-44 md:!min-w-64 ${isMiniSidebar ? '!left-1' : ''}`"
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
            <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
              <div v-e="['c:user:logout']" class="flex gap-2 items-center min-w-40 md:min-w-70">
                <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
                <GeneralIcon v-else icon="signout" class="menu-icon" />
                <span class="menu-btn"> {{ $t('general.logout') }}</span>
              </div>
            </NcMenuItem>

            <NcDivider />
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

            <template v-if="!isMobileMode">
              <NcDivider />

              <!-- Todo: Add dock mode menu item once it is done -->
              <!-- <NcMenuItem @click="toggleMode">
                <GeneralIcon icon="ncPlaceholderIcon" class="menu-icon mt-0.5" />
                <span class="menu-btn">Dock Mode</span>
              </NcMenuItem> -->

              <DashboardSidebarEEMenuOption v-if="isEeUI" />
              <NcMenuItem @click="openExperimentationMenu">
                <GeneralIcon icon="bulb" class="menu-icon mt-0.5" />
                <span class="menu-btn"> {{ $t('general.featurePreview') }} </span>
              </NcMenuItem>
              <NcSubMenu class="py-0" variant="medium">
                <template #title>
                  <GeneralIcon icon="ncHelp" class="menu-icon mt-0.5" />
                  <span class="menu-btn">{{ $t('general.help') }}</span>
                </template>

                <!-- Resources -->
                <div class="px-3 pt-2 pb-1 text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide">
                  Resources
                </div>
                <a
                  v-e="['c:nocodb:docs-open']"
                  href="https://nocodb.com/docs/product-docs"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="file" class="h-4 w-4" />
                    <span class="menu-btn">Documentation</span>
                  </NcMenuItem>
                </a>
                <a
                  v-e="['c:nocodb:api-docs-open']"
                  href="https://data-apis-v2.nocodb.com"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="ncCode" class="h-4 w-4" />
                    <span class="menu-btn">APIs</span>
                  </NcMenuItem>
                </a>

                <NcDivider />

                <!-- Community -->
                <div class="px-3 pt-2 pb-1 text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide">
                  Community
                </div>
                <a
                  v-e="['c:nocodb:forum-open']"
                  href="https://community.nocodb.com"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="ncDiscordForum" class="h-4 w-4" />
                    <span class="menu-btn">Forum</span>
                  </NcMenuItem>
                </a>
                <a
                  v-e="['c:nocodb:youtube-open']"
                  href="https://www.youtube.com/@NocoDB"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="ncYoutube" class="h-4 w-4" />
                    <span class="menu-btn">Youtube</span>
                  </NcMenuItem>
                </a>
                <a
                  v-e="['c:nocodb:twitter-open']"
                  href="https://twitter.com/nocodb"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="ncTwitter" class="h-4 w-4" />
                    <span class="menu-btn">X</span>
                  </NcMenuItem>
                </a>

                <NcDivider />

                <!-- Contact Support -->
                <div class="px-3 pt-2 pb-1 text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide">
                  Contact Support
                </div>
                <NcMenuItem v-if="isChatWootEnabled" @click="toggleChatSupport">
                  <GeneralIcon icon="ncSupportAgent" class="h-4 w-4" />
                  <span class="menu-btn">{{ $t('labels.chatWithNocoDBSupport') }}</span>
                </NcMenuItem>
                <NcMenuItem v-if="isEeUI" v-e="['c:nocodb:contact-us-mail-copy']" @click="copySupportEmail">
                  <GeneralIcon icon="ncMail" class="h-4 w-4" />
                  <span class="menu-btn">support@nocodb.com</span>
                  <GeneralCopyButton ref="supportCopyBtnRef" type="secondary" content="support@nocodb.com" :show-toast="false" />
                </NcMenuItem>

                <NcDivider />

                <!-- What's New -->
                <div class="px-3 pt-2 pb-1 text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide">
                  What's New
                </div>
                <a
                  v-e="['c:nocodb:changelog-open']"
                  href="https://nocodb.com/changelog"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="ncList" class="h-4 w-4" />
                    <span class="menu-btn">Changelog</span>
                  </NcMenuItem>
                </a>
              </NcSubMenu>
              <nuxt-link v-e="['c:user:api-tokens']" class="!no-underline" to="/account/tokens">
                <NcMenuItem>
                  <GeneralIcon icon="ncKey2" class="menu-icon mt-0.5" />
                  <span class="menu-btn"> {{ $t('title.apiTokens') }} </span>
                </NcMenuItem>
              </nuxt-link>
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
