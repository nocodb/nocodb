<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({
  public: true,
  requiresAuth: false,
})

const route = useRoute()

const { appInfo } = useGlobal()

const { isDark } = useTheme()

const { isWhiteLabelled, productName, logoUrl, logoDarkUrl, faviconUrl } = useBranding()

const baseStore = useBase()
const { loadProject } = baseStore
const { base } = storeToRefs(baseStore)

useMetas()

const baseData = ref({} as any)

const { $api } = useNuxtApp()

const brandIcon = computed(() => {
  if (!isWhiteLabelled.value) return null
  return faviconUrl.value || (isDark.value ? logoDarkUrl.value || logoUrl.value : logoUrl.value)
})

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
      <img v-if="brandIcon" width="50" :alt="productName" :src="brandIcon" class="object-contain" />
      <img v-else width="50" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
    </a-tooltip>
    <div class="ml-2 font-bold text-nc-content-gray-muted uppercase">{{ base.title }}</div>
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
