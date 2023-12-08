<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { iconMap, navigateTo, useColors, useNuxtApp } from '#imports'

interface Props {
  bases?: BaseType[]
}

const { bases = [] } = defineProps<Props>()

const emit = defineEmits(['delete-base'])

const { $e } = useNuxtApp()

const { getColorByIndex } = useColors(true)

const openProject = async (base: BaseType) => {
  await navigateTo(`/nc/${base.id}`)
  $e('a:base:open', { count: bases.length })
}

const formatTitle = (title?: string) =>
  title
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 3xl:grid-cols-8 gap-6 md:(gap-y-16)">
    <div class="group flex flex-col items-center gap-2">
      <v-menu>
        <template #activator="{ props }">
          <div
            class="thumbnail hover:(after:!opacity-100 shadow-lg to-primary/50)"
            :style="{ '--thumbnail-color': '#1348ba' }"
            @click="props.onClick"
          >
            a
            <component :is="iconMap.plus" />
          </div>
          <div class="prose-lg font-semibold">
            {{ $t('title.newProj') }}
          </div>
        </template>
        <v-list class="!py-0 flex flex-col bg-white rounded-lg shadow-md border-1 border-gray-300 mt-2 ml-2">
          <div
            class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
            @click="navigateTo('/base/create')"
          >
            <component :is="iconMap.plus" class="col-span-2 mr-1 mt-[1px] text-primary text-lg" />
            <div class="col-span-10 text-sm xl:text-md">{{ $t('activity.createProject') }}</div>
          </div>
          <div
            class="grid grid-cols-12 cursor-pointer hover:bg-gray-200 flex items-center p-2"
            @click="navigateTo('/base/create-external')"
          >
            <component :is="iconMap.dtabase" class="col-span-2 mr-1 mt-[1px] text-green-500 text-lg" />
            <div class="col-span-10 text-sm xl:text-md" v-html="$t('activity.createProjectExtended.extDB')" />
          </div>
        </v-list>
      </v-menu>
    </div>

    <div v-for="(base, i) of bases" :key="base.id" class="group flex flex-col items-center gap-2">
      <div class="thumbnail" :style="{ '--thumbnail-color': getColorByIndex(i) }" @click="openProject(base)">
        {{ formatTitle(base.title) }}
        <a-dropdown overlay-class-name="nc-dropdown-base-operations" @click.stop>
          <component :is="iconMap.arrowDown" class="menu-icon" />
          <template #overlay>
            <a-menu>
              <a-menu-item @click.stop="emit('delete-base', base)">
                <div class="grid grid-cols-6 cursor-pointer flex items-center p-2">
                  <component :is="iconMap.delete" class="col-span-2 mr-1 mt-[1px] text-red text-lg" />
                  <div class="col-span-4 text-sm xl:text-md">{{ $t('general.delete') }}</div>
                </div>
              </a-menu-item>
              <a-menu-item @click.stop="navigateTo(`/base/${base.id}`)">
                <div class="grid grid-cols-6 cursor-pointer flex items-center p-2">
                  <component :is="iconMap.edit" class="col-span-2 mr-1 mt-[1px] text-primary text-lg" />
                  <div class="col-span-4 text-sm xl:text-md">{{ $t('general.edit') }}</div>
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div class="prose-lg font-semibold overflow-ellipsis w-full overflow-hidden text-center capitalize">
        {{ base.title || 'Untitled' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.thumbnail {
  @apply relative rounded-md opacity-75 font-bold text-white text-[75px] h-[100px] w-full w-[100px] shadow-md cursor-pointer uppercase flex items-center justify-center color-transition hover:(after:opacity-100 shadow-none);
}

.thumbnail::after {
  @apply rounded-md absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out opacity-75;
  background-color: var(--thumbnail-color);
  content: '';
  z-index: -1;
}

.thumbnail:hover::after {
  @apply shadow-2xl transform scale-110;
}

.menu-icon,
.star-icon {
  @apply w-auto opacity-0 absolute h-[1.75rem] transition-opacity !duration-200 group-hover:opacity-100;
}

.star-icon {
  @apply top-1 right-1 transform hover:(scale-120 text-yellow-300/75) transition-all duration-100 ease;
}

.menu-icon {
  @apply bottom-1 right-1 transform hover:(scale-150 text-gray-200) transition-all duration-100 ease;
}
</style>
