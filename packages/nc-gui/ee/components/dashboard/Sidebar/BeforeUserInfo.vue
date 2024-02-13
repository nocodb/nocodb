<script lang="ts" setup>
import { useGlobal } from '#imports'

const { appInfo } = useGlobal()
</script>

<template>
  <div v-if="appInfo.isTrial" class="p-2" :class="{ expired: appInfo.isTrialExpired }">
    <DashboardSidebarTrial class="nc-trial-card" />
  </div>
</template>

<style scoped lang="scss">
.expired {
  background-color: #00000020;
  color: white;
  z-index: 999999;
  position: fixed;

  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  .nc-trial-card {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
}
</style>
