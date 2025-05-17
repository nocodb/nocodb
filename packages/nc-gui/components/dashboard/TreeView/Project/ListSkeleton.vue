<script setup lang="ts">
const enableLoadingSkeleton = false
</script>

<template>
  <div class="nc-treeview-loading absolute w-full h-full top-0 left-0 z-5">
    <div class="w-full">
      <DashboardSidebarHeaderWrapper>
        <div class="flex-1 flex">
          <a-skeleton-input active class="flex-1 children:rounded-md h-8" />
        </div>
      </DashboardSidebarHeaderWrapper>
      <template v-if="enableLoadingSkeleton">
        <div class="nc-project-home-section !px-2">
          <div class="h-11 flex items-center">
            <a-skeleton-input active size="small" class="flex-1 children:rounded-md h-8" />
          </div>
          <div class="h-8 flex items-center">
            <a-skeleton-input active size="small" class="flex-1 children:rounded-md h-8" />
          </div>
        </div>

        <div v-for="item of ncArrayFrom(2)" :key="item" class="nc-project-home-section !px-2 mt-1">
          <div class="flex w-1/2">
            <a-skeleton-input active size="small" class="children:rounded-md h-6 flex-1" />
          </div>
          <div class="flex flex-col gap-2 mt-3">
            <div v-for="i of ncArrayFrom(5)" :key="i" class="flex items-center gap-2">
              <a-skeleton-avatar active shape="square" class="!h-6 !w-6 !children:(rounded-md w-6 h-6)" />
              <a-skeleton-input active size="small" class="flex-1 children:rounded-md h-6" />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
