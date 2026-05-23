<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { mfaSetupRequiredDlg } = storeToRefs(workspaceStore)

const onOk = () => {
  workspaceStore.toggleMfaSetupRequiredDlg(false)
  navigateTo('/account/security', { replace: true })
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
