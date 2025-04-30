<script lang="ts" setup>
const { user, signOut } = useGlobal()
// So watcher in users store is triggered
useUsers()

const { leftSidebarState } = storeToRefs(useSidebarStore())

const auditsStore = useAuditsStore()

const name = computed(() => user.value?.display_name?.trim())

const isMenuOpen = ref(false)

const isAuthTokenCopied = ref(false)

const isLoggingOut = ref(false)

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

const accountUrl = computed(() => {
  return isUIAllowed('superAdminSetup') && !isEeUI ? '/account/setup' : '/account/profile'
})
</script>

<template>
  <div class="flex flex-col border-gray-200 gap-y-1">
    <LazyGeneralMaintenanceAlert />
    <div class="flex items-center justify-between">
      <NcDropdown v-model:visible="isMenuOpen" placement="topLeft" overlay-class-name="!min-w-64">
        <div
          class="nc-user-icon-wrapper border-1 w-8 h-8 flex-none rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
          :class="{
            'border-nc-gray-medium': !isMenuOpen,
            'active border-primary shadow-selected': isMenuOpen,
          }"
          data-testid="nc-sidebar-userinfo"
        >
          <GeneralUserIcon :user="user" size="medium" class="!w-full !h-full !min-w-full cursor-pointer" />
        </div>
        <template #overlay>
          <NcMenu data-testid="nc-sidebar-userinfo" variant="small">
            <div
              class="flex flex-col justify-center py-1 px-3 gap-x-2 text-gray-700 rounded-lg min-h-8 text-small leading-[18px]"
              data-testid="nc-sidebar-userinfo"
            >
              <div v-if="name?.trim()" class="capitalize text-nc-content-gray font-bold">
                {{ name }}
              </div>
              <div
                :class="{
                  'text-xs text-nc-content-gray-muted': name?.trim(),
                  'text-nc-content-gray font-semibold': !name?.trim(),
                }"
              >
                {{ user?.email }}
              </div>
            </div>
            <NcDivider />
            <nuxt-link v-e="['c:user:settings']" class="!no-underline" :to="accountUrl" @click="auditsStore.handleReset">
              <NcMenuItem> <GeneralIcon icon="ncSettings" class="menu-icon" /> {{ $t('title.accountSettings') }} </NcMenuItem>
            </nuxt-link>
            <NcMenuItem data-testid="nc-sidebar-user-logout" @click="logout">
              <div v-e="['c:user:logout']" class="flex gap-2 items-center">
                <GeneralLoader v-if="isLoggingOut" class="!ml-0.5 !mr-0.5 !max-h-4.5 !-mt-0.5" />
                <GeneralIcon v-else icon="signout" class="menu-icon" />
                <span class="menu-btn"> {{ $t('general.logout') }}</span>
              </div>
            </NcMenuItem>
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

.nc-user-icon-wrapper {
  &:not(.active):hover {
    box-shadow: 0px 12px 16px -4px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.06);
  }
  :deep(img) {
    @apply !cursor-pointer;
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
