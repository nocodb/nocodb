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
  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 3xl:grid-cols-8">
    <div v-for="(project, i) of projects" :key="project.id" class="group flex flex-col items-center gap-2">
      <div
        class="nc-project-thumbnail shadow-md cursor-pointer uppercase flex items-center justify-center transition-color ease duration-300 hover:shadow-lg"
        :style="{ backgroundColor: getColorByIndex(i) }"
        @click="openProject(project)"
      >
        {{ formatTitle(project.title) }}

        <MdiStarOutline class="nc-project-star-icon group-hover:opacity-100" @click.stop />

        <v-menu>
          <template #activator="{ props }">
            <MdiMenuDown class="nc-project-option-menu-icon group-hover:opacity-100" @click.stop="props.onClick" />
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

    <div class="group flex flex-col items-center gap-2">
      <v-menu>
        <template #activator="{ props }">
          <div
            class="cursor-pointer shadow-md nc-project-thumbnail opacity-50 hover:(opacity-100 shadow-lg) bg-gray-400 uppercase flex items-center justify-center transition-color ease duration-300"
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
  </div>
</template>

<style scoped>
.nc-project-thumbnail {
  height: 100px;
  width: 100px;
  font-size: 50px;
  color: white;
  font-weight: bold;
  border-radius: 4px;
  margin-inside: auto;
  position: relative;
}

.nc-project-option-menu-icon,
.nc-project-star-icon {
  width: auto;
  height: 1.5rem;
  position: absolute;
  opacity: 0;
  transition: 0.3s opacity;
}

.nc-project-star-icon {
  @apply top-1 right-1 transform hover:(scale-120 text-yellow-300/75) transition-all duration-100 ease;
}

.nc-project-option-menu-icon {
  @apply bottom-1 right-1 transform hover:(scale-150 text-gray-200) transition-all duration-100 ease;
}

.nc-project-title {
  text-transform: capitalize;
  text-align: center;
}

.nc-project-thumbnail {
  background-image: linear-gradient(#0002, #0002);
  opacity: 0.5;
}

.nc-project-thumbnail:hover {
  opacity: 1;
}
</style>
