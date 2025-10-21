<script setup lang="ts">
import { useUploadState } from './useUploadState'

interface Props {
  uploadText?: string
}

withDefaults(defineProps<Props>(), {
  uploadText: undefined,
})

const { isLoading, tempFiles, upload, closeModal } = useUploadState()

const { t } = useI18n()

const defaultUploadText = computed(() => {
  if (tempFiles.value.length > 0) {
    return `${t('general.upload')} ${tempFiles.value.length} ${t('objects.files')}`
  }
  return t('general.upload')
})
</script>

<template>
  <div class="flex gap-2 pt-2 bg-white w-full items-center justify-end">
    <NcButton :disabled="isLoading" type="secondary" size="small" @click="closeModal">
      {{ $t('labels.cancel') }}
    </NcButton>

    <NcButton :loading="isLoading" :disabled="tempFiles.length === 0 || isLoading" size="small" @click="upload">
      <template v-if="isLoading">
        {{ $t('labels.uploading') }}
      </template>
      <template v-else>
        {{ uploadText || defaultUploadText }}
      </template>
    </NcButton>
  </div>
</template>
