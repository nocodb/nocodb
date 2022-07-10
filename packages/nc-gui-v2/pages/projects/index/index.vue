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
  <div class="nc-project-item-container flex flex-wrap relative w-full">
    <div
      v-for="(project, i) of projects"
      :key="project.id"
      class="group nc-project-item elevation-0 flex items-center justify-center flex-column py-5"
    >
      <div
        class="nc-project-thumbnail cursor-pointer uppercase flex items-center justify-center transition-color ease duration-300"
        :style="{ backgroundColor: getColorByIndex(i) }"
        @click="openProject(project)"
      >
        {{ formatTitle(project.title) }}

        <MdiStarOutline class="nc-project-star-icon group-hover:opacity-100" @click.stop />

        <v-menu>
          <template #activator="{ props }">
            <MdiMenuDown class="nc-project-option-menu-icon group-hover:opacity-100" @click.stop="props.onClick" />
          </template>

          <v-list class="!py-0 flex flex-col bg-white rounded-lg shadow-md border-1 border-gray-300 mt-2">
            <div class="grid grid-cols-6 cursor-pointer hover:bg-gray-200 flex items-center p-2" @click.stop>
              <MdiDeleteOutline class="col-span-2 mr-1 mt-[1px] text-red text-lg" />
              <div class="col-span-4 text-sm xl:text-md">{{ $t('general.delete') }}</div>
            </div>
          </v-list>
        </v-menu>
      </div>

      <div class="text-center pa-2 nc-project-title body-2 font-weight-medium">
        {{ project.title }}
      </div>
    </div>

    <div class="w-[150px] flex items-center justify-center flex-column">
      <v-menu>
        <template #activator="{ props }">
          <div
            class="cursor-pointer nc-project-thumbnail opacity-50 hover:opacity-100 bg-gray-400 uppercase flex items-center justify-center transition-color ease duration-300"
            @click="props.onClick"
          >
            <MdiPlus />
          </div>
          <div class="text-center p-2">
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
.nc-project-item {
  @apply w-[150px] items-center;
}

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
  @apply top-1 right-1 transform hover:(scale-120 text-primary/75) transition-all duration-100 ease;
}

.nc-project-option-menu-icon {
  @apply bottom-1 right-1 transform hover:(scale-150 text-gray-500) transition-all duration-100 ease;
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
