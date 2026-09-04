<script lang="ts" setup>
const popover = useProvideShareBaseModal()

const { screen, direction, isPrivateBase, loadBase } = popover

const { base } = storeToRefs(useBase())

const transitionName = computed(() => (direction.value === 'forward' ? 'slide-left' : 'slide-right'))

onMounted(() => {
  if (base.value?.id) loadBase()
})
</script>

<template>
  <div class="nc-share-base-popover flex flex-col bg-nc-bg-default rounded-lg overflow-hidden">
    <div
      v-if="isPrivateBase"
      class="mx-3 my-2 flex items-center gap-2 px-3 py-2 bg-nc-bg-gray-light rounded-md text-nc-content-gray-subtle2"
    >
      <GeneralIcon icon="ncBasePrivate" class="flex-none !w-3.5 !h-3.5" />
      <div class="flex-1 text-bodySm">{{ $t('msg.privateBaseShareRestrictedMsg') }}</div>
    </div>

    <div class="nc-share-screen-wrapper">
      <Transition :name="transitionName" mode="out-in">
        <div v-if="screen === 'main'" key="main">
          <div class="flex items-center gap-1.5 px-4 pt-3 pb-3 select-none">
            <div class="text-nc-content-gray-emphasis text-subHeading2 truncate">
              {{ $t('activity.shareBase.title', { name: base?.title }) }}
            </div>
            <NcTooltip class="flex items-center">
              <template #title>{{ $t('activity.shareBase.tooltip') }}</template>
              <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5 text-nc-content-gray-subtle2 cursor-pointer" />
            </NcTooltip>
          </div>
          <NcDivider class="!my-0" />
          <ShareBaseMain />
        </div>
        <ShareBaseLinkSettings v-else-if="screen === 'link-settings'" key="link-settings" />
        <ShareBaseRegenerateConfirm v-else-if="screen === 'regenerate-confirm'" key="regenerate-confirm" />
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
