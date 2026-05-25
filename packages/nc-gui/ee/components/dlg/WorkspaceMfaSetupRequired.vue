<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { mfaSetupRequiredDlg } = storeToRefs(workspaceStore)

const onOk = () => {
  workspaceStore.toggleMfaSetupRequiredDlg(false)
  // Pass `openEnrollment=true` so Security.vue can auto-open the
  // setup modal on mount — saves the user an extra click after
  // they've already opted in via this dialog.
  navigateTo({ path: '/account/security', query: { openEnrollment: 'true' } }, { replace: true })
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
    :wrapper-props="{ 'data-testid': 'nc-2fa-setup-required-dlg' }"
    @cancel="onCancel"
    @ok="onOk"
  >
  </NcModalConfirm>
</template>
