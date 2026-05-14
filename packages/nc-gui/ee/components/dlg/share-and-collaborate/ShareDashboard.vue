<script lang="ts" setup>
import { NC_VIEW_PASSWORD_PROTECTED_SENTINEL } from 'nocodb-sdk'

const { appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const dashboardStore = useDashboardStore()

const { activeDashboard } = storeToRefs(dashboardStore)

const { dashboardShare } = dashboardStore

const { isPrivateBase } = storeToRefs(useBase())

const { activeProjectId } = storeToRefs(useBases())
const { copy } = useCopy()
const { t } = useI18n()

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

/**
 * `true` when the backend has confirmed a password is stored for this
 * dashboard. The actual hash never reaches the frontend — we receive the
 * sentinel `NC_VIEW_PASSWORD_PROTECTED_SENTINEL` and render a masked state.
 */
const hasStoredPassword = computed(() => {
  const value = activeDashboard.value?.password
  return typeof value === 'string' && value.length > 0
})

/**
 * `true` when the stored value is a legacy plaintext password (set before
 * the GHSA-mpp2 bcrypt migration and never re-saved). The backend passes
 * these through unmasked so the owner can still read the original value.
 */
const isLegacyPlaintextPassword = computed(() => {
  const value = activeDashboard.value?.password
  return typeof value === 'string' && value.length > 0 && value !== NC_VIEW_PASSWORD_PROTECTED_SENTINEL
})

// Local buffer for first-time password entry (after toggling the switch on).
// Once the password is saved, the field switches to a "locked" state and
// further edits go through the dedicated change-password modal.
const newPasswordDraft = ref('')

const isChangePasswordModalOpen = ref(false)

function sharedDashboardUrl() {
  if (!activeDashboard.value?.uuid) return null
  return `${dashboardUrl.value}/nc/dashboard/${activeDashboard.value.uuid}`
}

const togglePasswordProtected = async () => {
  if (!activeDashboard.value || !activeProjectId.value) return
  if (isUpdating.value.password) return

  const wasProtected = passwordProtected.value

  isUpdating.value.password = true
  try {
    if (wasProtected) {
      // Turning OFF — clear stored password.
      passwordProtectedLocal.value = false
      newPasswordDraft.value = ''
      await dashboardShare(activeProjectId.value, activeDashboard.value.id, {
        password: null,
      })
    } else {
      // Turning ON — open the toggle locally; backend stays unchanged until
      // the user actually enters a password.
      passwordProtectedLocal.value = true
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    // Revert local state on error
    passwordProtectedLocal.value = wasProtected
  } finally {
    isUpdating.value.password = false
  }
}

const saveNewPassword = async (newValue: string): Promise<boolean> => {
  if (!activeDashboard.value || !activeProjectId.value) return false
  const trimmed = (newValue ?? '').trim()
  if (!trimmed) return false
  if (isUpdating.value.password) return false

  isUpdating.value.password = true
  try {
    await dashboardShare(activeProjectId.value, activeDashboard.value.id, {
      password: trimmed,
    })
    // Backend echoes the sentinel back on the next read; reflect that locally
    // so the UI immediately switches to the masked/locked state.
    if (activeDashboard.value) {
      activeDashboard.value.password = NC_VIEW_PASSWORD_PROTECTED_SENTINEL
    }
    newPasswordDraft.value = ''
    passwordProtectedLocal.value = false
    return true
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    return false
  } finally {
    isUpdating.value.password = false
  }
}

const openChangePasswordModal = () => {
  isChangePasswordModalOpen.value = true
}

const onPasswordChanged = async (newValue: string) => {
  const ok = await saveNewPassword(newValue)
  // Keep the modal open on failure so the user can retry without losing input.
  if (ok) isChangePasswordModalOpen.value = false
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
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-nc-border-gray-medium border-1 rounded-md gap-y-2">
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="text-nc-content-gray-emphasis font-medium">
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
        <div class="mt-0.5 border-t-1 border-nc-border-gray-light pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>

        <DlgShareAndCollaborateCustomUrl
          v-if="activeDashboard"
          :id="activeDashboard.fk_custom_url_id"
          :backend-url="appInfo.ncSiteUrl"
          :copy-custom-url="copyCustomUrl"
          @update-custom-url="updateCustomUrl"
        />

        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md">
          <div class="flex flex-row items-center justify-between">
            <div class="flex text-nc-content-gray-extreme">
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
            <div v-if="passwordProtected" class="flex flex-col gap-2 mt-2">
              <!-- Legacy plaintext password (pre-bcrypt migration) — show as-is so the owner can still read it -->
              <div v-if="isLegacyPlaintextPassword" class="flex items-center gap-2">
                <a-input-password
                  :value="activeDashboard?.password"
                  class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
                  data-testid="nc-share-dashboard-password-legacy"
                  size="small"
                  readonly
                  autocomplete="off"
                  name="nc-share-dashboard-password-legacy"
                />
                <NcButton
                  v-e="['c:share:dashboard:password:change-open']"
                  data-testid="nc-share-dashboard-password-change-btn"
                  size="small"
                  type="secondary"
                  @click="openChangePasswordModal"
                >
                  {{ $t('labels.changePassword') }}
                </NcButton>
              </div>
              <!-- Stored password (bcrypt-hashed): show masked locked state + dedicated change action -->
              <div v-else-if="hasStoredPassword" class="flex items-center gap-2">
                <div
                  class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium"
                  data-testid="nc-share-dashboard-password-locked"
                >
                  <GeneralIcon icon="ncLock" class="text-nc-content-gray-subtle !w-3.5 !h-3.5" />
                  <span class="text-nc-content-gray-subtle text-bodySm tracking-widest">••••••••</span>
                </div>
                <NcButton
                  v-e="['c:share:dashboard:password:change-open']"
                  data-testid="nc-share-dashboard-password-change-btn"
                  size="small"
                  type="secondary"
                  @click="openChangePasswordModal"
                >
                  {{ $t('labels.changePassword') }}
                </NcButton>
              </div>
              <!-- First-time entry: inline input + explicit Save button -->
              <div v-else class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <a-input-password
                    v-model:value="newPasswordDraft"
                    :placeholder="$t('placeholder.password.enter')"
                    class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
                    data-testid="nc-modal-share-dashboard__password"
                    size="small"
                    type="password"
                    autocomplete="new-password"
                    name="nc-share-dashboard-password-new"
                    @press-enter="saveNewPassword(newPasswordDraft)"
                  />
                  <NcButton
                    v-e="['c:share:dashboard:password:save-new']"
                    :disabled="!newPasswordDraft.trim()"
                    :loading="isUpdating.password"
                    data-testid="nc-share-dashboard-password-save-btn"
                    size="small"
                    type="primary"
                    @click="saveNewPassword(newPasswordDraft)"
                  >
                    {{ $t('general.save') }}
                  </NcButton>
                </div>
                <span class="text-bodySm text-nc-content-gray-subtle leading-snug">
                  {{ $t('msg.info.viewPasswordNotVisibleAfterSave') }}
                </span>
              </div>
            </div>
          </Transition>
        </div>

        <DlgShareAndCollaborateChangeViewPassword
          v-if="isChangePasswordModalOpen && activeDashboard"
          v-model:visible="isChangePasswordModalOpen"
          :title="t('labels.changeDashboardPassword')"
          :loading="isUpdating.password"
          telemetry-key="c:share:dashboard:password:change-save"
          @save="onPasswordChanged"
        />
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
    @apply !m-0 !flex !items-center w-full px-2 py-1 rounded-lg hover:bg-nc-bg-gray-light;
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
