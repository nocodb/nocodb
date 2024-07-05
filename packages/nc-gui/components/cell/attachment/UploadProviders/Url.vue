<script setup lang="ts">
import { useAttachmentCell } from '../utils'

const emits = defineEmits<{
  'update:visible': [value: boolean]
  'upload': [fileList: File[]]
}>()

const { onDrop: saveAttachment, uploadViaUrl } = useAttachmentCell()!

const closeMenu = () => {
  emits('update:visible', false)
}

const url = ref('')

const uploadAndParseUrl = async () => {
  const data = await uploadViaUrl({ url: url.value })

  console.log(data)
}
</script>

<template>
  <div class="py-2 pr-2 h-full flex gap-2 flex-col">
    <div class="flex w-full bg-white border-b-1 py-1 justify-between">
      <h1>Link (URL)</h1>

      <NcButton type="secondary" class="!border-0" size="xsmall" @click="closeMenu">
        <GeneralIcon icon="close" />
      </NcButton>
    </div>

    <div class="flex-grow">
      <div class="flex gap-2">
        <a-input v-model:value="url" class="flex-grow" placeholder="www.google.com/hello.png" />

        <NcButton size="small" class="!h-10 !px-4" @click="uploadAndParseUrl"> Upload </NcButton>
      </div>
    </div>

    <div class="flex gap-2 items-center justify-end">
      <NcButton type="secondary" size="small" @click="closeMenu"> Cancel </NcButton>
      <NcButton size="small"> Add files </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
