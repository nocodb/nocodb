<script setup lang="ts">
const { isUIAllowed } = useRoles()

const hasPermissionForSnapshots = computed(() => isUIAllowed('manageSnapshot'))

const activeMenu = ref(isEeUI && hasPermissionForSnapshots.value ? 'snapshots' : 'visibility')

const selectMenu = (option: string) => {
  if (!hasPermissionForSnapshots.value && option === 'snapshots') {
    return
  }

  activeMenu.value = option
}

const router = useRouter()

onMounted(() => {
  const query = router.currentRoute.value.query
  if (query && query.tab && ['snapshots', 'visibility'].includes(query.tab as string)) {
    selectMenu(query.tab as string)
  }
})
</script>

<template>
  <div class="flex p-4 justify-center overflow-auto gap-8">
    <!-- Left Pane -->
    <div class="flex flex-col">
      <div class="h-full w-60">
        <div
          v-if="isEeUI && hasPermissionForSnapshots"
          :class="{
            'active-menu': activeMenu === 'snapshots',
          }"
          class="gap-3 !hover:bg-gray-50 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
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
          class="gap-3 !hover:bg-gray-50 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
          @click="selectMenu('visibility')"
        >
          <GeneralIcon icon="ncEye" />
          <span>
            {{ $t('labels.visibilityAndDataHandling') }}
          </span>
        </div>
      </div>
    </div>
    <!-- Data Pane -->

    <div class="flex flex-col py-4 w-[800px]">
      <DashboardSettingsBaseSettingsSnapshots v-if="activeMenu === 'snapshots'" />
      <DashboardSettingsBaseSettingsVisibility v-if="activeMenu === 'visibility'" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.active-menu {
  @apply !bg-brand-50 font-semibold !text-brand-500;
}
</style>
