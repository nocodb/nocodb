<script lang="ts" setup>
import { NC_VIEW_PASSWORD_PROTECTED_SENTINEL } from 'nocodb-sdk'

const { appInfo } = useGlobal()

const { dashboardUrl } = useDashboard()

const documentsStore = useDocumentsStore()
const { activeDocument } = storeToRefs(documentsStore)

const { isPrivateBase } = storeToRefs(useBase())
const { activeProjectId } = storeToRefs(useBases())
const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { t } = useI18n()
const { $api, $e } = useNuxtApp()

const isUpdating = ref({
  public: false,
  password: false,
  subtree: false,
})

const passwordProtectedLocal = ref(false)
const newPasswordDraft = ref('')
const isChangePasswordModalOpen = ref(false)

const restrictedSharing = computed(() => isPrivateBase.value)

const isPublicShared = computed(() => {
  if (restrictedSharing.value) return false
  return !!activeDocument.value?.uuid
})

const includeSubtree = computed(() => {
  // Default true when share is enabled — backend seeds this on first share.
  const meta = activeDocument.value?.meta as any
  return meta?.share?.include_subtree ?? true
})

const url = computed(() => sharedDocUrl() ?? '')

const passwordProtected = computed(
  () => !!activeDocument.value?.password || passwordProtectedLocal.value,
)

const hasStoredPassword = computed(() => {
  const value = activeDocument.value?.password
  return typeof value === 'string' && value.length > 0
})

const isLegacyPlaintextPassword = computed(() => {
  const value = activeDocument.value?.password
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value !== NC_VIEW_PASSWORD_PROTECTED_SENTINEL
  )
})

function sharedDocUrl() {
  if (!activeDocument.value?.uuid) return null
  return `${dashboardUrl.value}/doc/${activeDocument.value.uuid}`
}

// Patch the local reactive doc so the UI updates immediately. The store's
// activeDocument is reactive — assigning to its fields propagates.
const patchDoc = (patch: Partial<NonNullable<typeof activeDocument.value>>) => {
  if (!activeDocument.value) return
  Object.assign(activeDocument.value, patch)
}

const toggleShare = async () => {
  if (!activeDocument.value?.id || !activeProjectId.value) return
  if (isUpdating.value.public) return

  isUpdating.value.public = true
  try {
    if (isPublicShared.value) {
      await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value,
        { operation: 'documentUnshare' },
        { docId: activeDocument.value.id },
      )
      $e('c:doc:share:disable')
      patchDoc({ uuid: null, password: null })
      message.success(t('msg.info.docShareDisabled'))
    } else {
      const res = (await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value,
        { operation: 'documentShare' },
        { docId: activeDocument.value.id },
      )) as { uuid: string; include_subtree: boolean; password: boolean }
      $e('c:doc:share:enable')
      const meta = { ...(activeDocument.value.meta ?? {}) } as any
      meta.share = { include_subtree: res.include_subtree }
      patchDoc({ uuid: res.uuid, meta })
      message.success(t('msg.info.docShareEnabled'))
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.public = false
  }
}

const toggleSubtree = async () => {
  if (!activeDocument.value?.id || !activeProjectId.value) return
  if (isUpdating.value.subtree) return

  const nextValue = !includeSubtree.value
  isUpdating.value.subtree = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value!,
      activeProjectId.value,
      { operation: 'documentShareUpdate' },
      { docId: activeDocument.value.id, include_subtree: nextValue },
    )
    $e('c:doc:share:subtree:toggle', { include_subtree: nextValue })
    const meta = { ...(activeDocument.value.meta ?? {}) } as any
    meta.share = { ...(meta.share ?? {}), include_subtree: nextValue }
    patchDoc({ meta })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.subtree = false
  }
}

const togglePasswordProtected = async () => {
  if (!activeDocument.value?.id || !activeProjectId.value) return
  if (isUpdating.value.password) return

  const wasProtected = passwordProtected.value
  isUpdating.value.password = true
  try {
    if (wasProtected) {
      await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value,
        { operation: 'documentShareUpdate' },
        { docId: activeDocument.value.id, password: null },
      )
      $e('c:doc:share:password:toggle', { enabled: false })
      passwordProtectedLocal.value = false
      newPasswordDraft.value = ''
      patchDoc({ password: null })
    } else {
      // Opening the toggle is a local-only action until the user enters a
      // password — keeps us from saving a blank/sentinel value.
      passwordProtectedLocal.value = true
      $e('c:doc:share:password:toggle', { enabled: true })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.password = false
  }
}

const saveNewPassword = async (newValue: string): Promise<boolean> => {
  if (!activeDocument.value?.id || !activeProjectId.value) return false
  const trimmed = (newValue ?? '').trim()
  if (!trimmed) return false
  if (isUpdating.value.password) return false

  isUpdating.value.password = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value!,
      activeProjectId.value,
      { operation: 'documentShareUpdate' },
      { docId: activeDocument.value.id, password: trimmed },
    )
    $e('c:doc:share:password:set')
    patchDoc({ password: NC_VIEW_PASSWORD_PROTECTED_SENTINEL })
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
  if (ok) isChangePasswordModalOpen.value = false
}
</script>

<template>
  <div class="flex flex-col py-2 px-3 mb-1">
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-nc-border-gray-medium border-1 rounded-md gap-y-2">
      <!-- Master share toggle -->
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="text-nc-content-gray-emphasis font-medium">
          {{ $t('activity.enabledPublicViewing') }}
        </div>
        <a-switch
          v-if="!restrictedSharing"
          v-e="['c:share:doc:enable:toggle']"
          :checked="isPublicShared"
          :loading="isUpdating.public"
          class="share-doc-toggle !mt-0.25"
          data-testid="share-doc-toggle"
          @click="toggleShare"
        />
        <div v-else class="text-nc-content-gray-muted">{{ $t('labels.sharingRestricted') }}</div>
      </div>

      <template v-if="isPublicShared">
        <div class="mt-0.5 border-t-1 border-nc-border-gray-light pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>

        <!-- Search engines are blocked from the public page in Phase 1 -->
        <div class="flex flex-row items-center gap-x-2 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md text-nc-content-gray-subtle">
          <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5" />
          <div class="flex-1 text-bodySm">{{ $t('msg.info.docShareNoindex') }}</div>
        </div>

        <!-- Include sub-pages -->
        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md">
          <div class="flex flex-row items-center justify-between">
            <div class="text-nc-content-gray-extreme">
              {{ $t('labels.includeSubPages') }}
            </div>
            <a-switch
              v-e="['c:share:doc:subtree:toggle']"
              :checked="includeSubtree"
              :loading="isUpdating.subtree"
              class="share-doc-subtree-toggle !mt-0.25"
              data-testid="share-doc-subtree-toggle"
              size="small"
              @click="toggleSubtree"
            />
          </div>
        </div>

        <!-- Password -->
        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md">
          <div class="flex flex-row items-center justify-between">
            <div class="flex text-nc-content-gray-extreme">
              {{ $t('activity.restrictAccessWithPassword') }}
            </div>
            <a-switch
              v-e="['c:share:doc:password:toggle']"
              :checked="passwordProtected"
              :loading="isUpdating.password"
              class="share-doc-password-toggle !mt-0.25"
              data-testid="share-doc-password-toggle"
              size="small"
              @click="togglePasswordProtected"
            />
          </div>
          <Transition mode="out-in" name="layout">
            <div v-if="passwordProtected" class="flex flex-col gap-2 mt-2">
              <div v-if="isLegacyPlaintextPassword" class="flex items-center gap-2">
                <a-input-password
                  :value="activeDocument?.password"
                  class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
                  data-testid="nc-share-doc-password-legacy"
                  size="small"
                  readonly
                  autocomplete="off"
                  name="nc-share-doc-password-legacy"
                />
                <NcButton
                  v-e="['c:share:doc:password:change-open']"
                  data-testid="nc-share-doc-password-change-btn"
                  size="small"
                  type="secondary"
                  @click="openChangePasswordModal"
                >
                  {{ $t('labels.changePassword') }}
                </NcButton>
              </div>
              <div v-else-if="hasStoredPassword" class="flex items-center gap-2">
                <div
                  class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium"
                  data-testid="nc-share-doc-password-locked"
                >
                  <GeneralIcon icon="ncLock" class="text-nc-content-gray-subtle !w-3.5 !h-3.5" />
                  <span class="text-nc-content-gray-subtle text-bodySm tracking-widest">••••••••</span>
                </div>
                <NcButton
                  v-e="['c:share:doc:password:change-open']"
                  data-testid="nc-share-doc-password-change-btn"
                  size="small"
                  type="secondary"
                  @click="openChangePasswordModal"
                >
                  {{ $t('labels.changePassword') }}
                </NcButton>
              </div>
              <div v-else class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <a-input-password
                    v-model:value="newPasswordDraft"
                    :placeholder="$t('placeholder.password.enter')"
                    class="!rounded-lg !py-1 !bg-nc-bg-default flex-1"
                    data-testid="nc-modal-share-doc__password"
                    size="small"
                    type="password"
                    autocomplete="new-password"
                    name="nc-share-doc-password-new"
                    @press-enter="saveNewPassword(newPasswordDraft)"
                  />
                  <NcButton
                    v-e="['c:share:doc:password:save-new']"
                    :disabled="!newPasswordDraft.trim()"
                    :loading="isUpdating.password"
                    data-testid="nc-share-doc-password-save-btn"
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
          v-if="isChangePasswordModalOpen && activeDocument"
          v-model:visible="isChangePasswordModalOpen"
          :title="t('labels.changeDocPassword')"
          :loading="isUpdating.password"
          telemetry-key="c:doc:share:password:change-save"
          @save="onPasswordChanged"
        />
      </template>
    </div>
  </div>
</template>
