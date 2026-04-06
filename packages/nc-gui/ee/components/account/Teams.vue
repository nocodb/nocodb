<script setup lang="ts">
import { NC_DEFAULT_ORG_ID } from 'nocodb-sdk'

const { appInfo } = useGlobal()

// On-prem uses the default org ID from appInfo (or fallback to SDK constant)
const orgId = computed(() => (appInfo.value as any)?.defaultOrgId || NC_DEFAULT_ORG_ID)

// Provide orgId via route-like interface so AdminTeams can read it
provide('orgId', orgId)
</script>

<template>
  <AdminTeams :org-id="orgId" />
</template>
