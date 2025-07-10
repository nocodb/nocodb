<script setup lang="ts"></script>

<template>
  <div class="flex flex-col h-full">
    <SmartsheetTopbar />
    <div style="height: calc(100dvh - var(--topbar-height))">
      <LazySmartsheetDashboard />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
