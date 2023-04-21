<script lang="ts" setup></script>

<template>
  <div class="min-w-[640px] min-h-[640px] !rounded-2xl bg-white rounded-xl nc-card" @click.stop>
    <div class="p-6 pb-3.5">
      <div class="flex items-center">
        <span class="text-xl font-medium">
          <!-- todo: i18n -->
          Notification
        </span>
        <span class="flex-grow"></span>
        <GeneralIcon class="cursor-pointer" icon="settings" />
      </div>
    </div>
    <a-tabs>
      <a-tab-pane key="1" tab="Unread">
        <div class="px-6 overflow-y-auto max-h-[max(60vh,500px)]" @click.stop>
        <template v-for="i in 7 " :key="i">
          <NotificationItem class="py-6"  />
          <a-divider class="!my-0"/>
        </template>
        </div>
      </a-tab-pane>
      <a-tab-pane key="2" tab="Read">
        <div class="p-6">dsd</div>
      </a-tab-pane>

      <template #rightExtra>
        <div class="mr-6 text-primary cursor-pointer" @click.stop >Mark all as read</div>
      </template>
    </a-tabs>
  </div>
</template>

<style scoped>
.nc-card {
  border: solid 1px #e1e3e6;
}

:deep(.ant-tabs-nav-wrap) {
  @apply px-6;
}

:deep(.ant-tabs-nav){
  @apply !mb-0
}
</style>
