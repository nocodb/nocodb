<script lang="ts" setup>
import GithubButton from 'vue-github-button'

const { user, signOut, token, appInfo } = useGlobal()

const { clearWorkspaces } = useWorkspace()

const { leftSidebarState } = storeToRefs(useSidebarStore())

const { copy } = useCopy(true)

const name = computed(() => `${user.value?.firstname ?? ''} ${user.value?.lastname ?? ''}`.trim())

const isMenuOpen = ref(false)

const isAuthTokenCopied = ref(false)

const isLoggingOut = ref(false)

const logout = async () => {
  isLoggingOut.value = true
  try {
    await signOut(false)

    await clearWorkspaces()

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
  <div class="flex w-full flex-col p-1 border-t-1 border-gray-200 gap-y-2">
    <NcDropdown v-model:visible="isMenuOpen" placement="topLeft" overlay-class-name="!min-w-64">
      <div
        class="flex flex-row py-2 px-3 gap-x-2 items-center hover:bg-gray-200 rounded-lg cursor-pointer h-10"
        data-testid="nc-sidebar-userinfo"
      >
        <GeneralUserIcon />
        <div class="flex truncate">
          {{ name ? name : user?.email }}
        </div>
        <GeneralIcon icon="arrowUp" class="!min-w-5" />
      </div>
      <template #overlay>
        <NcMenu>
          <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
            <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
            <GeneralIcon v-else icon="signout" class="menu-icon" />
            Log Out</NcMenuItem
          >
          <NcDivider />
          <a href="https://docs.nocodb.com" target="_blank" class="!underline-transparent">
            <NcMenuItem>
              <GeneralIcon icon="help" class="menu-icon" />
              Help Center</NcMenuItem
            >
          </a>
          <NcDivider />
          <a href="https://discord.gg/5RgZmkW" target="_blank" class="!underline-transparent">
            <NcMenuItem class="social-icon-wrapper"
              ><GeneralIcon class="social-icon" icon="discord" />Join our Discord</NcMenuItem
            >
          </a>
          <a href="https://www.reddit.com/r/NocoDB" target="_blank" class="!underline-transparent">
            <NcMenuItem class="social-icon-wrapper"><GeneralIcon class="social-icon" icon="reddit" />/r/NocoDB</NcMenuItem>
          </a>
          <a href="https://twitter.com/nocodb" target="_blank" class="!underline-transparent">
            <NcMenuItem class="social-icon-wrapper group"
              ><GeneralIcon class="text-gray-500 group-hover:text-gray-800" icon="twitter" />Twitter</NcMenuItem
            >
          </a>
          <template v-if="!appInfo.ee">
            <NcDivider />
            <a-popover key="language" class="lang-menu !py-1.5" placement="rightBottom">
              <NcMenuItem>
                <GeneralIcon icon="translate" class="group-hover:text-black nc-language ml-0.25 menu-icon" />
                {{ $t('labels.language') }}
                <div class="flex items-center text-gray-400 text-xs">(Community Translated)</div>
                <div class="flex-1" />

                <MaterialSymbolsChevronRightRounded class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400" />
              </NcMenuItem>

              <template #content>
                <div class="bg-white max-h-50vh scrollbar-thin-dull min-w-50 !overflow-auto">
                  <LazyGeneralLanguageMenu />
                </div>
              </template>
            </a-popover>
          </template>

          <NcDivider />
          <NcMenuItem @click="onCopy"
            ><GeneralIcon v-if="isAuthTokenCopied" icon="check" class="group-hover:text-black menu-icon" /><GeneralIcon
              v-else
              icon="copy"
              class="menu-icon"
            />
            <template v-if="isAuthTokenCopied"> Copied Auth Token </template>
            <template v-else> Copy Auth Token </template>
          </NcMenuItem>
          <nuxt-link v-e="['c:navbar:user:email']" class="!no-underline" to="/account/tokens">
            <NcMenuItem><GeneralIcon icon="settings" class="menu-icon" /> Account Settings</NcMenuItem>
          </nuxt-link>
        </NcMenu>
      </template>
    </NcDropdown>

    <div v-if="appInfo.ee" class="text-gray-500 text-xs pl-3">© 2023 NocoDB. Inc</div>
    <div v-else-if="isMounted" class="flex flex-col gap-y-1 pt-1">
      <div class="flex items-start flex-row justify-center px-2 gap-2">
        <GithubButton href="https://github.com/nocodb/nocodb" data-icon="octicon-star" data-show-count="true" data-size="large">
          Star
        </GithubButton>
      </div>

      <div class="flex items-start flex-row justify-center gap-2">
        <GeneralJoinCloud class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.menu-icon {
  @apply !min-h-4.5;
  line-height: 1rem;
  font-size: 1.125rem;
}

:deep(.ant-popover-inner-content) {
  @apply !p-0 !rounded-md;
}
.social-icon {
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
