<script setup lang="ts">
import { useProject } from '#imports'
const { project, loadProject } = useProject()

onMounted(loadProject)
</script>

<template>
  <div class="flex w-full h-full items-center py-4">
    <!-- TODO: update -->
    <img src="https://dummyimage.com/48x48/000/fff" class="h-20 w-20 p-2" />
    <div class="flex min-w-0 w-200 text-base">
      <div class="nc-gpt-project mx-2 text-sm py-4">
        <div class="font-bold">{{ project.title }}</div>
        <div class="text-gray">
          <!-- TODO: handle super long description -->
          {{ project.description }}
        </div>
      </div>
    </div>

    <div class="flex-1 min-w-0 flex justify-end gap-2">
      <div class="flex items-center">
        <a-button class="!rounded-md">
          {{ $t('general.save') }}
        </a-button>
      </div>
      <div class="flex items-center gap-1">
        <a-button class="!rounded-md" type="primary">
          {{ $t('general.generate') }}
        </a-button>
      </div>
    </div>
  </div>
</template>
