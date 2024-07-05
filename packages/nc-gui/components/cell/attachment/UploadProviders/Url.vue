<script setup lang="ts">
import { useAttachmentCell } from '../utils'

const emits = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { openAttachment } = useAttachment()

const { uploadViaUrl, updateModelValue } = useAttachmentCell()!

const closeMenu = () => {
  emits('update:visible', false)
}

const tempAttachments = ref<
  {
    url?: string
    mimetype: string
    title: string
    path?: string
    size: number
  }[]
>([])

const onSave = async () => {
  await updateModelValue(tempAttachments.value)
  closeMenu()
}

const url = ref('')

const isParsing = ref(false)

const deleteAttachment = (index: number) => {
  tempAttachments.value.splice(index, 1)
}

const uploadAndParseUrl = async () => {
  try {
    isParsing.value = true
    const data = await uploadViaUrl({ url: url.value })

    if (data?.length) {
      tempAttachments.value.push(...data)
    } else {
      console.error('Error uploading via URL')
    }
  } finally {
    isParsing.value = false
  }
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
      <h1 class="text-gray-800 font-semibold">Add files from URL</h1>
      <div class="flex gap-2">
        <a-input v-model:value="url" :disabled="isParsing" class="flex-grow" placeholder="www.google.com/hello.png" />

        <NcButton :loading="isParsing" size="small" class="!h-10 !px-4" @click="uploadAndParseUrl"> Upload </NcButton>
      </div>
      <div v-if="tempAttachments.length > 0" class="overflow-y-auto mt-2">
        <h1 class="font-semibold text-gray-800">Files</h1>

        <div
          v-for="(file, index) in tempAttachments"
          :key="index"
          class="flex w-full items-center mt-2 h-10 px-2 py-1 border-1 rounded-md"
        >
          <div class="flex w-full items-center gap-2">
            <GeneralIcon icon="file" />

            <NuxtLink target="_blank" @click="openAttachment(file)">
              {{ file.title }}
            </NuxtLink>
          </div>

          <div class="flex-grow-1"></div>

          <NcTooltip>
            <template #title> Remove file </template>

            <NcButton type="text" size="xsmall" @click="deleteAttachment(index)">
              <GeneralIcon icon="close" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>
    </div>

    <div class="flex gap-2 items-center justify-end">
      <NcButton :disabled="isParsing" type="secondary" size="small" @click="closeMenu"> Cancel </NcButton>
      <NcButton :disabled="isParsing || tempAttachments.length === 0" size="small" @click="onSave"> Add files </NcButton>
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
a {
  @apply !text-gray-700 !no-underline !hover:underline;
}
</style>
