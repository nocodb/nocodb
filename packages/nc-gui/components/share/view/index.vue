<script lang="ts" setup>
import { ViewLockType } from 'nocodb-sdk'

const popover = useProvideShareViewPopover()

const { screen, direction, restrictedSharing, activeView, isLocked } = popover

const transitionName = computed(() => (direction.value === 'forward' ? 'slide-left' : 'slide-right'))
</script>

<template>
  <div class="nc-share-view-popover flex flex-col bg-nc-bg-default rounded-lg overflow-hidden">
    <template v-if="isLocked || restrictedSharing">
      <ShareCommonPopoverHeader :title="$t('activity.shareView')" />
      <div class="px-3 pb-3">
        <div class="flex items-start gap-2 px-2 py-2 bg-nc-bg-gray-light rounded-md text-nc-content-gray-subtle2">
          <GeneralIcon v-if="restrictedSharing" icon="ncBasePrivate" class="flex-none !w-3.5 !h-3.5 mt-0.5" />
          <GeneralIcon
            v-else-if="activeView?.lock_type === ViewLockType.Locked"
            icon="ncLock"
            class="flex-none !w-4 !h-4 mt-0.5"
          />
          <GeneralIcon v-else icon="ncEye" class="flex-none !w-3.5 !h-3.5 mt-0.5" />
          <div class="flex-1 text-bodySm">
            {{
              restrictedSharing
                ? $t('msg.privateBaseViewShareRestrictedMsg')
                : $t('title.viewSettingsCantBeChangedWhenViewIs', {
                    type: $t(viewLockIcons[activeView?.lock_type]?.title).toLowerCase(),
                  })
            }}
          </div>
        </div>
      </div>
    </template>

    <div v-else class="nc-share-screen-wrapper">
      <Transition :name="transitionName" mode="out-in">
        <div v-if="screen === 'main'" key="main">
          <div class="flex items-center gap-1.5 px-4 pt-3 pb-3 select-none">
            <div class="text-nc-content-gray-emphasis text-subHeading2 truncate">
              {{ $t('activity.shareViewTitle', { name: activeView?.title }) }}
            </div>
            <NcTooltip class="flex items-center">
              <template #title>{{ $t('activity.shareViewTooltip') }}</template>
              <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5 text-nc-content-gray-subtle2 cursor-pointer" />
            </NcTooltip>
          </div>
          <NcDivider class="!my-0" />
          <ShareViewMain />
        </div>
        <ShareViewLinkSettings v-else-if="screen === 'link-settings'" key="link-settings" />
        <ShareViewSyncData v-else-if="screen === 'sync'" key="sync" />
        <ShareViewRegenerateConfirm v-else-if="screen === 'regenerate-confirm'" key="regenerate-confirm" />
        <ShareViewDisableConfirm v-else-if="screen === 'disable-confirm'" key="disable-confirm" />
        <ShareViewChangePassword v-else-if="screen === 'change-password'" key="change-password" />
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-share-screen-wrapper {
  position: relative;
  overflow: hidden;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 90ms ease;
  will-change: transform;
}

.slide-left-enter-from {
  transform: translateX(8px);
}
.slide-left-leave-to {
  transform: translateX(-8px);
}
.slide-right-enter-from {
  transform: translateX(-8px);
}
.slide-right-leave-to {
  transform: translateX(8px);
}
</style>
