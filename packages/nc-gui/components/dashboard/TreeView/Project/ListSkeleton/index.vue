<template>
  <div class="nc-treeview-loading absolute w-full h-full top-0 left-0 z-5">
    <div class="w-full">
      <DashboardSidebarHeaderWrapper>
        <div class="flex-1 flex">
          <a-skeleton-input active class="flex-1 children:rounded-md h-7" />
        </div>
      </DashboardSidebarHeaderWrapper>

      <div class="nc-project-home-section !px-2">
        <div class="h-11 flex items-center">
          <a-skeleton-input active size="small" class="flex-1 children:rounded-md h-7" />
        </div>
      </div>

      <DashboardTreeViewProjectListSkeletonEntity class="!px-2" />
    </div>
  </div>
</template>
