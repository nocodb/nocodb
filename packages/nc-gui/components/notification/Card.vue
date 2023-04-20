<script lang="ts" setup></script>

<template>
  <div class="min-w-[640px] min-h-[640px] !rounded-2xl bg-white rounded-xl nc-card" >
    <div class=" !p-6">
    <div class="flex items-center">
      <span class="text-xl font-medium">
        <!-- todo: i18n -->
        Notification
      </span>
      <span class="flex-grow"></span>
      <GeneralIcon icon="settings" />
    </div>

      <a-tabs>
        <a-tab-pane key="1" tab="All">
          <div class="flex flex-col gap-4">
            dsd
          </div>
        </a-tab-pane>
      </a-tabs>

    </div>
  </div>
</template>

<style scoped>
.nc-card{
  border: solid 1px #e1e3e6;
}
</style>
