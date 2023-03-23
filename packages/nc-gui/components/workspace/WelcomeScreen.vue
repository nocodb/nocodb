<script lang="ts" setup>

import { NcProjectType } from '#imports'
</script>

<template>
  <div class="flex items-center justify-center h-full">
    <div class="flex flex-col gap-4 items-center">
      <NcIconsInbox />
      <div class="font-weight-medium">No Projects</div>
      <div class="text-xs">Create Project</div>
      <div class="flex gap-2 justify mt-2.5">
        <a-button class="flex-1 w-64 nc-btn">
          <div class="flex gap-2 items-center justify-center">
          <GeneralProjectIcon :type="NcProjectType.DB" class="text-[#2824FB] text-lg" />

          New Database Project
          </div>


        </a-button>
        <a-button class="flex-1 w-64 nc-btn">

          <div class="flex gap-2 items-center justify-center"><GeneralProjectIcon :type="NcProjectType.DOCS" class="text-[#247727] text-lg" />
          New Documentation Project
          </div>
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>


</style>
