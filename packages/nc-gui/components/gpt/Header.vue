<script setup lang="ts">
import { useGPTStoreOrThrow } from '#imports'
const { gptProject } = useGPTStoreOrThrow()
</script>

<template>
  <div v-if="gptProject" class="flex w-full h-full items-center py-4">
    <!-- TODO: update -->
    <img src="https://dummyimage.com/48x48/000/fff" class="h-20 w-20 p-2" />
    <div class="flex min-w-0 w-200 text-base">
      <div class="nc-gpt-project mx-2 text-sm py-4">
        <div class="font-bold">{{ gptProject.title }}</div>
        <div class="text-gray">
          <!-- TODO: handle super long description -->
          {{ gptProject.description }}
        </div>
      </div>
    </div>
  </div>
</template>
