<script setup lang="ts">
const { includeM2M } = useGlobal()
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-column w-full">
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <a-checkbox v-model:checked="includeM2M">Show M2M Tables</a-checkbox>
      </div>
    </div>
  </div>
</template>
