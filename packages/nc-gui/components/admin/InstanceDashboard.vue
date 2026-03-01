<script lang="ts" setup>
const { stats, isLoading, fetchStats } = useInstanceAdmin()

const { appInfo } = useGlobal()

const instanceName = computed(() => {
  try {
    return appInfo.value.ncSiteUrl ? new URL(appInfo.value.ncSiteUrl).hostname : 'NocoDB'
  } catch {
    return 'NocoDB'
  }
})

onMounted(async () => {
  await fetchStats()
})
</script>

<template>
  <div class="flex flex-col" data-testid="nc-instance-admin-dashboard">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="home1" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.dashboard') }}
        </span>
      </template>
    </NcPageHeader>

    <div
      class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6"
    >
      <div class="flex flex-col gap-6 w-150">
        <span class="font-bold text-xl" data-rec="true">
          {{ $t('general.general') }}
        </span>
        <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-y-5">
          <div class="flex items-center gap-5">
            <img src="~/assets/img/brand/nocodb-logo.svg" alt="NocoDB" class="h-12 w-12 rounded-lg" />
            <span class="text-nc-content-gray-emphasis text-2xl font-semibold">
              {{ instanceName }}
            </span>
          </div>
          <div class="flex border-1 rounded-lg border-nc-border-gray-medium">
            <div v-if="isEeUI" class="w-1/4 px-4 border-r-1 py-3">
              <div class="text-[40px] font-semibold">{{ isLoading ? '-' : stats.totalWorkspaces }}</div>
              <div class="text-nc-content-gray-subtle2 mt-2">
                {{ $t('labels.workspaces') }}
              </div>
            </div>
            <div class="flex-1 px-4 border-r-1 py-3">
              <div class="text-[40px] font-semibold">{{ isLoading ? '-' : stats.totalUsers }}</div>
              <div class="text-nc-content-gray-subtle2 mt-2">
                {{ $t('objects.users') }}
              </div>
            </div>
            <div class="flex-1 px-4 border-r-1 py-3">
              <div class="text-[40px] font-semibold">{{ isLoading ? '-' : stats.totalBases }}</div>
              <div class="text-nc-content-gray-subtle2 mt-2">
                {{ $t('objects.projects') }}
              </div>
            </div>
            <div class="flex-1 px-4 py-3">
              <div class="text-[40px] font-semibold">{{ isLoading ? '-' : stats.editorCount }}</div>
              <div class="text-nc-content-gray-subtle2 mt-2">{{ $t('title.editors') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
