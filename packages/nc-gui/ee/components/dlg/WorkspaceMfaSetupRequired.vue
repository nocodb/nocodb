<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { mfaSetupRequiredDlg } = storeToRefs(workspaceStore)

// Reload after navigating to flush in-flight workspace API calls — without it
// they surface as toasts after the dialog closes (same as WorkspaceSsoRedirectConfirm).
const onOk = async () => {
  workspaceStore.toggleMfaSetupRequiredDlg(false)
  await navigateTo('/account/security', { replace: true })
  location.reload()
}

const onCancel = () => {
  workspaceStore.toggleMfaSetupRequiredDlg(false)
}
</script>

<template>
  <NcModalConfirm
    v-model:visible="mfaSetupRequiredDlg"
    :title="$t('labels.mfaSetupRequired')"
    :content="$t('labels.mfaSetupRequiredContent')"
    :ok-text="$t('labels.setupTwoFactorAuth')"
    @cancel="onCancel"
    @ok="onOk"
  >
  </NcModalConfirm>
</template>
