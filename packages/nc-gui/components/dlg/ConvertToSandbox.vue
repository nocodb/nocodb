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
  <NcModal
    v-model:visible="visible"
    size="sm"
    height="auto"
    centered
    wrap-class-name="nc-modal-convert-to-sandbox "
    nc-modal-class-name="!p-0"
  >
    <div class="p-4 w-full flex items-center gap-3 border-b border-nc-border-gray-medium">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
        <GeneralIcon icon="ncBox" class="w-5 h-5 text-white" />
      </div>
      <div class="flex-1">
        <div class="font-semibold text-lg text-nc-content-gray-emphasis">Convert to Sandbox</div>
        <div class="text-xs text-nc-content-gray-subtle2">{{ $t('labels.publishToAppStore') }}</div>
      </div>

      <NcButton size="small" type="text" class="self-start" @click="visible = false">
        <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
      </NcButton>
    </div>

    <div class="flex-1 p-6 nc-scrollbar-thin">
      <NcFormBuilder>
        <template #header>
          <NcAlert
            type="info"
            align="top"
            description="Convert this base into a living application that can be published to the App Store. You'll be able to manage versions and push updates to all installations."
            class="!p-3 !items-start bg-nc-bg-blue-light border-1 !border-nc-blue-200 rounded-lg p-3 mb-4"
          >
            <template #icon>
              <GeneralIcon icon="info" class="w-4 h-4 mt-0.5 text-nc-content-blue-dark flex-none" />
            </template>
          </NcAlert>
        </template>
      </NcFormBuilder>
    </div>

    <div class="flex justify-end gap-2 px-4 py-3 border-t border-nc-border-gray-medium">
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
  </NcModal>
</template>

<style lang="scss">
.nc-modal-convert-to-sandbox {
  .nc-modal {
    max-height: min(90vh, 540px) !important;
    height: min(90vh, 540px) !important;
  }
}
</style>
