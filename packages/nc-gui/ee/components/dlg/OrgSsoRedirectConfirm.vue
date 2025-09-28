<script lang="ts" setup>
const orgStore = useOrg()

const { ssoLoginRequiredDlg } = storeToRefs(orgStore)

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
    // reload the page to avoid showing previous org API call failure errors
    location.reload()
  })
}

const onCancel = async () => {
  // navigate to non-sso org or create a default org
  // For now, we'll just close the dialog and let the user handle it
  orgStore.toggleSsoLoginRequiredDlg(false)
}
</script>

<template>
  <NcModalConfirm
    v-model:visible="ssoLoginRequiredDlg"
    title="SSO Login Required"
    content="You are trying to access an organization that requires SSO login. Please click the button below to continue to SSO login."
    ok-text="Continue to SSO Signin"
    @cancel="onCancel"
    @ok="onOk"
  >
  </NcModalConfirm>
</template>
