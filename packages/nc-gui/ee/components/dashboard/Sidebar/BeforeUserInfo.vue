<script lang="ts" setup>
import { useGlobal } from '#imports'
const { appInfo } = useGlobal()
</script>

<template>
  <div v-if="appInfo.isTrial" class="p-2">
    <DashboardSidebarTrial />
  </div>
</template>
