<script setup lang="ts">
interface Props {
  size?: 'default' | 'small'
  showInMobile?: boolean
}

withDefaults(defineProps<Props>(), {
  size: 'default',
  showInMobile: false,
})
const { isWorkspacesLoading } = storeToRefs(useWorkspace())

const { isMobileMode } = useGlobal()
</script>

<template>
  <div v-if="isWorkspacesLoading && (!isMobileMode || showInMobile)" class="nc-mini-sidebar-btn-full-width">
    <div
      class="w-7"
      :class="{
        'h-7 ': size === 'default',
        'h-9 py-1': size === 'small',
      }"
    >
      <a-skeleton-avatar active shape="square" class="!h-full !w-full !children:(rounded-md w-7 h-7)" />
    </div>
  </div>
  <slot v-else-if="!isMobileMode || showInMobile" />
</template>
