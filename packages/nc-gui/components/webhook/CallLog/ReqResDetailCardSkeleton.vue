<script lang="ts" setup>
interface Props {
  title: string
}
defineProps<Props>()
</script>

<template>
  <div class="detail-card">
    <div class="detail-title">{{ title }}</div>

    <div class="content">
      <div class="detail-headers">
        <span class="text-gray-500 font-weight-bold text-small1">Header</span>
        <div class="log-details">
          <a-skeleton
            v-for="idx in 2"
            :key="idx"
            active
            :paragraph="{
              rows: 1,
              width: '90%',
            }"
            :title="false"
          />
        </div>
      </div>
      <div class="detail-payload -mt-1">
        <div class="text-sm text-gray-500 font-weight-bold pb-2 flex justify-between items-center">
          <span class="text-xs leading-[18px]">Payload</span>
          <GeneralCopyButton content="" size="xs" class="!px-1" disabled />
        </div>

        <div class="log-details">
          <a-skeleton
            v-for="idx in 5"
            :key="idx"
            active
            :paragraph="{
              rows: 1,
              width: '90%',
            }"
            :title="false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.detail-card {
  @apply flex-1 flex flex-col border-1 border-gray-200 rounded-lg bg-gray-50 h-full;

  & > .detail-title {
    @apply border-b border-nc-border-gray-medium px-3 py-2;
  }

  .content {
    @apply flex-1 overflow-auto nc-scrollbar-thin flex flex-col;

    & > div:not(:last-child) {
      @apply border-b border-gray-200;
    }

    & > div {
      @apply px-3 py-2;
    }

    .log-details {
      @apply flex flex-col gap-1 mt-2;
      .log-detail-item {
        @apply flex flex-row w-full;
        .label {
          @apply min-w-40 font-weight-600 text-gray-700 text-small1 lowercase;
        }

        .value {
          @apply min-w-0 text-nc-content-gray-subtle2 font-500 text-small1;
        }
      }
    }

    .detail-params,
    .detail-headers,
    .detail-payload {
      @apply min-w-80;
    }
    .detail-payload {
      @apply flex-grow;
    }
  }
}
</style>
