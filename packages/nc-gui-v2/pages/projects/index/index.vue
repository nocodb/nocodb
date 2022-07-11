<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { navigateTo } from '#app'
import useColors from '~/composables/useColors'
import MdiStarOutline from '~icons/mdi/star-outline'
import MdiMenuDown from '~icons/mdi/menu-down'
import MdiDeleteOutline from '~icons/mdi/delete-outline'
import MdiPlus from '~icons/mdi/plus'
import MdiDatabaseOutline from '~icons/mdi/database-outline'

interface Props {
  projects: ProjectType[]
}

const { projects } = defineProps<Props>()

const { $e } = useNuxtApp()

const { getColorByIndex } = useColors()

const openProject = async (project: ProjectType) => {
  await navigateTo(`/nc/${project.id}`)
  $e('a:project:open', { count: projects.length })
}

const formatTitle = (title: string) =>
  title
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 3xl:grid-cols-6 gap-6 md:gap-12">
    <div class="group flex flex-col items-center gap-2">
      <v-menu>
        <template #activator="{ props }">
          <div
            class="thumbnail !bg-gradient-to-br from-primary to-gray-500 !opacity-25 hover:(!opacity-100 shadow-lg to-primary/50) bg-gray-400"
            @click="props.onClick"
          >
            <MdiPlus />
          </div>
          <div class="prose-lg font-semibold">
            {{ $t('title.newProj') }}
          </div>
        </template>
        <v-list class="!py-0 flex flex-col bg-white rounded-lg shadow-md border-1 border-gray-300 mt-2 ml-2">
          <div
            class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
            @click="navigateTo('/projects/create')"
          >
            <MdiPlus class="col-span-2 mr-1 mt-[1px] text-primary text-lg" />
            <div class="col-span-10 text-sm xl:text-md">{{ $t('activity.createProject') }}</div>
          </div>
          <div
            class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
            @click="navigateTo('/projects/create-external')"
          >
            <MdiDatabaseOutline class="col-span-2 mr-1 mt-[1px] text-green-500 text-lg" />
            <div class="col-span-10 text-sm xl:text-md" v-html="$t('activity.createProjectExtended.extDB')" />
          </div>
        </v-list>
      </v-menu>
    </div>

    <div v-for="(project, i) of projects" :key="project.id" class="group flex flex-col items-center gap-2">
      <div class="thumbnail" :style="{ backgroundColor: getColorByIndex(i) }" @click="openProject(project)">
        {{ formatTitle(project.title) }}

        <MdiStarOutline class="star-icon group-hover:opacity-100" @click.stop />

        <v-menu>
          <template #activator="{ props }">
            <MdiMenuDown class="menu-icon group-hover:opacity-100" @click.stop="props.onClick" />
          </template>

          <v-list class="!py-0 flex flex-col bg-white rounded-lg shadow-md border-1 border-gray-300">
            <div class="grid grid-cols-6 cursor-pointer hover:bg-gray-200 flex items-center p-2" @click.stop>
              <MdiDeleteOutline class="col-span-2 mr-1 mt-[1px] text-red text-lg" />
              <div class="col-span-4 text-sm xl:text-md">{{ $t('general.delete') }}</div>
            </div>
          </v-list>
        </v-menu>
      </div>

      <div class="prose-lg font-semibold">
        {{ project.title || 'Untitled' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.thumbnail {
  @apply relative rounded-md opacity-75 font-bold text-white text-[75px] h-[150px] w-full max-w-[150px] md:w-1/2 min-w-[150px] shadow-md cursor-pointer uppercase flex items-center justify-center transition-color ease-in duration-300 hover:(shadow-lg opacity-100);
  background-image: linear-gradient(#0002, #0002);
}

.menu-icon,
.star-icon {
  @apply w-auto opacity-0 absolute h-[1.75rem] transition-opacity duration-300;
}

.star-icon {
  @apply top-1 right-1 transform hover:(scale-120 text-yellow-300/75) transition-all duration-100 ease;
}

.menu-icon {
  @apply bottom-1 right-1 transform hover:(scale-150 text-gray-200) transition-all duration-100 ease;
}
</style>
