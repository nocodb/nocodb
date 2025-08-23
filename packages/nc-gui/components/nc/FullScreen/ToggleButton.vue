<script setup lang="ts">
const { isMobileMode } = useGlobal()

const sidebarStore = useSidebarStore()

const { isFullScreen } = storeToRefs(sidebarStore)

const { toggleFullScreenState } = sidebarStore

/**
 * hide-on-click is not working when we enter in fullscreen mode as tooltip is getting disabled as soon as we enter in fullscreen mode.
 * Which is why we need to use a key to force the tooltip to re-render.
 */
</script>

<template>
  <NcTooltip
    v-if="!isMobileMode"
    :key="`${isFullScreen}`"
    hide-on-click
    :title="$t('labels.enterFullscreen')"
    :disabled="isFullScreen"
    placement="left"
  >
    <NcButton
      :type="isFullScreen ? 'primary' : 'text'"
      size="xs"
      :class="{
        '!px-1': !isFullScreen,
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
