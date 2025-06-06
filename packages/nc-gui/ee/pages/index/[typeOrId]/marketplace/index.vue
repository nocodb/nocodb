<script setup lang="ts">
const { hideSidebar, isNewSidebarEnabled } = storeToRefs(useSidebarStore())

onMounted(() => {
  if (isNewSidebarEnabled.value) {
    hideSidebar.value = true
  }
})
</script>

<template>
  <div>
    <div class="h-full flex-1 flex flex-col overflow-y-auto nc-scrollbar-thin">
      <div class="flex flex-row py-2 border-b-1 border-nc-border-gray-medium px-2 items-center">
        <div class="flex-1">
          <LazyAccountBreadcrumb />
        </div>
      </div>
      <div
        :style="{
          height: 'calc(100vh - 3.5rem)',
        }"
        class="flex flex-col w-full"
      >
        <div class="h-full">
          <Marketplace />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
