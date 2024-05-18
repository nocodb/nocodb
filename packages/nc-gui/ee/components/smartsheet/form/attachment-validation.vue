<script setup lang="ts">
import { AttachmentValidationType, type FileSizeValidation, type Validation } from 'nocodb-sdk'

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const isEnabled = computed(() => {
  const result = {
    fileTypes: false,
    fileCount: false,
    fileSize: false,
  }
  if (!activeField.value) {
    return result
  }

  ;((activeField.value.meta.validators || []) as Validation[]).forEach((v) => {
    if (v.type === AttachmentValidationType.FileTypes) {
      result.fileTypes = true
    }
    if (v.type === AttachmentValidationType.FileCount) {
      result.fileCount = true
    }
    if (v.type === AttachmentValidationType.FileSize) {
      result.fileSize = true
    }
  })

  return result
})

const getFileTypesValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === AttachmentValidationType.FileTypes
  })
})

const getFileCountValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === AttachmentValidationType.FileCount
  })
})

const getFileSizeValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === AttachmentValidationType.FileSize
  }) as FileSizeValidation
})

const addPlaceholderValidators = (value, type: AttachmentValidationType) => {
  if (!activeField.value) return

  if (value) {
    activeField.value.meta.validators = [
      ...(activeField.value.meta.validators || []),
      {
        type,
        value: null,
        message: '',
        ...(type === AttachmentValidationType.FileSize ? { unit: 'KB' } : {}),
      },
    ]
  } else {
    activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
      return val.type !== type
    })
    updateColMeta(activeField.value)
  }
}
</script>

<template v-if="activeField">
  <div class="w-full flex items-start justify-between gap-3">
    <div class="flex-1 max-w-[calc(100%_-_40px)]">
      <div class="font-medium text-gray-800 flex items-center gap-2">
        <div
          class="cursor-pointer select-none"
          @click="addPlaceholderValidators(!isEnabled.fileTypes, AttachmentValidationType.FileTypes)"
        >
          Limit file type
        </div>
      </div>
      <div class="text-gray-500 mt-1">
        Manage user file uploads by specifying permitted MIME types.
        <template v-if="isEnabled.fileTypes">
          <br /><br />
          <b>Example:</b> <br />
          <b>image/png</b>: Allows PNG images only <br />
          <b>application/pdf</b>: Allows PDF documents only <b>image/*</b>: Allows all images <br /><br />
          Find MIME types for different file formats
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types"
            target="_blank"
            rel="noopener noreferrer"
            >here</a
          >. <br />
          <b> Note:</b> Use commas to separate MIME types
        </template>
      </div>

      <div v-if="isEnabled.fileTypes" class="mt-3 flex flex-col gap-1">
        <LazySmartsheetFormValidationInput
          v-if="getFileTypesValidator"
          :column="activeField"
          :validator="getFileTypesValidator"
          placeholder="image/jpg, video/mp4, text/plain "
          @update-validation-value="updateColMeta(activeField)"
        >
        </LazySmartsheetFormValidationInput>
        <LazySmartsheetFormValidationInputError :type="AttachmentValidationType.FileTypes" />
      </div>
    </div>

    <a-switch
      :checked="isEnabled.fileTypes"
      size="small"
      class="flex-none nc-form-switch-focus"
      @change="addPlaceholderValidators($event, AttachmentValidationType.FileTypes)"
    />
  </div>
  <div class="w-full flex items-start justify-between gap-3">
    <div class="flex-1 max-w-[calc(100%_-_40px)]">
      <div
        class="font-medium text-gray-800 cursor-pointer select-none"
        @click="addPlaceholderValidators(!isEnabled.fileCount, AttachmentValidationType.FileCount)"
      >
        Limit number of files
      </div>
      <div class="text-gray-500 mt-1">Limit the number of files that can be uploaded.</div>

      <div v-if="isEnabled.fileCount" class="mt-3 flex flex-col gap-1">
        <LazySmartsheetFormValidationInput
          v-if="getFileCountValidator"
          :column="activeField"
          :validator="getFileCountValidator"
          @update-validation-value="updateColMeta(activeField)"
        >
          <template #prefix> Maximum</template>
        </LazySmartsheetFormValidationInput>
        <LazySmartsheetFormValidationInputError :type="AttachmentValidationType.FileCount" />
      </div>
    </div>

    <a-switch
      :checked="isEnabled.fileCount"
      size="small"
      class="flex-none nc-form-switch-focus"
      @change="addPlaceholderValidators($event, AttachmentValidationType.FileCount)"
    />
  </div>
  <div class="w-full flex items-start justify-between gap-3">
    <div class="flex-1 max-w-[calc(100%_-_40px)]">
      <div
        class="font-medium text-gray-800 cursor-pointer select-none"
        @click="addPlaceholderValidators(!isEnabled.fileSize, AttachmentValidationType.FileSize)"
      >
        Limit files size
      </div>
      <div class="text-gray-500 mt-1">Limit the size of files that can be uploaded. (Limit per file)</div>

      <div>
        <div v-if="isEnabled.fileSize" class="mt-3 flex gap-2">
          <LazySmartsheetFormValidationInput
            v-if="getFileSizeValidator"
            :column="activeField"
            :validator="getFileSizeValidator"
            @update-validation-value="updateColMeta(activeField)"
          >
          </LazySmartsheetFormValidationInput>

          <NcSelect
            v-model:value="getFileSizeValidator.unit"
            class="!w-[96px]"
            :options="['KB', 'MB'].map((o) => ({ label: o, value: o }))"
          />
        </div>
        <LazySmartsheetFormValidationInputError :type="AttachmentValidationType.FileSize" />
      </div>
    </div>

    <a-switch
      :checked="isEnabled.fileSize"
      size="small"
      class="flex-none nc-form-switch-focus"
      @change="addPlaceholderValidators($event, AttachmentValidationType.FileSize)"
    />
  </div>
</template>
