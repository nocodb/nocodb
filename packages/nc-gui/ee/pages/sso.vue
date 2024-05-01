<script setup lang="ts">
import { definePageMeta } from '#imports'

definePageMeta({
  requiresAuth: false,
  title: 'title.headLogin',
  public: true,
})
</script>

<template>
  <AuthOrgSso />
</template>

<style></style>
