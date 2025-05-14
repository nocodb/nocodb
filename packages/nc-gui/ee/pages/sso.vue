<script setup lang="ts">
definePageMeta({
  requiresAuth: false,
  title: 'title.headLogin',
  public: true,
})

const { ssoError } = useSsoError()
</script>

<template>
  <div v-if="ssoError">
    <AuthNoAccess :message="ssoError.message" />
  </div>
  <div v-else>
    <AuthOrgSso />
  </div>
</template>

<style></style>
