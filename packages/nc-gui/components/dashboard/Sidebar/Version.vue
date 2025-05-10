<script lang="ts" setup>
const { appInfo } = useGlobal()
</script>

<template>
  <div>
    <div class="flex items-center text-xs text-gray-400 px-3 py-1">
      <span>Version {{ appInfo.version }}</span>
    </div>
  </div>
</template>
