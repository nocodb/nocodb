<script setup lang="ts">
const { isMobileMode } = useGlobal()

const sidebarStore = useSidebarStore()

const { isFullScreen } = storeToRefs(sidebarStore)

const { toggleFullScreenState: _toggleFullScreenState } = sidebarStore

const showLockResetLoading = ref(false)

const userClickedOnToggleBtn = ref(false)

const showToggleFullscreenBtn = computed(() => {
  return !isMobileMode.value
})

let lockResetTimer: any

watch(isFullScreen, async (newValue, _oldValue, onCleanup) => {
  if (newValue || userClickedOnToggleBtn.value) {
    userClickedOnToggleBtn.value = false

    return
  }

  showLockResetLoading.value = true

  lockResetTimer = setTimeout(() => {
    showLockResetLoading.value = false
  }, 1500)

  onCleanup(() => {
    clearTimeout(lockResetTimer)
  })
})

const toggleFullScreenState = () => {
  // If it is inside iframe then open in new tab
  if (ncIsIframe()) {
    window.open(window.location.href, '_blank')
    return
  }

  if (isFullScreen.value) {
    userClickedOnToggleBtn.value = true
  }

  _toggleFullScreenState()
}

/**
 * hide-on-click is not working when we enter in fullscreen mode as tooltip is getting disabled as soon as we enter in fullscreen mode.
 * Which is why we need to use a key to force the tooltip to re-render.
 */
</script>

<template>
  <NcTooltip
    v-if="showToggleFullscreenBtn"
    :key="`${isFullScreen}`"
    hide-on-click
    :title="
      showLockResetLoading
        ? $t('tooltip.releasingPreviousFullscreenLock')
        : ncIsIframe()
        ? $t('labels.clickToOpenInNewTabToEnterFullscreen')
        : $t('labels.enterFullscreen')
    "
    :disabled="isFullScreen"
    placement="left"
    :class="{
      '!cursor-wait': showLockResetLoading,
    }"
  >
    <NcButton
      :type="isFullScreen ? 'primary' : 'text'"
      size="xs"
      :class="{
        '!px-1': !isFullScreen,
        'pointer-events-none': showLockResetLoading,
      }"
      :icon-only="!isFullScreen"
      @click="toggleFullScreenState"
    >
      <template #icon>
        <GeneralIcon v-if="!isFullScreen" icon="ncMaximize2" />
        <GeneralIcon v-else icon="ncMinimize2" />
      </template>
      <template v-if="isFullScreen">{{ $t('labels.exitFullscreen') }}</template>
    </NcButton>
  </NcTooltip>
</template>
