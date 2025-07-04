<script setup lang="ts">
const { isUIAllowed } = useRoles()

const hasPermissionForBaseAccess = computed(() => isEeUI && isUIAllowed('baseMiscSettings'))

const hasPermissionForSnapshots = computed(() => isEeUI && isUIAllowed('baseMiscSettings') && isUIAllowed('manageSnapshot'))

const hasPermissionForMigrate = computed(() => !isEeUI && isUIAllowed('baseMiscSettings') && isUIAllowed('migrateBase'))

const router = useRouter()

const allTabs = ['baseType', 'snapshots', 'visibility', 'mcp', 'migrate']

const activeMenu = ref(
  hasPermissionForBaseAccess.value ? 'baseType' : hasPermissionForSnapshots.value ? 'snapshots' : 'visibility',
)

const { isFeatureEnabled } = useBetaFeatureToggle()

const isMCPEnabled = computed(() => isUIAllowed('baseMiscSettings') && isFeatureEnabled(FEATURE_FLAG.MODEL_CONTEXT_PROTOCOL))

const selectMenu = (option: string, updateQuery = true) => {
  if (!hasPermissionForSnapshots.value && option === 'snapshots') {
    return
  }

  if (!hasPermissionForBaseAccess.value && option === 'baseType') {
    return
  }

  if (!hasPermissionForMigrate.value && option === 'migrate') {
    return
  }

  if (updateQuery) {
    router.push({
      query: {
        ...router.currentRoute.value.query,
        tab: option,
      },
    })
  }
  activeMenu.value = option
}

onMounted(() => {
  const query = router.currentRoute.value.query

  if (query && query.tab && allTabs.includes(query.tab as string)) {
    selectMenu(query.tab as string)
  }
})

watch(
  () => router.currentRoute.value.query.tab,
  (tab) => {
    if (tab && allTabs.includes(tab as string) && tab !== activeMenu.value) {
      selectMenu(tab as string, false)
    }
  },
)
</script>

<template>
  <div class="w-full flex p-6 nc-base-settings overflow-auto gap-8">
    <!-- Left Pane -->
    <div class="flex flex-col">
      <div class="h-full flex flex-col gap-1 w-60">
        <div
          v-if="hasPermissionForBaseAccess"
          data-testid="base-access-tab"
          :class="{
            'active-menu': activeMenu === 'baseType',
          }"
          class="gap-3 hover:bg-gray-100 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
          @click="selectMenu('baseType')"
        >
          <GeneralIcon icon="ncUsers" />

          <span>
            {{ $t('general.baseType') }}
          </span>
        </div>
        <div
          v-if="hasPermissionForSnapshots"
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
          v-if="isUIAllowed('baseMiscSettings')"
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
          v-if="isMCPEnabled"
          :class="{
            'active-menu': activeMenu === 'mcp',
          }"
          class="gap-3 hover:bg-gray-100 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
          data-testid="mcp-tab"
          @click="selectMenu('mcp')"
        >
          <GeneralIcon icon="mcp" />
          <span>
            {{ $t('labels.modelContextProtocol') }}
          </span>
        </div>

        <div
          v-if="hasPermissionForMigrate"
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
      <DashboardSettingsBaseAccess v-if="activeMenu === 'baseType'" />
      <DashboardSettingsBaseSnapshots v-if="activeMenu === 'snapshots'" />
      <DashboardSettingsBaseVisibility v-if="activeMenu === 'visibility'" />
      <DashboardSettingsBaseMigrate v-if="activeMenu === 'migrate'" />
      <DashboardSettingsBaseMCP v-if="activeMenu === 'mcp'" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.active-menu {
  @apply !bg-brand-50 font-semibold !text-nc-content-brand-disabled;
}
</style>
