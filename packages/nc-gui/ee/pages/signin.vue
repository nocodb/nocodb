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

onMounted(() => {
  if (route.query.continueAfterSignIn) {
    sessionStorage.setItem('continueAfterSignIn', route.query.continueAfterSignIn)
  }
})
</script>

<template>
  <AuthCognito v-if="appInfo.cognito.aws_user_pools_id" />
  <NuxtLayout>
    <AuthSignin />
  </NuxtLayout>
</template>

<style></style>
