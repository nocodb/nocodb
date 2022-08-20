<script lang="ts" setup>
const showDrawer = ref(false)
</script>

<template>
  <div>
    <div size="middle" type="primary" class="rounded" @click="showDrawer = true">
      <div class="flex items-center space-x-1">
        <MdiCommentTextOutline class="mr-1 nc-share-base" />
        <!-- todo: i18n -->
        <div>APIs & Support</div>
      </div>
    </div>

    <a-drawer
      v-model:visible="showDrawer"
      class="h-full relative"
      style="color: red"
      placement="right"
      size="small"
      :closable="false"
      :body-style="{ padding: '12px 24px 24px 24px', background: '#fafafa' }"
    >
      <div class="flex flex-col w-full h-full p-4">
        <!-- todo: i18n -->
        <a-typography-title :level="4" class="!mb-6 !text-gray-500">Help center</a-typography-title>

        <GeneralSocialCard show-swagger-link class="!w-full nc-social-card" />
        <div class="flex-1 my-2"></div>
        <GeneralSponsors class="!w-full" />
      </div>
    </a-drawer>
  </div>
</template>

<style scoped lang="scss">
/* Social card style */
.nc-social-card {
  @apply !shadow-none !border-0 bg-transparent;

  :deep(.ant-spin-container) {
    @apply !gap-3;

    .ant-list-item {
      @apply mb-2 border-1 bg-white;
      &:last-child {
        @apply border-1;
      }
    }
  }
}
</style>
