<script setup lang="ts">
const props = defineProps<{
  page: 'all' | 'youtube' | 'github' | 'twitter' | 'cloud'
}>()

const emits = defineEmits(['reload'])

const { loadFeed, socialFeed, youtubeFeed, githubFeed, cloudFeed } = useProductFeed()

const triggerReload = async () => {
  if (props.page === 'twitter') {
    emits('reload')
    return
  }

  const data = (await loadFeed({
    type: props.page,
    loadMore: false,
  }))!.filter((item) => item['Feed Source'] !== 'Twitter')

  if (props.page === 'all') {
    socialFeed.value = data
  } else if (props.page === 'youtube') {
    youtubeFeed.value = data
  } else if (props.page === 'github') {
    githubFeed.value = data
  } else if (props.page === 'cloud') {
    cloudFeed.value = data
  }
}
</script>

<template>
  <div class="flex items-center justify-center">
    <div class="w-[696px] error-box gap-6 border-1 border-gray-200 py-6 rounded-xl flex flex-col items-center justify-center">
      <GeneralIcon icon="alertTriangle" class="text-gray-500 w-8 h-8" />
      <span class="text-gray-600 text-base font-semibold"> Unable to load feed </span>

      <NcButton type="secondary" size="small" @click="triggerReload">
        <div class="flex items-center text-gray-700 gap-2">
          <GeneralIcon icon="refreshCw" />
          <span class="text-sm"> Refresh </span>
        </div>
      </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.error-box {
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
}
</style>
