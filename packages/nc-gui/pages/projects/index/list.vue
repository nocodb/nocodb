<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { iconMap, navigateTo } from '#imports'

interface Props {
  bases?: BaseType[]
}

const { bases = [] } = defineProps<Props>()

const emit = defineEmits(['delete-base'])

const { $e } = useNuxtApp()

const openProject = async (base: BaseType) => {
  await navigateTo(`/nc/${base.id}`)
  $e('a:base:open', { count: bases.length })
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

    <template v-for="base of bases" :key="base.id">
      <div
        class="cursor-pointer grid grid-cols-3 gap-2 prose-md hover:(bg-gray-300/30) p-2 transition-color ease-in duration-100"
        @click="openProject(base)"
      >
        <div class="font-semibold capitalize">{{ base.title || 'Untitled' }}</div>
        <div>{{ base.updated_at }}</div>
        <div class="flex justify-center">
          <component :is="iconMap.delete" class="text-gray-500 hover:text-red-500 mr-2" @click.stop="emit('delete-base', base)" />
          <component
            :is="iconMap.edit"
            class="text-gray-500 hover:text-primary mr-2"
            @click.stop="navigateTo(`/base/${base.id}`)"
          />
        </div>
      </div>
      <div class="col-span-3 w-full h-[1px] bg-gray-500/30" />
    </template>
  </div>
</template>
