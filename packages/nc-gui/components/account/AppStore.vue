<template>
  <div class="h-full overflow-y-scroll scrollbar-thin-dull pt-2">
    <div class="text-xl mt-4">{{ $t('title.appStore') }}</div>
    <a-divider class="!my-3" />
    <div>
      <LazyDashboardSettingsAppStore />
    </div>
  </div>
</template>
