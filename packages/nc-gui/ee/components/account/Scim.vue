<script setup lang="ts">
import { NC_DEFAULT_ORG_ID } from 'nocodb-sdk'

const { appInfo } = useGlobal()

const orgId = computed(() => (appInfo.value as any)?.defaultOrgId || NC_DEFAULT_ORG_ID)
</script>

<template>
  <AdminScim :org-id="orgId" />
</template>
