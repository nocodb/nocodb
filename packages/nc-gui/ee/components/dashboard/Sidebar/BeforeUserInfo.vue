<script lang="ts" setup>
import { useGlobal } from '#imports'
const { appInfo } = useGlobal()
</script>

<template>
  <div class="p-2" v-if="appInfo.isTrial">
    <DashboardSidebarTrial />
  </div>
</template>
