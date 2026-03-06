<script setup lang="ts">
const { isUpdateAvailable } = useUpdateChecker()

const reload = () => {
  ;(location.reload as (forceReload?: boolean) => void)(true)
}
</script>

<template>
  <div v-if="isUpdateAvailable" class="nc-update-sidebar-banner-wrapper -mx-1 pt-1.5 px-1 pointer-events-none">
    <div
      v-e="['c:sidebar:update-banner:reload']"
      data-testid="nc-update-sidebar-banner"
      class="nc-update-sidebar-banner pointer-events-auto"
      @click="reload"
    >
      <GeneralIcon icon="reload" class="h-4 w-4 flex-none text-nc-content-brand" />
      <div class="flex-1 text-bodyDefaultSmBold font-semibold text-nc-content-gray">
        {{ $t('general.newUpdateAvailable') }}
      </div>
      <span class="nc-update-reload text-bodyDefaultSmBold font-semibold text-nc-content-brand/80 flex-none cursor-pointer">
        {{ $t('general.reload') }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-update-sidebar-banner-wrapper {
  &:last-child {
    @apply pb-0.5;
  }

  .nc-update-sidebar-banner {
    @apply flex items-center gap-1.5 pl-1.5 pr-2.5 py-2 rounded-lg cursor-pointer border-l-3 border-nc-border-brand bg-nc-bg-gray-medium dark:bg-nc-bg-gray-light hover:bg-nc-bg-gray-dark dark:hover:bg-nc-bg-gray-medium h-10 transition-all duration-300 hover:shadow-default;

    .nc-update-reload {
      @apply transition-all;
    }

    &:hover .nc-update-reload {
      @apply text-nc-content-brand;
    }
  }
}
</style>
