<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'small' | 'xs'
  }>(),
  {
    size: 'xs',
  },
)

const { isMobileMode } = useGlobal()

const sidebarStore = useSidebarStore()

const { isFullScreen } = storeToRefs(sidebarStore)

const { toggleFullScreenState } = sidebarStore
</script>

<template>
  <NcTooltip v-if="!isMobileMode" hide-on-click :title="$t('labels.enterFullscreen')" :disabled="isFullScreen" placement="left">
    <NcButton
      :type="isFullScreen ? 'primary' : 'secondary'"
      :size="size"
      :class="{
        '!px-1': size === 'xs' && !isFullScreen,
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
