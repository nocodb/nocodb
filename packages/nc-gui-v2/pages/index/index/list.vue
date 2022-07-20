<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { navigateTo } from '#app'

import MdiDeleteOutline from '~icons/mdi/delete-outline'
import MdiEditOutline from '~icons/mdi/edit-outline'

interface Props {
  projects: ProjectType[]
}

const { projects } = defineProps<Props>()

const emit = defineEmits(['delete-project'])

const { $e } = useNuxtApp()

const openProject = async (project: ProjectType) => {
  await navigateTo(`/nc/${project.id}`)
  $e('a:project:open', { count: projects.length })
}
</script>

<template>
  <div class="grid grid-cols-4 gap-2 prose-md p-2 font-semibold">
    <div>{{ $t('general.title') }}</div>
    <div>Updated At</div>
    <div></div>
  </div>

  <v-divider class="col-span-3" />

  <template v-for="project of projects" :key="project.id">
    <div
      class="cursor-pointer grid grid-cols-4 gap-2 prose-md hover:(bg-gray-100 shadow-sm dark:text-black) p-2 transition-color ease-in duration-100"
      @click="openProject(project)"
    >
      <div class="font-semibold">{{ project.title || 'Untitled' }}</div>
      <div>{{ project.updated_at }}</div>
      <div>
        <MdiDeleteOutline class="text-gray-500 hover:text-red-500 mr-2" @click.stop @click="emit('delete-project', project)" />
        <MdiEditOutline class="text-gray-500 hover:text-primary mr-2" @click.stop />
      </div>
    </div>
    <v-divider class="col-span-3" />
  </template>
</template>
