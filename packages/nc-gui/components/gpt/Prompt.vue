<script setup lang="ts">
// TODO:
const data = ref('')
</script>

<template>
  <div class="h-min-[calc(100%_-_160px] w-full overflow-y-auto scrollbar-thin-dull">
    <a-textarea v-model:value="data" :auto-size="{ minRows: 20 }" />
  </div>
</template>
