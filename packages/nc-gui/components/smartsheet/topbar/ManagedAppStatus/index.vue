<script setup lang="ts">
const { t } = useI18n()

const baseStore = useBase()

const { loadManagedApp, loadCurrentVersion } = baseStore

const { base, isManagedAppMaster, isManagedAppInstaller, managedApp, currentVersion, liveVersion, managedAppVersionsInfo } =
  storeToRefs(baseStore)

const isModalVisible = ref(false)

const modalVariant = ref<'draftOrPublish' | 'versionHistory' | undefined>(undefined)

const isOpenDropdown = ref<boolean>(false)

const isDraft = computed(() => managedAppVersionsInfo.value.current?.status === 'draft')

const openModal = (variant?: 'draftOrPublish' | 'versionHistory') => {
  isOpenDropdown.value = false

  modalVariant.value = variant

  nextTick(() => {
    isModalVisible.value = true
  })
}

const loadManagedAppAndCurrentVersion = async () => {
  await loadManagedApp()
  await loadCurrentVersion()
}

watch(
  () => (base.value as any)?.managed_app_id,
  async (managedAppId) => {
    if (!managedAppId) return

    await loadManagedAppAndCurrentVersion()
  },
  { immediate: true },
)

const colors = {
  green: {
    bg: 'bg-nc-green-50 dark:bg-nc-green-20',
    border: 'border-green-200 dark:border-nc-green-100',
    text: 'text-green-600 dark:text-nc-green-300',
  },
  orange: {
    bg: 'bg-nc-orange-20 dark:bg-nc-orange-20',
    border: 'border-nc-orange-200 dark:border-orange-600/40',
    text: 'text-orange-600 text-orange-600',
  },
  brand: {
    bg: 'bg-nc-brand-50 dark:bg-nc-brand-20/40',
    border: 'border-nc-brand-200 dark:border-nc-content-brand/50',
    text: 'text-nc-content-brand',
  },
}

const badgeConfig = computed(() => {
  const result = {
    colors: colors.green,
    icon: 'circleCheck3',
    subText: '',
  }

  if (isManagedAppInstaller.value) {
    if (managedAppVersionsInfo.value.updateAvailable) {
      result.colors = colors.brand
      result.icon = 'ncDownload'
      result.subText = t('labels.updateAvailable')
    } else {
      result.colors = colors.green
      result.icon = 'circleCheck3'
      result.subText = t('labels.upToDate')
    }
  } else if (isDraft.value) {
    result.colors = colors.orange
    result.icon = 'pencil'
    result.subText = t('labels.draft')
  } else {
    result.colors = colors.green
    result.icon = 'circleCheck3'
    result.subText = t('labels.published')
  }

  return result
})
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
        class="flex items-center gap-2 px-2.5 py-1 h-8 rounded-lg border-1 cursor-pointer transition-colors select-none"
        :class="[badgeConfig.colors.bg, badgeConfig.colors.border, badgeConfig.colors.text]"
      >
        <GeneralIcon :icon="badgeConfig.icon as IconMapKey" class="w-3.5 h-3.5 text-current nc-managed-app-status-info-icon" />
        <span class="text-xs font-mono font-medium"> v{{ managedAppVersionsInfo.current?.version || '1.0.0' }}</span>
        <span class="py-0.5 text-xs font-medium whitespace-nowrap">
          {{ badgeConfig.subText }}
        </span>
        <GeneralIcon
          icon="chevronDown"
          class="w-3.5 h-3.5 text-nc-content-gray-muted opacity-80 transform transition-all duration-200"
          :class="{
            'rotate-180': isOpenDropdown,
          }"
        />
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
              @click="openModal('draftOrPublish')"
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
              @click="openModal('draftOrPublish')"
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
            @click="openModal('versionHistory')"
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
                Published {{ parseStringDateTime(managedAppVersionsInfo.current?.published_at, 'MMM DD, YYYY, hh:mm A') }}
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

  <DlgManagedApp v-model:visible="isModalVisible" modal-size="sm" :variant="modalVariant"> </DlgManagedApp>
</template>

<style lang="scss" scoped>
.nc-managed-app-status-menu {
  @apply w-[318px] pb-2;
}

.nc-managed-app-status-menu-header {
  @apply flex items-center justify-between gap-2 pt-3 px-5 mb-1 text-nc-content-gray-muted text-captionSm;
}
</style>
