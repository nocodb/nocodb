<script setup lang="ts">
const props = defineProps<{
  page: 'all' | 'youtube' | 'github' | 'twitter' | 'cloud'
}>()

const emits = defineEmits(['reload'])

const { loadFeed } = useProductFeed()

const triggerReload = async () => {
  if (props.page === 'twitter') {
    emits('reload')
    return
  }

  await loadFeed({
    type: props.page,
    loadMore: false,
  })
}
</script>

<template>
  <div class="flex items-center justify-center">
    <div
      class="w-[696px] error-box gap-6 border-1 border-nc-border-gray-medium py-6 rounded-xl flex flex-col items-center justify-center"
    >
      <GeneralIcon icon="alertTriangle" class="text-nc-content-gray-muted w-8 h-8" />
      <span class="text-nc-content-gray-subtle2 text-base font-semibold"> {{ $t('msg.error.unableToLoadFeed') }} </span>

      <NcButton type="secondary" size="small" @click="triggerReload">
        <div class="flex items-center text-nc-content-gray-subtle gap-2">
          <GeneralIcon icon="refreshCw" />
          <span class="text-sm"> {{ $t('general.refresh') }} </span>
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
