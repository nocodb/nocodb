<script setup lang="ts">
const { appInfo } = useGlobal()
const { ssoError } = useSsoError()

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
    <AuthCognito v-if="appInfo.cognito.aws_user_pools_id" />
    <NuxtLayout>
      <AuthSignin />
    </NuxtLayout>
  </template>
  <span v-else />
</template>

<style></style>
