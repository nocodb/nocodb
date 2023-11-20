<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { definePageMeta, navigateTo, onMounted, ref, useBase, useGlobal, useMetas, useNuxtApp, useRoute } from '#imports'

definePageMeta({
  public: true,
  requiresAuth: false,
})

const route = useRoute()

const { appInfo } = useGlobal()

const baseStore = useBase()
const { loadProject } = baseStore
const { base } = storeToRefs(baseStore)

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

  await loadProject(false, baseData.value.base_id)
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
      <img width="50" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
    </a-tooltip>
    <div class="ml-2 font-bold text-gray-500 uppercase">{{ base.title }}</div>
  </div>
  <div class="w-full h-full !p-0">
    <ErdView :source-id="baseData.id" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-erd-histogram.top) {
  display: none;
}
</style>
