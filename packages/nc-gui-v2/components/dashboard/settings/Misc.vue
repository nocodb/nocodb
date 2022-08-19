<script setup lang="ts">
const { includeM2M } = useGlobal()
const { loadTables } = useProject()

watch(includeM2M, async () => await loadTables())
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full">
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <a-checkbox v-model:checked="includeM2M">Show M2M Tables</a-checkbox>
      </div>
    </div>
  </div>
</template>
