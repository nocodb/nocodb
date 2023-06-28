<script lang="ts" setup>
import SidebarIcon from '~icons/nc-icons/sidebar'

const { isRightSidebarOpen } = storeToRefs(useSidebarStore())
</script>

<template>
  <div
    class="flex flex-row items-center justify-center !rounded-md !p-1.75 border-1 cursor-pointer hover:bg-gray-50"
    :class="{
      'bg-gray-75': !isRightSidebarOpen,
    }"
    type="ghost"
    @click="isRightSidebarOpen = !isRightSidebarOpen"
  >
    <SidebarIcon class="w-4 h-4 text-gray-500" />
  </div>
</template>
