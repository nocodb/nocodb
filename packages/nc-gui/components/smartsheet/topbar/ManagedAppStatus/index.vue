<script setup lang="ts">
const baseStore = useBase()

const { loadManagedApp, loadCurrentVersion } = baseStore

const { base, isManagedAppMaster, isManagedAppInstaller, managedApp, currentVersion, liveVersion, managedAppVersionsInfo } =
  storeToRefs(baseStore)

const isModalVisible = ref(false)
const initialTab = ref<'publish' | 'fork' | 'deployments' | undefined>(undefined)

const isOpenDropdown = ref<boolean>(false)

const isDraft = computed(() => managedAppVersionsInfo.value.current?.status === 'draft')

const openModal = (tab?: 'publish' | 'fork' | 'deployments') => {
  isOpenDropdown.value = false

  initialTab.value = tab
  isModalVisible.value = true
}

const loadManagedAppAndCurrentVersion = async () => {
  await loadManagedApp()
  await loadCurrentVersion()
}

const handlePublished = async () => {
  await loadManagedAppAndCurrentVersion()
}

const handleForked = async () => {
  await loadManagedAppAndCurrentVersion()
}

watch(
  () => (base.value as any)?.managed_app_id,
  async (managedAppId) => {
    if (!managedAppId) return

    await loadManagedAppAndCurrentVersion()
  },
  { immediate: true },
)
</script>

<template>
  <NcDropdown
    v-if="isManagedAppMaster || isManagedAppInstaller"
    v-model:visible="isOpenDropdown"
    placement="bottomRight"
    overlay-class-name="!rounded-xl"
  >
    <div class="flex items-center gap-2">
      <!-- Version Badge (clickable to open modal) -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 bg-nc-bg-gray-light rounded-md border-1 border-nc-border-gray-medium cursor-pointer hover:(bg-nc-bg-gray-medium border-nc-border-gray-dark) transition-colors"
      >
        <GeneralIcon icon="ncInfoSolid" class="w-3.5 h-3.5 text-nc-content-gray nc-managed-app-status-info-icon" />
        <span class="text-xs font-mono font-semibold text-nc-content-gray-emphasis"
          >v{{ managedAppVersionsInfo.current?.version || '1.0.0' }}</span
        >
        <div
          v-if="managedAppVersionsInfo.current?.status === 'draft'"
          class="ml-1 px-1.5 py-0.5 text-xs rounded bg-nc-bg-orange-light text-nc-content-orange-dark font-medium"
        >
          {{ $t('labels.draft') }}
        </div>
        <div
          v-else-if="managedAppVersionsInfo.current?.status === 'published'"
          class="ml-1 px-1.5 py-0.5 text-xs rounded bg-nc-bg-green-dark text-nc-content-green-dark font-medium"
        >
          {{ $t('labels.published') }}
        </div>
      </div>
    </div>
    <template #overlay>
      <div class="nc-managed-app-status-menu flex flex-col">
        <div class="nc-managed-app-status-menu-header">
          <span class="uppercase">{{ isManagedAppInstaller ? 'Installed Version' : 'Current State' }}</span>
          <span v-if="managedAppVersionsInfo.current?.status === 'draft' && managedAppVersionsInfo.published"
            >Live: v{{ managedAppVersionsInfo.published.version }}
          </span>
        </div>

        <!-- Publisher application  -->
        <template v-if="isManagedAppMaster">
          <!-- Live state  -->
          <template v-if="managedAppVersionsInfo.published && !isDraft">
            <SmartsheetTopbarManagedAppStatusMenuItem
              :label="`v${managedAppVersionsInfo.published.version || '1.0.0'}`"
              icon-wrapper-class="bg-green-50 dark:bg-nc-green-20"
            >
              <template #icon>
                <GeneralIcon icon="circleCheck3" class="text-green-600" />
              </template>
              <template #subtext>
                <span class="text-green-600"> Live & Serving Users </span>
              </template>
            </SmartsheetTopbarManagedAppStatusMenuItem>

            <NcDivider />
            <SmartsheetTopbarManagedAppStatusMenuItem
              clickable
              label="Fork to Draft"
              :subtext="`Create v${suggestManagedAppNextVersion(
                managedAppVersionsInfo.published.version || '1.0.0',
              )} to make changes`"
              icon-wrapper-class="bg-nc-bg-gray-light dakr:bg-nc-bg-gray-light/75"
              @click="openModal('fork')"
            >
              <template #icon>
                <GeneralIcon icon="ncCopy" class="text-nc-content-gray-muted" />
              </template>
            </SmartsheetTopbarManagedAppStatusMenuItem>
          </template>

          <!-- Draft state  -->
          <template v-if="isDraft">
            <SmartsheetTopbarManagedAppStatusMenuItem
              :label="`v${managedAppVersionsInfo.current.version || '1.0.0'}`"
              icon-wrapper-class="bg-orange-50 dark:bg-nc-orange-20"
            >
              <template #icon>
                <GeneralIcon icon="edit" class="text-orange-600" />
              </template>
              <template #subtext>
                <span class="text-orange-600"> Editing Draft </span>
              </template>
            </SmartsheetTopbarManagedAppStatusMenuItem>
            <NcDivider />

            <SmartsheetTopbarManagedAppStatusMenuItem
              clickable
              icon-wrapper-class="bg-green-50 dark:bg-nc-green-20"
              @click="openModal('publish')"
            >
              <template #icon>
                <GeneralIcon icon="ncArrowUp" class="text-green-600" />
              </template>
              <template #label>
                <span class="text-green-600"> Publish v{{ managedAppVersionsInfo.current.version || '1.0.0' }} </span>
              </template>
              <template #subtext>
                {{
                  managedAppVersionsInfo.published
                    ? `Replace v${managedAppVersionsInfo.published.version || '1.0.0'} and go live`
                    : `Go live`
                }}
              </template>
            </SmartsheetTopbarManagedAppStatusMenuItem>
          </template>

          <!-- Initial draft state  -->
          <SmartsheetTopbarManagedAppStatusMenuItem
            v-if="managedAppVersionsInfo.published && isDraft"
            clickable
            label="Discard Draft"
            :subtext="`Return to v${managedAppVersionsInfo.published.version || '1.0.0'}`"
            icon-wrapper-class="bg-nc-bg-gray-light"
          >
            <template #icon>
              <GeneralIcon icon="delete" class="text-nc-content-gray-muted" />
            </template>
          </SmartsheetTopbarManagedAppStatusMenuItem>
          <NcDivider />

          <!-- Version history  -->
          <div
            class="flex items-center gap-2 px-5 py-2 text-captionSm text-nc-content-gray-muted cursor-pointer select-none"
            @click="openModal('deployments')"
          >
            <GeneralIcon icon="ncClock" />
            View version history
          </div>
        </template>

        <!-- Installer application  -->
        <template v-if="isManagedAppInstaller">
          <SmartsheetTopbarManagedAppStatusMenuItem
            :label="`v${managedAppVersionsInfo.current?.version || '1.0.0'}`"
            icon-wrapper-class="bg-green-50 dark:bg-nc-green-20"
          >
            <template #icon>
              <GeneralIcon icon="circleCheck3" class="text-green-600" />
            </template>

            <template v-if="managedAppVersionsInfo.current?.published_at" #subtext>
              <span class="text-green-600">
                Published {{ parseStringDateTime(managedAppVersionsInfo.current?.published_at, 'MMM DD, YYYY, HH:mm A') }}
              </span>
            </template>
          </SmartsheetTopbarManagedAppStatusMenuItem>

          <div
            v-if="!base.auto_update && managedAppVersionsInfo.updateAvailable"
            class="bg-nc-brand-20 dark:bg-nc-brand-20/40 -mb-1.5"
          >
            <SmartsheetTopbarManagedAppStatusMenuItem
              :label="`v${managedAppVersionsInfo.published?.version || '1.0.0'}`"
              icon-wrapper-class="bg-brand-50 dark:bg-nc-brand-50"
            >
              <template #icon>
                <GeneralIcon icon="ncDownload" class="text-brand-600" />
              </template>

              <template #subtext>
                <span class="text-brand-600"> New version available </span>
              </template>
              <template #extraRight>
                <NcButton size="small"> Update </NcButton>
              </template>
            </SmartsheetTopbarManagedAppStatusMenuItem>
          </div>

          <NcDivider />
          <SmartsheetTopbarManagedAppStatusMenuItem
            clickable
            label="View Changelog"
            subtext="See what's new in each version"
            icon-wrapper-class="bg-nc-bg-gray-light"
          >
            <template #icon>
              <GeneralIcon icon="file" class="text-nc-content-gray-muted" />
            </template>
          </SmartsheetTopbarManagedAppStatusMenuItem>
        </template>
      </div>
    </template>
  </NcDropdown>

  <!-- Managed App Modal -->
  <SmartsheetTopbarManagedAppModal
    v-model:visible="isModalVisible"
    :managed-app="managedApp"
    :current-version="managedAppVersionsInfo.current"
    :initial-tab="initialTab"
    @published="handlePublished"
    @forked="handleForked"
  />
</template>

<style lang="scss" scoped>
:deep(.nc-managed-app-status-info-icon path.nc-icon-inner) {
  stroke: var(--nc-bg-gray-light) !important;
}

.nc-managed-app-status-menu {
  @apply w-[318px] pb-2;
}

.nc-managed-app-status-menu-header {
  @apply flex items-center justify-between gap-2 pt-3 px-5 mb-1 text-nc-content-gray-muted text-captionSm;
}
</style>
