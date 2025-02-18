<script setup lang="ts">
const { isUIAllowed } = useRoles()

const hasPermissionForSnapshots = computed(() => isUIAllowed('manageSnapshot'))

const hasPermissionForMigrate = computed(() => isUIAllowed('migrateBase'))

const router = useRouter()

const activeMenu = ref(isEeUI && hasPermissionForSnapshots.value ? 'snapshots' : 'visibility')

const selectMenu = (option: string) => {
  if (!hasPermissionForSnapshots.value && option === 'snapshots') {
    return
  }
  router.push({
    query: {
      ...router.currentRoute.value.query,
      tab: option,
    },
  })
  activeMenu.value = option
}

onMounted(() => {
  const query = router.currentRoute.value.query
  if (query && query.tab && ['snapshots', 'visibility'].includes(query.tab as string)) {
    selectMenu(query.tab as string)
  }
})
</script>

<template>
  <div class="w-full flex p-6 nc-base-settings overflow-auto gap-8">
    <!-- Left Pane -->
    <div class="flex flex-col">
      <div class="h-full flex flex-col gap-1 w-60">
        <div
          v-if="isEeUI && hasPermissionForSnapshots"
          data-testid="snapshots-tab"
          :class="{
            'active-menu': activeMenu === 'snapshots',
          }"
          class="gap-3 hover:bg-gray-100 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
          @click="selectMenu('snapshots')"
        >
          <GeneralIcon icon="camera" />

          <span>
            {{ $t('general.snapshots') }}
          </span>
        </div>

        <div
          :class="{
            'active-menu': activeMenu === 'visibility',
          }"
          class="gap-3 hover:bg-gray-100 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
          data-testid="visibility-tab"
          @click="selectMenu('visibility')"
        >
          <GeneralIcon icon="ncEye" />
          <span>
            {{ $t('labels.visibilityAndDataHandling') }}
          </span>
        </div>

        <div
          v-if="!isEeUI && hasPermissionForMigrate"
          :class="{
            'active-menu': activeMenu === 'migrate',
          }"
          class="gap-3 hover:bg-gray-100 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
          data-testid="migrate-tab"
          @click="selectMenu('migrate')"
        >
          <GeneralIcon icon="move" />
          <span> Migrate </span>
        </div>
      </div>
    </div>
    <!-- Data Pane -->

    <div class="flex flex-col flex-1 max-w-[760px]">
      <DashboardSettingsBaseSnapshots v-if="activeMenu === 'snapshots'" />
      <DashboardSettingsBaseVisibility v-if="activeMenu === 'visibility'" />
      <DashboardSettingsBaseMigrate v-if="activeMenu === 'migrate'" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.active-menu {
  @apply !bg-brand-50 font-semibold !text-nc-content-brand-disabled;
}
</style>
