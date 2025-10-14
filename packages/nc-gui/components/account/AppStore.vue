<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="appStore" class="flex-none text-[20px] h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.appStore') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div>
        <DashboardSettingsAppStore />
      </div>
    </div>
  </div>
</template>
