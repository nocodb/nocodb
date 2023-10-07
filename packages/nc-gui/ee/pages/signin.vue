<script setup lang="ts">
import { definePageMeta, useGlobal } from '#imports'

const { appInfo } = useGlobal()

definePageMeta({
  requiresAuth: false,
  title: 'title.headLogin',
})
</script>

<template>
  <AuthCognito v-if="appInfo.cognito.aws_user_pools_id" />
  <NuxtLayout>
    <AuthSignin />
  </NuxtLayout>
</template>

<style></style>
