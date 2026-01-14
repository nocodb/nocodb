<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const visible = defineModel<boolean>('visible', { required: true })

const { $api } = useNuxtApp()
const { t } = useI18n()

const isLoading = ref(false)
const sandboxForm = reactive({
  title: '',
  description: '',
  category: '',
  visibility: 'private',
})

const { base } = storeToRefs(useBase())

const basesStore = useBases()

watch(visible, (isVisible) => {
  if (isVisible && base.value) {
    sandboxForm.title = base.value.title || ''
    sandboxForm.description = ''
    sandboxForm.category = ''
    sandboxForm.visibility = 'private'
  }
})

const convertToSandbox = async () => {
  if (!sandboxForm.title?.trim()) {
    message.error(t('msg.error.titleRequired'))
    return
  }

  isLoading.value = true
  try {
    const response = await $api.internal.postOperation(
      base.value.fk_workspace_id,
      props.baseId,
      {
        operation: 'sandboxCreate',
      } as any,
      {
        title: sandboxForm.title,
        description: sandboxForm.description,
        category: sandboxForm.category,
        visibility: sandboxForm.visibility,
      },
    )

    message.success(t('msg.success.sandboxCreated'))
    visible.value = false

    // Update the base with the sandbox_id from response
    if (response && response.sandbox_id) {
      const currentBase = basesStore.bases.get(props.baseId)
      if (currentBase) {
        ;(currentBase as any).sandbox_id = response.sandbox_id
      }
    }

    // Reload base to ensure all sandbox data is loaded
    await basesStore.loadProject(props.baseId, true)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralModal v-model:visible="visible" size="medium" centered>
    <div class="flex flex-col p-6">
      <div class="flex items-center gap-3 pb-4 mb-4 border-b border-nc-border-gray-medium">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
          <GeneralIcon icon="ncBox" class="w-5 h-5 text-white" />
        </div>
        <div>
          <div class="font-semibold text-lg text-nc-content-gray-emphasis">Convert to Sandbox</div>
          <div class="text-xs text-nc-content-gray-subtle2">{{ $t('labels.publishToAppStore') }}</div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="bg-nc-bg-blue-light border border-nc-border-blue rounded-lg p-3 mb-4">
          <div class="flex gap-2 text-sm text-nc-content-gray">
            <GeneralIcon icon="info" class="w-4 h-4 text-nc-content-blue-dark mt-0.5 flex-shrink-0" />
            <div>
              Convert this base into a living application that can be published to the App Store. You'll be able to manage
              versions and push updates to all installations.
            </div>
          </div>
        </div>

        <div>
          <label class="text-nc-content-gray text-sm font-medium mb-2 block">
            {{ $t('labels.sandboxTitle') }} <span class="text-nc-content-red-dark">*</span>
          </label>
          <a-input v-model:value="sandboxForm.title" placeholder="Enter a descriptive title" size="large" class="rounded-lg" />
        </div>

        <div>
          <label class="text-nc-content-gray text-sm font-medium mb-2 block">
            {{ $t('labels.sandboxDescription') }}
          </label>
          <a-textarea
            v-model:value="sandboxForm.description"
            placeholder="Describe your application's capabilities"
            :rows="3"
            size="large"
            class="rounded-lg"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxCategory') }}
            </label>
            <a-input v-model:value="sandboxForm.category" placeholder="e.g., CRM, HR" size="large" class="rounded-lg" />
          </div>

          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxVisibility') }}
            </label>
            <a-select v-model:value="sandboxForm.visibility" size="large" class="w-full rounded-lg">
              <a-select-option disabled value="public">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="eye" class="w-4 h-4" />
                  <span>Public</span>
                </div>
              </a-select-option>
              <a-select-option value="private">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="lock" class="w-4 h-4" />
                  <span>Private</span>
                </div>
              </a-select-option>
              <a-select-option value="unlisted">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncEyeOff" class="w-4 h-4" />
                  <span>Unlisted</span>
                </div>
              </a-select-option>
            </a-select>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-nc-border-gray-medium">
        <NcButton size="medium" type="secondary" :disabled="isLoading" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton size="medium" type="primary" :loading="isLoading" @click="convertToSandbox">
          <template #icon>
            <GeneralIcon icon="ncBox" />
          </template>
          Convert to sandbox
        </NcButton>
      </div>
    </div>
  </GeneralModal>
</template>
