<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import { definePageMeta, useGlobal } from '#imports'
import { useRoute } from '#app'

const { appInfo } = useGlobal()

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
  <div>
    <template v-if="appInfo.cognito">
      <AuthCognito v-if="appInfo.cognito.aws_user_pools_id" />
      <NuxtLayout>
        <AuthSignin />
      </NuxtLayout>
    </template>
    <span v-else />
  </div>
</template>

<style></style>
