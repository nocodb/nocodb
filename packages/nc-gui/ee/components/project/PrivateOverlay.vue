<template>
  <div class="nc-smartsheet-access-restrict-overlay">
    <div class="flex flex-col gap-2 flex-col items-center">
      <GeneralIcon icon="ncLock" class="mb-4 w-5 h-5 text-gray-700" />
      <h3 class="my-0 text-heading3">{{ $t('title.accessRestricted') }}</h3>
      <span class="text-gray-800 font-weight-regular">{{ $t('msg.privateBaseAccessRestricted') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-smartsheet-access-restrict-overlay {
  @apply !pointer-events-auto absolute inset-0 bg-white z-500 grid place-items-center px-4;
}
</style>
