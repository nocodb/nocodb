<script setup lang="ts">
const { appInfo } = useGlobal()
const { ssoError } = useSsoError()
const { twoFactorRequired } = useTwoFactorSignin()

const route = useRoute()

definePageMeta({
  requiresAuth: false,
  title: 'title.headLogin',
})

// If the user is redirected to the login page from a page that requires authentication,
// save the page's URL in sessionStorage so that we can redirect the user back to that page
onMounted(() => {
  if (route.query.continueAfterSignIn) {
    localStorage.setItem('continueAfterSignIn', route.query.continueAfterSignIn)
  }
})
</script>

<template>
  <div v-if="ssoError">
    <AuthNoAccess :message="ssoError.message" />
  </div>
  <template v-else-if="appInfo.cognito">
    <!--
      Hide AuthCognito while a NocoDB-side 2FA challenge is pending.
      Cognito has already authenticated the user; the Amplify
      <Authenticator> renders nothing into its default slot when
      authenticated but its outer container is min-h-screen, which
      pushes <AuthSignin> (the TOTP form) below the fold and leaves
      /signin looking blank. Suppressing AuthCognito for the duration
      of the 2FA step keeps the TOTP UI visible.
    -->
    <AuthCognito v-if="appInfo.cognito.aws_user_pools_id && !twoFactorRequired" />
    <NuxtLayout>
      <AuthSignin />
    </NuxtLayout>
  </template>
  <NuxtLayout v-else>
    <AuthSignin />
  </NuxtLayout>
</template>
