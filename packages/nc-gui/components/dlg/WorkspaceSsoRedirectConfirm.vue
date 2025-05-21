<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { ssoLoginRequiredDlg, workspaces } = storeToRefs(workspaceStore)

const { user } = useGlobal()

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
    // reload the page to avoid showing previous workspace API call failure errors
    location.reload()
    location.reload()
  })
}

const onCancel = async () => {
  // navigate to non-sso workspace
  // find first non-sso workspace and navigate to it
  let nonSsoWorkspace = [...(workspaces.value?.values() || [])].find((workspace) => {
    return !workspace.sso_only_access && workspace.id !== workspaceStore.activeWorkspaceId
  })

  if (!nonSsoWorkspace) {
    // create a default workspace with user name and navigate
    const defaultWorkspace = {
      title: user.value?.display_name || user.value?.email?.split('@')[0] || 'Default Workspace',
    }

    nonSsoWorkspace = await workspaceStore.createWorkspace(defaultWorkspace)
    await workspaceStore.loadWorkspaces()
  }

  if (nonSsoWorkspace) {
    await navigateTo(
      {
        path: `/${nonSsoWorkspace.id}`,
      },
      {
        replace: true,
      },
    )

    // reload the page to avoid showing previous workspace API call failure errors
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
