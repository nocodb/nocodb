<script lang="ts" setup>
import axios from 'axios'
import type { CustomUrlType, StringOrNullType } from 'nocodb-sdk'

interface Props {
  /**
   * The unique identifier for the custom URL.
   */
  id?: StringOrNullType
  /**
   * The base URL of the backend.
   */
  backendUrl: string
  /**
   * The search query to be appended to the custom URL.
   */
  searchQuery?: string
  /**
   * The tooltip text to be displayed.
   */
  tooltip?: string
  /**
   * A function to copy the custom URL to the clipboard.
   *
   * @param customUrl The custom URL to be copied.
   * @returns A promise that resolves to a boolean indicating whether the copy operation was successful.
   */
  copyCustomUrl: (customUrl: string) => Promise<boolean>
}

const props = withDefaults(defineProps<Props>(), {
  backendUrl: '',
  searchQuery: '',
  tooltip: '',
})

const emits = defineEmits(['updateCustomUrl'])

const { id, backendUrl, searchQuery, tooltip } = toRefs(props)

const isLocked = inject(IsLockedInj, ref(false))

const { t } = useI18n()

const { api } = useApi()

const { showShareModal } = storeToRefs(useShare())

const isLoading = ref({
  customUrl: false,
  fetchCustomUrl: false,
  checkAvailability: false,
})

const customUrlInputRef = ref()

const customUrlLocal = ref()

const customUrl = ref()

const isOpenCustomUrlLocal = ref(false)

const isCopied = ref(false)

const isFocused = ref(false)

const isCustomUrlAvailable = ref(true)

const isOpenCustomUrl = computed(() => {
  return !!customUrl.value || !!customUrlLocal.value || isOpenCustomUrlLocal.value
})

const showAvailableStatus = computed(() => {
  return (
    customUrl.value &&
    customUrl.value !== customUrlLocal.value &&
    !isLoading.value.checkAvailability &&
    isCustomUrlAvailable.value
  )
})

const copyCustomUrl = async () => {
  if (!customUrl.value || (customUrl.value && customUrl.value !== customUrlLocal.value)) return

  isCopied.value = false

  await props.copyCustomUrl(customUrl.value)

  isCopied.value = true

  await ncDelay(5000)

  isCopied.value = false
}

const toggleCustomUrl = async () => {
  isOpenCustomUrlLocal.value = !isOpenCustomUrl.value

  if (isLoading.value.customUrl) return

  isCustomUrlAvailable.value = true

  isLoading.value.customUrl = true
  try {
    if (!isOpenCustomUrlLocal.value) {
      customUrl.value = null
      customUrlLocal.value = null
      emits('updateCustomUrl', null)
    }
  } finally {
    isLoading.value.customUrl = false

    if (isOpenCustomUrlLocal.value) {
      ncDelay(250).then(() => {
        customUrlInputRef.value?.focus()
      })
    }
  }
}

const validation = computed(() => {
  if (!customUrl.value) {
    return null // No input, no unsupported characters
  }

  const unsupportedChars = ['/', '#', '?'].filter((char) => {
    if (customUrl.value && customUrl.value.includes(char)) {
      return true
    }

    return false
  })

  const maxLengthError = `${customUrl.value || ''}`.length > 128

  return {
    hasError: !!unsupportedChars.length || maxLengthError,
    msg: maxLengthError
      ? t('msg.info.valueMustBeAtMostCharLong', {
          length: 128,
        })
      : unsupportedChars.length
      ? t(`${unsupportedChars.length === 1 ? 'msg.error.unsupportedCharacter' : 'msg.error.unsupportedCharacters'}`, {
          char: unsupportedChars.join(', '),
        })
      : null,
  }
})

const handleUpdateCustomUrl = () => {
  if (isLoading.value.checkAvailability) return

  emits('updateCustomUrl', customUrl.value?.trim() || null)

  isCopied.value = false

  customUrlLocal.value = customUrl.value?.trim() || null
}

const controller = ref() // A ref to manage the CancelToken source for Axios requests.

const checkAvailability = async () => {
  // Cancel any ongoing request before starting a new one
  if (controller.value) {
    controller.value.cancel() // Cancels the previous request to prevent overlapping calls.
  }

  const CancelToken = axios.CancelToken // Axios CancelToken utility.
  controller.value = CancelToken.source() // Create a new token source for the current request.

  try {
    // Make the API call to check the custom URL's availability

    const res = await api.customUrl.checkAvailability(
      {
        id: id.value || undefined,
        custom_path: customUrl.value?.trim(),
      },
      {
        cancelToken: controller.value.token,
      },
    )

    // Update the availability status based on the response
    isCustomUrlAvailable.value = res === true

    isLoading.value.checkAvailability = false
  } catch (e: any) {
    // Ignore errors caused by request cancellation
    if (e?.code === 'ERR_CANCELED') return

    isCustomUrlAvailable.value = false

    isLoading.value.checkAvailability = false

    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const checkAvailabilityWithDebounce = useDebounceFn(
  async () => {
    await checkAvailability()
  },
  1000,
  { maxWait: 5000 },
)

const onChangeCustomUrl = (value: string) => {
  customUrl.value = value
  isLoading.value.checkAvailability = true // Set the loading state for this operation.

  checkAvailabilityWithDebounce()
}

const fetchCustomUrl = async () => {
  if (!id.value) return

  isLoading.value.fetchCustomUrl = true

  try {
    const res = (await api.customUrl.getById(id.value)) as CustomUrlType

    if (res?.custom_path) {
      customUrl.value = res.custom_path
      customUrlLocal.value = res.custom_path
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value.fetchCustomUrl = false
  }
}

watch(
  showShareModal,
  (newValue) => {
    if (!newValue) {
      if (isOpenCustomUrl.value && customUrl.value) {
        customUrl.value = null
        customUrlLocal.value = null

        isOpenCustomUrlLocal.value = false
      }
      isCustomUrlAvailable.value = true

      return
    }

    fetchCustomUrl()
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-gray-50 rounded-md">
    <div class="flex flex-row items-center justify-between">
      <div class="flex text-black items-center gap-1">
        {{ $t('title.customUrl') }}
        <NcTooltip v-if="tooltip" class="flex items-center">
          <template #title>
            <div class="text-center">
              {{ tooltip }}
            </div>
          </template>
          <GeneralIcon icon="info" class="flex-none text-gray-400 cursor-pointer"></GeneralIcon>
        </NcTooltip>
      </div>
      <a-switch
        v-e="['c:share:view:custom-url:toggle']"
        :checked="isOpenCustomUrl"
        :loading="isLoading.customUrl || isLoading.fetchCustomUrl"
        :disabled="isLocked || isLoading.fetchCustomUrl"
        class="share-custom-url-toggle !mt-0.25"
        data-testid="share-custom-url-toggle"
        size="small"
        @click="toggleCustomUrl"
      />
    </div>
    <Transition mode="out-in" name="layout">
      <div v-if="isOpenCustomUrl">
        <div
          class="flex items-center mt-2 p-1.5 pl-2 h-11 w-full border-1 rounded-md transition-all duration-300 border-1"
          :class="{
            'focus-within:(border-nc-border-brand shadow-selected)': isCustomUrlAvailable && !validation?.hasError,
            'focus-within:(border-error shadow-error)': !isCustomUrlAvailable || validation?.hasError,
          }"
        >
          <div
            class="text-nc-content-gray-muted whitespace-nowrap"
            :class="{
              'cursor-pointer': customUrl && customUrl === customUrlLocal,
            }"
            @click="copyCustomUrl"
          >
            {{ backendUrl }}/p/
          </div>
          <a-input
            ref="customUrlInputRef"
            :value="isFocused ? `${customUrl || ''}` : `${customUrl || ''}${searchQuery}`"
            placeholder="Enter custom url"
            class="!rounded-lg h-full !pl-0"
            data-testid="nc-modal-share-view__custom-url"
            :bordered="false"
            autocomplete="off"
            @focus="isFocused = true"
            @blur="isFocused = false"
            @update:value="onChangeCustomUrl"
            :disabled="isLocked"
          />
          <div>
            <div
              v-if="customUrl && customUrl === customUrlLocal"
              class="nc-copy-custom-url"
              data-testid="docs-share-page-copy-link"
              @click="copyCustomUrl"
            >
              <MdiCheck v-if="isCopied" class="h-3.5" />
              <MdiContentCopy v-else class="h-3.5" />
              <div class="flex text-xs whitespace-nowrap" :style="{ fontWeight: 500 }">
                <template v-if="isCopied"> {{ $t('activity.copiedLink') }} </template>
                <template v-else> {{ $t('activity.copyUrl') }} </template>
              </div>
            </div>
            <NcButton
              v-else
              size="xs"
              :disabled="!customUrl || (!isLoading.checkAvailability && !isCustomUrlAvailable) || !!validation?.hasError"
              class="!rounded-md !h-7.5"
              :class="{
                '!cursor-wait': isLoading.checkAvailability,
              }"
              @click.stop="handleUpdateCustomUrl"
            >
              {{ $t('general.save') }}
            </NcButton>
          </div>
        </div>
        <div v-if="isLoading.checkAvailability" class="text-small mt-2 flex items-center gap-1.5 text-nc-content-gray-subtle">
          <div class="h-4 w-4 flex items-center justify-center">
            <GeneralLoader size="small" class="!bg-inherit !text-inherit" />
          </div>
          {{ $t('title.checkingUrlAvailability') }}..
        </div>
        <div
          v-else-if="!isCustomUrlAvailable || validation?.hasError"
          class="text-small mt-2 text-nc-content-red-medium flex items-center gap-1.5"
        >
          <GeneralIcon icon="info" class="h-4 w-4" />
          {{ validation?.hasError ? validation.msg : $t('title.thisUrlIsUnavailable') }}
        </div>

        <div v-else-if="showAvailableStatus" class="text-small mt-2 flex items-center gap-1.5 text-nc-content-green-dark">
          <div class="h-4 w-4 flex items-center justify-center">
            <GeneralIcon icon="ncCheckCircle" class="flex-none w-3.5 h-3.5" />
          </div>
          {{ $t('title.thisUrlIsAvailable') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.nc-copy-custom-url {
  @apply flex flex-row py-1.5 px-1.5 bg-white hover:bg-gray-100 cursor-pointer rounded-md border-1 border-gray-100 gap-x-1 items-center shadow-sm text-nc-content-gray-subtle2;
}
</style>
