<script lang="ts" setup>
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const { user, signOut, appInfo } = useGlobal()
// So watcher in users store is triggered
useUsers()

const { isExperimentalFeatureModalOpen } = useBetaFeatureToggle()

const { leftSidebarState } = storeToRefs(useSidebarStore())

const auditsStore = useAuditsStore()

const name = computed(() => user.value?.display_name?.trim())

const isMenuOpen = ref(false)

const isAuthTokenCopied = ref(false)

const isLoggingOut = ref(false)

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

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

const accountUrl = computed(() => {
  return isUIAllowed('superAdminSetup') && !isEeUI ? '/account/setup' : '/account/profile'
})
</script>

<template>
  <div
    class="flex w-full flex-col border-gray-200 gap-y-1"
    :class="{
      'sticky bottom-0 bg-[var(--mini-sidebar-bg-color)]': isMiniSidebar,
    }"
  >
    <LazyGeneralMaintenanceAlert v-if="!isMiniSidebar" />
    <div
      class="flex items-center"
      :class="{
        'justify-center h-[var(--mini-sidebar-width)]': isMiniSidebar,
        'justify-between': !isMiniSidebar,
      }"
    >
      <NcDropdown
        v-model:visible="isMenuOpen"
        placement="topLeft"
        :overlay-class-name="`!min-w-44 md:!min-w-64 ${isMiniSidebar ? '!left-1' : ''}`"
      >
        <NcTooltip :disabled="!isMiniSidebar" placement="right" hide-on-click :arrow="false">
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
              'flex-row py-1 px-3 gap-x-2 items-center text-gray-700 hover:bg-gray-200 rounded-lg cursor-pointer': !isMiniSidebar,
              'nc-mini-sidebar-ws-item !w-[var(--mini-sidebar-width)] flex-none': isMiniSidebar,
            }"
            data-testid="nc-sidebar-userinfo"
          >
            <div
              v-if="isMiniSidebar"
              class="nc-user-icon-wrapper border-1 w-7 h-7 flex-none rounded-full overflow-hidden transition-all duration-300"
              :class="{
                'border-nc-gray-medium': !isMenuOpen,
                'active border-primary shadow-selected': isMenuOpen,
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

              <GeneralIcon icon="chevronDown" class="flex-none !min-w-5 transform rotate-180 !text-gray-500" />
            </template>
          </div>
        </NcTooltip>
        <template #overlay>
          <NcMenu data-testid="nc-sidebar-userinfo" variant="medium">
            <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
              <div v-e="['c:user:logout']" class="flex gap-2 items-center min-w-40 md:min-w-70">
                <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
                <GeneralIcon v-else icon="signout" class="menu-icon" />
                <span class="menu-btn"> {{ $t('general.logout') }}</span>
              </div>
            </NcMenuItem>
            <NcDivider v-if="!isMiniSidebar" />
            <a
              v-if="!isMiniSidebar"
              v-e="['c:nocodb:discord']"
              href="https://discord.gg/5RgZmkW"
              target="_blank"
              class="!underline-transparent"
              rel="noopener noreferrer"
            >
              <NcMenuItem class="social-icon-wrapper">
                <GeneralIcon class="social-icon" icon="ncDiscord" />
                <span class="menu-btn"> {{ $t('labels.community.joinDiscord') }} </span>
              </NcMenuItem>
            </a>
            <a
              v-if="!isMiniSidebar"
              v-e="['c:nocodb:reddit']"
              href="https://www.reddit.com/r/NocoDB"
              target="_blank"
              class="!underline-transparent"
              rel="noopener noreferrer"
            >
              <NcMenuItem class="social-icon-wrapper">
                <GeneralIcon class="social-icon" icon="ncReddit" />
                <span class="menu-btn"> {{ $t('labels.community.joinReddit') }} </span>
              </NcMenuItem>
            </a>
            <a
              v-if="!isMiniSidebar"
              v-e="['c:nocodb:twitter']"
              href="https://twitter.com/nocodb"
              target="_blank"
              class="!underline-transparent"
              rel="noopener noreferrer"
            >
              <NcMenuItem class="social-icon-wrapper group">
                <GeneralIcon class="social-icon text-gray-500 group-hover:text-gray-800" icon="ncTwitter" />
                <span class="menu-btn"> {{ $t('labels.twitter') }} </span>
              </NcMenuItem>
            </a>
            <NcDivider />
            <a-popover
              key="language"
              class="lang-menu !py-1.5"
              placement="rightBottom"
              overlay-class-name="nc-lang-menu-overlay !z-1050"
            >
              <NcMenuItem inner-class="w-full">
                <div v-e="['c:translate:open']" class="flex gap-2 items-center w-full">
                  <GeneralIcon icon="translate" class="group-hover:text-black nc-language ml-0.25 menu-icon" />
                  {{ $t('labels.language') }}
                  <div class="flex items-center text-gray-400 text-xs">{{ $t('labels.community.communityTranslated') }}</div>
                  <div class="flex-1" />

                  <GeneralIcon icon="ncChevronRight" class="flex-none !text-gray-500" />
                </div>
              </NcMenuItem>

              <template #content>
                <div class="bg-white max-h-50vh min-w-64 mb-1 nc-scrollbar-thin -mr-1.5 pr-1.5">
                  <LazyGeneralLanguageMenu />
                </div>
              </template>
            </a-popover>

            <template v-if="!isMobileMode">
              <NcDivider />

              <template v-if="!isMiniSidebar">
                <a
                  v-e="['c:nocodb:forum-open']"
                  href="https://community.nocodb.com"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="ncHelp" class="menu-icon mt-0.5" />
                    <span class="menu-btn"> {{ $t('title.forum') }} </span>
                  </NcMenuItem>
                </a>

                <a
                  v-e="['c:nocodb:docs-open']"
                  href="https://nocodb.com/docs/product-docs"
                  target="_blank"
                  class="!underline-transparent"
                  rel="noopener"
                >
                  <NcMenuItem>
                    <GeneralIcon icon="file" class="menu-icon mt-0.5" />
                    <span class="menu-btn"> {{ $t('title.docs') }} </span>
                  </NcMenuItem>
                </a>

                <NcDivider />
              </template>

              <DashboardSidebarEEMenuOption v-if="isEeUI" />
              <NcMenuItem @click="openExperimentationMenu">
                <GeneralIcon icon="bulb" class="menu-icon mt-0.5" />
                <span class="menu-btn"> {{ $t('general.featurePreview') }} </span>
              </NcMenuItem>
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
          </NcMenu>
        </template>
      </NcDropdown>
      <LazyNotificationMenu v-if="!isMiniSidebar" />
    </div>

    <template v-if="!isMiniSidebar">
      <template v-if="isMobileMode || appInfo.ee"></template>
      <div v-else class="flex flex-row w-full justify-between pt-0.5 truncate">
        <GeneralJoinCloud />
      </div>
    </template>
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
  .ant-popover-inner {
    @apply !rounded-lg;
  }

  .ant-popover-inner-content {
    @apply !bg-transparent;
  }
}
</style>
