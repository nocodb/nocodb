<script setup lang="ts">
import { definePageMeta, navigateTo, onMounted, ref, useGlobal, useMetas, useNuxtApp, useProject, useRoute } from '#imports'
import {storeToRefs} from "pinia";

definePageMeta({
  public: true,
  requiresAuth: false,
})

const route = useRoute()

const { appInfo } = useGlobal()

const projectStore = useProject()
const { loadProject,  } =projectStore
const {  project } = storeToRefs(projectStore)

useMetas()

const baseData = ref({} as any)

const { $api } = useNuxtApp()

onMounted(async () => {
  try {
    baseData.value = await $api.public.sharedErdMetaGet(route.params.erdUuid as string)
  } catch (e: any) {
    console.error(e)
    navigateTo('/')
    return
  }

  await loadProject(false, baseData.value.project_id)
})
</script>

<template>
  <div
    class="absolute z-60 transition-all duration-200 m-6 cursor-pointer transform hover:scale-105 flex text-xl items-center"
    @click="navigateTo('/')"
  >
    <a-tooltip placement="bottom">
      <template #title>
        {{ appInfo.version }}
      </template>
      <img width="50" alt="NocoDB" src="~/assets/img/icons/512x512.png" />
    </a-tooltip>
    <div class="ml-2 font-bold text-gray-500 uppercase">{{ project.title }}</div>
  </div>
  <div class="w-full h-full !p-0">
    <ErdView :base-id="baseData.id" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-erd-histogram.top) {
  display: none;
}
</style>
