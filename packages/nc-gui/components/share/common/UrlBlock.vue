<script lang="ts" setup>
interface Props {
  url: string
}

const props = defineProps<Props>()

const { copy } = useCopy()

const isCopied = ref(false)

const onCopy = async () => {
  if (!props.url) return
  await copy(props.url)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}
</script>

<template>
  <div class="px-3 py-2">
    <div
      class="nc-share-url-block flex items-center h-8 pr-1 pl-3 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg shadow-default hover:border-nc-border-gray-dark transition-colors"
    >
      <div class="flex-1 min-w-0 text-bodySm text-nc-content-gray-subtle truncate cursor-pointer" :title="url" @click="onCopy">
        {{ url }}
      </div>
      <NcButton
        v-e="['c:share:copy-url']"
        size="xsmall"
        type="secondary"
        data-testid="nc-share-copy-url"
        class="!h-6 !px-2 !text-bodySm"
        @click="onCopy"
      >
        {{ isCopied ? $t('activity.copiedLink') : $t('activity.copyLink') }}
      </NcButton>
    </div>
  </div>
</template>
