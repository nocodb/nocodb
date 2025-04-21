<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { ssoLoginRequiredDlg, workspaces } = storeToRefs(workspaceStore)

const { closeDialog, redirectToSSO } = workspaceStore

const { getBaseUrl, user } = useGlobal()

const onOk = () => {
  const email = user.value?.email
  navigateTo(
    {
      path: '/sso',
      query: {
        email,
      },
    },
    {
      replace: true,
    },
  ).then(() => {
    location.reload()
  })
}

const onCancel = () => {
  // navigate to non-sso workspace
  // find first non-sso workspace and navigate to it
  const nonSsoWorkspace = [...(workspaces.value?.values() || [])].find((workspace) => {
    return !workspace.sso_only_access && workspace.id !== workspaceStore.activeWorkspaceId
  })

  if (nonSsoWorkspace) {
    navigateTo(
      {
        path: `/${nonSsoWorkspace.id}`,
      },
      {
        replace: true,
      },
    )
    location.reload()
  } else {
    workspaceStore.toggleSsoLoginRequiredDlg(false)
  }
}
</script>

<template>
  <NcModalConfirm
    v-model:visible="ssoLoginRequiredDlg"
    title="SSO Login Required"
    content="You are trying to access a workspace that requires SSO login. Please click the button below to continue to SSO login."
    ok-text="Continue to SSO Signin"
    @cancel="onCancel"
    @ok="onOk"
  >
  </NcModalConfirm>
</template>
