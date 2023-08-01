<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { iconMap, navigateTo } from '#imports'

interface Props {
  projects?: ProjectType[]
}

const { projects = [] } = defineProps<Props>()

const emit = defineEmits(['delete-project'])

const { $e } = useNuxtApp()

const openProject = async (project: ProjectType) => {
  if (project.type === 'documentation') {
    await navigateTo(`/nc/doc/p/${project.id}`)
  } else {
    await navigateTo(`/nc/${project.id}`)
  }
  $e('a:project:open', { count: projects.length })
}
</script>

<template>
  <div>
    <div class="grid grid-cols-3 gap-2 prose-md p-2 font-semibold">
      <div>{{ $t('general.title') }}</div>
      <div>Updated At</div>
      <div></div>
    </div>

    <div class="col-span-3 w-full h-[1px] bg-gray-500/50" />

    <template v-for="project of projects" :key="project.id">
      <div
        class="cursor-pointer grid grid-cols-3 gap-2 prose-md hover:(bg-gray-300/30) p-2 transition-color ease-in duration-100"
        @click="openProject(project)"
      >
        <div class="font-semibold capitalize">{{ project.title || 'Untitled' }}</div>
        <div>{{ project.updated_at }}</div>
        <div class="flex justify-center">
          <component
            :is="iconMap.delete"
            class="text-gray-500 hover:text-red-500 mr-2"
            @click.stop="emit('delete-project', project)"
          />
          <component
            :is="iconMap.edit"
            class="text-gray-500 hover:text-primary mr-2"
            @click.stop="navigateTo(`/project/${project.id}`)"
          />
        </div>
      </div>
      <div class="col-span-3 w-full h-[1px] bg-gray-500/30" />
    </template>
  </div>
</template>
