<script lang="ts" setup>
const { baseHomeSearchQuery } = storeToRefs(useBases())

const { commandPalette } = useCommandPalette()
</script>

<template>
  <div class="px-2 h-11 flex items-center">
    <div @click="commandPalette?.open()" class="w-full">
      <a-input
        v-model:value="baseHomeSearchQuery"
        type="text"
        class="nc-input-border-on-value nc-input-shadow !h-8 !px-2.5 !py-1 !rounded-lg"
        placeholder="Quick search..."
        allow-clear
        @keydown.stop
        readonly
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
        </template>
        <template #suffix>
          <div class="px-1 text-bodySmBold text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded">
            {{ renderCmdOrCtrlKey(true) }} K
          </div>
        </template>
      </a-input>
    </div>
  </div>
</template>
