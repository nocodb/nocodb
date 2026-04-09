<script setup lang="ts">
interface Props {
  connectionCount?: number
  integrationCount?: number
  showDivider?: boolean
}

withDefaults(defineProps<Props>(), {
  connectionCount: 4,
  integrationCount: 4,
  showDivider: true,
})
</script>

<template>
  <div class="flex flex-col space-y-6 w-full">
    <!-- Connections skeleton -->
    <div class="nc-connections-skeleton" style="container-type: inline-size">
      <div class="flex items-center gap-2 mb-4">
        <a-skeleton-input active class="!h-4 !w-36 !min-w-0 !children:rounded-md" />
      </div>
      <div class="nc-connection-skeleton-grid grid grid-cols-1 gap-3">
        <div
          v-for="i in connectionCount"
          :key="`conn-skeleton-${i}`"
          class="flex items-center gap-3 border-1 border-nc-border-gray-medium rounded-xl p-3"
        >
          <a-skeleton-avatar active shape="square" class="!h-[44px] !w-[44px] !children:(rounded-lg w-[44px] h-[44px])" />
          <div class="flex-1 flex flex-col gap-2">
            <a-skeleton-input active size="small" class="!h-4 !w-40 !min-w-0 !children:rounded-md" />
            <a-skeleton-input active size="small" class="!h-3 !w-32 !min-w-0 !children:rounded-md" />
          </div>
        </div>
      </div>
      <NcDivider v-if="showDivider" class="!mt-6 !mb-0" />
    </div>

    <!-- Integration categories skeleton -->
    <div class="nc-integrations-skeleton" style="container-type: inline-size">
      <div class="flex items-center gap-2 mb-3">
        <a-skeleton-input active class="!h-4 !w-36 !min-w-0 !children:rounded-md" />
      </div>
      <div class="nc-integration-skeleton-grid grid grid-cols-1 gap-3">
        <div
          v-for="i in integrationCount"
          :key="`int-skeleton-${i}`"
          class="flex items-center gap-4 border-1 border-nc-border-gray-medium rounded-xl p-3"
        >
          <a-skeleton-avatar active shape="square" class="!h-[44px] !w-[44px] !children:(rounded-lg w-[44px] h-[44px])" />
          <div class="flex-1 flex flex-col gap-2">
            <a-skeleton-input active size="small" class="!h-4 !w-40 !min-w-0 !children:rounded-md" />
            <a-skeleton-input active size="small" class="!h-3 !w-32 !min-w-0 !children:rounded-md" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-connections-skeleton {
  .nc-connection-skeleton-grid {
    @supports not (container-type: inline-size) {
      @media (min-width: 540px) {
        @apply grid-cols-2;
      }

      @media (min-width: 1024px) {
        @apply grid-cols-3;
      }

      @media (min-width: 1440px) {
        @apply grid-cols-4;
      }
    }

    @container (min-width: 540px) {
      @apply grid-cols-2;
    }

    @container (min-width: 820px) {
      @apply grid-cols-3;
    }

    @container (min-width: 1140px) {
      @apply grid-cols-4;
    }
  }
}

.nc-integrations-skeleton {
  .nc-integration-skeleton-grid {
    @supports not (container-type: inline-size) {
      @media (min-width: 540px) {
        @apply grid-cols-2;
      }

      @media (min-width: 1024px) {
        @apply grid-cols-3;
      }

      @media (min-width: 1440px) {
        @apply grid-cols-4;
      }
    }

    @container (min-width: 540px) {
      @apply grid-cols-2;
    }

    @container (min-width: 820px) {
      @apply grid-cols-3;
    }

    @container (min-width: 1140px) {
      @apply grid-cols-4;
    }
  }
}
</style>
