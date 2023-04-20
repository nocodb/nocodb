<script lang="ts" setup>
</script>

<template>
  <a-dropdown :trigger="['click']">
    <GeneralIcon icon="notification" />
    <GeneralIcon icon="menuDown" />

    <template #overlay>
      <NotificationCard />
    </template>
  </a-dropdown>
</template>

<style scoped></style>
