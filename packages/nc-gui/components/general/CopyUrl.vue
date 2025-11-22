<script lang="ts" setup>
const props = defineProps<{
  url: string
}>()

const emits = defineEmits(['update:url'])

const url = useVModel(props, 'url', emits)

const isCopied = ref({
  link: false,
  embed: false,
})

const { copy } = useCopy()

const openUrl = async () => {
  window.open(url.value, '_blank', 'noopener,noreferrer')
}

const embedHtml = async () => {
  await copy(`<iframe src="${url.value}" width="100%" height="100%" style="border: none;"></iframe>`)
  isCopied.value.embed = true
}

const copyUrl = async () => {
  isCopied.value.link = false

  await copy(url.value)
  isCopied.value.link = true

  setTimeout(() => {
    isCopied.value.link = false
  }, 5000)
}
</script>

<template>
  <div
    class="flex flex-row items-center justify-end text-nc-content-gray-subtle2 gap-x-1.5 py-1.5 px-1.5 bg-nc-bg-gray-extralight rounded-md border-1 border-nc-border-gray-medium"
  >
    <div class="flex flex-row block flex-1 overflow-hidden pl-3 cursor-pointer" @click="copyUrl">
      <div class="overflow-hidden whitespace-nowrap text-nc-content-gray-muted">{{ url }}</div>
    </div>
    <div class="flex flex-row gap-x-1">
      <NcTooltip>
        <template #title>
          {{ $t('activity.openInANewTab') }}
        </template>

        <div class="button" @click="openUrl">
          <RiExternalLinkLine class="h-3.75" />
        </div>
      </NcTooltip>
      <NcTooltip>
        <template #title>
          {{ $t('activity.copyIFrameCode') }}
        </template>
        <div
          class="button"
          :class="{
            '!text-nc-content-brand-hover !border-nc-border-gray-medium !cursor-not-allowed': isCopied.embed,
          }"
          @click="embedHtml"
        >
          <MdiCodeTags class="h-4" />
        </div>
      </NcTooltip>
      <div class="button" data-testid="docs-share-page-copy-link" @click="copyUrl">
        <MdiCheck v-if="isCopied.link" class="h-3.5" />
        <MdiContentCopy v-else class="h-3.5" />
        <div class="flex text-xs" :style="{ fontWeight: 500 }">
          <template v-if="isCopied.link"> {{ $t('activity.copiedLink') }} </template>
          <template v-else> {{ $t('activity.copyUrl') }} </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.button {
  @apply flex flex-row py-1.5 px-1.5 bg-nc-bg-default hover:bg-nc-bg-gray-light cursor-pointer rounded-md border-1 border-nc-border-gray-light gap-x-1 items-center shadow-sm;
}
</style>
