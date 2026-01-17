<script setup lang="ts">
import { FormBuilderValidatorType } from 'nocodb-sdk'
import { FORM_BUILDER_NON_CATEGORIZED, FormBuilderInputType } from '#imports'
const props = defineProps<{
  baseId: string
}>()

const visible = defineModel<boolean>('visible', { required: true })

const { $api } = useNuxtApp()
const { t } = useI18n()

const initialSanboxFormState = ref<Record<string, any>>({
  title: '',
  description: '',
  category: '',
  visibility: 'private',
})

const sandboxForm = reactive({
  title: '',
  description: '',
  category: '',
  visibility: 'private',
})

const { base } = storeToRefs(useBase())

const basesStore = useBases()

const convertToSandbox = async (formState: Record<string, any>) => {
  try {
    const response = await $api.internal.postOperation(
      base.value!.fk_workspace_id as string,
      props.baseId,
      {
        operation: 'sandboxCreate',
      } as any,
      {
        title: formState.title,
        description: formState.description,
        category: formState.category,
        visibility: formState.visibility,
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
  }
}

const { formState, isLoading, submit } = useProvideFormBuilderHelper({
  formSchema: [
    {
      type: FormBuilderInputType.Input,
      label: t('labels.sandboxTitle'),
      span: 24,
      model: 'title',
      placeholder: 'Enter a descriptive title',
      category: FORM_BUILDER_NON_CATEGORIZED,
      validators: [
        {
          type: FormBuilderValidatorType.Required,
          message: t('labels.titleRequired'),
        },
      ],
      required: true,
    },
    {
      type: FormBuilderInputType.Textarea,
      label: t('labels.sandboxDescription'),
      span: 24,
      model: 'description',
      placeholder: "Describe your application's capabilities",
      category: FORM_BUILDER_NON_CATEGORIZED,
    },
    {
      type: FormBuilderInputType.Input,
      label: t('labels.sandboxCategory'),
      span: 12,
      model: 'category',
      placeholder: 'e.g., CRM, HR',
      category: FORM_BUILDER_NON_CATEGORIZED,
    },
    {
      type: FormBuilderInputType.Select,
      label: t('labels.sandboxVisibility'),
      span: 12,
      model: 'visibility',
      category: FORM_BUILDER_NON_CATEGORIZED,
      options: [
        { label: 'Public', value: 'public', icon: 'eye' },
        { label: 'Private', value: 'private', icon: 'lock' },
        { label: 'Unlisted', value: 'unlisted', icon: 'ncEyeOff' },
      ],
      defaultValue: 'private',
    },
  ],
  onSubmit: async () => {
    return await convertToSandbox(formState.value)
  },
  initialState: initialSanboxFormState,
})

watch(visible, (isVisible) => {
  if (isVisible && base.value) {
    formState.value = {
      title: base.value.title || '',
      description: '',
      category: '',
      visibility: 'private',
    }
  }
})
</script>

<template>
  <NcModal v-model:visible="visible" size="medium" centered wrap-class-name="nc-modal-convert-to-sandbox">
    <div class="flex flex-col">
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

        <NcFormBuilder />
      </div>

      <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-nc-border-gray-medium">
        <NcButton size="small" type="secondary" :disabled="isLoading" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton size="small" type="primary" :loading="isLoading" @click="submit">
          <template #icon>
            <GeneralIcon icon="ncBox" />
          </template>
          Convert to sandbox
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
