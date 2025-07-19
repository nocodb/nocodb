<script lang="ts" setup>
const { appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const dashboardStore = useDashboardStore()

const { activeDashboard } = storeToRefs(dashboardStore)

const { dashboardShare } = dashboardStore

const { isPrivateBase } = storeToRefs(useBase())

const { activeProjectId } = storeToRefs(useBases())
const { copy } = useCopy()

const isUpdating = ref({
  public: false,
  password: false,
})

const passwordProtectedLocal = ref(false)

const restrictedSharing = computed(() => {
  return isPrivateBase.value
})

const isPublicShared = computed(() => {
  // If base is private, then we have to restrict sharing
  if (restrictedSharing.value) return false
  return !!activeDashboard.value?.uuid
})

const url = computed(() => {
  return sharedDashboardUrl() ?? ''
})

const passwordProtected = computed(() => {
  return !!activeDashboard.value?.password || passwordProtectedLocal.value
})

const password = ref(activeDashboard.value?.password || '')

const passwordDebounced = refDebounced(password, 500)

watch(passwordDebounced, async (newPassword) => {
  if (!activeDashboard.value || !activeProjectId.value) return
  if (!passwordProtected.value) return
  if (newPassword === activeDashboard.value?.password) return
  if (isUpdating.value.password) return

  isUpdating.value.password = true
  try {
    await dashboardShare(activeProjectId.value, activeDashboard.value.id, {
      password: newPassword || null,
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.password = false
  }
})

function sharedDashboardUrl() {
  if (!activeDashboard.value?.uuid) return null
  return `${dashboardUrl.value}#/nc/dashboard/${activeDashboard.value.uuid}`
}

const togglePasswordProtected = async () => {
  if (!activeDashboard.value || !activeProjectId.value) return
  if (isUpdating.value.password) return

  isUpdating.value.password = true
  try {
    const newPassword = passwordProtected.value ? null : ''
    passwordProtectedLocal.value = !passwordProtected.value

    await dashboardShare(activeProjectId.value, activeDashboard.value.id, {
      password: newPassword,
    })

    password.value = newPassword || ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    // Revert local state on error
    passwordProtectedLocal.value = !passwordProtectedLocal.value
  } finally {
    isUpdating.value.password = false
  }
}

const toggleShare = async () => {
  if (!activeDashboard.value || !activeProjectId.value) return
  if (isUpdating.value.public) return

  isUpdating.value.public = true
  try {
    if (isPublicShared.value) {
      // Disable sharing
      await dashboardShare(activeProjectId.value, activeDashboard.value.id, {
        uuid: null,
      })
      message.success('Dashboard sharing disabled')
    } else {
      // Enable sharing
      await dashboardShare(activeProjectId.value, activeDashboard.value.id, {})
      message.success('Dashboard sharing enabled')
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.public = false
  }
}

const updateCustomUrl = async (customUrl: string | null) => {
  if (!activeDashboard.value || !activeProjectId.value) return

  try {
    await dashboardShare(activeProjectId.value, activeDashboard.value.id, {
      custom_url_path: customUrl,
    })
    message.success(customUrl ? 'Custom URL updated' : 'Custom URL removed')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const copyCustomUrl = async (custUrl = '') => {
  return await copy(`${appInfo.value.ncSiteUrl}/p/${encodeURIComponent(custUrl)}`)
}
</script>

<template>
  <div class="flex flex-col py-2 px-3 mb-1">
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-gray-200 border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="text-gray-900 font-medium">
          {{ $t('activity.enabledPublicViewing') }}
        </div>
        <a-switch
          v-if="!restrictedSharing"
          v-e="['c:share:dashboard:enable:toggle']"
          :checked="isPublicShared"
          :loading="isUpdating.public"
          class="share-view-toggle !mt-0.25"
          data-testid="share-dashboard-toggle"
          @click="toggleShare"
        />
        <div v-else class="text-nc-content-gray-muted">{{ $t('labels.sharingRestricted') }}</div>
      </div>
      <template v-if="isPublicShared">
        <div class="mt-0.5 border-t-1 border-gray-100 pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>

        <DlgShareAndCollaborateCustomUrl
          v-if="activeDashboard"
          :id="activeDashboard.fk_custom_url_id"
          :backend-url="appInfo.ncSiteUrl"
          :copy-custom-url="copyCustomUrl"
          @update-custom-url="updateCustomUrl"
        />

        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-gray-50 rounded-md">
          <div class="flex flex-row items-center justify-between">
            <div class="flex text-black">
              {{ $t('activity.restrictAccessWithPassword') }}
            </div>
            <a-switch
              v-e="['c:share:dashboard:password:toggle']"
              :checked="passwordProtected"
              :loading="isUpdating.password"
              class="share-password-toggle !mt-0.25"
              data-testid="share-dashboard-password-toggle"
              size="small"
              @click="togglePasswordProtected"
            />
          </div>
          <Transition mode="out-in" name="layout">
            <div v-if="passwordProtected" class="flex gap-2 mt-2 w-2/3">
              <a-input-password
                v-model:value="password"
                :placeholder="$t('placeholder.password.enter')"
                class="!rounded-lg !py-1 !bg-white"
                data-testid="nc-modal-share-dashboard__password"
                size="small"
                type="password"
              />
            </div>
          </Transition>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
.docs-share-public-toggle {
  height: 1.25rem !important;
  min-width: 2.4rem !important;
  width: 2.4rem !important;
  line-height: 1rem;

  .ant-switch-handle {
    height: 1rem !important;
    min-width: 1rem !important;
    line-height: 0.8rem !important;
  }
  .ant-switch-inner {
    height: 1rem !important;
    min-width: 1rem !important;
    line-height: 1rem !important;
  }
}

.nc-modal-share-view-preFillMode {
  @apply flex flex-col;

  .ant-radio-wrapper {
    @apply !m-0 !flex !items-center w-full px-2 py-1 rounded-lg hover:bg-gray-100;
    .ant-radio {
      @apply !top-0;
    }
    .ant-radio + span {
      @apply !flex !pl-4;
    }
  }
}

.nc-modal-share-view-language-select.ant-select {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}
</style>
