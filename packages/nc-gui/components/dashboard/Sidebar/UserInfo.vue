<script lang="ts" setup>
import GithubButton from 'vue-github-button'
import {
  computed,
  message,
  navigateTo,
  onMounted,
  ref,
  storeToRefs,
  useCopy,
  useGlobal,
  useSidebarStore,
  useUsers,
  watch,
} from '#imports'

const { user, signOut, token, appInfo } = useGlobal()
// So watcher in users store is triggered
useUsers()

const { leftSidebarState } = storeToRefs(useSidebarStore())

const { copy } = useCopy(true)

const name = computed(() => user.value?.display_name?.trim())

const isMenuOpen = ref(false)

const isAuthTokenCopied = ref(false)

const isLoggingOut = ref(false)

const { isMobileMode } = useGlobal()

const logout = async () => {
  isLoggingOut.value = true
  try {
    await signOut(false)

    // No need as all stores are cleared on signout
    // await clearWorkspaces()

    await navigateTo('/signin')
  } catch (e) {
    console.error(e)
  } finally {
    isLoggingOut.value = false
  }
}

const onCopy = async () => {
  try {
    await copy(token.value!)
    isAuthTokenCopied.value = true
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
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
</script>

<template>
  <div class="flex w-full flex-col p-1 border-t-1 border-gray-200 gap-y-1">
    <div v-if="!appInfo.ee && isMounted && !isMobileMode" class="flex flex-row w-full justify-between pt-0.5 truncate">
      <GeneralJoinCloud />
    </div>
    <NcDropdown v-model:visible="isMenuOpen" placement="topLeft" overlay-class-name="!min-w-64">
      <div
        class="flex flex-row py-2 px-3 gap-x-2 items-center hover:bg-gray-200 rounded-lg cursor-pointer h-10"
        data-testid="nc-sidebar-userinfo"
      >
        <GeneralUserIcon :email="user?.email" size="base" :name="user?.display_name" />
        <div class="flex truncate">
          {{ name ? name : user?.email }}
        </div>
        <GeneralIcon icon="arrowUp" class="!min-w-5" />
      </div>
      <template #overlay>
        <NcMenu data-testid="nc-sidebar-userinfo">
          <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
            <div v-e="['c:user:logout']" class="flex gap-2 items-center">
              <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
              <GeneralIcon v-else icon="signout" class="menu-icon" />
              <span class="menu-btn"> {{ $t('general.logout') }}</span>
            </div>
          </NcMenuItem>
          <template v-if="!isMobileMode">
            <NcMenuItem @click="onCopy">
              <div v-e="['c:auth-token:copy']" class="flex gap-2 items-center">
                <GeneralIcon v-if="isAuthTokenCopied" icon="check" class="group-hover:text-black menu-icon" />
                <GeneralIcon v-else icon="copy" class="menu-icon" />
                <template v-if="isAuthTokenCopied"> {{ $t('title.copiedAuthToken') }} </template>
                <template v-else> {{ $t('title.copyAuthToken') }} </template>
              </div>
            </NcMenuItem>
          </template>
          <NcDivider />
          <a
            v-e="['c:nocodb:discord']"
            href="https://discord.gg/5RgZmkW"
            target="_blank"
            class="!underline-transparent"
            rel="noopener noreferrer"
          >
            <NcMenuItem class="social-icon-wrapper">
              <GeneralIcon class="social-icon" icon="discord" />
              <span class="menu-btn"> {{ $t('labels.community.joinDiscord') }} </span>
            </NcMenuItem>
          </a>
          <a
            v-e="['c:nocodb:reddit']"
            href="https://www.reddit.com/r/NocoDB"
            target="_blank"
            class="!underline-transparent"
            rel="noopener noreferrer"
          >
            <NcMenuItem class="social-icon-wrapper">
              <GeneralIcon class="social-icon" icon="reddit" />
              <span class="menu-btn"> {{ $t('labels.community.joinReddit') }} </span>
            </NcMenuItem>
          </a>
          <a v-e="['c:nocodb:twitter']" href="https://twitter.com/nocodb" target="_blank" class="!underline-transparent">
            <NcMenuItem class="social-icon-wrapper group">
              <GeneralIcon class="text-gray-500 group-hover:text-gray-800 my-0.5" icon="twitter" />
              <span class="menu-btn"> {{ $t('labels.twitter') }} </span>
            </NcMenuItem>
          </a>
          <template v-if="!appInfo.ee">
            <NcDivider />
            <a-popover key="language" class="lang-menu !py-1.5" placement="rightBottom">
              <NcMenuItem>
                <div v-e="['c:translate:open']" class="flex gap-2 items-center">
                  <GeneralIcon icon="translate" class="group-hover:text-black nc-language ml-0.25 menu-icon" />
                  {{ $t('labels.language') }}
                  <div class="flex items-center text-gray-400 text-xs">{{ $t('labels.community.communityTranslated') }}</div>
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </NcMenuItem>

              <template #content>
                <div class="bg-white max-h-50vh scrollbar-thin-dull min-w-50 !overflow-auto">
                  <LazyGeneralLanguageMenu />
                </div>
              </template>
            </a-popover>
          </template>

          <template v-if="!isMobileMode">
            <NcDivider />

            <a
              v-e="['c:nocodb:forum-open']"
              href="https://community.nocodb.com"
              target="_blank"
              class="!underline-transparent"
              rel="noopener"
            >
              <NcMenuItem>
                <GeneralIcon icon="help" class="menu-icon mt-0.5" />
                <span class="menu-btn"> {{ $t('title.forum') }} </span>
              </NcMenuItem>
            </a>

            <a
              v-e="['c:nocodb:docs-open']"
              href="https://docs.nocodb.com"
              target="_blank"
              class="!underline-transparent"
              rel="noopener"
            >
              <NcMenuItem>
                <GeneralIcon icon="doc" class="menu-icon mt-0.5" />
                <span class="menu-btn"> {{ $t('title.docs') }} </span>
              </NcMenuItem>
            </a>

            <NcDivider />

            <nuxt-link v-e="['c:user:settings']" class="!no-underline" to="/account/profile">
              <NcMenuItem> <GeneralIcon icon="settings" class="menu-icon" /> {{ $t('title.accountSettings') }} </NcMenuItem>
            </nuxt-link>
          </template>
        </NcMenu>
      </template>
    </NcDropdown>

    <template v-if="isMobileMode"></template>
    <div v-else-if="appInfo.ee" class="text-gray-500 text-xs pl-3 mt-1">© 2023 NocoDB. Inc</div>
  </div>
</template>

<style lang="scss" scoped>
.menu-btn {
  line-height: 1.5;
}
.menu-icon {
  @apply !min-h-4.5;
  line-height: 1rem;
  font-size: 1.125rem;
}

:deep(.ant-popover-inner-content) {
  @apply !p-0 !rounded-md;
}

.social-icon {
  @apply my-0.5;
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
