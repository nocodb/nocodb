<script lang="ts" setup></script>

<template>
  <div class="h-full">
    <div class="flex flex-col">
      <NcPageHeader>
        <template #icon>
          <GeneralIcon icon="ncSettings" class="flex-none text-gray-700 text-[20px] h-5 w-5" />
        </template>
        <template #title>
          <span data-rec="true"> Settings </span>
        </template>
      </NcPageHeader>
      <WorkspaceSettings />
    </div>
  </div>
</template>
