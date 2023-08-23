<script setup lang="ts">
// TODO:
</script>

<template>
  <a-layout>
    <LazyProfileOverviewHeatmap />
    <a-layout>
      <a-layout-content class="mt-5">
        <LazyProfileOverviewContributionActivity />
      </a-layout-content>
      <a-layout-sider :collapsed="false" width="250" collapsed-width="50" :trigger="null" theme="light">
        <LazyProfileOverviewYearList />
      </a-layout-sider>
    </a-layout>
  </a-layout>
</template>
