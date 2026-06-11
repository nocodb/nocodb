<script lang="ts" setup>
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const { user } = useGlobal()
// So watcher in users store is triggered
useUsers()

const { leftSidebarState } = storeToRefs(useSidebarStore())

const name = computed(() => user.value?.display_name?.trim())

const isMenuOpen = ref(false)

const { isMobileMode } = useGlobal()

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
        overlay-class-name="!min-w-44 md:!min-w-64 nc-user-menu-dropdown"
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
          <DashboardSidebarUserInfoMenu @close-menu="isMenuOpen = false" />
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
