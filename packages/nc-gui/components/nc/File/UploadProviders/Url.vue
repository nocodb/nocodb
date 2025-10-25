<script setup lang="ts">
import type { PublicAttachmentScope } from 'nocodb-sdk'
import { useUploadState } from './useUploadState'

const { openAttachment } = useAttachment()

const { $api } = useNuxtApp()

const { isLoading, uploadPath, uploadScope, uploadAttachments, closeModal } = useUploadState()

const inputRef = ref<HTMLInputElement | null>(null)

const tempAttachments = ref<
  {
    url?: string
    mimetype: string
    title: string
    path?: string
    size: number
  }[]
>([])

const url = ref('')

const isParsing = ref(false)

const deleteAttachment = (index: number) => {
  tempAttachments.value.splice(index, 1)
}

const isValidUrl = ref(false)

const errorMessage = ref('')

const uploadAndParseUrl = async () => {
  if (!isValidURL(url.value)) {
    isValidUrl.value = false
    return
  }
  isValidUrl.value = true

  try {
    isParsing.value = true
    const data = await $api.storage.uploadByUrl(
      {
        path: uploadPath.value,
        ...(uploadScope.value && { scope: uploadScope.value as PublicAttachmentScope }),
      },
      [{ url: url.value }],
    )

    if (data && Array.isArray(data)) {
      tempAttachments.value = [...data, ...tempAttachments.value]
      url.value = ''
    } else {
      isValidUrl.value = false
      errorMessage.value = 'Failed to upload URL'
    }
  } catch (error: any) {
    isValidUrl.value = false
    errorMessage.value = error.message || 'Failed to upload URL'
  } finally {
    isParsing.value = false
  }

  await nextTick(() => {
    inputRef.value?.focus()
  })
}

const handleUpload = async () => {
  await uploadAttachments(tempAttachments.value)
  tempAttachments.value = []
}

watch(url, () => {
  isValidUrl.value = true
})
</script>

<template>
  <div class="py-2 px-2 h-full flex gap-2 flex-col">
    <div class="flex w-full bg-white border-b-1 py-1 justify-between">
      <h1 class="font-semibold">
        {{ $t('title.uploadViaUrl') }}
      </h1>

      <NcTooltip>
        <NcButton type="secondary" class="!border-0" size="xsmall" @click="closeModal">
          <GeneralIcon icon="close" />
        </NcButton>

        <template #title> {{ $t('general.close') }} </template>
      </NcTooltip>
    </div>

    <div class="flex-grow bg-white">
      <h1 class="text-gray-800 font-semibold">
        {{ $t('labels.addFilesFromUrl') }}
      </h1>
      <div class="flex bg-white gap-2">
        <a-input
          ref="inputRef"
          v-model:value="url"
          type="url"
          :disabled="isParsing"
          class="flex-grow"
          placeholder="www.google.com/hello.png"
          @keydown.enter="uploadAndParseUrl"
        />

        <NcButton :disabled="!isValidUrl" :loading="isParsing" size="small" class="!h-10 !px-4" @click="uploadAndParseUrl">
          {{ $t('general.upload') }}
        </NcButton>
      </div>
      <span v-if="url.length > 0 && !isValidUrl" class="text-red-500 text-[13px]">
        {{ errorMessage.length > 0 ? errorMessage : $t('labels.enterValidUrl') }}
      </span>
      <template v-if="tempAttachments.length > 0">
        <div :style="`height: ${!isValidUrl ? '208px' : '230px'}`" class="overflow-y-auto bg-white mt-1 !max-h-[250px]">
          <h1 class="font-semibold capitalize sticky top-0 bg-white text-gray-800">
            {{ $t('objects.files') }}
          </h1>

          <div
            v-for="(file, index) in tempAttachments"
            :key="index"
            class="flex w-full items-center mt-2 h-10 px-2 py-1 border-1 rounded-md"
          >
            <div class="flex w-full items-center gap-2">
              <GeneralIcon icon="file" />

              {{ file.title }}
              <NcTooltip class="hover:underline">
                <NuxtLink class="flex items-center" target="_blank" @click="openAttachment(file)">
                  <component :is="iconMap.externalLink" class="w-3.5 h-3.5 text-gray-500" />
                </NuxtLink>

                <template #title> {{ $t('labels.openFile') }} </template>
              </NcTooltip>
            </div>

            <div class="flex-grow-1"></div>

            <NcTooltip>
              <template #title> {{ $t('title.removeFile') }} </template>

              <NcButton type="text" size="xsmall" @click="deleteAttachment(index)">
                <GeneralIcon icon="close" />
              </NcButton>
            </NcTooltip>
          </div>
        </div>
      </template>
    </div>

    <div class="flex gap-2 items-center justify-end">
      <NcButton :disabled="isLoading || isParsing" type="secondary" size="small" @click="closeModal">
        {{ $t('labels.cancel') }}
      </NcButton>
      <NcButton :disabled="isLoading || isParsing || tempAttachments.length === 0" size="small" @click="handleUpload">
        {{ $t('activity.addFiles') }}
      </NcButton>
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
