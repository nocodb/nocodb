<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { navigateTo } from '#app'

interface Props {
  projects: ProjectType[]
}

const { projects } = defineProps<Props>()

const { $e } = useNuxtApp()

const openProject = async (project: ProjectType) => {
  await navigateTo(`/nc/${project.id}`)
  $e('a:project:open', { count: projects.length })
}
</script>

<template>
  <div>
    <div class="grid grid-cols-3 gap-2 prose-md p-2 font-semibold">
      <div>{{ $t('general.title') }}</div>
      <div>Status</div>
      <div>Updated At</div>
    </div>

    <v-divider class="col-span-3" />

    <template v-for="project of projects" :key="project.id">
      <div
        class="cursor-pointer grid grid-cols-3 gap-2 prose-md hover:(bg-gray-100 shadow-sm) p-2 transition-color ease-in duration-100"
        @click="openProject(project)"
      >
        <div class="font-semibold">{{ project.title || 'Untitled' }}</div>
        <div>{{ project.status }}</div>
        <div>{{ project.updated_at }}</div>
      </div>
      <v-divider class="col-span-3" />
    </template>
  </div>
</template>
